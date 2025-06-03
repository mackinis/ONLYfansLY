'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import VideoCard from '@/components/VideoCard';
import type { Video, SiteSettings, ActiveCurrencySetting, ExchangeRates, Announcement, HeroTaglineSize, SessionUserProfile } from '@/lib/types';
import CuratedTestimonialsDisplay from '@/components/CuratedTestimonialsDisplay';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import AnnouncementModal from '@/components/AnnouncementModal';
import CourseDetailModal from '@/components/CourseDetailModal';
import { Button } from '@/components/ui/button';
import { PlayCircle, Loader2, Video as VideoIconLucideSvg, AlertTriangle, Mic, MicOff, PhoneOff, VideoOff as VideoOffIcon, VolumeX, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from '@/context/I18nContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function HomePage() {
  const { t, siteSettings, isLoadingSettings: isLoadingSiteSettings, displayCurrency, exchangeRates: contextExchangeRates } = useTranslation();
  const { toast } = useToast();

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

  // --- NUEVO: Guardar el ID del broadcaster actual para evitar re-registrarse en bucle
  const [currentBroadcasterId, setCurrentBroadcasterId] = useState<string | null>(null);

  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<SessionUserProfile | null>(null);

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserProfileString = sessionStorage.getItem('aurum_user_profile');
      if (storedUserProfileString) {
        try {
          const userProfile: SessionUserProfile = JSON.parse(storedUserProfileString);
          setLoggedInUserId(userProfile.id);
          setCurrentUserProfile(userProfile);
        } catch (e) { console.error("HomePage: Failed to parse user profile for stream auth:", e); }
      } else {
        setLoggedInUserId(null);
        setCurrentUserProfile(null);
      }
    }
  }, []);

  useEffect(() => {
    if (siteSettings) {
      setCurrentExchangeRates(siteSettings.exchangeRates);
      if (!isGeneralStreamLive && !isUserInPrivateCall) {
        setGeneralStreamTitle(siteSettings.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
        setGeneralStreamSubtitle(siteSettings.liveStreamSubtitle || '');
      }
    }
  }, [siteSettings, t, isGeneralStreamLive, isUserInPrivateCall]);

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const response = await fetch('/api/video-courses');
        if (!response.ok) throw new Error('Failed to fetch courses');
        const data = await response.json();
        setVideoCourses(data);
      } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "Failed to load video courses.", variant: "destructive" });
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, [toast]);

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
        if (firstAnn.showOnce && typeof window !== 'undefined' && localStorage.getItem(viewedKey) === 'true') {
          setCurrentAnnouncement(null);
        } else {
          setCurrentAnnouncement(firstAnn);
          setIsAnnouncementModalOpen(true);
        }
      } else {
        setCurrentAnnouncement(null);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setCurrentAnnouncement(null);
    } finally {
      setIsLoadingAnnouncement(false);
    }
  }, [isLoadingSiteSettings]);

  useEffect(() => { fetchAndShowAnnouncement(); }, [fetchAndShowAnnouncement]);

  const handleOpenVideoPlayer = (video: Video) => { setSelectedVideoForPlayer(video); setIsVideoPlayerModalOpen(true); };
  const handleOpenCourseDetail = (video: Video) => { setSelectedCourseForDetail(video); setIsCourseDetailModalOpen(true); };
  const handleWatchFromDetailModal = (video: Video) => { setIsCourseDetailModalOpen(false); handleOpenVideoPlayer(video); };

  const handleEndPrivateCall = useCallback((emitToServer = true, reason = "User ended call") => {
    console.log(`HomePage: Ending private call. Emit to server: ${emitToServer}. Reason: ${reason}`);
    if (peerConnectionForPrivateCallRef.current) {
      console.log("HomePage: Closing existing peerConnectionForPrivateCallRef.");
      peerConnectionForPrivateCallRef.current.close();
      peerConnectionForPrivateCallRef.current = null;
    }
    userLocalStreamForCall?.getTracks().forEach(track => track.stop());
    setUserLocalStreamForCall(null);
    setAdminStreamForCall(null);
    if (privateCallMainVideoRef.current) privateCallMainVideoRef.current.srcObject = null;
    if (privateCallUserPipVideoRef.current) privateCallUserPipVideoRef.current.srcObject = null;

    if (socket && socket.connected && emitToServer && privateCallAdminSocketId) {
      console.log("HomePage: Emitting 'user-end-private-call' to adminSocketId:", privateCallAdminSocketId);
      socket.emit('user-end-private-call', { adminSocketId: privateCallAdminSocketId });
    }

    setIsUserInPrivateCall(false);
    setPrivateCallAdminSocketId(null);
    setPrivateCallStatusMessage('');
    setIsUserMicMuted(false);
    setIsUserVideoOff(false);
    setHasCallCameraPermission(null);
    setIsLoadingPrivateCallVideo(false);

    if (socket && socket.connected) {
      console.log("HomePage: Re-registering as general viewer after ending private call.");
      socket.emit('register-general-viewer');
    }
  }, [socket, privateCallAdminSocketId, userLocalStreamForCall]);

  useEffect(() => {
    if (isLoadingSiteSettings) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }
    let shouldConnectSocket = false;
    let queryParams: { appUserId?: string } = {};

    if (loggedInUserId) {
      shouldConnectSocket = true;
      queryParams.appUserId = loggedInUserId;
    } else if (siteSettings && !siteSettings.liveStreamForLoggedInUsersOnly) {
      shouldConnectSocket = true;
    } else if (!loggedInUserId && siteSettings && siteSettings.liveStreamForLoggedInUsersOnly) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsGeneralStreamLive(false);
      setGeneralStreamReceived(null);
      setIsLoadingGeneralStream(false);
      return;
    }

    if (shouldConnectSocket) {
      console.log("HomePage: Initializing socket connection. Query params:", queryParams);
      const newSocket = io({ path: '/api/socket_io', query: queryParams });
      setSocket(newSocket);
      return () => {
        console.log("HomePage: Disconnecting socket.");
        newSocket.disconnect();
        setSocket(null);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUserId, siteSettings, isLoadingSiteSettings]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => {
      console.log("HomePage: Socket connected. ID:", socket.id);
      if (!isUserInPrivateCall) socket.emit('register-general-viewer');
    });
    socket.on('connect_error', (error) => {
      console.error("HomePage: Socket connection error:", error);
      toast({ variant: 'destructive', title: 'Socket Connection Error', description: `User: ${error.message}` });
    });
    socket.on('disconnect', (reason) => {
      console.log(`HomePage: Socket disconnected. Reason: ${reason}. Was general stream live: ${isGeneralStreamLive}, Was in private call: ${isUserInPrivateCall}`);
      if (reason !== 'io client disconnect') toast({ variant: 'destructive', title: 'Socket Disconnected', description: `Reason: ${reason}` });

      setIsGeneralStreamLive(false);
      setGeneralStreamReceived(null);
      setCurrentGeneralStreamIsLoggedInOnly(false);
      setIsLoadingGeneralStream(false);
      if (peerConnectionForGeneralStreamRef.current) {
        peerConnectionForGeneralStreamRef.current.close();
        peerConnectionForGeneralStreamRef.current = null;
      }

      if (isUserInPrivateCall) handleEndPrivateCall(false, "Socket disconnected during call");
    });

    const onGeneralBroadcasterReady = ({
      broadcasterId,
      streamTitle: titleFromServer,
      streamSubtitle: subtitleFromServer,
      isLoggedInOnly
    }: {
      broadcasterId: string;
      streamTitle?: string;
      streamSubtitle?: string;
      isLoggedInOnly?: boolean;
    }) => {
      console.log("HomePage: 'general-broadcaster-ready' received", { broadcasterId, titleFromServer, subtitleFromServer, isLoggedInOnly });

      // Si hay PC abierto, lo cerramos
      if (peerConnectionForGeneralStreamRef.current && peerConnectionForGeneralStreamRef.current.signalingState !== 'closed') {
        console.log("HomePage: Closing existing general PC on 'general-broadcaster-ready'.");
        peerConnectionForGeneralStreamRef.current.close();
        peerConnectionForGeneralStreamRef.current = null;
      }

      setCurrentGeneralStreamIsLoggedInOnly(isLoggedInOnly || false);
      setGeneralStreamReceived(null);
      setIsLoadingGeneralStream(true);

      // Si es stream “solo para logueados” y no estoy logueado, denegar acceso
      if (isLoggedInOnly && !loggedInUserId) {
        setIsGeneralStreamLive(false);
        setGeneralStreamReceived(null);
        setIsLoadingGeneralStream(false);
        setGeneralStreamTitle(titleFromServer || siteSettings?.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
        setGeneralStreamSubtitle(subtitleFromServer || siteSettings?.liveStreamSubtitle || '');
        toast({
          title: t('homepage.live.accessDenied'),
          description: t('homepage.live.accessDeniedDescription'),
          variant: "destructive"
        });
        return;
      }

      // Si estoy en llamada privada, ignoro el evento
      if (isUserInPrivateCall) {
        console.log("HomePage: In private call, ignoring 'general-broadcaster-ready'.");
        setIsLoadingGeneralStream(false);
        return;
      }

      // Si cambió el broadcaster (nuevo stream), me registro UNA vez
      if (broadcasterId !== currentBroadcasterId) {
        setCurrentBroadcasterId(broadcasterId);
        setGeneralStreamTitle(titleFromServer || siteSettings?.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
        setGeneralStreamSubtitle(subtitleFromServer || siteSettings?.liveStreamSubtitle || '');
        setIsGeneralStreamLive(true);
        setGeneralStreamWebRtcError(null);

        // ─── Re-registrar como viewer solo la primera vez para este broadcasterId ───
        if (socket && socket.connected) {
          console.log("HomePage: Re-registrando como viewer tras 'general-broadcaster-ready'.");
          socket.emit("register-general-viewer");
        }
      } else {
        console.log("HomePage: Ya me re-registré para este broadcasterId, ignoro.");
      }
    };

    const onGeneralStreamEnded = () => {
      console.log("HomePage: 'general-stream-ended' received.");
      if (isUserInPrivateCall) {
        console.log("HomePage: In private call, ignoring 'general-stream-ended'.");
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
    };

    const onGeneralBroadcasterDisconnected = onGeneralStreamEnded;

    const onOfferFromGeneralBroadcaster = async ({ broadcasterId, offer }: { broadcasterId: string; offer: RTCSessionDescriptionInit }) => {
      console.log("HomePage: 'offer-from-general-broadcaster' received. BroadcasterId:", broadcasterId);
      if (isUserInPrivateCall || !socket || !socket.connected) {
        console.log("HomePage: Ignoring offer - in private call or socket not ready.");
        return;
      }
      if (currentGeneralStreamIsLoggedInOnly && !loggedInUserId) {
        socket.emit('general-stream-access-denied', { message: 'This live stream is for registered users only.' });
        setIsGeneralStreamLive(false);
        setIsLoadingGeneralStream(false);
        return;
      }

      if (peerConnectionForGeneralStreamRef.current && peerConnectionForGeneralStreamRef.current.signalingState !== 'closed') {
        console.log("HomePage: Closing existing peerConnectionForGeneralStreamRef before creating new for offer.");
        peerConnectionForGeneralStreamRef.current.close();
        peerConnectionForGeneralStreamRef.current = null;
      }
      peerConnectionForGeneralStreamRef.current = new RTCPeerConnection(PC_CONFIG);
      console.log("HomePage: New RTCPeerConnection created for general stream to process offer.");

      peerConnectionForGeneralStreamRef.current.ontrack = (event) => {
        console.log("HomePage (General Stream): 'ontrack' event. Streams:", event.streams);
        if (event.streams[0]) {
          console.log("HomePage (General Stream): Remote stream received, ID:", event.streams[0].id);
          setGeneralStreamReceived(event.streams[0]);
        } else {
          console.log("HomePage (General Stream): 'ontrack' event but no stream[0].");
        }
      };
      peerConnectionForGeneralStreamRef.current.onicecandidate = (event) => {
        if (event.candidate && socket.connected) {
          console.log("HomePage (General Stream): Sending ICE candidate to broadcaster:", broadcasterId);
          try {
            socket.emit('general-stream-candidate-to-broadcaster', { broadcasterId, candidate: event.candidate });
          } catch (e: any) {
            console.error("HomePage: Error emitting ICE to broadcaster:", e.message);
          }
        }
      };
      peerConnectionForGeneralStreamRef.current.onconnectionstatechange = () => {
        if (peerConnectionForGeneralStreamRef.current) {
          const state = peerConnectionForGeneralStreamRef.current.connectionState;
          console.log("HomePage (General Stream): PC connection state changed to:", state);
          if (state === 'connected') {
            setGeneralStreamWebRtcError(null);
          } else if (['failed', 'disconnected', 'closed'].includes(state)) {
            console.log("HomePage (General Stream): PC connection failed/disconnected/closed.");
            setGeneralStreamWebRtcError(t('homepage.live.connectionLostError'));
            setIsGeneralStreamLive(false);
            setGeneralStreamReceived(null);
            setIsLoadingGeneralStream(false);
          }
        }
      };
      try {
        console.log("HomePage (General Stream): Setting remote description (offer).");
        await peerConnectionForGeneralStreamRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionForGeneralStreamRef.current.createAnswer();
        await peerConnectionForGeneralStreamRef.current.setLocalDescription(answer);
        if (socket.connected) {
          console.log("HomePage (General Stream): Sending answer to broadcaster.");
          socket.emit('general-stream-answer-to-broadcaster', { broadcasterId, answer });
        }
      } catch (error: any) {
        console.error("HomePage (General Stream): Error handling offer:", error);
        setGeneralStreamWebRtcError(t('homepage.live.webrtcSetupError'));
        setIsLoadingGeneralStream(false);
      }
    };

    const onCandidateFromGeneralBroadcaster = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      console.log("HomePage: 'candidate-from-general-broadcaster' received.");
      if (
        isUserInPrivateCall ||
        !peerConnectionForGeneralStreamRef.current ||
        !candidate ||
        !peerConnectionForGeneralStreamRef.current.remoteDescription
      ) {
        console.log("HomePage: Ignoring candidate - conditions not met.");
        return;
      }
      try {
        await peerConnectionForGeneralStreamRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("HomePage: Added ICE candidate from general broadcaster.");
      } catch (error: any) {
        console.error('HomePage: Error adding ICE candidate from general broadcaster:', candidate, error.message);
      }
    };

    const onGeneralStreamAccessDenied = ({ message }: { message: string }) => {
      console.log("HomePage: 'general-stream-access-denied' received. Message:", message);
      setIsGeneralStreamLive(false);
      setGeneralStreamReceived(null);
      setIsLoadingGeneralStream(false);
      setCurrentGeneralStreamIsLoggedInOnly(true);
      toast({
        title: t('homepage.live.accessDenied'),
        description: message || t('homepage.live.accessDeniedDescription'),
        variant: "destructive"
      });
    };

    const onPrivateCallInviteFromAdmin = async ({ adminSocketId: adSocketId, adminAppUserId }: { adminSocketId: string; adminAppUserId: string }) => {
      console.log("HomePage: 'private-call-invite-from-admin' received. AdminSocketId:", adSocketId);
      if (loggedInUserId && siteSettings?.liveStreamAuthorizedUserId === loggedInUserId && !isUserInPrivateCall) {
        if (peerConnectionForGeneralStreamRef.current) {
          console.log("HomePage: Closing general stream PC due to private call invite.");
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

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          console.log("[PrivateCall] Got stream. Track summary:", {
            audio: stream.getAudioTracks().map(t => ({ id: t.id, enabled: t.enabled, state: t.readyState })),
            video: stream.getVideoTracks().map(t => ({ id: t.id, enabled: t.enabled, state: t.readyState }))
          });

          console.log("HomePage: User media obtained for private call. Stream ID:", stream.id);
          setHasCallCameraPermission(true);
          setUserLocalStreamForCall(stream);
          if (stream.getTracks().length === 0) {
            console.warn("[PrivateCall] No tracks in obtained user media stream.");
          }
          stream.getAudioTracks().forEach(track => track.enabled = !isUserMicMuted);
          stream.getVideoTracks().forEach(track => track.enabled = !isUserVideoOff);

          if (peerConnectionForPrivateCallRef.current && peerConnectionForPrivateCallRef.current.signalingState !== 'closed') {
            console.log("HomePage: Closing existing peerConnectionForPrivateCallRef before new private call.");
            peerConnectionForPrivateCallRef.current.close();
            peerConnectionForPrivateCallRef.current = null;
          }
          peerConnectionForPrivateCallRef.current = new RTCPeerConnection(PC_CONFIG);
          console.log("HomePage: New RTCPeerConnection created for private call.");

          const validTracks = stream.getTracks().filter(track => track.readyState === 'live');
          if (validTracks.length === 0) {
            console.warn("HomePage: All user tracks are inactive. Aborting private call.");
            setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed'));
            handleEndPrivateCall(false, "No live user tracks");
            return;
          }
          validTracks.forEach(track => {
            try {
              peerConnectionForPrivateCallRef.current!.addTrack(track, stream);
              console.log("HomePage: Added user live track to private call PC:", track.kind);
            } catch (e: any) {
              console.error("HomePage: Error adding user's local track to private PC:", track.kind, e.message);
            }
          });

          peerConnectionForPrivateCallRef.current.onicecandidate = (event) => {
            if (event.candidate && socket && socket.connected) {
              console.log("HomePage: Sending private ICE candidate to admin:", adSocketId);
              try {
                socket.emit('private-ice-candidate', { targetSocketId: adSocketId, candidate: event.candidate });
              } catch (e: any) {
                console.error("HomePage: Error emitting private ICE:", e.message);
              }
            }
          };
          peerConnectionForPrivateCallRef.current.ontrack = (event) => {
            console.log("HomePage (Private Call): 'ontrack' event from admin. Streams:", event.streams);
            if (event.streams[0]) {
              console.log("HomePage (Private Call): Admin remote stream received, ID:", event.streams[0].id);
              setAdminStreamForCall(event.streams[0]);
            } else {
              console.log("HomePage (Private Call): 'ontrack' event but no stream[0].");
            }
          };
          peerConnectionForPrivateCallRef.current.onconnectionstatechange = () => {
            if (peerConnectionForPrivateCallRef.current) {
              const state = peerConnectionForPrivateCallRef.current.connectionState;
              console.log(`HomePage (Private Call): PC connection state changed to: ${state}`);
              if (state === 'connected') {
                setPrivateCallStatusMessage(t('homepage.privateCall.statusConnected'));
                setIsLoadingPrivateCallVideo(false);
              } else if (['failed', 'disconnected', 'closed'].includes(state)) {
                if (isUserInPrivateCall) handleEndPrivateCall(false, `PC state changed to ${state}`);
              }
            }
          };
          if (socket && socket.connected) {
            socket.emit('user-accepts-private-call', { adminSocketId: adSocketId });
            setPrivateCallStatusMessage(t('homepage.privateCall.statusConnecting'));
            console.log("HomePage: 'user-accepts-private-call' emitted to admin:", adSocketId);
          } else {
            setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed') + " (Socket Error)");
            handleEndPrivateCall(false, "Socket disconnected before user could accept call");
          }
        } catch (error) {
          console.error("HomePage: Error getting user media for private call:", error);
          setPrivateCallStatusMessage(t('homepage.privateCall.cameraError'));
          toast({ title: t('homepage.privateCall.cameraPermissionErrorTitle'), description: t('homepage.privateCall.cameraPermissionErrorDescription'), variant: "destructive" });
          setHasCallCameraPermission(false);
          setUserLocalStreamForCall(null);
          handleEndPrivateCall(false, "Error getting user media for call");
        }
      } else {
        console.log(
          "HomePage: Ignoring 'private-call-invite-from-admin'. Conditions not met. LoggedInUserId:",
          loggedInUserId,
          "Site Authorized User:",
          siteSettings?.liveStreamAuthorizedUserId,
          "isUserInPrivateCall:",
          isUserInPrivateCall
        );
      }
    };

    const onPrivateSdpOfferReceived = async ({ senderSocketId, offer }: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
      console.log("HomePage: 'private-sdp-offer-received' from senderSocketId:", senderSocketId);
      if (
        isUserInPrivateCall &&
        senderSocketId === privateCallAdminSocketId &&
        peerConnectionForPrivateCallRef.current &&
        socket &&
        socket.connected
      ) {
        try {
          console.log("HomePage (Private Call): Setting remote description (offer from admin).");
          await peerConnectionForPrivateCallRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnectionForPrivateCallRef.current.createAnswer();
          await peerConnectionForPrivateCallRef.current.setLocalDescription(answer);
          if (socket.connected) {
            socket.emit('private-sdp-answer', { targetSocketId: senderSocketId, answer });
            console.log("HomePage (Private Call): SDP answer sent to admin:", senderSocketId);
          } else {
            setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed') + " (Socket Error)");
            handleEndPrivateCall(false, "Socket disconnected before sending SDP answer");
          }
        } catch (error: any) {
          console.error("HomePage (Private Call): Error handling SDP offer:", error);
          setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed'));
          handleEndPrivateCall(false, "Error handling SDP offer");
        }
      } else {
        console.log(
          "HomePage: Ignoring 'private-sdp-offer-received'. Conditions not met. isUserInPrivateCall:",
          isUserInPrivateCall,
          "sender vs adminSocketId:",
          senderSocketId,
          privateCallAdminSocketId
        );
      }
    };

    const onPrivateIceCandidateReceived = async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      console.log("HomePage: 'private-ice-candidate-received' from senderSocketId:", senderSocketId);
      if (
        isUserInPrivateCall &&
        senderSocketId === privateCallAdminSocketId &&
        peerConnectionForPrivateCallRef.current &&
        candidate &&
        peerConnectionForPrivateCallRef.current.remoteDescription
      ) {
        try {
          await peerConnectionForPrivateCallRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("HomePage: Added ICE candidate for private call from admin.");
        } catch (error: any) {
          console.error('HomePage: Error adding received ICE candidate for private call:', candidate, error.message);
        }
      } else {
        console.log("HomePage: Ignoring 'private-ice-candidate-received'. Conditions not met.");
      }
    };

    const onPrivateCallTerminatedByAdmin = () => {
      console.log("HomePage: 'private-call-terminated-by-admin' received.");
      if (isUserInPrivateCall) {
        toast({ title: t('homepage.privateCall.callEndedTitle'), description: t('homepage.privateCall.adminEndedCallDesc'), variant: "default" });
        handleEndPrivateCall(false, "Call terminated by admin event");
      }
    };

    const onForceViewersReconnect = ({ streamTitle, streamSubtitle, isLoggedInOnly }: { streamTitle: string; streamSubtitle: string; isLoggedInOnly: boolean }) => {
      console.log("HomePage: Received 'force-viewers-reconnect' for new stream:", { streamTitle, streamSubtitle, isLoggedInOnly });
      if (isUserInPrivateCall) {
        console.log("HomePage: In private call, ignoring 'force-viewers-reconnect'.");
        return;
      }

      if (peerConnectionForGeneralStreamRef.current && peerConnectionForGeneralStreamRef.current.signalingState !== 'closed') {
        console.log("HomePage: Closing existing general PC due to 'force-viewers-reconnect'.");
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
        console.log("HomePage: Re-registering as viewer due to 'force-viewers-reconnect'.");
        socket.emit('register-general-viewer');
      }
    };

    socket.on('general-broadcaster-ready', onGeneralBroadcasterReady);
    socket.on('general-stream-ended', onGeneralStreamEnded);
    socket.on('general-broadcaster-disconnected', onGeneralBroadcasterDisconnected);
    socket.on('offer-from-general-broadcaster', onOfferFromGeneralBroadcaster);
    socket.on('candidate-from-general-broadcaster', onCandidateFromGeneralBroadcaster);
    socket.on('general-stream-access-denied', onGeneralStreamAccessDenied);
    socket.on('private-call-invite-from-admin', onPrivateCallInviteFromAdmin);
    socket.on('private-sdp-offer-received', onPrivateSdpOfferReceived);
    socket.on('private-ice-candidate-received', onPrivateIceCandidateReceived);
    socket.on('private-call-terminated-by-admin', onPrivateCallTerminatedByAdmin);
    socket.on('force-viewers-reconnect', onForceViewersReconnect);

    return () => {
      socket.off('general-broadcaster-ready', onGeneralBroadcasterReady);
      socket.off('general-stream-ended', onGeneralStreamEnded);
      socket.off('general-broadcaster-disconnected', onGeneralBroadcasterDisconnected);
      socket.off('offer-from-general-broadcaster', onOfferFromGeneralBroadcaster);
      socket.off('candidate-from-general-broadcaster', onCandidateFromGeneralBroadcaster);
      socket.off('general-stream-access-denied', onGeneralStreamAccessDenied);
      socket.off('private-call-invite-from-admin', onPrivateCallInviteFromAdmin);
      socket.off('private-sdp-offer-received', onPrivateSdpOfferReceived);
      socket.off('private-ice-candidate-received', onPrivateIceCandidateReceived);
      socket.off('private-call-terminated-by-admin', onPrivateCallTerminatedByAdmin);
      socket.off('force-viewers-reconnect', onForceViewersReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, siteSettings, loggedInUserId, isUserInPrivateCall, privateCallAdminSocketId, handleEndPrivateCall, toast, t, isUserMicMuted, isUserVideoOff, currentGeneralStreamIsLoggedInOnly, currentBroadcasterId]);

  const toggleUserMicrophone = () => {
    if (userLocalStreamForCall) {
      const newMicState = !isUserMicMuted;
      userLocalStreamForCall.getAudioTracks().forEach(track => track.enabled = !newMicState);
      setIsUserMicMuted(newMicState);
    }
  };
  const toggleUserVideo = () => {
    if (userLocalStreamForCall) {
      const newVideoState = !isUserVideoOff;
      userLocalStreamForCall.getVideoTracks().forEach(track => track.enabled = !newVideoState);
      setIsUserVideoOff(newVideoState);
    }
  };
  const toggleGeneralStreamMute = () => {
    if (generalStreamVideoRef.current) {
      generalStreamVideoRef.current.muted = !generalStreamVideoRef.current.muted;
      setIsGeneralStreamMuted(generalStreamVideoRef.current.muted);
    }
  };

  useEffect(() => {
    const videoEl = generalStreamVideoRef.current;
    if (!videoEl) return;

    const canShowGeneralStream = isGeneralStreamLive && !isUserInPrivateCall &&
      (!currentGeneralStreamIsLoggedInOnly || loggedInUserId);
    let handleLoadedMetadataGlobal: (() => void) | null = null;
    let handleErrorGlobal: ((e: Event) => void) | null = null;

    if (canShowGeneralStream && generalStreamReceived) {
      console.log(
        "HomePage (generalStreamVideoRef Effect): Conditions met, generalStreamReceived is present.",
        "VideoEl srcObject current:",
        videoEl.srcObject ? videoEl.srcObject.id : 'null',
        "New stream ID:",
        generalStreamReceived.id
      );
      if (videoEl.srcObject !== generalStreamReceived) {
        console.log("HomePage (generalStreamVideoRef Effect): Assigning new generalStreamReceived to video element.");
        videoEl.srcObject = generalStreamReceived;
        videoEl.muted = isGeneralStreamMuted;
        videoEl.load(); // Explicitly call load

        handleLoadedMetadataGlobal = () => {
          console.log("HomePage (generalStreamVideoRef Effect): 'loadedmetadata' event fired. Video tracks:", generalStreamReceived?.getVideoTracks());
          if (generalStreamReceived?.getVideoTracks().length === 0) {
            console.warn("HomePage (generalStreamVideoRef Effect): Stream received but has no video tracks.");
            setGeneralStreamWebRtcError("Stream has no video.");
            setIsLoadingGeneralStream(false);
            return;
          }
          videoEl.play()
            .then(() => {
              console.log("HomePage (generalStreamVideoRef Effect): play() successful.");
              setIsLoadingGeneralStream(false);
            })
            .catch(e => {
              console.error("HomePage (generalStreamVideoRef Effect): Error playing general stream:", e);
              if (e.name !== 'AbortError') {
                setGeneralStreamWebRtcError(t('homepage.live.webrtcSetupError') + `: Playback failed - ${e.message}`);
              }
              setIsLoadingGeneralStream(false);
            });
        };

        handleErrorGlobal = (e: Event) => {
          console.error("HomePage (generalStreamVideoRef Effect): Video element error event", e);
          if (e.target && (e.target as HTMLVideoElement).error) {
            setGeneralStreamWebRtcError(t('homepage.live.webrtcSetupError') + `: Video Error Code ${(e.target as HTMLVideoElement).error?.code}`);
          } else {
            setGeneralStreamWebRtcError(t('homepage.live.webrtcSetupError') + ": Unknown video element error.");
          }
          setIsLoadingGeneralStream(false);
        };

        videoEl.addEventListener('loadedmetadata', handleLoadedMetadataGlobal);
        videoEl.addEventListener('error', handleErrorGlobal);
      } else if (videoEl.paused && videoEl.readyState >= 3 && !isLoadingGeneralStream) {
        console.log("HomePage (generalStreamVideoRef Effect): Stream already assigned but paused, attempting to replay.");
        videoEl.play().catch(e => {
          if (e.name !== 'AbortError' && e.name !== 'NotAllowedError')
            console.error("HomePage: Error re-playing general stream:", e);
        });
      } else if (!videoEl.paused && isLoadingGeneralStream) {
        setIsLoadingGeneralStream(false);
      }
    } else {
      if (videoEl.srcObject) {
        console.log("HomePage (generalStreamVideoRef Effect): Clearing srcObject from generalStreamVideoRef because stream cannot be shown.");
        videoEl.srcObject = null;
      }
      if (isLoadingGeneralStream && !isUserInPrivateCall) {
        console.log("HomePage (generalStreamVideoRef Effect): Conditions not met or stream not received, ensuring loader is off for general stream.");
        setIsLoadingGeneralStream(false);
      }
    }
    return () => {
      console.log("HomePage (generalStreamVideoRef Effect): Cleanup running.");
      if (videoEl && handleLoadedMetadataGlobal) {
        videoEl.removeEventListener('loadedmetadata', handleLoadedMetadataGlobal);
      }
      if (videoEl && handleErrorGlobal) {
        videoEl.removeEventListener('error', handleErrorGlobal);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalStreamReceived, isGeneralStreamLive, isUserInPrivateCall, currentGeneralStreamIsLoggedInOnly, loggedInUserId, isGeneralStreamMuted]);

  useEffect(() => {
    const videoEl = privateCallMainVideoRef.current;
    if (videoEl) {
      if (adminStreamForCall && isUserInPrivateCall) {
        if (videoEl.srcObject !== adminStreamForCall) {
          console.log("HomePage (Private Call Main Video Effect): Assigning adminStreamForCall to privateCallMainVideoRef.");
          setIsLoadingPrivateCallVideo(true);
          videoEl.srcObject = adminStreamForCall;
          videoEl.muted = false;
          videoEl.load(); // Explicitly call load

          const handleLoadedMetadata = () => {
            console.log("HomePage (Private Call Main Video Effect): 'loadedmetadata' for privateCallMainVideoRef.");
            videoEl.play()
              .catch(e => {
                if (e.name !== 'AbortError') console.error("HomePage: Error playing admin stream in call:", e);
              })
              .finally(() => setIsLoadingPrivateCallVideo(false));
          };
          videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
          return () => videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      } else if (videoEl.srcObject) {
        console.log("HomePage (Private Call Main Video Effect): Clearing srcObject from privateCallMainVideoRef.");
        videoEl.srcObject = null;
        setIsLoadingPrivateCallVideo(false);
      }
    }
  }, [adminStreamForCall, isUserInPrivateCall]);

  useEffect(() => {
    const videoEl = privateCallUserPipVideoRef.current;
    if (videoEl) {
      if (userLocalStreamForCall && isUserInPrivateCall) {
        if (videoEl.srcObject !== userLocalStreamForCall) {
          console.log("HomePage (User PiP Effect): Assigning userLocalStreamForCall to privateCallUserPipVideoRef.");
          videoEl.srcObject = userLocalStreamForCall;
          videoEl.muted = true;
          videoEl.load(); // Explicitly call load
          videoEl.onloadedmetadata = () => {
            videoEl.play().catch(e => {
              if (e.name !== 'AbortError') console.error("HomePage: Error playing user PiP stream:", e);
            });
          };
        }
        videoEl.style.visibility = isUserVideoOff ? 'hidden' : 'visible';
      } else if (videoEl.srcObject) {
        console.log("HomePage (User PiP Effect): Clearing srcObject from privateCallUserPipVideoRef.");
        videoEl.srcObject = null;
      }
    }
  }, [userLocalStreamForCall, isUserInPrivateCall, isUserVideoOff]);

  if (isLoadingSiteSettings || !siteSettings) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const { heroTitle, heroTagline, heroTaglineColor, heroTaglineSize, heroSubtitle } = siteSettings;
  const taglineStyle: React.CSSProperties = {};
  if (heroTaglineColor && /^#[0-9A-Fa-f]{6}$/i.test(heroTaglineColor)) {
    taglineStyle.color = heroTaglineColor;
  }
  const taglineSizeClasses: Record<HeroTaglineSize, string> = {
    sm: 'text-lg md:text-xl',
    md: 'text-xl md:text-2xl',
    lg: 'text-2xl md:text-3xl',
  };
  const currentTaglineSizeClass = taglineSizeClasses[heroTaglineSize || 'md'];

  const showPrivateCallUI = isUserInPrivateCall && loggedInUserId === siteSettings.liveStreamAuthorizedUserId;
  const canDisplayGeneralStream = isGeneralStreamLive && !isUserInPrivateCall &&
    (!currentGeneralStreamIsLoggedInOnly || (currentGeneralStreamIsLoggedInOnly && loggedInUserId));

  let mainDisplayVideoRef = showPrivateCallUI ? privateCallMainVideoRef : generalStreamVideoRef;
  let mainDisplayVideoIsMuted = showPrivateCallUI ? false : isGeneralStreamMuted;

  let videoAreaEffectiveTitle = showPrivateCallUI
    ? t('homepage.privateCall.adminVideoLabel')
    : generalStreamTitle;

  let videoAreaEffectiveSubtitle = showPrivateCallUI
    ? privateCallStatusMessage
    : (isGeneralStreamLive ? generalStreamSubtitle : '');

  let showOfflineMessageInVideoArea = !isGeneralStreamLive && !showPrivateCallUI;

  let isLoadingStateForVideoArea =
    (canDisplayGeneralStream && isLoadingGeneralStream && !generalStreamWebRtcError && !showPrivateCallUI) ||
    (showPrivateCallUI && isLoadingPrivateCallVideo && hasCallCameraPermission !== false &&
      (privateCallStatusMessage === t('homepage.privateCall.statusConnecting') ||
        privateCallStatusMessage === t('homepage.privateCall.statusIncoming')));

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section
          className="relative bg-gradient-to-br from-primary/20 via-background to-background py-20 md:py-32 text-center overflow-hidden"
          style={{
            backgroundImage: `radial-gradient(circle at top right, hsl(var(--primary)/0.1), transparent 40%), radial-gradient(circle at bottom left, hsl(var(--primary)/0.15), transparent 50%)`,
          }}
        >
          <div className="container mx-auto px-4 relative z-10">
            <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-primary">
              {heroTitle || t('homepage.hero.title')}
            </h1>
            {heroTagline && (
              <p className={cn("font-semibold mb-6", currentTaglineSizeClass)} style={taglineStyle}>
                {heroTagline}
              </p>
            )}
            <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-8">
              {heroSubtitle || t('homepage.hero.subtitle')}
            </p>
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transform hover:scale-105 transition-transform">
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
              <span className="text-primary">
                {videoAreaEffectiveTitle}
              </span>
            </h2>
            {videoAreaEffectiveSubtitle && (
              <p className="text-muted-foreground mb-4 text-lg">
                {videoAreaEffectiveSubtitle}
              </p>
            )}
            {!showPrivateCallUI && !generalStreamSubtitle && isGeneralStreamLive && (
              <p className="text-muted-foreground mb-4 text-lg">{t('homepage.live.broadcastingNow')}</p>
            )}
            {!showPrivateCallUI && !isGeneralStreamLive && (
              <p className="text-muted-foreground mb-4 text-lg">{siteLiveStreamOfflineMessage || t('homepage.live.currentlyOffline')}</p>
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
                <div className={cn("absolute bottom-4 right-4 w-1/3 sm:w-1/4 max-w-[200px] aspect-video border-2 border-primary rounded-md overflow-hidden shadow-lg z-10", isUserVideoOff && "invisible")}>
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
                  {isGeneralStreamMuted ? t('adminLivestream.configCard.unmuteLocalAudioButton') : t('adminLivestream.configCard.muteLocalAudioButton')}
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
                  <Button onClick={() => handleEndPrivateCall(true, "User clicked end call button")} variant="destructive" size="sm">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center">
                {videoCourses.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onWatchNowClick={handleOpenVideoPlayer}
                    onCourseCardClick={handleOpenCourseDetail}
                    displayCurrency={displayCurrency}
                    exchangeRates={effectiveExchangeRates}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">
                {t('homepage.courses.noCourses')}
              </p>
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
