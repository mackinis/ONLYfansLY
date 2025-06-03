
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Radio, Settings, StopCircle, Video as VideoIconLucideSvg, AlertTriangle, Save, Mic, MicOff, Loader2, VolumeX, Volume2, Users, UserCheck, ShieldAlert, CheckCircle, Eye, EyeOff, PhoneCall, PhoneOff } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from '@/context/I18nContext';
import type { SiteSettings, UserProfile, SessionUserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function LiveStreamAdminPage() {
  const { t, siteSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const { toast } = useToast();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [adminAppUserId, setAdminAppUserId] = useState<string | null>(null);

  // General Unidirectional Stream States
  const [isGeneralStreamActive, setIsGeneralStreamActive] = useState(false);
  const [currentGeneralStreamTitle, setCurrentGeneralStreamTitle] = useState('');
  const [currentGeneralStreamSubtitle, setCurrentGeneralStreamSubtitle] = useState('');
  const [adminLocalStreamForGeneral, setAdminLocalStreamForGeneral] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [generalStreamViewerCount, setGeneralStreamViewerCount] = useState(0);

  // Private Bi-directional Call States
  const [isPrivateCallActive, setIsPrivateCallActive] = useState(false);
  const [privateCallStatus, setPrivateCallStatus] = useState<string>('');
  const [adminLocalStreamForCall, setAdminLocalStreamForCall] = useState<MediaStream | null>(null);
  const [privateCallRemoteStream, setPrivateCallRemoteStream] = useState<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localPipVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionForCallRef = useRef<RTCPeerConnection | null>(null);
  const [authorizedUserForStream, setAuthorizedUserForStream] = useState<UserProfile | null>(null);
  const [isLoadingAuthorizedUser, setIsLoadingAuthorizedUser] = useState(false);
  const [isAuthorizedUserConnected, setIsAuthorizedUserConnected] = useState(false);
  const [authorizedUserSocketIdForCall, setAuthorizedUserSocketIdForCall] = useState<string | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const [localDefaultStreamTitle, setLocalDefaultStreamTitle] = useState('');
  const [localOfflineMessage, setLocalOfflineMessage] = useState('');
  const [localLiveStreamForLoggedInOnly, setLocalLiveStreamForLoggedInOnly] = useState(false);
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);

  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isLocalPreviewAudioMuted, setIsLocalPreviewAudioMuted] = useState(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserProfile = sessionStorage.getItem('aurum_user_profile');
      if (storedUserProfile) {
        try {
          const user: SessionUserProfile = JSON.parse(storedUserProfile);
          if (user.role === 'admin' && user.id) {
            setAdminAppUserId(user.id);
          }
        } catch (e) { console.error("AdminLiveStream: Error parsing admin profile for socket", e); }
      }
    }
  }, []);

  const fetchAuthorizedUserData = useCallback(async (userId: string) => {
    console.log("AdminLiveStream: fetchAuthorizedUserData called for userId:", userId);
    if (!userId) {
      setAuthorizedUserForStream(null);
      setIsAuthorizedUserConnected(false);
      setAuthorizedUserSocketIdForCall(null);
      return;
    }
    setIsLoadingAuthorizedUser(true);
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error(`Failed to fetch user ${userId}`);
      const userProfile: UserProfile = await response.json();
      setAuthorizedUserForStream(userProfile);
      if (socket && socket.connected) {
        console.log("AdminLiveStream: Requesting authorized user status via socket for:", userId);
        socket.emit('request-authorized-user-status', { targetUserAppId: userId });
      }
    } catch (error) {
      console.error("AdminLiveStream: Error fetching authorized user details:", error);
      setAuthorizedUserForStream(null);
      setIsAuthorizedUserConnected(false);
      setAuthorizedUserSocketIdForCall(null);
    } finally {
      setIsLoadingAuthorizedUser(false);
    }
  }, [socket]);

  useEffect(() => {
    if (siteSettings) {
      setLocalDefaultStreamTitle(siteSettings.liveStreamDefaultTitle || t('adminLivestream.defaultStreamTitle'));
      setLocalOfflineMessage(siteSettings.liveStreamOfflineMessage || t('adminLivestream.defaultOfflineMessage'));
      setLocalLiveStreamForLoggedInOnly(siteSettings.liveStreamForLoggedInUsersOnly || false);
      
      setCurrentGeneralStreamTitle(siteSettings.liveStreamDefaultTitle || '');
      setCurrentGeneralStreamSubtitle(siteSettings.liveStreamSubtitle || ''); 
      
      if (siteSettings.liveStreamAuthorizedUserId && siteSettings.liveStreamAuthorizedUserId !== authorizedUserForStream?.id) {
        fetchAuthorizedUserData(siteSettings.liveStreamAuthorizedUserId);
      } else if (!siteSettings.liveStreamAuthorizedUserId) {
        setAuthorizedUserForStream(null);
        setIsAuthorizedUserConnected(false);
        setAuthorizedUserSocketIdForCall(null);
      }
    }
  }, [siteSettings, t, fetchAuthorizedUserData, authorizedUserForStream?.id]);

  const handleEndPrivateCall = useCallback((emitToServer = true, reason = "Admin ended call") => {
    console.log(`AdminLiveStream: Ending private call. Emit to server: ${emitToServer}. Reason: ${reason}`);
    if (peerConnectionForCallRef.current) {
      console.log("AdminLiveStream: Closing existing peerConnectionForCallRef for private call.");
      peerConnectionForCallRef.current.close();
      peerConnectionForCallRef.current = null;
    }
    
    adminLocalStreamForCall?.getTracks().forEach(track => track.stop());
    setAdminLocalStreamForCall(null);


    if (localPipVideoRef.current) localPipVideoRef.current.srcObject = null;
    setPrivateCallRemoteStream(null);

    if (socket && socket.connected && emitToServer && authorizedUserSocketIdForCall) {
      console.log("AdminLiveStream: Emitting 'admin-end-private-call' to userSocketId:", authorizedUserSocketIdForCall);
      socket.emit('admin-end-private-call', { userSocketId: authorizedUserSocketIdForCall });
    } else if (socket && socket.connected && emitToServer && !authorizedUserSocketIdForCall && siteSettings?.liveStreamAuthorizedUserId) {
      console.log("AdminLiveStream: Emitting 'admin-end-private-call-for-user-app-id' to targetUserAppId:", siteSettings.liveStreamAuthorizedUserId);
      socket.emit('admin-end-private-call-for-user-app-id', { targetUserAppId: siteSettings.liveStreamAuthorizedUserId });
    }

    setIsPrivateCallActive(false);
    setPrivateCallStatus(t('adminLivestream.privateCall.statusEnded'));
    setHasCameraPermission(null);
    setIsMicrophoneMuted(false);
    setIsLoadingVideo(false);
  }, [socket, authorizedUserSocketIdForCall, siteSettings?.liveStreamAuthorizedUserId, t, adminLocalStreamForCall]);


  useEffect(() => {
    if (!adminAppUserId || isLoadingSettings) {
        if (socket) { 
            console.log("AdminLiveStream: Disconnecting socket due to changed conditions (adminAppUserId or isLoadingSettings).");
            socket.disconnect();
            setSocket(null); 
        }
        return; 
    }

    console.log("AdminLiveStream: Initializing socket connection with adminAppUserId:", adminAppUserId);
    const newSocket = io({ path: '/api/socket_io', query: { appUserId: adminAppUserId } });
    setSocket(newSocket);

    return () => {
        console.log("AdminLiveStream: Disconnecting socket in effect cleanup for adminAppUserId/isLoadingSettings. Socket ID:", newSocket.id);
        newSocket.disconnect();
    };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [adminAppUserId, isLoadingSettings]); 

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log('AdminLiveStream: Socket connected to server. Socket ID:', socket.id);
      toast({ title: t('adminLivestream.toast.socketConnectedTitle'), description: t('adminLivestream.toast.socketConnectedDescription')});
      if (siteSettings?.liveStreamAuthorizedUserId) {
        socket.emit('request-authorized-user-status', { targetUserAppId: siteSettings.liveStreamAuthorizedUserId });
      }
    };
    const onConnectError = (error: Error) => {
      console.error('AdminLiveStream: Socket connection error:', error.message);
      toast({ variant: 'destructive', title: 'Socket Connection Error', description: `Admin: ${error.message}` });
    };
    const onDisconnect = (reason: Socket.DisconnectReason) => {
      const wasGeneralBroadcaster = socket.data && socket.data.isGeneralBroadcaster;
      // Corrected console.log by removing server-side variable reference
      console.log(`AdminLiveStream: Socket disconnected. Reason: ${reason}. WasGeneralBroadcaster: ${wasGeneralBroadcaster}, isPrivateCallActive: ${isPrivateCallActive}`);
      if (reason !== 'io client disconnect') {
        toast({ variant: 'destructive', title: t('adminLivestream.toast.socketDisconnectedTitle'), description: `${t('adminLivestream.toast.socketDisconnectedStreamInterrupt')} Reason: ${reason}` });
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      setGeneralStreamViewerCount(0);
      if (wasGeneralBroadcaster) {
          setIsGeneralStreamActive(false);
          setAdminLocalStreamForGeneral(null);
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
      }
      if (isPrivateCallActive) { 
          handleEndPrivateCall(false, "Admin socket disconnected");
      }
    };
    const onNewGeneralViewer = ({ viewerId }: { viewerId: string }) => {
      console.log("AdminLiveStream: 'new-general-viewer' received from viewerId:", viewerId);
      setGeneralStreamViewerCount(prev => prev + 1);
      if (isGeneralStreamActive && adminLocalStreamForGeneral && socket && socket.connected) {
        console.log("AdminLiveStream: Initiating WebRTC for new general viewer:", viewerId);
        initiateWebRTCForGeneralViewer(viewerId, adminLocalStreamForGeneral, socket);
      } else {
        console.log("AdminLiveStream: Conditions not met to initiate WebRTC for new viewer. isGeneralStreamActive:", isGeneralStreamActive, "adminLocalStreamForGeneral:", !!adminLocalStreamForGeneral);
      }
    };
    const onAnswerFromGeneralViewer = async ({ viewerId, answer }: { viewerId: string, answer: RTCSessionDescriptionInit }) => {
      console.log("AdminLiveStream: 'answer-from-general-viewer' received from viewerId:", viewerId);
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && pc.signalingState === 'have-local-offer') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); console.log("AdminLiveStream: Remote description (answer) set for viewer:", viewerId); }
        catch (error: any) { console.error('AdminLiveStream: Error setting remote description for general viewer:', viewerId, error.message); }
      } else {
        console.log("AdminLiveStream: Could not set remote description for general viewer. PC not found or state not 'have-local-offer'. PC State:", pc?.signalingState);
      }
    };
    const onCandidateFromGeneralViewer = async ({ viewerId, candidate }: { viewerId: string, candidate: RTCIceCandidateInit }) => {
      console.log("AdminLiveStream: 'candidate-from-general-viewer' received from viewerId:", viewerId);
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && candidate && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); console.log("AdminLiveStream: ICE candidate added from general viewer:", viewerId); }
        catch (error: any) { console.error('AdminLiveStream: Error adding ICE candidate from general viewer:', viewerId, candidate, error.message); }
      } else {
        console.log("AdminLiveStream: Could not add ICE candidate from general viewer. PC not found, no remoteDescription, or candidate null.");
      }
    };
    const onViewerDisconnected = ({ viewerId }: { viewerId: string }) => {
        console.log("AdminLiveStream: 'viewer-disconnected' event for viewerId:", viewerId);
        const pc = peerConnectionsRef.current.get(viewerId);
        if (pc) pc.close();
        peerConnectionsRef.current.delete(viewerId);
        setGeneralStreamViewerCount(prev => Math.max(0, prev -1));
    };
    const onAuthorizedUserStatus = ({ userId, isConnected, userSocketId }: { userId: string, isConnected: boolean, userSocketId: string | null }) => {
      console.log("AdminLiveStream: 'authorized-user-status' received:", { userId, isConnected, userSocketId });
      if (siteSettings?.liveStreamAuthorizedUserId === userId) {
        setIsAuthorizedUserConnected(isConnected);
        setAuthorizedUserSocketIdForCall(isConnected ? userSocketId : null);
        if (!isConnected && isPrivateCallActive) {
          toast({ title: t('adminLivestream.privateCall.callEndedTitle'), description: t('adminLivestream.toast.callUserDisconnected'), variant: 'default'});
          handleEndPrivateCall(false, "Authorized user disconnected event received by admin");
        }
      }
    };
    const onPrivateCallUserReadyForOffer = ({ userSocketId, userAppUserId }: { userSocketId: string, userAppUserId: string }) => {
      console.log("AdminLiveStream: 'private-call-user-ready-for-offer' received:", { userSocketId, userAppUserId });
      if (userAppUserId === siteSettings?.liveStreamAuthorizedUserId && isPrivateCallActive && adminLocalStreamForCall && socket && socket.connected) {
          setAuthorizedUserSocketIdForCall(userSocketId);
          console.log("AdminLiveStream: Initiating WebRTC private call offer to userSocketId:", userSocketId);
          initiateWebRTCPrivateCallOffer(userSocketId, socket);
      } else {
         console.log("AdminLiveStream: Conditions not met for 'private-call-user-ready-for-offer'. isPrivateCallActive:", isPrivateCallActive, "adminLocalStreamForCall:", !!adminLocalStreamForCall);
      }
    };
    const onPrivateSdpAnswerReceived = async ({ senderSocketId, answer }: { senderSocketId: string, answer: RTCSessionDescriptionInit }) => {
      console.log("AdminLiveStream: 'private-sdp-answer-received' from senderSocketId:", senderSocketId);
      if (peerConnectionForCallRef.current && senderSocketId === authorizedUserSocketIdForCall && peerConnectionForCallRef.current.signalingState === 'have-local-offer') {
        try {
          await peerConnectionForCallRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setPrivateCallStatus(t('adminLivestream.privateCall.statusConnected', { userName: authorizedUserForStream?.name || 'User' }));
          console.log("AdminLiveStream: Remote description (answer) set for private call.");
        } catch (error: any) {
          console.error('AdminLiveStream: Error setting remote description from private call answer:', error.message);
          setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed'));
          handleEndPrivateCall(false, "Error setting remote description (answer)");
        }
      } else {
        console.log("AdminLiveStream: Could not set remote description for private call. PC not found, state not 'have-local-offer', or senderSocketId mismatch. PC State:", peerConnectionForCallRef.current?.signalingState);
      }
    };
    const onPrivateIceCandidateReceived = async ({ senderSocketId, candidate }: { senderSocketId: string, candidate: RTCIceCandidateInit }) => {
      console.log("AdminLiveStream: 'private-ice-candidate-received' from senderSocketId:", senderSocketId);
      if (peerConnectionForCallRef.current && senderSocketId === authorizedUserSocketIdForCall && candidate && peerConnectionForCallRef.current.remoteDescription) {
        try { await peerConnectionForCallRef.current.addIceCandidate(new RTCIceCandidate(candidate)); console.log("AdminLiveStream: ICE candidate added for private call from user."); }
        catch (error: any) { console.error('AdminLiveStream: Error adding received ICE candidate for private call:', candidate, error.message); }
      } else {
        console.log("AdminLiveStream: Could not add ICE candidate for private call. PC not found, no remoteDescription, candidate null, or senderSocketId mismatch.");
      }
    };
    const onPrivateCallUserDisconnected = ({ userSocketId }: { userSocketId: string }) => {
        console.log("AdminLiveStream: 'private-call-user-disconnected' event for userSocketId:", userSocketId);
        if (userSocketId === authorizedUserSocketIdForCall && isPrivateCallActive) {
            toast({ title: t('adminLivestream.privateCall.callEndedTitle'), description: t('adminLivestream.toast.callUserDisconnected'), variant: 'default'});
            handleEndPrivateCall(false, "Private call user disconnected event received by admin");
        }
    };
    const onPrivateCallError = ({ message }: { message: string }) => {
        console.error('AdminLiveStream: Event "private-call-error" from server:', message);
        toast({ variant: 'destructive', title: 'Private Call Error', description: message });
        if (isPrivateCallActive) handleEndPrivateCall(false, `Private call error from server: ${message}`);
    };
    const onGeneralStreamError = ({ message }: { message: string }) => {
        console.error('AdminLiveStream: Event "general-stream-error" from server:', message);
        toast({ variant: 'destructive', title: t('adminLivestream.toast.streamErrorTitle'), description: message });
        if(isGeneralStreamActive) handleToggleGeneralStreaming();
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('new-general-viewer', onNewGeneralViewer);
    socket.on('answer-from-general-viewer', onAnswerFromGeneralViewer);
    socket.on('candidate-from-general-viewer', onCandidateFromGeneralViewer);
    socket.on('viewer-disconnected', onViewerDisconnected);
    socket.on('authorized-user-status', onAuthorizedUserStatus);
    socket.on('private-call-user-ready-for-offer', onPrivateCallUserReadyForOffer);
    socket.on('private-sdp-answer-received', onPrivateSdpAnswerReceived);
    socket.on('private-ice-candidate-received', onPrivateIceCandidateReceived);
    socket.on('private-call-user-disconnected', onPrivateCallUserDisconnected);
    socket.on('private-call-error', onPrivateCallError);
    socket.on('general-stream-error', onGeneralStreamError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('new-general-viewer', onNewGeneralViewer);
      socket.off('answer-from-general-viewer', onAnswerFromGeneralViewer);
      socket.off('candidate-from-general-viewer', onCandidateFromGeneralViewer);
      socket.off('viewer-disconnected', onViewerDisconnected);
      socket.off('authorized-user-status', onAuthorizedUserStatus);
      socket.off('private-call-user-ready-for-offer', onPrivateCallUserReadyForOffer);
      socket.off('private-sdp-answer-received', onPrivateSdpAnswerReceived);
      socket.off('private-ice-candidate-received', onPrivateIceCandidateReceived);
      socket.off('private-call-user-disconnected', onPrivateCallUserDisconnected);
      socket.off('private-call-error', onPrivateCallError);
      socket.off('general-stream-error', onGeneralStreamError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, siteSettings, isGeneralStreamActive, isPrivateCallActive, authorizedUserForStream, authorizedUserSocketIdForCall, t, handleEndPrivateCall, adminLocalStreamForGeneral, adminLocalStreamForCall]);


  const getCameraPermission = async (forCall = false): Promise<MediaStream | null> => {
    console.log("AdminLiveStream: getCameraPermission called. forCall:", forCall);
    setIsLoadingVideo(true);
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: t('adminLivestream.toast.unsupportedBrowserTitle'), description: t('adminLivestream.toast.unsupportedBrowserDescription') });
      if (forCall) setAdminLocalStreamForCall(null); else setAdminLocalStreamForGeneral(null);
      setIsLoadingVideo(false);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log("AdminLiveStream: Camera permission granted. Stream ID:", stream.id);
      setHasCameraPermission(true);
      stream.getAudioTracks().forEach(track => track.enabled = !isMicrophoneMuted);

      if (forCall) {
        setAdminLocalStreamForCall(stream);
      } else {
        setAdminLocalStreamForGeneral(stream);
      }
      return stream;
    } catch (error: any) {
      console.error("AdminLiveStream: Error getting camera permission:", error);
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: t('adminLivestream.toast.cameraAccessDeniedTitle'), description: t('adminLivestream.toast.cameraAccessDeniedDescription')});
      if (forCall) setAdminLocalStreamForCall(null); else setAdminLocalStreamForGeneral(null);
      setIsLoadingVideo(false);
      return null;
    }
  };

  const initiateWebRTCForGeneralViewer = async (viewerId: string, stream: MediaStream, currentSocket: Socket) => {
    console.log("AdminLiveStream: initiateWebRTCForGeneralViewer for viewerId:", viewerId);
    if (!currentSocket || !currentSocket.connected) { console.log("AdminLiveStream: Socket not connected, cannot initiate WebRTC for general viewer."); return; }
    
    if (peerConnectionsRef.current.has(viewerId)) {
        const oldPc = peerConnectionsRef.current.get(viewerId);
        if (oldPc && oldPc.signalingState !== 'closed') {
            console.log("AdminLiveStream: Closing existing PC for general viewer:", viewerId);
            oldPc.close();
        }
    }
    const pc = new RTCPeerConnection(PC_CONFIG);
    console.log("AdminLiveStream: New RTCPeerConnection created for general viewer:", viewerId);
    peerConnectionsRef.current.set(viewerId, pc);
    
    stream.getTracks().forEach(track => { try { pc.addTrack(track, stream); } catch (e: any) { console.error("AdminLiveStream: Error adding track to PC for general viewer", viewerId, track.kind, e.message); }});
    
    pc.onicecandidate = (event) => { 
        if (event.candidate && currentSocket.connected) { 
            console.log("AdminLiveStream: Sending ICE candidate to general viewer:", viewerId);
            try { currentSocket.emit('general-stream-candidate-to-viewer', { viewerId, candidate: event.candidate }); } 
            catch (e:any) { console.error("AdminLiveStream: Error emitting ICE to general viewer:", e.message);}
        } 
    };
    pc.onconnectionstatechange = () => { 
        console.log(`AdminLiveStream: General viewer ${viewerId} PC connection state changed to: ${pc.connectionState}`);
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) { 
            pc.close(); 
            peerConnectionsRef.current.delete(viewerId); 
            setGeneralStreamViewerCount(prev => Math.max(0, prev -1)); 
            console.log("AdminLiveStream: General viewer connection closed/failed, removed PC for:", viewerId);
        }
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (currentSocket.connected) {
        console.log("AdminLiveStream: Sending offer to general viewer:", viewerId);
        currentSocket.emit('general-stream-offer-to-viewer', { viewerId, offer });
      } else {
        console.log("AdminLiveStream: Socket disconnected before sending offer to general viewer:", viewerId);
      }
    } catch (error: any) { console.error('AdminLiveStream: Error creating/sending offer to general viewer:', viewerId, error.message); }
  };

  const handleToggleGeneralStreaming = async () => {
    if (!socket) {
      toast({
        title: t('adminLivestream.toast.errorTitle'),
        description: t('adminLivestream.toast.socketNotConnectedError'),
        variant: 'destructive'
      });
      return;
    }
    if (isPrivateCallActive) {
      toast({
        title: "Action Denied",
        description: "Cannot manage general stream while in a private call. Please end the call first.",
        variant: "destructive"
      });
      return;
    }
  
    if (isGeneralStreamActive) {
      // Detener el stream existente
      adminLocalStreamForGeneral?.getTracks().forEach(track => track.stop());
      setAdminLocalStreamForGeneral(null);
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      setGeneralStreamViewerCount(0);
      if (socket.connected) socket.emit('stop-general-stream');
      setIsGeneralStreamActive(false);
      setHasCameraPermission(null);
      toast({
        title: t('adminLivestream.toast.streamStoppedTitle'),
        description: t('adminLivestream.toast.streamStoppedDescription')
      });
    } else {
      if (!currentGeneralStreamTitle.trim()) {
        toast({
          title: "Stream Title Required",
          description: "Please enter a title for the live stream.",
          variant: "destructive"
        });
        return;
      }
      const stream = await getCameraPermission(false);
      if (stream) {
        if (socket.connected) {
          // Registrar al admin como broadcaster general
          socket.emit('register-general-broadcaster', {
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: localLiveStreamForLoggedInOnly
          });
          console.log("AdminLiveStream: Emitted 'register-general-broadcaster' con socket.id =", socket.id);
        } else {
          toast({
            title: t('adminLivestream.toast.errorTitle'),
            description: "Socket not connected. Cannot start stream.",
            variant: 'destructive'
          });
          stream.getTracks().forEach(track => track.stop());
          setAdminLocalStreamForGeneral(null);
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          setHasCameraPermission(null);
          return;
        }
        setIsGeneralStreamActive(true);
        let streamTypeInfo = siteSettings?.liveStreamForLoggedInUsersOnly
          ? t('adminLivestream.toast.loggedInOnlyStreamInfo')
          : t('adminLivestream.toast.publicStreamInfo');
        toast({
          title: t('adminLivestream.toast.streamStartingTitle'),
          description: streamTypeInfo
        });
      } else {
        setIsGeneralStreamActive(false);
      }
    }
  };
  

  const initiateWebRTCPrivateCallOffer = async (targetUserSocketId: string, currentSocket: Socket) => {
    console.log("AdminLiveStream: initiateWebRTCPrivateCallOffer to targetUserSocketId:", targetUserSocketId);
    if (!currentSocket || !currentSocket.connected || !adminLocalStreamForCall) { 
        console.error("AdminLiveStream: Cannot initiate private call offer. Socket/stream missing. adminLocalStreamForCall:", !!adminLocalStreamForCall);
        setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + " (Internal Error)"); return; 
    }
    
    if (peerConnectionForCallRef.current && peerConnectionForCallRef.current.signalingState !== 'closed') {
        console.log("AdminLiveStream: Closing existing peerConnectionForCallRef before creating new one for private call offer.");
        peerConnectionForCallRef.current.close();
        peerConnectionForCallRef.current = null;
    }
    peerConnectionForCallRef.current = new RTCPeerConnection(PC_CONFIG);
    console.log("AdminLiveStream: New RTCPeerConnection created for private call offer.");
    
    adminLocalStreamForCall.getTracks().forEach(track => {
        try { peerConnectionForCallRef.current!.addTrack(track, adminLocalStreamForCall); console.log("AdminLiveStream: Added local track to private call PC:", track.kind); } 
        catch (e:any) { console.error("AdminLiveStream: Error adding admin's local track to private PC:", track.kind, e.message); }
    });

    peerConnectionForCallRef.current.onicecandidate = (event) => { 
        if (event.candidate && currentSocket.connected) { 
            console.log("AdminLiveStream: Sending private ICE candidate to user:", targetUserSocketId);
            try { currentSocket.emit('private-ice-candidate', { targetSocketId: targetUserSocketId, candidate: event.candidate }); } 
            catch (e:any) { console.error("AdminLiveStream: Error emitting private ICE:", e.message); }
        }
    };
    peerConnectionForCallRef.current.ontrack = (event) => { 
        console.log("AdminLiveStream: Private call 'ontrack' event from user. Streams:", event.streams);
        if (event.streams[0]) setPrivateCallRemoteStream(event.streams[0]); 
        else { setPrivateCallRemoteStream(null); console.log("AdminLiveStream: Private call 'ontrack' event but no stream[0].");}
    };
    peerConnectionForCallRef.current.onconnectionstatechange = () => { 
        if(peerConnectionForCallRef.current) { 
            const state = peerConnectionForCallRef.current.connectionState; 
            console.log(`AdminLiveStream: Private call PC connection state changed to: ${state}`);
            if (state === 'connected') {
                setPrivateCallStatus(t('adminLivestream.privateCall.statusConnected', { userName: authorizedUserForStream?.name || 'User' }));
                setIsLoadingVideo(false);
            } else if (['failed', 'disconnected', 'closed'].includes(state)) { 
                if (isPrivateCallActive) handleEndPrivateCall(false, `PC state changed to ${state}`); 
            }
        }
    };
    
    try {
      const offer = await peerConnectionForCallRef.current.createOffer();
      await peerConnectionForCallRef.current.setLocalDescription(offer);
      if (currentSocket.connected) { 
        currentSocket.emit('private-sdp-offer', { targetSocketId: targetUserSocketId, offer }); 
        setPrivateCallStatus(t('adminLivestream.privateCall.statusConnecting', { userName: authorizedUserForStream?.name || 'User' }));
        console.log("AdminLiveStream: Private call SDP offer sent to user:", targetUserSocketId);
      } else { 
        setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + " (Socket Disconnected)"); 
        handleEndPrivateCall(false, "Socket disconnected before sending offer"); 
      }
    } catch (error: any) {
      console.error("AdminLiveStream: Error creating/sending private call offer:", error.message); 
      setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed')); 
      toast({ variant: 'destructive', title: 'WebRTC Error', description: `Failed to create private call offer. Err: ${error.message}` }); 
      handleEndPrivateCall(false, "Error creating/sending offer");
    }
  };

  const handleStartPrivateCall = async () => {
    console.log("AdminLiveStream: handleStartPrivateCall called.");
    if (!socket) { toast({ title: t('adminLivestream.toast.errorTitle'), description: t('adminLivestream.toast.socketNotConnectedError'), variant: "destructive" }); return; }
    if (!siteSettings?.liveStreamAuthorizedUserId) { toast({ title: t('adminLivestream.privateCall.cannotStartTitle'), description: "No user is authorized for private calls in site settings.", variant: "destructive" }); return; }
    if (!isAuthorizedUserConnected || !authorizedUserSocketIdForCall) { toast({ title: t('adminLivestream.privateCall.cannotStartTitle'), description: t('adminLivestream.privateCall.noUserConnected'), variant: "destructive" }); return; }
    if (isGeneralStreamActive) { toast({ title: "Action Denied", description: "Cannot start private call while general stream is active. Stop general stream first.", variant: "destructive"}); return; }
    if (isPrivateCallActive) return;

    setIsPrivateCallActive(true);
    setIsLoadingVideo(true);
    setPrivateCallStatus(t('adminLivestream.privateCall.statusConnecting', { userName: authorizedUserForStream?.name || 'User' }));
    const stream = await getCameraPermission(true); 
    if (stream) {
      if (socket.connected) {
          console.log("AdminLiveStream: Emitting 'admin-initiate-private-call-request' to targetUserAppId:", siteSettings.liveStreamAuthorizedUserId);
          socket.emit('admin-initiate-private-call-request', { targetUserAppId: siteSettings.liveStreamAuthorizedUserId });
      } else {
        setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + " (Socket Error)"); 
        setIsPrivateCallActive(false); setIsLoadingVideo(false);
        stream.getTracks().forEach(track => track.stop()); setAdminLocalStreamForCall(null);
        setHasCameraPermission(null);
      }
    } else { 
        setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + " (Camera/Mic Error)"); 
        setIsPrivateCallActive(false); setIsLoadingVideo(false);
    }
  };

  const handleSaveChanges = async () => { 
    setIsSubmittingSettings(true); 
    try { 
      const payload: Partial<SiteSettings> = { 
        liveStreamDefaultTitle: currentGeneralStreamTitle, 
        liveStreamSubtitle: currentGeneralStreamSubtitle, 
        liveStreamOfflineMessage: localOfflineMessage, 
        liveStreamForLoggedInUsersOnly: localLiveStreamForLoggedInOnly,
      };
      
      const response = await fetch('/api/site-settings', { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      }); 
      const result = await response.json(); 
      if (response.ok) { 
        toast({ title: t('adminLivestream.toast.settingsSavedTitle'), description: result.message || t('adminLivestream.toast.persistentSettingsSavedDescription')}); 
        await refreshSiteSettings(); 
      } else { 
        toast({ title: t('adminLivestream.toast.errorTitle'), description: result.message || t('adminLivestream.toast.genericError'), variant: "destructive" }); 
      } 
    } catch (error) { 
      toast({ title: t('adminLivestream.toast.errorTitle'), description: t('adminLivestream.toast.genericError'), variant: "destructive" }); 
    } finally { 
      setIsSubmittingSettings(false); 
    }
  };

  const toggleMicrophone = () => { 
    const streamToToggle = isPrivateCallActive ? adminLocalStreamForCall : adminLocalStreamForGeneral;
    if (streamToToggle) { 
      const newMutedState = !isMicrophoneMuted; 
      streamToToggle.getAudioTracks().forEach(track => track.enabled = !newMutedState); 
      setIsMicrophoneMuted(newMutedState); 
      toast({ title: t('adminLivestream.toast.microphoneStatusTitle'), description: newMutedState ? t('adminLivestream.toast.microphoneMuted') : t('adminLivestream.toast.microphoneUnmuted') }); 
    }
  };
  const toggleLocalPreviewAudio = () => { 
      const videoEl = localVideoRef.current; 
      if (videoEl && (isGeneralStreamActive || adminLocalStreamForGeneral)) { 
          const newMutedState = !videoEl.muted; 
          videoEl.muted = newMutedState; 
          setIsLocalPreviewAudioMuted(newMutedState); 
          toast({ title: t('adminLivestream.toast.localAudioStatusTitle'), description: newMutedState ? t('adminLivestream.toast.localAudioMuted') : t('adminLivestream.toast.localAudioUnmuted')}); 
      }
  };

  useEffect(() => { 
    const videoEl = localVideoRef.current;
    if (videoEl) {
      if (!isPrivateCallActive && adminLocalStreamForGeneral) { 
        if (videoEl.srcObject !== adminLocalStreamForGeneral) {
          console.log("AdminLiveStream (General Stream Preview Effect): Assigning adminLocalStreamForGeneral to localVideoRef.");
          videoEl.srcObject = adminLocalStreamForGeneral;
          videoEl.muted = isLocalPreviewAudioMuted; 
          const handleLoadedMetadata = () => {
            setIsLoadingVideo(false); 
            videoEl.play().catch(e => { if (e.name !== 'AbortError') console.error("AdminLiveStream: Error playing general local video preview:", e); });
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
          videoEl.onerror = (e) => {
            console.error("AdminLiveStream (General Stream Preview Effect): Video element error on localVideoRef.", e);
            setIsLoadingVideo(false);
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
        } else if (videoEl.paused && !isLoadingVideo && videoEl.readyState >= 3) { 
           videoEl.play().catch(e => { if (e.name !== 'AbortError') console.error("AdminLiveStream: Error re-playing general local video preview:", e); });
        }
      } else if (videoEl.srcObject && (isPrivateCallActive || !adminLocalStreamForGeneral)) {
        console.log("AdminLiveStream (General Stream Preview Effect): Clearing srcObject from localVideoRef (private call active or stream ended).");
        videoEl.srcObject = null;
        if (!isPrivateCallActive) setIsLoadingVideo(false); 
      }
    }
  }, [isGeneralStreamActive, adminLocalStreamForGeneral, isPrivateCallActive, isLocalPreviewAudioMuted, isLoadingVideo]);

  useEffect(() => { 
    const videoEl = localPipVideoRef.current;
    if (videoEl && adminLocalStreamForCall) {
        if (videoEl.srcObject !== adminLocalStreamForCall) {
            console.log("AdminLiveStream (PiP Effect): Assigning adminLocalStreamForCall to localPipVideoRef.");
            videoEl.srcObject = adminLocalStreamForCall;
            videoEl.muted = true;
            const handleLoadedMetadata = () => {
                videoEl.play().catch(e => { if (e.name !== 'AbortError') console.error("AdminLiveStream: Error playing admin PiP video:", e); });
                videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
            };
            videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
        }
    } else if (videoEl && videoEl.srcObject && !adminLocalStreamForCall) {
        console.log("AdminLiveStream (PiP Effect): Clearing srcObject from localPipVideoRef due to no adminLocalStreamForCall.");
        videoEl.srcObject = null;
    }
  }, [isPrivateCallActive, adminLocalStreamForCall]);

  useEffect(() => { 
    const videoEl = remoteVideoRef.current;
    if (videoEl) {
      if (isPrivateCallActive && privateCallRemoteStream) {
        if (videoEl.srcObject !== privateCallRemoteStream) {
          console.log("AdminLiveStream (Remote Video Effect): Assigning privateCallRemoteStream to remoteVideoRef.");
          setIsLoadingVideo(true);
          videoEl.srcObject = privateCallRemoteStream;
          videoEl.muted = false;
          const handleLoadedMetadata = () => {
            console.log("AdminLiveStream (Remote Video Effect): 'loadedmetadata' for remoteVideoRef.");
            setIsLoadingVideo(false);
            videoEl.play().catch(e => { if (e.name !== 'AbortError') console.error("AdminLiveStream: Error playing remote user video:", e); });
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
           videoEl.onerror = (e) => {
            console.error("AdminLiveStream (Remote Video Effect): Video element error on remoteVideoRef.", e);
            setIsLoadingVideo(false);
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
        }
      } else if (videoEl.srcObject) {
        console.log("AdminLiveStream (Remote Video Effect): Clearing srcObject from remoteVideoRef.");
        videoEl.srcObject = null;
        setIsLoadingVideo(false);
      }
    }
  }, [isPrivateCallActive, privateCallRemoteStream]);

  if (isLoadingSettings && !siteSettings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const canStartPrivateCall = !!(siteSettings?.liveStreamAuthorizedUserId && isAuthorizedUserConnected && authorizedUserSocketIdForCall && !isPrivateCallActive && !isGeneralStreamActive);
  
  let mainVideoPlayerElementRef = isPrivateCallActive ? remoteVideoRef : localVideoRef;
  let mainVideoPlayerIsMuted = isPrivateCallActive ? false : isLocalPreviewAudioMuted;
  let videoAreaTitle = isPrivateCallActive ? t('adminLivestream.remoteUserVideoLabel') : (currentGeneralStreamTitle || t('adminLivestream.videoArea.title'));
  let videoAreaSubtitle = isPrivateCallActive ? privateCallStatus : (isGeneralStreamActive ? currentGeneralStreamSubtitle : '');
  let showOfflineMessageInVideoArea = !isGeneralStreamActive && !isPrivateCallActive && !adminLocalStreamForGeneral;


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <Radio className="mr-3 h-8 w-8" /> {t('adminLivestream.pageTitle')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminLivestream.configCard.title')}</CardTitle>
          <CardDescription>{t('adminLivestream.configCard.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
              <Label htmlFor="current-live-stream-title" className="text-sm font-medium">{t('adminLivestream.configCard.currentLiveTitleLabel')}</Label>
              <Input
                id="current-live-stream-title"
                placeholder={t('adminLivestream.configCard.titlePlaceholder')}
                value={currentGeneralStreamTitle}
                onChange={(e) => setCurrentGeneralStreamTitle(e.target.value)}
                className="text-sm"
                disabled={isGeneralStreamActive || isPrivateCallActive}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('adminLivestream.configCard.currentLiveTitleHelpText')}</p>
            </div>
             <div>
                <Label htmlFor="current-live-stream-subtitle" className="text-sm font-medium">{t('adminLivestream.configCard.currentLiveSubtitleLabel')}</Label>
                <Input
                    id="current-live-stream-subtitle"
                    placeholder={t('adminLivestream.configCard.subtitlePlaceholder')}
                    value={currentGeneralStreamSubtitle}
                    onChange={(e) => setCurrentGeneralStreamSubtitle(e.target.value)}
                    className="text-sm"
                    disabled={isGeneralStreamActive || isPrivateCallActive}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('adminLivestream.configCard.currentLiveSubtitleHelpText')}</p>
            </div>
            {/* Log for debugging button state */}
            {/* console.log("Render General Stream Button: isPrivateCallActive", isPrivateCallActive, "isGeneralStreamActive", isGeneralStreamActive, "currentGeneralStreamTitle", currentGeneralStreamTitle.trim(), "isLoadingVideo", isLoadingVideo) */}
            <Button onClick={handleToggleGeneralStreaming} disabled={isPrivateCallActive || (!isGeneralStreamActive && !currentGeneralStreamTitle.trim()) || isLoadingVideo}>
                {(isLoadingVideo && !isGeneralStreamActive && !isPrivateCallActive && !adminLocalStreamForGeneral) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isGeneralStreamActive ? <StopCircle className="mr-2 h-4 w-4"/> : <Radio className="mr-2 h-4 w-4"/>}
                {isGeneralStreamActive ? t('adminLivestream.streamControlCard.stopStreamButton') : t('adminLivestream.streamControlCard.startStreamButton')}
            </Button>
            <p className="text-sm text-muted-foreground">
                {t('adminLivestream.configCard.statusLabel')}{' '}
                <span className={cn("font-semibold", isGeneralStreamActive ? "text-red-500" : "text-gray-500")}>
                  {isGeneralStreamActive ? t('adminLivestream.configCard.statusLive') : t('adminLivestream.configCard.statusOffline')}
                </span>
                 {isGeneralStreamActive && ` (${generalStreamViewerCount} ${t('adminLivestream.statsCard.viewersLabel')})`}
            </p>
             <p className="text-xs text-muted-foreground mt-1">
                {isGeneralStreamActive && siteSettings?.liveStreamForLoggedInUsersOnly && (
                    <span className="text-yellow-600">{t('adminLivestream.toast.loggedInOnlyStreamInfo')}</span>
                )}
                 {isGeneralStreamActive && !siteSettings?.liveStreamForLoggedInUsersOnly && (
                    <span className="text-green-600">{t('adminLivestream.toast.publicStreamInfo')}</span>
                )}
            </p>
        </CardContent>
      </Card>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminLivestream.privateCall.cardTitle')}</CardTitle>
          <CardDescription>
            {isLoadingAuthorizedUser ? <Loader2 className="h-4 w-4 animate-spin inline mr-2"/> :
              (siteSettings?.liveStreamAuthorizedUserId && authorizedUserForStream
              ? `${t('adminLivestream.configCard.authorizedUserLabel')} ${authorizedUserForStream.name} ${authorizedUserForStream.surname} (${isAuthorizedUserConnected ? t('adminLivestream.privateCall.statusUserConnected') : t('adminLivestream.privateCall.statusUserDisconnected')})`
              : t('adminLivestream.privateCall.noUserConfigured'))
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={isPrivateCallActive ? () => handleEndPrivateCall(true, "Admin manually ended call") : handleStartPrivateCall} disabled={isLoadingVideo || !canStartPrivateCall && !isPrivateCallActive}>
            {(isLoadingVideo && !isPrivateCallActive && !adminLocalStreamForCall) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPrivateCallActive ? <PhoneOff className="mr-2 h-4 w-4"/> : <PhoneCall className="mr-2 h-4 w-4"/>}
            {isPrivateCallActive ? t('adminLivestream.endPrivateCallButton') : t('adminLivestream.startPrivateCallButton')}
          </Button>
          {isPrivateCallActive && privateCallStatus && <p className="text-sm text-muted-foreground">{privateCallStatus}</p>}
        </CardContent>
      </Card>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">
            {videoAreaTitle}
          </CardTitle>
          {videoAreaSubtitle && <CardDescription>{videoAreaSubtitle}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="relative bg-background/50 p-2 sm:p-4 rounded-lg border border-border shadow-inner">
            <video
              ref={mainVideoPlayerElementRef}
              className="w-full aspect-video rounded-md bg-black"
              autoPlay
              playsInline
              muted={mainVideoPlayerIsMuted}
            />

            {isPrivateCallActive && adminLocalStreamForCall && (
              <div className="absolute bottom-4 right-4 w-1/3 sm:w-1/4 max-w-[200px] aspect-video border-2 border-primary rounded-md overflow-hidden shadow-lg z-10">
                 <p className="absolute top-0 left-0 bg-black/50 text-white text-xs px-1 py-0.5 rounded-br-md">{t('adminLivestream.userLocalVideoLabel')}</p>
                <video ref={localPipVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              </div>
            )}

            {hasCameraPermission === false && (isGeneralStreamActive || isPrivateCallActive) && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('adminLivestream.toast.cameraAccessDeniedTitle')}</AlertTitle>
                  <AlertDescription>{t('adminLivestream.toast.cameraAccessDeniedDescription')}</AlertDescription>
                </Alert>
            )}
            {isLoadingVideo && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
                    <p className="text-md text-muted-foreground">{isPrivateCallActive ? privateCallStatus : t('adminLivestream.videoArea.startingCamera')}</p>
                 </div>
            )}
             {showOfflineMessageInVideoArea && !isLoadingVideo && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                  <VideoIconLucideSvg className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-lg text-muted-foreground">{localOfflineMessage || t('adminLivestream.videoArea.offlineMessage')}</p>
                 </div>
            )}
          </div>
           {(isGeneralStreamActive || isPrivateCallActive) && (adminLocalStreamForGeneral || adminLocalStreamForCall) && (
              <div className="mt-3 flex items-center justify-center space-x-2 sm:space-x-3">
                <Button onClick={toggleMicrophone} variant="outline" size="sm" className="bg-card/80 hover:bg-card">
                  {isMicrophoneMuted ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
                  {isMicrophoneMuted ? t('adminLivestream.configCard.unmuteMicButton') : t('adminLivestream.configCard.muteMicButton')}
                </Button>
                {isGeneralStreamActive && !isPrivateCallActive && (
                    <Button onClick={toggleLocalPreviewAudio} variant="outline" size="sm" className="bg-card/80 hover:bg-card">
                        {isLocalPreviewAudioMuted ? <VolumeX className="mr-1.5 h-4 w-4" /> : <Volume2 className="mr-1.5 h-4 w-4" />}
                        {isLocalPreviewAudioMuted ? t('adminLivestream.configCard.unmuteLocalAudioButton') : t('adminLivestream.configCard.muteLocalAudioButton')}
                    </Button>
                )}
              </div>
            )}
        </CardContent>
      </Card>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminLivestream.persistentSettings.title')}</CardTitle>
          <CardDescription>{t('adminLivestream.persistentSettings.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-1">
              <Label htmlFor="offline-message" className="text-sm font-medium">{t('adminLivestream.configCard.offlineMessageLabel')}</Label>
              <Textarea id="offline-message" placeholder={t('adminLivestream.configCard.offlineMessagePlaceholder')} value={localOfflineMessage} onChange={(e) => setLocalOfflineMessage(e.target.value)} className="text-sm" rows={2} />
               <p className="text-xs text-muted-foreground mt-1">{t('adminLivestream.configCard.offlineMessageHelpText')}</p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch id="liveStreamForLoggedInUsersOnly" checked={localLiveStreamForLoggedInOnly} onCheckedChange={setLocalLiveStreamForLoggedInOnly} disabled={isSubmittingSettings} />
              <Label htmlFor="liveStreamForLoggedInUsersOnly" className="text-sm font-medium">{t('adminLiveStreamPage.loggedInUsersOnly')}</Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('adminLiveStreamPage.loggedInUsersOnlyDescription')}</p>
             <p className="text-xs text-muted-foreground mt-1">
                <ShieldAlert className="inline h-3.5 w-3.5 mr-1 text-yellow-500" />
                {t('adminLivestream.toast.loggedInOnlyClearsSpecificUser')}
            </p>
        </CardContent>
        <CardFooter className="border-t pt-6 flex justify-end">
          <Button onClick={handleSaveChanges} disabled={isSubmittingSettings}>
            {isSubmittingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t('adminLivestream.configCard.saveSettingsButton')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
