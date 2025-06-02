
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


  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<SessionUserProfile | null>(null);

  const [isUserInPrivateCall, setIsUserInPrivateCall] = useState(false);
  const [privateCallAdminSocketId, setPrivateCallAdminSocketId] = useState<string | null>(null);
  const localUserStreamForCallRef = useRef<MediaStream | null>(null);
  const privateCallMainVideoRef = useRef<HTMLVideoElement | null>(null);
  const privateCallUserPipVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionForPrivateCallRef = useRef<RTCPeerConnection | null>(null);
  const [privateCallStatusMessage, setPrivateCallStatusMessage] = useState('');
  const [isUserMicMuted, setIsUserMicMuted] = useState(false);
  const [isUserVideoOff, setIsUserVideoOff] = useState(false);
  const [adminStreamForCall, setAdminStreamForCall] = useState<MediaStream | null>(null);
  const [hasCallCameraPermission, setHasCallCameraPermission] = useState<boolean | null>(null);


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
      }
    }
  }, []);

  useEffect(() => {
    if (siteSettings) {
      setCurrentExchangeRates(siteSettings.exchangeRates);
      if (!isGeneralStreamLive && !isUserInPrivateCall) {
        setGeneralStreamTitle(siteLiveStreamDefaultTitle || t('homepage.live.defaultTitle'));
        setGeneralStreamSubtitle(siteSettings.heroSubtitle || '');
      }
    }
  }, [siteSettings, siteLiveStreamDefaultTitle, t, isGeneralStreamLive, isUserInPrivateCall]);

  useEffect(() => {
    const fetchCourses = async () => { setIsLoadingCourses(true); try { const response = await fetch('/api/video-courses'); if (!response.ok) throw new Error('Failed to fetch courses'); const data = await response.json(); setVideoCourses(data); } catch (error) { console.error(error); toast({ title: "Error", description: "Failed to load video courses.", variant: "destructive" }); } finally { setIsLoadingCourses(false); }};
    fetchCourses();
  }, [toast]);

  const fetchAndShowAnnouncement = useCallback(async () => { setIsLoadingAnnouncement(true); try { if (isLoadingSiteSettings) return; const response = await fetch('/api/announcements?activeOnly=true&nonExpiredOnly=true'); if (!response.ok) return; const announcements: Announcement[] = await response.json(); if (announcements.length > 0) { const firstAnn = announcements[0]; const viewedKey = `announcement_viewed_${firstAnn.id}`; if (firstAnn.showOnce && typeof window !== 'undefined' && localStorage.getItem(viewedKey) === 'true') { setCurrentAnnouncement(null); } else { setCurrentAnnouncement(firstAnn); setIsAnnouncementModalOpen(true); } } else { setCurrentAnnouncement(null); } } catch (error) { console.error("Error fetching announcements:", error); setCurrentAnnouncement(null); } finally { setIsLoadingAnnouncement(false); } }, [isLoadingSiteSettings]);
  useEffect(() => { fetchAndShowAnnouncement(); }, [fetchAndShowAnnouncement]);

  const handleOpenVideoPlayer = (video: Video) => { setSelectedVideoForPlayer(video); setIsVideoPlayerModalOpen(true); };
  const handleOpenCourseDetail = (video: Video) => { setSelectedCourseForDetail(video); setIsCourseDetailModalOpen(true); };
  const handleWatchFromDetailModal = (video: Video) => { setIsCourseDetailModalOpen(false); handleOpenVideoPlayer(video); };

  const handleEndPrivateCall = useCallback((emitToServer = true, reason = "User ended call") => {
    if (peerConnectionForPrivateCallRef.current) { peerConnectionForPrivateCallRef.current.close(); peerConnectionForPrivateCallRef.current = null; }
    localUserStreamForCallRef.current?.getTracks().forEach(track => track.stop()); localUserStreamForCallRef.current = null;
    setAdminStreamForCall(null);
    if (privateCallMainVideoRef.current) privateCallMainVideoRef.current.srcObject = null;
    if (privateCallUserPipVideoRef.current) privateCallUserPipVideoRef.current.srcObject = null;
    if (socket && socket.connected && emitToServer && privateCallAdminSocketId) socket.emit('user-end-private-call', { adminSocketId: privateCallAdminSocketId });
    setIsUserInPrivateCall(false); setPrivateCallAdminSocketId(null); setPrivateCallStatusMessage(''); setIsUserMicMuted(false); setIsUserVideoOff(false); setHasCallCameraPermission(null);
    if (socket && socket.connected) socket.emit('register-general-viewer');
  }, [socket, privateCallAdminSocketId]);

  useEffect(() => {
    if (isLoadingSiteSettings) { if (socket) { socket.disconnect(); setSocket(null); } return; }
    let shouldConnectSocket = false; let queryParams: { appUserId?: string } = {};
    if (loggedInUserId) { shouldConnectSocket = true; queryParams.appUserId = loggedInUserId;
    } else if (siteSettings && !siteSettings.liveStreamForLoggedInUsersOnly) { shouldConnectSocket = true;
    } else if (!loggedInUserId && siteSettings && siteSettings.liveStreamForLoggedInUsersOnly) {
      if (socket) { socket.disconnect(); setSocket(null); } setIsGeneralStreamLive(false); setGeneralStreamReceived(null); return;
    }
    if (shouldConnectSocket) {
      console.log("HomePage: Attempting to connect socket with query:", queryParams);
      const newSocket = io({ path: '/api/socket_io', query: queryParams }); setSocket(newSocket);
      return () => { console.log("HomePage: Disconnecting socket"); newSocket.disconnect(); setSocket(null); };
    }
  }, [loggedInUserId, siteSettings, isLoadingSiteSettings]);


  useEffect(() => {
    if (!socket) return;
    socket.on('connect', () => { console.log("HomePage: Socket connected!", socket.id); if (!isUserInPrivateCall) socket.emit('register-general-viewer'); });
    socket.on('connect_error', (error) => { console.error('HomePage: Socket connection error:', error); toast({ variant: 'destructive', title: 'Socket Connection Error', description: `User: ${error.message}` }); });
    socket.on('disconnect', (reason) => {
       console.log("HomePage: Socket disconnected. Reason:", reason);
       if (reason !== 'io client disconnect') toast({ variant: 'destructive', title: 'Socket Disconnected', description: `Reason: ${reason}` });
      setIsGeneralStreamLive(false); setGeneralStreamReceived(null); setCurrentGeneralStreamIsLoggedInOnly(false);
      if (peerConnectionForGeneralStreamRef.current) { peerConnectionForGeneralStreamRef.current.close(); peerConnectionForGeneralStreamRef.current = null; }
      if (isUserInPrivateCall) handleEndPrivateCall(false, "Socket disconnected during call");
    });

    const onGeneralBroadcasterReady = ({ broadcasterId, streamTitle, streamSubtitle, isLoggedInOnly }: { broadcasterId: string, streamTitle?: string, streamSubtitle?: string, isLoggedInOnly?: boolean }) => {
      console.log('HomePage: Event "general-broadcaster-ready". Title:', streamTitle, "Subtitle:", streamSubtitle, "IsLoggedInOnly:", isLoggedInOnly);
      if (isLoggedInOnly && !loggedInUserId) {
        setIsGeneralStreamLive(false); setGeneralStreamReceived(null);
        setGeneralStreamTitle(streamTitle || siteSettings?.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
        setGeneralStreamSubtitle(streamSubtitle || '');
        setCurrentGeneralStreamIsLoggedInOnly(isLoggedInOnly || false);
        toast({ title: t('homepage.live.accessDenied'), description: t('homepage.live.accessDeniedDescription'), variant: "destructive" }); return;
      }
      if (isUserInPrivateCall) return;
      setGeneralStreamTitle(streamTitle || siteSettings?.liveStreamDefaultTitle || t('homepage.live.defaultTitle'));
      setGeneralStreamSubtitle(streamSubtitle || '');
      setCurrentGeneralStreamIsLoggedInOnly(isLoggedInOnly || false);
      setIsGeneralStreamLive(true); setGeneralStreamWebRtcError(null); setGeneralStreamReceived(null);
    };
    const onGeneralStreamEnded = () => {
      if (isUserInPrivateCall) return;
      setIsGeneralStreamLive(false); setGeneralStreamReceived(null); setCurrentGeneralStreamIsLoggedInOnly(false);
      if (peerConnectionForGeneralStreamRef.current) { peerConnectionForGeneralStreamRef.current.close(); peerConnectionForGeneralStreamRef.current = null; }
      setGeneralStreamWebRtcError(null); setGeneralStreamTitle(siteSettings?.liveStreamDefaultTitle || t('homepage.live.defaultTitle')); setGeneralStreamSubtitle('');
    };
    const onGeneralBroadcasterDisconnected = onGeneralStreamEnded; // Same logic
    const onOfferFromGeneralBroadcaster = async ({ broadcasterId, offer }: { broadcasterId: string, offer: RTCSessionDescriptionInit }) => {
      console.log("HomePage: Received offer from general broadcaster", broadcasterId);
      if (isUserInPrivateCall || !socket || !socket.connected) return;
      if (currentGeneralStreamIsLoggedInOnly && !loggedInUserId) { socket.emit('general-stream-access-denied', { message: 'This live stream is for registered users only.' }); setIsGeneralStreamLive(false); return; }
      if (peerConnectionForGeneralStreamRef.current && peerConnectionForGeneralStreamRef.current.signalingState !== 'closed') peerConnectionForGeneralStreamRef.current.close();
      peerConnectionForGeneralStreamRef.current = new RTCPeerConnection(PC_CONFIG);
      peerConnectionForGeneralStreamRef.current.ontrack = (event) => { console.log("HomePage: General stream ontrack event:", event); if (event.streams[0]) setGeneralStreamReceived(event.streams[0]); else console.warn("HomePage: General stream ontrack event received no stream."); };
      peerConnectionForGeneralStreamRef.current.onicecandidate = (event) => { if (event.candidate && socket.connected) { try { socket.emit('general-stream-candidate-to-broadcaster', { broadcasterId, candidate: event.candidate }); } catch (e:any) { console.error("Error emitting ICE to broadcaster:", e.message);}} };
      peerConnectionForGeneralStreamRef.current.onconnectionstatechange = () => {
        if (peerConnectionForGeneralStreamRef.current) {
            const state = peerConnectionForGeneralStreamRef.current.connectionState;
            console.log("HomePage: General stream PC connection state:", state);
            if (['failed', 'disconnected', 'closed'].includes(state)) { setGeneralStreamWebRtcError(t('homepage.live.connectionLostError')); setIsGeneralStreamLive(false); setGeneralStreamReceived(null); }
            else if (state === 'connected') setGeneralStreamWebRtcError(null);
        }
      };
      try {
        await peerConnectionForGeneralStreamRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionForGeneralStreamRef.current.createAnswer();
        await peerConnectionForGeneralStreamRef.current.setLocalDescription(answer);
        if (socket.connected) socket.emit('general-stream-answer-to-broadcaster', { broadcasterId, answer });
      } catch (error:any) { console.error("HomePage: Error handling general stream offer:", error.message); setGeneralStreamWebRtcError(t('homepage.live.webrtcSetupError')); }
    };
    const onCandidateFromGeneralBroadcaster = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (isUserInPrivateCall || !peerConnectionForGeneralStreamRef.current || !candidate || !peerConnectionForGeneralStreamRef.current.remoteDescription) return;
      try { await peerConnectionForGeneralStreamRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (error:any) { console.error('HomePage: Error adding ICE candidate from general broadcaster:', candidate, error.message); }
    };
    const onGeneralStreamAccessDenied = ({ message }: { message: string }) => {
      setIsGeneralStreamLive(false); setGeneralStreamReceived(null);
      toast({ title: t('homepage.live.accessDenied'), description: message || t('homepage.live.accessDeniedDescription'), variant: "destructive" });
    };
    const onPrivateCallInviteFromAdmin = async ({ adminSocketId: adSocketId, adminAppUserId }: { adminSocketId: string, adminAppUserId: string }) => {
      console.log("HomePage: Received private call invite from admin", adSocketId);
      if (loggedInUserId && siteSettings?.liveStreamAuthorizedUserId === loggedInUserId && !isUserInPrivateCall) {
        if (peerConnectionForGeneralStreamRef.current) { peerConnectionForGeneralStreamRef.current.close(); peerConnectionForGeneralStreamRef.current = null; }
        setGeneralStreamReceived(null); setIsGeneralStreamLive(false);
        setPrivateCallAdminSocketId(adSocketId); setPrivateCallStatusMessage(t('homepage.privateCall.statusIncoming')); setIsUserInPrivateCall(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setHasCallCameraPermission(true); localUserStreamForCallRef.current = stream;
            if (privateCallUserPipVideoRef.current) { privateCallUserPipVideoRef.current.srcObject = stream; privateCallUserPipVideoRef.current.muted = true; await privateCallUserPipVideoRef.current.play().catch(e=>console.error("Error playing user PiP", e)); }
            stream.getAudioTracks().forEach(track => track.enabled = !isUserMicMuted); stream.getVideoTracks().forEach(track => track.enabled = !isUserVideoOff);
            if (peerConnectionForPrivateCallRef.current && peerConnectionForPrivateCallRef.current.signalingState !== 'closed') peerConnectionForPrivateCallRef.current.close();
            peerConnectionForPrivateCallRef.current = new RTCPeerConnection(PC_CONFIG);
            stream.getTracks().forEach(track => { try { peerConnectionForPrivateCallRef.current!.addTrack(track, stream); } catch(e:any) { console.error("Error adding track to private PC:", track.kind, e.message); }});
            peerConnectionForPrivateCallRef.current.onicecandidate = (event) => { if (event.candidate && socket && socket.connected) { try { socket.emit('private-ice-candidate', { targetSocketId: adSocketId, candidate: event.candidate }); } catch (e:any) { console.error("Error emitting private ICE:", e.message); }}};
            peerConnectionForPrivateCallRef.current.ontrack = (event) => { console.log("HomePage: Private call ontrack event:", event); if (event.streams[0]) setAdminStreamForCall(event.streams[0]); else setAdminStreamForCall(null); };
            peerConnectionForPrivateCallRef.current.onconnectionstatechange = () => { if (peerConnectionForPrivateCallRef.current) { const state = peerConnectionForPrivateCallRef.current.connectionState; console.log("HomePage: Private call PC connection state:", state); if (state === 'connected') setPrivateCallStatusMessage(t('homepage.privateCall.statusConnected')); else if (['failed', 'disconnected', 'closed'].includes(state)) { if (isUserInPrivateCall) handleEndPrivateCall(false, `PC state changed to ${state}`); }}};
            if (socket && socket.connected) { socket.emit('user-accepts-private-call', { adminSocketId: adSocketId }); setPrivateCallStatusMessage(t('homepage.privateCall.statusConnecting'));
            } else { setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed') + " (Socket Error)"); handleEndPrivateCall(false, "Socket disconnected before user could accept call"); }
        } catch (error) {
            console.error("HomePage: Error getting user media for call:", error);
            setPrivateCallStatusMessage(t('homepage.privateCall.cameraError')); toast({ title: t('homepage.privateCall.cameraPermissionErrorTitle'), description: t('homepage.privateCall.cameraPermissionErrorDescription'), variant: "destructive" });
            setHasCallCameraPermission(false); handleEndPrivateCall(false, "Error getting user media for call");
        }
      }
    };
    const onPrivateSdpOfferReceived = async ({ senderSocketId, offer }: { senderSocketId: string, offer: RTCSessionDescriptionInit }) => {
      console.log("HomePage: Received SDP offer for private call from", senderSocketId);
      if (isUserInPrivateCall && senderSocketId === privateCallAdminSocketId && peerConnectionForPrivateCallRef.current && socket && socket.connected) {
        try {
          await peerConnectionForPrivateCallRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnectionForPrivateCallRef.current.createAnswer();
          await peerConnectionForPrivateCallRef.current.setLocalDescription(answer);
          if (socket.connected) { socket.emit('private-sdp-answer', { targetSocketId: senderSocketId, answer }); setPrivateCallStatusMessage(t('homepage.privateCall.statusConnected'));
          } else { setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed') + " (Socket Error)"); handleEndPrivateCall(false, "Socket disconnected before sending SDP answer"); }
        } catch (error:any) { console.error("HomePage: Error handling private call offer or creating answer:", error.message); setPrivateCallStatusMessage(t('homepage.privateCall.statusFailed')); handleEndPrivateCall(false, "Error handling SDP offer"); }
      }
    };
    const onPrivateIceCandidateReceived = async ({ senderSocketId, candidate }: { senderSocketId: string, candidate: RTCIceCandidateInit }) => {
      if (isUserInPrivateCall && senderSocketId === privateCallAdminSocketId && peerConnectionForPrivateCallRef.current && candidate && peerConnectionForPrivateCallRef.current.remoteDescription) {
        try { await peerConnectionForPrivateCallRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (error:any) { console.error('HomePage: Error adding received ICE candidate for private call:', candidate, error.message); }
      }
    };
    const onPrivateCallTerminatedByAdmin = () => { if (isUserInPrivateCall) { toast({ title: t('homepage.privateCall.callEndedTitle'), description:t('homepage.privateCall.adminEndedCallDesc'), variant: "default" }); handleEndPrivateCall(false, "Call terminated by admin event"); }};

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

    return () => {
        console.log("HomePage: Cleaning up socket listeners");
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
    };
  }, [socket, siteSettings, loggedInUserId, isUserInPrivateCall, privateCallAdminSocketId, handleEndPrivateCall, toast, t, isUserMicMuted, isUserVideoOff, currentGeneralStreamIsLoggedInOnly]);

  const toggleUserMicrophone = () => { if (localUserStreamForCallRef.current) { const newMicState = !isUserMicMuted; localUserStreamForCallRef.current.getAudioTracks().forEach(track => track.enabled = !newMicState); setIsUserMicMuted(newMicState); }};
  const toggleUserVideo = () => { if (localUserStreamForCallRef.current) { const newVideoState = !isUserVideoOff; localUserStreamForCallRef.current.getVideoTracks().forEach(track => track.enabled = !newVideoState); setIsUserVideoOff(newVideoState); if (privateCallUserPipVideoRef.current) privateCallUserPipVideoRef.current.style.visibility = newVideoState ? 'hidden' : 'visible'; }};
  const toggleGeneralStreamMute = () => { if (generalStreamVideoRef.current) { generalStreamVideoRef.current.muted = !generalStreamVideoRef.current.muted; setIsGeneralStreamMuted(generalStreamVideoRef.current.muted); }};

  useEffect(() => {
    const videoEl = generalStreamVideoRef.current;
    if (videoEl) {
      const canShowGeneralStream = isGeneralStreamLive && !isUserInPrivateCall && (!currentGeneralStreamIsLoggedInOnly || loggedInUserId);
      if (canShowGeneralStream && generalStreamReceived) {
        if (videoEl.srcObject !== generalStreamReceived) {
          console.log("HomePage: Assigning general stream to generalStreamVideoRef. Stream ID:", generalStreamReceived.id);
          videoEl.srcObject = generalStreamReceived;
          // videoEl.muted = isGeneralStreamMuted; // Muted by default, user can unmute
          videoEl.play().then(() => console.log("HomePage: General stream playback attempt."))
                        .catch(e => { if (e.name !== 'AbortError') console.error("HomePage: Error playing general stream:", e); });
        }
      } else if (videoEl.srcObject) {
        videoEl.srcObject = null;
      }
    }
  }, [generalStreamReceived, isGeneralStreamLive, isUserInPrivateCall, currentGeneralStreamIsLoggedInOnly, loggedInUserId, isGeneralStreamMuted]);

  useEffect(() => {
    const videoEl = privateCallMainVideoRef.current;
    if (videoEl) {
        if (adminStreamForCall && isUserInPrivateCall) {
            if (videoEl.srcObject !== adminStreamForCall) {
                videoEl.srcObject = adminStreamForCall; videoEl.muted = false;
                videoEl.play().catch(e => { if (e.name !== 'AbortError') console.error("Error playing admin stream in call:", e); });
            }
        } else if (videoEl.srcObject) videoEl.srcObject = null;
    }
  }, [adminStreamForCall, isUserInPrivateCall]);

  useEffect(() => {
    const videoEl = privateCallUserPipVideoRef.current;
    if (videoEl) {
        if (localUserStreamForCallRef.current && isUserInPrivateCall) {
            if (videoEl.srcObject !== localUserStreamForCallRef.current) {
                videoEl.srcObject = localUserStreamForCallRef.current; videoEl.muted = true;
                videoEl.play().catch(e => { if (e.name !== 'AbortError') console.error("Error playing user PiP stream:", e); });
            }
            videoEl.style.visibility = isUserVideoOff ? 'hidden' : 'visible';
        } else if (videoEl.srcObject) videoEl.srcObject = null;
    }
  }, [localUserStreamForCallRef, isUserInPrivateCall, isUserVideoOff]);


  if (isLoadingSiteSettings || !siteSettings) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const { heroTitle, heroTagline, heroTaglineColor, heroTaglineSize, heroSubtitle } = siteSettings;
  const taglineStyle: React.CSSProperties = {};
  if (heroTaglineColor) {
    taglineStyle.color = heroTaglineColor;
  }
  const taglineSizeClasses: Record<HeroTaglineSize, string> = {
    sm: 'text-lg md:text-xl',
    md: 'text-xl md:text-2xl',
    lg: 'text-2xl md:text-3xl',
  };
  const currentTaglineSizeClass = taglineSizeClasses[heroTaglineSize || 'md'];


  const showPrivateCallUI = isUserInPrivateCall && loggedInUserId === siteSettings.liveStreamAuthorizedUserId;
  const canDisplayGeneralStream = isGeneralStreamLive && (!currentGeneralStreamIsLoggedInOnly || (currentGeneralStreamIsLoggedInOnly && loggedInUserId));

  let mainDisplayVideoRef = showPrivateCallUI ? privateCallMainVideoRef : generalStreamVideoRef;
  let mainDisplayStream = showPrivateCallUI ? adminStreamForCall : generalStreamReceived;
  let isMainVideoMuted = showPrivateCallUI ? false : isGeneralStreamMuted;


  let isLoadingStateForVideoArea = false;
  if (!showPrivateCallUI && canDisplayGeneralStream && !mainDisplayStream && generalStreamWebRtcError === null) {
    isLoadingStateForVideoArea = true; // Loading general stream
  } else if (showPrivateCallUI && !mainDisplayStream && localUserStreamForCallRef.current && hasCallCameraPermission && (privateCallStatusMessage === t('homepage.privateCall.statusIncoming') || privateCallStatusMessage === t('homepage.privateCall.statusConnecting'))) {
    isLoadingStateForVideoArea = true; // Loading private call (admin's stream)
  }


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
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
                {showPrivateCallUI ? t('homepage.privateCall.title') : generalStreamTitle}
              </span>
            </h2>
            {((!showPrivateCallUI && generalStreamSubtitle) || (showPrivateCallUI && privateCallStatusMessage)) && (
                 <p className="text-muted-foreground mb-4 text-lg">
                    {showPrivateCallUI ? privateCallStatusMessage : generalStreamSubtitle}
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
                  controls={!showPrivateCallUI && canDisplayGeneralStream && !!mainDisplayStream}
                  autoPlay
                  muted={isMainVideoMuted}
              />

              {showPrivateCallUI && localUserStreamForCallRef.current && (
                <div className={cn("absolute bottom-4 right-4 w-1/3 sm:w-1/4 aspect-video border-2 border-primary rounded-md overflow-hidden shadow-lg z-10", isUserVideoOff && "invisible")}>
                  <p className="absolute top-0 left-0 bg-black/50 text-white text-xs px-1 py-0.5 rounded-br-md">{t('homepage.privateCall.yourVideoLabel')}</p>
                  <video ref={privateCallUserPipVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                </div>
              )}

              {isLoadingStateForVideoArea && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
                      <p className="text-md text-muted-foreground">{showPrivateCallUI ? privateCallStatusMessage : t('homepage.live.connecting')}</p>
                  </div>
              )}
              {!mainDisplayStream && !isLoadingStateForVideoArea &&(
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                  <VideoIconLucideSvg className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-xl text-muted-foreground">
                    {showPrivateCallUI ? privateCallStatusMessage || t('homepage.live.statusOffline') : (siteLiveStreamOfflineMessage || t('homepage.live.statusOffline'))}
                  </p>
                 </div>
              )}
              {generalStreamWebRtcError && !showPrivateCallUI && <Alert variant="destructive" className="mt-4 text-left"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t('homepage.live.streamingIssueTitle')}</AlertTitle><AlertDescription>{generalStreamWebRtcError}</AlertDescription></Alert>}
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
                {showPrivateCallUI && localUserStreamForCallRef.current && (
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
              <div className="flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
            ) : videoCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videoCourses.map(video => (
                  <VideoCard key={video.id} video={video} onWatchNowClick={handleOpenVideoPlayer} onCourseCardClick={handleOpenCourseDetail} displayCurrency={displayCurrency} exchangeRates={effectiveExchangeRates} />
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
      {selectedVideoForPlayer && ( <VideoPlayerModal isOpen={isVideoPlayerModalOpen} onOpenChange={setIsVideoPlayerModalOpen} videoUrl={selectedVideoForPlayer.videoUrl} title={selectedVideoForPlayer.title} /> )}
      {selectedCourseForDetail && displayCurrency && effectiveExchangeRates && ( <CourseDetailModal isOpen={isCourseDetailModalOpen} onOpenChange={setIsCourseDetailModalOpen} video={selectedCourseForDetail} onWatchVideo={handleWatchFromDetailModal} displayCurrency={displayCurrency} exchangeRates={effectiveExchangeRates} /> )}
      {!isLoadingAnnouncement && currentAnnouncement && ( <AnnouncementModal isOpen={isAnnouncementModalOpen} onOpenChange={(open) => { setIsAnnouncementModalOpen(open); if (!open && currentAnnouncement?.showOnce && currentAnnouncement.id && typeof window !== 'undefined') { localStorage.setItem(`announcement_viewed_${currentAnnouncement.id}`, 'true'); }}} announcement={currentAnnouncement} /> )}
    </div>
  );
}

