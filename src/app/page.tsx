'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import VideoCard from '@/components/VideoCard';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import AnnouncementModal from '@/components/AnnouncementModal';
import CourseDetailModal from '@/components/CourseDetailModal';
import { Button } from '@/components/ui/button';
import {
  PlayCircle,
  Loader2,
  Video as VideoIconLucideSvg,
  AlertTriangle,
  Mic,
  MicOff,
  PhoneOff,
  VideoOff as VideoOffIcon,
  VolumeX,
  Volume2
} from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import { cn } from '@/lib/utils';
import type {
  Video,
  SiteSettings,
  ExchangeRates,
  Announcement,
  HeroTaglineSize,
  SessionUserProfile
} from '@/lib/types';

const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function HomePage() {
  const {
    t,
    siteSettings,
    isLoadingSettings: isLoadingSiteSettings,
    displayCurrency,
    exchangeRates: contextExchangeRates
  } = useTranslation();
  const { toast } = useToast();

  // --- Socket & General Stream State ---
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isGeneralStreamLive, setIsGeneralStreamLive] = useState(false);
  const [generalStreamTitle, setGeneralStreamTitle] = useState('');
  const [generalStreamSubtitle, setGeneralStreamSubtitle] = useState('');
  const [currentGeneralStreamIsLoggedInOnly, setCurrentGeneralStreamIsLoggedInOnly] = useState(false);
  const generalStreamVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionForGeneralStreamRef = useRef<RTCPeerConnection | null>(null);
  const [generalStreamWebRtcError, setGeneralStreamWebRtcError] = useState<string | null>(null);
  const [generalStreamReceived, setGeneralStreamReceived] = useState<MediaStream | null>(null);
  const [isGeneralStreamMuted, setIsGeneralStreamMuted] = useState(true);
  const [isLoadingGeneralStream, setIsLoadingGeneralStream] = useState(false);
  const [currentBroadcasterId, setCurrentBroadcasterId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // --- Logged-in User State ---
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<SessionUserProfile | null>(null);

  // --- Private Call State ---
  const [isUserInPrivateCall, setIsUserInPrivateCall] = useState(false);
  const [privateCallAdminSocketId, setPrivateCallAdminSocketId] = useState<string | null>(null);
  const [userLocalStreamForCall, setUserLocalStreamForCall] = useState<MediaStream | null>(null);
  const [adminStreamForCall, setAdminStreamForCall] = useState<MediaStream | null>(null);
  const privateCallMainVideoRef = useRef<HTMLVideoElement | null>(null);
  const privateCallUserPipVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionForPrivateCallRef = useRef<RTCPeerConnection | null>(null);
  const [privateCallStatusMessage, setPrivateCallStatusMessage] = useState('');
  const [isUserMicMuted, setIsUserMicMuted] = useState(false);
  const [isUserVideoOff, setIsUserVideoOff] = useState(false);
  const [hasCallCameraPermission, setHasCallCameraPermission] = useState<boolean | null>(null);
  const [isLoadingPrivateCallVideo, setIsLoadingPrivateCallVideo] = useState(false);

  // --- Courses + Announcements State ---
  const [videoCourses, setVideoCourses] = useState<Video[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<Video | null>(null);
  const [isVideoPlayerModalOpen, setIsVideoPlayerModalOpen] = useState(false);
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<Video | null>(null);
  const [isCourseDetailModalOpen, setIsCourseDetailModalOpen] = useState(false);

  const [currentExchangeRates, setCurrentExchangeRates] = useState<ExchangeRates | null>(null);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isLoadingAnnouncement, setIsLoadingAnnouncement] = useState(true);

  const effectiveExchangeRates = contextExchangeRates || currentExchangeRates;
  const siteLiveStreamDefaultTitle = siteSettings?.liveStreamDefaultTitle;
  const siteLiveStreamOfflineMessage = siteSettings?.liveStreamOfflineMessage;

  // --- 1) Load User Profile from Session ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedProfile = sessionStorage.getItem('aurum_user_profile');
      if (storedProfile) {
        try {
          const userProfile: SessionUserProfile = JSON.parse(storedProfile);
          setLoggedInUserId(userProfile.id);
          setCurrentUserProfile(userProfile);
        } catch (e) {
          console.error('HomePage: Error parsing user profile from session:', e);
          setLoggedInUserId(null);
          setCurrentUserProfile(null);
        }
      } else {
        setLoggedInUserId(null);
        setCurrentUserProfile(null);
      }
    }
  }, []);

  // --- 2) Sync Site Settings into Exchange Rates and Default Titles ---
  useEffect(() => {
    if (siteSettings) {
      setCurrentExchangeRates(siteSettings.exchangeRates || null);
      if (!isGeneralStreamLive && !isUserInPrivateCall) {
        setGeneralStreamTitle(siteSettings.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
        setGeneralStreamSubtitle(siteSettings.liveStreamSubtitle || '');
      }
    }
  }, [siteSettings, t, isGeneralStreamLive, isUserInPrivateCall]);

  // --- 3) Fetch Video Courses ---
  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const resp = await fetch('/api/video-courses');
        if (!resp.ok) throw new Error('Failed to fetch courses');
        const data: Video[] = await resp.json();
        setVideoCourses(data);
      } catch (error) {
        console.error('HomePage: Error fetching video courses:', error);
        toast({
          title: t('homepage.courses.errorLoadingTitle'),
          description: t('homepage.courses.errorLoadingDescription'),
          variant: 'destructive'
        });
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, [toast, t]);

  // --- 4) Fetch Announcement ---
  const fetchAndShowAnnouncement = useCallback(async () => {
    setIsLoadingAnnouncement(true);
    try {
      if (isLoadingSiteSettings) return;
      const response = await fetch('/api/announcements?activeOnly=true&nonExpiredOnly=true');
      if (!response.ok) return;
      const announcements: Announcement[] = await response.json();
      if (announcements.length > 0) {
        const firstAnn = announcements[0];
        const viewedKey = `announcement_viewed_${firstAnn.id}`;
        if (
          firstAnn.showOnce &&
          typeof window !== 'undefined' &&
          localStorage.getItem(viewedKey) === 'true'
        ) {
          setCurrentAnnouncement(null);
        } else {
          setCurrentAnnouncement(firstAnn);
          setIsAnnouncementModalOpen(true);
        }
      } else {
        setCurrentAnnouncement(null);
      }
    } catch (error) {
      console.error('HomePage: Error fetching announcements:', error);
      setCurrentAnnouncement(null);
    } finally {
      setIsLoadingAnnouncement(false);
    }
  }, [isLoadingSiteSettings]);

  useEffect(() => {
    fetchAndShowAnnouncement();
  }, [fetchAndShowAnnouncement]);

  // --- Handlers to Open Modals ---
  const handleOpenVideoPlayer = (video: Video) => {
    setSelectedVideoForPlayer(video);
    setIsVideoPlayerModalOpen(true);
  };
  const handleOpenCourseDetail = (video: Video) => {
    setSelectedCourseForDetail(video);
    setIsCourseDetailModalOpen(true);
  };
  const handleWatchFromDetailModal = (video: Video) => {
    setIsCourseDetailModalOpen(false);
    handleOpenVideoPlayer(video);
  };

  // --- 5) Private Call: Cleanup ---
  const handleEndPrivateCall = useCallback(
    (emitToServer = true, reason = 'User ended call') => {
      console.log(`HomePage: Ending private call. Emit to server: ${emitToServer}. Reason: ${reason}`);
      // Close PeerConnection
      if (peerConnectionForPrivateCallRef.current) {
        peerConnectionForPrivateCallRef.current.close();
        peerConnectionForPrivateCallRef.current = null;
        console.log('HomePage: Closed private call PeerConnection.');
      }
      // Stop local tracks
      if (userLocalStreamForCall) {
        userLocalStreamForCall.getTracks().forEach((track) => track.stop());
        setUserLocalStreamForCall(null);
        console.log('HomePage: Stopped user local tracks for private call.');
      }
      // Clear remote stream
      setAdminStreamForCall(null);
      if (privateCallMainVideoRef.current) privateCallMainVideoRef.current.srcObject = null;
      if (privateCallUserPipVideoRef.current) privateCallUserPipVideoRef.current.srcObject = null;

      // Notify admin if still connected
      if (socket && socket.connected && emitToServer && privateCallAdminSocketId) {
        console.log(`HomePage: Emitting 'user-end-private-call' to admin: ${privateCallAdminSocketId}`);
        socket.emit('user-end-private-call', { adminSocketId: privateCallAdminSocketId });
      }

      // Reset private call state
      setIsUserInPrivateCall(false);
      setPrivateCallAdminSocketId(null);
      setPrivateCallStatusMessage('');
      setIsUserMicMuted(false);
      setIsUserVideoOff(false);
      setHasCallCameraPermission(null);
      setIsLoadingPrivateCallVideo(false);

      // After call, re-register as general viewer
      if (socket && socket.connected) {
        console.log('HomePage: Re-registering as general viewer after ending private call.');
        socket.emit('register-general-viewer');
      }
    },
    [socket, privateCallAdminSocketId, userLocalStreamForCall]
  );

  // --- 6) Main Socket Connection Logic ---
  useEffect(() => {
    if (isLoadingSiteSettings) {
      // If no settings yet, disconnect socket if exists
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Decide whether to connect
    let shouldConnect = false;
    const queryParams: { appUserId?: string } = {};

    if (loggedInUserId) {
      shouldConnect = true;
      queryParams.appUserId = loggedInUserId;
    } else if (siteSettings && !siteSettings.liveStreamForLoggedInUsersOnly) {
      shouldConnect = true;
    } else {
      // Not logged in & stream requires login → disconnect
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsGeneralStreamLive(false);
      setGeneralStreamReceived(null);
      setIsLoadingGeneralStream(false);
      return;
    }

    if (shouldConnect) {
      console.log('HomePage: Initializing socket connection. Query params:', queryParams);

      // 6.A) Create socket with autoConnect: false
      const newSocket = io({
        path: '/api/socket_io',
        autoConnect: false,
        query: queryParams
      });

      // 6.B) Pre‐hook listeners BEFORE socket.connect()

      // --- Connection Events ---
      newSocket.on('connect', onConnect);
      newSocket.on('connect_error', onConnectError);
      newSocket.on('disconnect', onDisconnect);

      // --- General Stream Events ---
      newSocket.on('general-broadcaster-ready', onGeneralBroadcasterReady);
      newSocket.on('general-stream-ended', onGeneralStreamEnded);
      newSocket.on('general-broadcaster-disconnected', onGeneralStreamEnded);
      newSocket.on('offer-from-general-broadcaster', onOfferFromGeneralBroadcaster);
      newSocket.on('candidate-from-general-broadcaster', onCandidateFromGeneralBroadcaster);
      newSocket.on('general-stream-access-denied', onGeneralStreamAccessDenied);

      // --- Private Call Events ---
      newSocket.on('private-call-invite-from-admin', onPrivateCallInviteFromAdmin);
      newSocket.on('private-sdp-offer-received', onPrivateSdpOfferReceived);
      newSocket.on('private-ice-candidate-received', onPrivateIceCandidateReceived);
      newSocket.on('private-call-terminated-by-admin', onPrivateCallTerminatedByAdmin);

      // 6.C) Now connect
      newSocket.connect();
      setSocket(newSocket);

      return () => {
        // Cleanup all listeners and disconnect
        newSocket.off('connect', onConnect);
        newSocket.off('connect_error', onConnectError);
        newSocket.off('disconnect', onDisconnect);

        newSocket.off('general-broadcaster-ready', onGeneralBroadcasterReady);
        newSocket.off('general-stream-ended', onGeneralStreamEnded);
        newSocket.off('general-broadcaster-disconnected', onGeneralStreamEnded);
        newSocket.off('offer-from-general-broadcaster', onOfferFromGeneralBroadcaster);
        newSocket.off('candidate-from-general-broadcaster', onCandidateFromGeneralBroadcaster);
        newSocket.off('general-stream-access-denied', onGeneralStreamAccessDenied);

        newSocket.off('private-call-invite-from-admin', onPrivateCallInviteFromAdmin);
        newSocket.off('private-sdp-offer-received', onPrivateSdpOfferReceived);
        newSocket.off('private-ice-candidate-received', onPrivateIceCandidateReceived);
        newSocket.off('private-call-terminated-by-admin', onPrivateCallTerminatedByAdmin);

        newSocket.disconnect();
      };
    }
  }, [loggedInUserId, siteSettings, isLoadingSiteSettings]);

  // --- 7) Socket Event Handlers ---

  // ** onConnect **
  function onConnect() {
    console.log('HomePage: Socket conectado:', socket?.id);
    if (!isUserInPrivateCall) {
      socket!.emit('register-general-viewer');
      socket!.emit('check-active-broadcast');
    }
  }

  // ** onConnectError **
  function onConnectError(error: Error) {
    console.error('HomePage: Error de conexión socket:', error);
    toast({ variant: 'destructive', title: 'Socket Connection Error', description: error.message });
  }

  // ** onDisconnect **
  function onDisconnect(reason: string) {
    console.log(`HomePage: Socket desconectado. Reason: ${reason}. Stream active: ${isGeneralStreamLive}, In private call: ${isUserInPrivateCall}`);
    if (reason !== 'io client disconnect') {
      toast({ variant: 'destructive', title: 'Socket Disconnected', description: `Reason: ${reason}` });
    }

    // Reset general stream state
    setIsGeneralStreamLive(false);
    setGeneralStreamReceived(null);
    setCurrentGeneralStreamIsLoggedInOnly(false);
    setIsLoadingGeneralStream(false);
    setGeneralStreamWebRtcError(null);
    setCurrentBroadcasterId(null);
    if (peerConnectionForGeneralStreamRef.current) {
      peerConnectionForGeneralStreamRef.current.close();
      peerConnectionForGeneralStreamRef.current = null;
    }

    // If in private call, clean up without notifying server
    if (isUserInPrivateCall) handleEndPrivateCall(false, `Socket disconnected: ${reason}`);
  }

  // ** onGeneralBroadcasterReady **
  function onGeneralBroadcasterReady({
    broadcasterId,
    streamTitle: titleFromServer,
    streamSubtitle: subtitleFromServer,
    isLoggedInOnly
  }: {
    broadcasterId: string;
    streamTitle?: string;
    streamSubtitle?: string;
    isLoggedInOnly?: boolean;
  }) {
    console.log('HomePage: Evento general-broadcaster-ready recibido:', {
      broadcasterId,
      titleFromServer,
      subtitleFromServer,
      isLoggedInOnly
    });

    // 1) Close existing PC if any
    if (
      peerConnectionForGeneralStreamRef.current &&
      peerConnectionForGeneralStreamRef.current.signalingState !== 'closed'
    ) {
      peerConnectionForGeneralStreamRef.current.close();
      peerConnectionForGeneralStreamRef.current = null;
    }

    // 2) Update state
    setCurrentGeneralStreamIsLoggedInOnly(isLoggedInOnly || false);
    setGeneralStreamTitle(titleFromServer || siteSettings?.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    setGeneralStreamSubtitle(subtitleFromServer || siteSettings?.liveStreamSubtitle || '');
    setIsGeneralStreamLive(true);
    setGeneralStreamWebRtcError(null);
    setGeneralStreamReceived(null);
    setIsLoadingGeneralStream(true);
    setCurrentBroadcasterId(broadcasterId);
    setRetryCount(0);

    // 3) Access control: if only for logged in and user not logged in
    if (isLoggedInOnly && !loggedInUserId) {
      toast({
        variant: 'destructive',
        title: t('homepage.live.accessDenied'),
        description: t('homepage.live.accessDeniedDescription')
      });
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          socket!.emit('check-active-broadcast');
        }, 2000);
      }
      setIsLoadingGeneralStream(false);
      return;
    }

    // 4) Always register as viewer
    socket!.emit('register-general-viewer');
  }

  // ** onGeneralStreamEnded **
  function onGeneralStreamEnded() {
    console.log("HomePage: Evento 'general-stream-ended' recibido.");
    if (isUserInPrivateCall) {
      console.log("HomePage: En llamada privada, ignorando 'general-stream-ended'.");
      return;
    }
    setIsGeneralStreamLive(false);
    setGeneralStreamReceived(null);
    setCurrentGeneralStreamIsLoggedInOnly(false);
    setIsLoadingGeneralStream(false);
    setCurrentBroadcasterId(null);
    if (peerConnectionForGeneralStreamRef.current) {
      peerConnectionForGeneralStreamRef.current.close();
      peerConnectionForGeneralStreamRef.current = null;
    }
    setGeneralStreamWebRtcError(null);
    setGeneralStreamTitle(siteSettings?.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    setGeneralStreamSubtitle(siteSettings?.liveStreamSubtitle || '');
  }

  // ** onOfferFromGeneralBroadcaster **
  async function onOfferFromGeneralBroadcaster({
    broadcasterId,
    offer
  }: {
    broadcasterId: string;
    offer: RTCSessionDescriptionInit;
  }) {
    console.log(`HomePage: Evento 'offer-from-general-broadcaster' recibido. BroadcasterId: ${broadcasterId}`);

    // Conditions to ignore
    if (isUserInPrivateCall || !socket || !socket.connected) {
      console.log('HomePage: Ignorando offer - en llamada privada o socket no listo.');
      return;
    }
    if (currentGeneralStreamIsLoggedInOnly && !loggedInUserId) {
      socket.emit('general-stream-access-denied', { message: 'This live stream is for registered users only.' });
      setIsGeneralStreamLive(false);
      setIsLoadingGeneralStream(false);
      return;
    }

    // 1) Close existing PC
    if (
      peerConnectionForGeneralStreamRef.current &&
      peerConnectionForGeneralStreamRef.current.signalingState !== 'closed'
    ) {
      console.log('HomePage: Cerrando PC existente antes de procesar nuevo offer.');
      peerConnectionForGeneralStreamRef.current.close();
      peerConnectionForGeneralStreamRef.current = null;
    }

    // 2) Create new RTCPeerConnection
    const pc = new RTCPeerConnection(PC_CONFIG);
    peerConnectionForGeneralStreamRef.current = pc;
    console.log('HomePage: Nueva RTCPeerConnection para general stream.');

    pc.ontrack = (event) => {
      console.log('HomePage (General Stream): ontrack evt. Streams:', event.streams);
      if (event.streams[0]) {
        console.log('HomePage (General Stream): Received remote stream ID:', event.streams[0].id);
        setGeneralStreamReceived(event.streams[0]);
      } else {
        console.warn('HomePage (General Stream): ontrack but no stream[0].');
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && socket.connected) {
        console.log('HomePage (General Stream): Enviando ICE candidate a broadcaster:', broadcasterId);
        try {
          socket.emit('general-stream-candidate-to-broadcaster', { broadcasterId, candidate: event.candidate });
        } catch (e: any) {
          console.error('HomePage: Error emitiendo ICE a broadcaster:', e.message);
        }
      }
    };
    pc.onconnectionstatechange = () => {
      if (peerConnectionForGeneralStreamRef.current) {
        const state = peerConnectionForGeneralStreamRef.current.connectionState;
        console.log('HomePage (General Stream): PC connection state:', state);
        if (state === 'connected') {
          setGeneralStreamWebRtcError(null);
        } else if (['failed', 'disconnected', 'closed'].includes(state)) {
          console.log('HomePage (General Stream): PC connection failed/disconnected/closed.');
          setGeneralStreamWebRtcError(t('homepage.live.connectionLostError'));
          setIsGeneralStreamLive(false);
          setGeneralStreamReceived(null);
          setIsLoadingGeneralStream(false);
        }
      }
    };

    // 3) Set remote description and create/send answer
    try {
      console.log('HomePage (General Stream): Setting remote description (offer).');
      await peerConnectionForGeneralStreamRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionForGeneralStreamRef.current.createAnswer();
      await peerConnectionForGeneralStreamRef.current.setLocalDescription(answer);
      if (socket.connected) {
        console.log('HomePage (General Stream): Enviando answer a broadcaster.');
        socket.emit('general-stream-answer-to-broadcaster', { broadcasterId, answer });
      }
    } catch (error: any) {
      console.error('HomePage (General Stream): Error al manejar offer:', error);
      setGeneralStreamWebRtcError(t('homepage.live.webrtcSetupError'));
      setIsLoadingGeneralStream(false);
    }
  }

  // ** onCandidateFromGeneralBroadcaster **
  async function onCandidateFromGeneralBroadcaster({ candidate }: { candidate: RTCIceCandidateInit }) {
    console.log("HomePage: Evento 'candidate-from-general-broadcaster' recibido.");
    if (
      isUserInPrivateCall ||
      !peerConnectionForGeneralStreamRef.current ||
      !candidate ||
      !peerConnectionForGeneralStreamRef.current.remoteDescription
    ) {
      console.log('HomePage: Ignorando candidate - condiciones no cumplidas.');
      return;
    }
    try {
      await peerConnectionForGeneralStreamRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('HomePage: Agregado ICE candidate desde broadcaster.');
    } catch (error: any) {
      console.error('HomePage: Error al agregar ICE candidate desde broadcaster:', candidate, error.message);
    }
  }

  // ** onGeneralStreamAccessDenied **
  function onGeneralStreamAccessDenied({ message }: { message: string }) {
    console.log("HomePage: Evento 'general-stream-access-denied' recibido. Mensaje:", message);
    setIsGeneralStreamLive(false);
    setGeneralStreamReceived(null);
    setIsLoadingGeneralStream(false);
    setCurrentGeneralStreamIsLoggedInOnly(true);
    toast({
      title: t('homepage.live.accessDenied'),
      description: message || t('homepage.live.accessDeniedDescription'),
      variant: 'destructive'
    });
  }

  // ** onPrivateCallInviteFromAdmin **
  const onPrivateCallInviteFromAdmin = async ({
    adminSocketId: adSocketId,
    adminAppUserId
  }: {
    adminSocketId: string;
    adminAppUserId: string;
  }) => {
    console.log("HomePage: Evento 'private-call-invite-from-admin' recibido. AdminSocketId:", adSocketId);
    // Ensure authorized user and not already in private call
    if (
      loggedInUserId &&
      siteSettings?.liveStreamAuthorizedUserId === loggedInUserId &&
      !isUserInPrivateCall
    ) {
      // Close general stream PC
      if (peerConnectionForGeneralStreamRef.current) {
        console.log('HomePage: Cerrando PC general debido a invite de call privada.');
        peerConnectionForGeneralStreamRef.current.close();
        peerConnectionForGeneralStreamRef.current = null;
      }
      setGeneralStreamReceived(null);
      setIsGeneralStreamLive(false);
      setIsLoadingGeneralStream(false);

      setPrivateCallAdminSocketId(adSocketId);
      setPrivateCallStatusMessage(t('homepage.privateCall.statusIncoming'));
      setIsUserInPrivateCall(true);
      setIsLoadingPrivateCallVideo(true);

      // Try to get user media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('[PrivateCall] Got stream. Tracks:', {
          audio: stream.getAudioTracks().map((t) => ({ id: t.id, enabled: t.enabled, state: t.readyState })),
          video: stream.getVideoTracks().map((t) => ({ id: t.id, enabled: t.enabled, state: t.readyState }))
        });

        setHasCallCameraPermission(true);
        setUserLocalStreamForCall(stream);
        if (stream.getTracks().length === 0) {
          console.warn('[PrivateCall] No live tracks in user media.');
        }
        stream.getAudioTracks().forEach((t) => (t.enabled = !isUserMicMuted));
        stream.getVideoTracks().forEach((t) => (t.enabled = !isUserVideoOff));

        // Close existing private PC if present
        if (
          peerConnectionForPrivateCallRef.current &&
          peerConnectionForPrivateCallRef.current.signalingState !== 'closed'
        ) {
          console.log('HomePage: Cerrando PC privada existente antes de nueva llamada.');
          peerConnectionForPrivateCallRef.current.close();
          peerConnectionForPrivateCallRef.current = null;
        }
        peerConnectionForPrivateCallRef.current = new RTCPeerConnection(PC_CONFIG);
        console.log('HomePage: Nueva RTCPeerConnection creada para llamada privada.');

        const validTracks = stream.getTracks().filter((track) => track.readyState === 'live');
        if (validTracks.length === 0) {
          console.warn('HomePage: No hay tracks vivas en user media. Abortando llamada.');
          setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed'));
          handleEndPrivateCall(false, 'No live user tracks');
          return;
        }
        validTracks.forEach((track) => {
          try {
            peerConnectionForPrivateCallRef.current!.addTrack(track, stream);
            console.log('HomePage: Added local track to private call PC:', track.kind);
          } catch (e: any) {
            console.error('HomePage: Error adding local track to private PC:', track.kind, e.message);
          }
        });

        peerConnectionForPrivateCallRef.current.onicecandidate = (event) => {
          if (event.candidate && socket && socket.connected) {
            console.log('HomePage: Sending private ICE candidate to admin:', adSocketId);
            try {
              socket.emit('private-ice-candidate', { targetSocketId: adSocketId, candidate: event.candidate });
            } catch (e: any) {
              console.error('HomePage: Error emitting private ICE:', e.message);
            }
          }
        };
        peerConnectionForPrivateCallRef.current.ontrack = (event) => {
          console.log('HomePage (Private Call): ontrack evt from admin. Streams:', event.streams);
          if (event.streams[0]) {
            console.log('HomePage (Private Call): Received remote admin stream ID:', event.streams[0].id);
            setAdminStreamForCall(event.streams[0]);
          } else {
            console.warn('HomePage (Private Call): ontrack but no stream[0].');
          }
        };
        peerConnectionForPrivateCallRef.current.onconnectionstatechange = () => {
          if (peerConnectionForPrivateCallRef.current) {
            const state = peerConnectionForPrivateCallRef.current.connectionState;
            console.log(`HomePage (Private Call): PC state changed to: ${state}`);
            if (state === 'connected') {
              setPrivateCallStatusMessage(t('homepage.privateCall.statusConnected'));
              setIsLoadingPrivateCallVideo(false);
            } else if (['failed', 'disconnected', 'closed'].includes(state)) {
              if (isUserInPrivateCall) handleEndPrivateCall(false, `PC state: ${state}`);
            }
          }
        };

        // Send ACK to server for invite
        socket!.emit('private-call-invite-ack', { adminSocketId: adSocketId });

        // Now accept the call
        if (socket && socket.connected) {
          socket.emit('user-accepts-private-call', { adminSocketId: adSocketId });
          setPrivateCallStatusMessage(t('homepage.privateCall.statusConnecting'));
          console.log('HomePage: Emitted user-accepts-private-call to admin:', adSocketId);
        } else {
          setPrivateCallStatusMessage(`${t('homepage.privateCall.statusFailed')} (Socket Error)`);
          handleEndPrivateCall(false, 'Socket disconnected before accepting call');
        }
      } catch (error) {
        console.error('HomePage: Error getting user media:', error);
        setPrivateCallStatusMessage(t('homepage.privateCall.cameraError'));
        toast({
          title: t('homepage.privateCall.cameraPermissionErrorTitle'),
          description: t('homepage.privateCall.cameraPermissionErrorDescription'),
          variant: 'destructive'
        });
        setHasCallCameraPermission(false);
        setUserLocalStreamForCall(null);
        handleEndPrivateCall(false, 'Error getting user media');
      }
    } else {
      console.log(
        'HomePage: Ignorando private-call-invite-from-admin. Conditions not met:',
        {
          loggedInUserId,
          authorizedForStream: siteSettings?.liveStreamAuthorizedUserId,
          isUserInPrivateCall
        }
      );
    }
  };

  // ** onPrivateSdpOfferReceived **
  const onPrivateSdpOfferReceived = async ({
    senderSocketId,
    offer
  }: {
    senderSocketId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    console.log('HomePage: Evento private-sdp-offer-received de senderSocketId:', senderSocketId);
    if (
      isUserInPrivateCall &&
      senderSocketId === privateCallAdminSocketId &&
      peerConnectionForPrivateCallRef.current &&
      socket &&
      socket.connected
    ) {
      try {
        console.log('HomePage (Private Call): Setting remote description (offer from admin).');
        await peerConnectionForPrivateCallRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionForPrivateCallRef.current.createAnswer();
        await peerConnectionForPrivateCallRef.current.setLocalDescription(answer);
        if (socket.connected) {
          socket.emit('private-sdp-answer', { targetSocketId: senderSocketId, answer });
          console.log('HomePage (Private Call): Sent SDP answer to admin:', senderSocketId);
        } else {
          setPrivateCallStatusMessage(`${t('homepage.privateCall.statusFailed')} (Socket Error)`);
          handleEndPrivateCall(false, 'Socket disconnected before sending SDP answer');
        }
      } catch (error: any) {
        console.error('HomePage (Private Call): Error handling SDP offer:', error);
        setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed'));
        handleEndPrivateCall(false, 'Error handling SDP offer');
      }
    } else {
      console.log(
        'HomePage: Ignoring private-sdp-offer-received. Conditions not met.',
        {
          isUserInPrivateCall,
          senderMatch: senderSocketId === privateCallAdminSocketId,
          pcExists: !!peerConnectionForPrivateCallRef.current
        }
      );
    }
  };

  // ** onPrivateIceCandidateReceived **
  const onPrivateIceCandidateReceived = async ({
    senderSocketId,
    candidate
  }: {
    senderSocketId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    console.log('HomePage: Evento private-ice-candidate-received de senderSocketId:', senderSocketId);
    if (
      isUserInPrivateCall &&
      senderSocketId === privateCallAdminSocketId &&
      peerConnectionForPrivateCallRef.current &&
      candidate &&
      peerConnectionForPrivateCallRef.current.remoteDescription
    ) {
      try {
        await peerConnectionForPrivateCallRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('HomePage: Added ICE candidate for private call from admin.');
      } catch (error: any) {
        console.error('HomePage: Error adding ICE candidate for private call:', candidate, error.message);
      }
    } else {
      console.log(
        'HomePage: Ignoring private-ice-candidate-received. Conditions not met.',
        {
          isUserInPrivateCall,
          senderMatch: senderSocketId === privateCallAdminSocketId,
          pcExists: !!peerConnectionForPrivateCallRef.current,
          remoteDesc: !!peerConnectionForPrivateCallRef.current?.remoteDescription
        }
      );
    }
  };

  // ** onPrivateCallTerminatedByAdmin **
  const onPrivateCallTerminatedByAdmin = () => {
    console.log("HomePage: Evento 'private-call-terminated-by-admin' recibido.");
    if (isUserInPrivateCall) {
      toast({
        title: t('homepage.privateCall.callEndedTitle'),
        description: t('homepage.privateCall.adminEndedCallDesc'),
        variant: 'default'
      });
      handleEndPrivateCall(false, 'Call terminated by admin');
    }
  };

  // ** onForceViewersReconnect **
  const onForceViewersReconnect = ({
    streamTitle,
    streamSubtitle,
    isLoggedInOnly
  }: {
    streamTitle: string;
    streamSubtitle: string;
    isLoggedInOnly: boolean;
  }) => {
    console.log('HomePage: Evento force-viewers-reconnect recibido:', {
      streamTitle,
      streamSubtitle,
      isLoggedInOnly
    });
    if (isUserInPrivateCall) {
      console.log('HomePage: En llamada privada, ignorando force-viewers-reconnect.');
      return;
    }

    if (
      peerConnectionForGeneralStreamRef.current &&
      peerConnectionForGeneralStreamRef.current.signalingState !== 'closed'
    ) {
      console.log('HomePage: Cerrando PC existente debido a force-viewers-reconnect.');
      peerConnectionForGeneralStreamRef.current.close();
      peerConnectionForGeneralStreamRef.current = null;
    }
    setGeneralStreamReceived(null);
    setIsLoadingGeneralStream(true);
    setGeneralStreamTitle(streamTitle);
    setGeneralStreamSubtitle(streamSubtitle);
    setCurrentGeneralStreamIsLoggedInOnly(isLoggedInOnly);
    setGeneralStreamWebRtcError(null);

    if (socket && socket.connected) {
      console.log('HomePage: Re-registrando como viewer tras force-viewers-reconnect.');
      socket.emit('register-general-viewer');
    }
  };

  // --- 8) Handlers for Toggles ---
  const toggleUserMicrophone = () => {
    if (userLocalStreamForCall) {
      const newState = !isUserMicMuted;
      userLocalStreamForCall.getAudioTracks().forEach((track) => (track.enabled = !newState));
      setIsUserMicMuted(newState);
      console.log(`HomePage: Mic privado ${newState ? 'silenciado' : 'activado'}`);
    }
  };
  const toggleUserVideo = () => {
    if (userLocalStreamForCall) {
      const newState = !isUserVideoOff;
      userLocalStreamForCall.getVideoTracks().forEach((track) => (track.enabled = !newState));
      setIsUserVideoOff(newState);
      console.log(`HomePage: Video privado ${newState ? 'desactivado' : 'activado'}`);
    }
  };
  const toggleGeneralStreamMute = () => {
    if (generalStreamVideoRef.current) {
      generalStreamVideoRef.current.muted = !generalStreamVideoRef.current.muted;
      setIsGeneralStreamMuted(generalStreamVideoRef.current.muted);
      console.log(`HomePage: General stream ${generalStreamVideoRef.current.muted ? 'silenciado' : 'activado audio'}`);
    }
  };

  // --- 9) Effect to Assign General Stream to <video> ---
  useEffect(() => {
    const videoEl = generalStreamVideoRef.current;
    if (!videoEl) return;

    const canShowGeneralStream =
      isGeneralStreamLive &&
      !isUserInPrivateCall &&
      (!currentGeneralStreamIsLoggedInOnly || loggedInUserId);

    let handleLoadedMetadataGlobal: (() => void) | null = null;
    let handleErrorGlobal: ((e: Event) => void) | null = null;

    if (canShowGeneralStream && generalStreamReceived) {
      console.log(
        'HomePage (Effect generalStreamVideoRef): Conditions met, generalStreamReceived present.',
        'Current srcObject:',
        videoEl.srcObject ? (videoEl.srcObject as MediaStream).id : 'null',
        'New Stream ID:',
        generalStreamReceived.id
      );
      if (videoEl.srcObject !== generalStreamReceived) {
        console.log('HomePage (Effect): Assigning new generalStreamReceived to video element.');
        videoEl.srcObject = generalStreamReceived;
        videoEl.muted = isGeneralStreamMuted;
        videoEl.load();

        handleLoadedMetadataGlobal = () => {
          console.log('HomePage (Effect): loadedmetadata event. Video tracks:', generalStreamReceived?.getVideoTracks());
          if (generalStreamReceived?.getVideoTracks().length === 0) {
            console.warn('HomePage (Effect): Received stream has no video tracks.');
            setGeneralStreamWebRtcError('Stream has no video.');
            setIsLoadingGeneralStream(false);
            return;
          }
          videoEl
            .play()
            .then(() => {
              console.log('HomePage (Effect): play() succeeded.');
              setIsLoadingGeneralStream(false);
            })
            .catch((e) => {
              console.error('HomePage (Effect): Error playing general stream:', e);
              if (e.name !== 'AbortError') {
                setGeneralStreamWebRtcError(`${t('homepage.live.webrtcSetupError')}: Playback failed - ${e.message}`);
              }
              setIsLoadingGeneralStream(false);
            });
        };

        handleErrorGlobal = (e: Event) => {
          console.error('HomePage (Effect): Video element error event:', e);
          if (e.target && (e.target as HTMLVideoElement).error) {
            setGeneralStreamWebRtcError(
              `${t('homepage.live.webrtcSetupError')}: Video Error Code ${(e.target as HTMLVideoElement).error?.code}`
            );
          } else {
            setGeneralStreamWebRtcError(`${t('homepage.live.webrtcSetupError')}: Unknown video error.`);
          }
          setIsLoadingGeneralStream(false);
        };

        videoEl.addEventListener('loadedmetadata', handleLoadedMetadataGlobal);
        videoEl.addEventListener('error', handleErrorGlobal);
      } else if (videoEl.paused && videoEl.readyState >= 3 && !isLoadingGeneralStream) {
        console.log('HomePage (Effect): Stream already assigned but paused, attempting to play.');
        videoEl.play().catch((e) => {
          if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
            console.error('HomePage: Error re-playing general stream:', e);
          }
        });
      } else if (!videoEl.paused && isLoadingGeneralStream) {
        setIsLoadingGeneralStream(false);
      }
    } else {
      if (videoEl.srcObject) {
        console.log('HomePage (Effect): Clearing srcObject of generalStreamVideoRef because it cannot be shown.');
        videoEl.srcObject = null;
      }
      if (isLoadingGeneralStream && !isUserInPrivateCall) {
        console.log('HomePage (Effect): Conditions not met or stream not received, turning off loader.');
        setIsLoadingGeneralStream(false);
      }
    }
    return () => {
      console.log('HomePage (Effect): Cleanup.');
      if (videoEl && handleLoadedMetadataGlobal) {
        videoEl.removeEventListener('loadedmetadata', handleLoadedMetadataGlobal);
      }
      if (videoEl && handleErrorGlobal) {
        videoEl.removeEventListener('error', handleErrorGlobal);
      }
    };
  }, [
    generalStreamReceived,
    isGeneralStreamLive,
    isUserInPrivateCall,
    currentGeneralStreamIsLoggedInOnly,
    loggedInUserId,
    isGeneralStreamMuted,
    isLoadingGeneralStream,
    siteSettings,
    t
  ]);

  // --- 10) Private Call: Assign Admin Stream to Main Video ---
  useEffect(() => {
    const videoEl = privateCallMainVideoRef.current;
    if (videoEl) {
      if (adminStreamForCall && isUserInPrivateCall) {
        if (videoEl.srcObject !== adminStreamForCall) {
          console.log('HomePage (PrivateCallMainVideo Effect): Assigning adminStreamForCall to element.');
          setIsLoadingPrivateCallVideo(true);
          videoEl.srcObject = adminStreamForCall;
          videoEl.muted = false;
          videoEl.load();

          const handleLoadedMetadata = () => {
            console.log('HomePage (PrivateCallMainVideo Effect): loadedmetadata event.');
            videoEl
              .play()
              .catch((e) => {
                if (e.name !== 'AbortError') console.error('HomePage: Error playing admin video:', e);
              })
              .finally(() => setIsLoadingPrivateCallVideo(false));
          };
          videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
          return () => videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      } else if (videoEl.srcObject) {
        console.log('HomePage (PrivateCallMainVideo Effect): Clearing srcObject of private element.');
        videoEl.srcObject = null;
        setIsLoadingPrivateCallVideo(false);
      }
    }
  }, [adminStreamForCall, isUserInPrivateCall]);

  // --- 11) Private Call: Assign User Local Stream to PiP ---
  useEffect(() => {
    const videoEl = privateCallUserPipVideoRef.current;
    if (videoEl) {
      if (userLocalStreamForCall && isUserInPrivateCall) {
        if (videoEl.srcObject !== userLocalStreamForCall) {
          console.log('HomePage (User PiP Effect): Assigning userLocalStreamForCall to PiP element.');
          videoEl.srcObject = userLocalStreamForCall;
          videoEl.muted = true;
          videoEl.load();
          videoEl.onloadedmetadata = () => {
            videoEl.play().catch((e) => {
              if (e.name !== 'AbortError') console.error('HomePage: Error playing PiP:', e);
            });
          };
        }
        videoEl.style.visibility = isUserVideoOff ? 'hidden' : 'visible';
      } else if (videoEl.srcObject) {
        console.log('HomePage (User PiP Effect): Clearing srcObject of PiP.');
        videoEl.srcObject = null;
      }
    }
  }, [userLocalStreamForCall, isUserInPrivateCall, isUserVideoOff]);

  if (isLoadingSiteSettings || !siteSettings) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const { heroTitle, heroTagline, heroTaglineColor, heroTaglineSize, heroSubtitle } = siteSettings;
  const taglineStyle: React.CSSProperties = {};
  if (heroTaglineColor && /^#[0-9A-Fa-f]{6}$/i.test(heroTaglineColor)) {
    taglineStyle.color = heroTaglineColor;
  }
  const taglineSizeClasses: Record<HeroTaglineSize, string> = {
    sm: 'text-lg md:text-xl',
    md: 'text-xl md:text-2xl',
    lg: 'text-2xl md:text-3xl'
  };
  const currentTaglineSizeClass = taglineSizeClasses[heroTaglineSize || 'md'];

  const showPrivateCallUI = isUserInPrivateCall && loggedInUserId === siteSettings.liveStreamAuthorizedUserId;
  const canDisplayGeneralStream =
    isGeneralStreamLive &&
    !isUserInPrivateCall &&
    (!currentGeneralStreamIsLoggedInOnly || (currentGeneralStreamIsLoggedInOnly && loggedInUserId));

  let mainDisplayVideoRef = showPrivateCallUI ? privateCallMainVideoRef : generalStreamVideoRef;
  let mainDisplayVideoIsMuted = showPrivateCallUI ? false : isGeneralStreamMuted;

  let videoAreaEffectiveTitle = showPrivateCallUI
    ? t('homepage.privateCall.adminVideoLabel')
    : generalStreamTitle;
  let videoAreaEffectiveSubtitle = showPrivateCallUI
    ? privateCallStatusMessage
    : isGeneralStreamLive
    ? generalStreamSubtitle
    : '';
  const showOfflineMessageInVideoArea = !isGeneralStreamLive && !showPrivateCallUI;

  const isLoadingStateForVideoArea =
    (canDisplayGeneralStream && isLoadingGeneralStream && !generalStreamWebRtcError && !showPrivateCallUI) ||
    (showPrivateCallUI &&
      isLoadingPrivateCallVideo &&
      hasCallCameraPermission !== false &&
      (privateCallStatusMessage.toLowerCase().includes('connecting') ||
        privateCallStatusMessage.toLowerCase().includes('incoming')));

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section
          className="relative bg-gradient-to-br from-primary/20 via-background to-background py-20 md:py-32 text-center overflow-hidden"
          style={{
            backgroundImage:
              'radial-gradient(circle at top right, hsl(var(--primary)/0.1), transparent 40%), radial-gradient(circle at bottom left, hsl(var(--primary)/0.15), transparent 50%)'
          }}
        >
          <div className="container mx-auto px-4 relative z-10">
            <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-primary">
              {heroTitle || t('homepage.hero.title')}
            </h1>
            {heroTagline && (
              <p className={cn('font-semibold mb-6', currentTaglineSizeClass)} style={taglineStyle}>
                {heroTagline}
              </p>
            )}
            <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-8">
              {heroSubtitle || t('homepage.hero.subtitle')}
            </p>
            <Button
              size="lg"
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transform hover:scale-105 transition-transform"
            >
              <Link href="/#courses">
                <PlayCircle className="mr-2 h-5 w-5" />
                {t('homepage.hero.exploreButton')}
              </Link>
            </Button>
          </div>
        </section>

        <section id="live" className="py-12 md:py-16 bg-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-3xl md:text-4xl font-bold mb-2">
              <span className="text-primary">{videoAreaEffectiveTitle}</span>
            </h2>
            {videoAreaEffectiveSubtitle && (
              <p className="text-muted-foreground mb-4 text-lg">{videoAreaEffectiveSubtitle}</p>
            )}
            {!showPrivateCallUI && !generalStreamSubtitle && isGeneralStreamLive && (
              <p className="text-muted-foreground mb-4 text-lg">{t('homepage.live.broadcastingNow')}</p>
            )}
            {!showPrivateCallUI && !isGeneralStreamLive && (
              <p className="text-muted-foreground mb-4 text-lg">
                {siteLiveStreamOfflineMessage || t('homepage.live.currentlyOffline')}
              </p>
            )}

            <div className="bg-card p-4 md:p-8 rounded-lg shadow-xl max-w-3xl mx-auto relative">
              <video
                ref={mainDisplayVideoRef}
                className="w-full aspect-video rounded-md bg-black"
                playsInline
                controls={!showPrivateCallUI && canDisplayGeneralStream && !!generalStreamReceived}
                autoPlay
                muted={mainDisplayVideoIsMuted}
              />

              {showPrivateCallUI && userLocalStreamForCall && (
                <div
                  className={cn(
                    'absolute bottom-4 right-4 w-1/3 sm:w-1/4 max-w-[200px] aspect-video border-2 border-primary rounded-md overflow-hidden shadow-lg z-10',
                    isUserVideoOff && 'invisible'
                  )}
                >
                  <p className="absolute top-0 left-0 bg-black/50 text-white text-xs px-1 py-0.5 rounded-br-md">
                    {t('homepage.privateCall.yourVideoLabel')}
                  </p>
                  <video ref={privateCallUserPipVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                </div>
              )}

              {isLoadingStateForVideoArea && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
                  <p className="text-md text-muted-foreground">
                    {showPrivateCallUI ? privateCallStatusMessage : t('homepage.live.connecting')}
                  </p>
                </div>
              )}
              {showOfflineMessageInVideoArea && !isLoadingStateForVideoArea && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                  <VideoIconLucideSvg className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-xl text-muted-foreground">
                    {siteLiveStreamOfflineMessage || t('homepage.live.statusOffline')}
                  </p>
                </div>
              )}
              {generalStreamWebRtcError && !showPrivateCallUI && (
                <Alert variant="destructive" className="mt-4 text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('homepage.live.streamingIssueTitle')}</AlertTitle>
                  <AlertDescription>{generalStreamWebRtcError}</AlertDescription>
                </Alert>
              )}
              {showPrivateCallUI && hasCallCameraPermission === false && (
                <Alert variant="destructive" className="mt-4 text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('homepage.privateCall.cameraPermissionErrorTitle')}</AlertTitle>
                  <AlertDescription>{t('homepage.privateCall.cameraPermissionErrorDescription')}</AlertDescription>
                </Alert>
              )}
              {!showPrivateCallUI && isGeneralStreamLive && currentGeneralStreamIsLoggedInOnly && !loggedInUserId && (
                <Alert variant="destructive" className="mt-4 text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('homepage.live.accessDenied')}</AlertTitle>
                  <AlertDescription>{t('homepage.live.accessDeniedDescription')}</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="mt-4 flex justify-center space-x-2 sm:space-x-4">
              {!showPrivateCallUI && canDisplayGeneralStream && generalStreamReceived && (
                <Button onClick={toggleGeneralStreamMute} variant="outline" size="sm">
                  {isGeneralStreamMuted ? <VolumeX className="mr-1.5 h-4 w-4" /> : <Volume2 className="mr-1.5 h-4 w-4" />}
                  {isGeneralStreamMuted ? t('homepage.controls.unmute') : t('homepage.controls.mute')}
                </Button>
              )}
              {showPrivateCallUI && userLocalStreamForCall && (
                <>
                  <Button onClick={toggleUserMicrophone} variant="outline" size="sm">
                    {isUserMicMuted ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
                    {isUserMicMuted ? t('homepage.privateCall.unmuteMic') : t('homepage.privateCall.muteMic')}
                  </Button>
                  <Button onClick={toggleUserVideo} variant="outline" size="sm">
                    {isUserVideoOff ? <VideoIconLucideSvg className="mr-1.5 h-4 w-4" /> : <VideoOffIcon className="mr-1.5 h-4 w-4" />}
                    {isUserVideoOff ? t('homepage.privateCall.startVideo') : t('homepage.privateCall.stopVideo')}
                  </Button>
                  <Button onClick={() => handleEndPrivateCall(true, 'User ended call')} variant="destructive" size="sm">
                    <PhoneOff className="mr-1.5 h-4 w-4" /> {t('homepage.privateCall.endCallButton')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section id="courses" className="py-12 md:py-16 bg-card/30">
          <div className="container mx-auto px-4">
            <h2 className="font-headline text-3xl md:text-4xl font-bold text-center mb-10">
              {t('homepage.courses.title')} <span className="text-primary">{t('homepage.courses.titleHighlight')}</span>
            </h2>
            {isLoadingCourses ? (
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : videoCourses.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-6">
                {videoCourses.map((video) => (
                  <div className="min-w-[240px] max-w-[340px] w-full sm:w-[240px] md:w-[340px]" key={video.id}>
                    <VideoCard
                      video={video}
                      onWatchNowClick={handleOpenVideoPlayer}
                      onCourseCardClick={handleOpenCourseDetail}
                      displayCurrency={displayCurrency}
                      exchangeRates={effectiveExchangeRates}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">{t('homepage.courses.noCourses')}</p>
            )}
          </div>
        </section>

        <section id="testimonials" className="py-12 md:py-16 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="font-headline text-3xl md:text-4xl font-bold text-center mb-10">
              {t('homepage.testimonials.title')} <span className="text-primary">{t('homepage.testimonials.titleHighlight')}</span>
            </h2>
            <CuratedTestimonialsDisplay />
          </div>
        </section>
      </main>

      <Footer />

      {selectedVideoForPlayer && (
        <VideoPlayerModal
          isOpen={isVideoPlayerModalOpen}
          onOpenChange={setIsVideoPlayerModalOpen}
          videoUrl={selectedVideoForPlayer.videoUrl}
          title={selectedVideoForPlayer.title}
        />
      )}
      {selectedCourseForDetail && displayCurrency && effectiveExchangeRates && (
        <CourseDetailModal
          isOpen={isCourseDetailModalOpen}
          onOpenChange={setIsCourseDetailModalOpen}
          video={selectedCourseForDetail}
          onWatchVideo={handleWatchFromDetailModal}
          displayCurrency={displayCurrency}
          exchangeRates={effectiveExchangeRates}
        />
      )}
      {!isLoadingAnnouncement && currentAnnouncement && (
        <AnnouncementModal
          isOpen={isAnnouncementModalOpen}
          onOpenChange={(open) => {
            setIsAnnouncementModalOpen(open);
            if (!open && currentAnnouncement?.showOnce && currentAnnouncement.id && typeof window !== 'undefined') {
              localStorage.setItem(`announcement_viewed_${currentAnnouncement.id}`, 'true');
            }
          }}
          announcement={currentAnnouncement}
        />
      )}
    </div>
  );
}
