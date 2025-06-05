'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Radio,
  Settings,
  StopCircle,
  Video as VideoIconLucideSvg,
  AlertTriangle,
  Save,
  Mic,
  MicOff,
  Loader2,
  VolumeX,
  Volume2,
  Users,
  UserCheck,
  ShieldAlert,
  CheckCircle,
  Eye,
  EyeOff,
  PhoneCall,
  PhoneOff
} from 'lucide-react';
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

  // -------- General Unidirectional Stream State --------
  const [isGeneralStreamActive, setIsGeneralStreamActive] = useState(false);
  const [currentGeneralStreamTitle, setCurrentGeneralStreamTitle] = useState('');
  const [currentGeneralStreamSubtitle, setCurrentGeneralStreamSubtitle] = useState('');
  const [adminLocalStreamForGeneral, setAdminLocalStreamForGeneral] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [generalStreamViewerCount, setGeneralStreamViewerCount] = useState(0);

  // -------- Private Bi-directional Call State --------
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

  // -------- Persistent Settings Form State --------
  const [localDefaultStreamTitle, setLocalDefaultStreamTitle] = useState('');
  const [localOfflineMessage, setLocalOfflineMessage] = useState('');
  const [persistentSettingsSubtitle, setPersistentSettingsSubtitle] = useState('');
  const [localLiveStreamForLoggedInOnly, setLocalLiveStreamForLoggedInOnly] = useState(false);
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);

  // -------- Audio/Video Controls --------
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isLocalPreviewAudioMuted, setIsLocalPreviewAudioMuted] = useState(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // -------- Load admin profile from session --------
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedProfile = sessionStorage.getItem('aurum_user_profile');
      if (storedProfile) {
        try {
          const user: SessionUserProfile = JSON.parse(storedProfile);
          if (user.role === 'admin' && user.id) {
            setAdminAppUserId(user.id);
            console.log('AdminLiveStream: AdminAppUserId establecido desde sesión:', user.id);
          }
        } catch (e) {
          console.error('AdminLiveStream: Error al parsear perfil de usuario para socket:', e);
        }
      }
    }
  }, []);

  // -------- Fetch authorized user details --------
  const fetchAuthorizedUserData = useCallback(
    async (userId: string) => {
      console.log('AdminLiveStream: fetchAuthorizedUserData llamado para:', userId);
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
        console.log('AdminLiveStream: Datos de usuario autorizado obtenidos:', userProfile);
        if (socket && socket.connected) {
          console.log('AdminLiveStream: Solicitud de estado de usuario autorizado via socket para:', userId);
          socket.emit('request-authorized-user-status', { targetUserAppId: userId });
        }
      } catch (error) {
        console.error('AdminLiveStream: Error al obtener detalles de usuario autorizado:', error);
        setAuthorizedUserForStream(null);
        setIsAuthorizedUserConnected(false);
        setAuthorizedUserSocketIdForCall(null);
      } finally {
        setIsLoadingAuthorizedUser(false);
      }
    },
    [socket]
  );

  // -------- Sync site settings into local form state --------
  useEffect(() => {
    if (siteSettings) {
      setLocalDefaultStreamTitle(siteSettings.liveStreamDefaultTitle || t('adminLivestream.defaultStreamTitle'));
      setLocalOfflineMessage(siteSettings.liveStreamOfflineMessage || t('adminLivestream.defaultOfflineMessage'));
      setLocalLiveStreamForLoggedInOnly(siteSettings.liveStreamForLoggedInUsersOnly || false);

      setCurrentGeneralStreamTitle(siteSettings.liveStreamDefaultTitle || '');
      setCurrentGeneralStreamSubtitle(siteSettings.liveStreamSubtitle || '');

      if (
        siteSettings.liveStreamAuthorizedUserId &&
        siteSettings.liveStreamAuthorizedUserId !== authorizedUserForStream?.id
      ) {
        fetchAuthorizedUserData(siteSettings.liveStreamAuthorizedUserId);
      } else if (!siteSettings.liveStreamAuthorizedUserId) {
        setAuthorizedUserForStream(null);
        setIsAuthorizedUserConnected(false);
        setAuthorizedUserSocketIdForCall(null);
      }
    }
  }, [siteSettings, t, fetchAuthorizedUserData, authorizedUserForStream?.id]);

  // -------- End private call cleanup --------
  const handleEndPrivateCall = useCallback(
    (emitToServer = true, reason = 'Admin ended call') => {
      console.log(`AdminLiveStream: Ending private call. Emit to server: ${emitToServer}. Reason: ${reason}`);
      if (peerConnectionForCallRef.current) {
        console.log('AdminLiveStream: Cerrando PeerConnection de llamada privada.');
        peerConnectionForCallRef.current.close();
        peerConnectionForCallRef.current = null;
      }

      if (adminLocalStreamForCall) {
        adminLocalStreamForCall.getTracks().forEach((track) => track.stop());
        setAdminLocalStreamForCall(null);
        console.log('AdminLiveStream: Detenidas pistas locales de llamada privada.');
      }

      if (localPipVideoRef.current) localPipVideoRef.current.srcObject = null;
      setPrivateCallRemoteStream(null);

      if (socket && socket.connected && emitToServer && authorizedUserSocketIdForCall) {
        console.log('AdminLiveStream: Emitting admin-end-private-call to userSocketId:', authorizedUserSocketIdForCall);
        socket.emit('admin-end-private-call', { userSocketId: authorizedUserSocketIdForCall });
      } else if (socket && socket.connected && emitToServer && !authorizedUserSocketIdForCall && siteSettings?.liveStreamAuthorizedUserId) {
        console.log('AdminLiveStream: Emitting admin-end-private-call-for-user-app-id to:', siteSettings.liveStreamAuthorizedUserId);
        socket.emit('admin-end-private-call-for-user-app-id', { targetUserAppId: siteSettings.liveStreamAuthorizedUserId });
      }

      setIsPrivateCallActive(false);
      setPrivateCallStatus(t('adminLivestream.privateCall.statusEnded'));
      setHasCameraPermission(null);
      setIsMicrophoneMuted(false);
      setIsLoadingVideo(false);
    },
    [socket, authorizedUserSocketIdForCall, siteSettings?.liveStreamAuthorizedUserId, t, adminLocalStreamForCall]
  );

  // -------- Initialize or disconnect socket when adminAppUserId / settings change --------
  useEffect(() => {
    if (!adminAppUserId || isLoadingSettings) {
      if (socket) {
        console.log('AdminLiveStream: Desconectando socket debido a cambios en adminAppUserId / isLoadingSettings.');
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    console.log('AdminLiveStream: Inicializando conexión socket con adminAppUserId:', adminAppUserId);
    const newSocket = io({ path: '/api/socket_io', query: { appUserId: adminAppUserId } });
    setSocket(newSocket);

    return () => {
      console.log('AdminLiveStream: Desconectando socket en cleanup. Socket ID:', newSocket.id);
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminAppUserId, isLoadingSettings]);

  // -------- Handle all socket events --------
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log('AdminLiveStream: Socket conectado. Socket ID:', socket.id);
      toast({ title: t('adminLivestream.toast.socketConnectedTitle'), description: t('adminLivestream.toast.socketConnectedDescription') });

      // Si ya estaba transmitiendo antes de reconectar, re-registrarse como broadcaster
      if (isGeneralStreamActive && adminLocalStreamForGeneral && socket.connected) {
        console.log('AdminLiveStream: Re-registrando general broadcaster tras reconexión.');
        socket.emit('register-general-broadcaster', {
          streamTitle: currentGeneralStreamTitle,
          streamSubtitle: currentGeneralStreamSubtitle,
          isLoggedInOnly: localLiveStreamForLoggedInOnly
        });
      }

      // Re-solicitar estado del usuario autorizado para llamadas
      if (siteSettings?.liveStreamAuthorizedUserId) {
        socket.emit('request-authorized-user-status', { targetUserAppId: siteSettings.liveStreamAuthorizedUserId });
      }
    };
    const onConnectError = (error: Error) => {
      console.error('AdminLiveStream: Error de conexión socket:', error.message);
      toast({ variant: 'destructive', title: 'Socket Connection Error', description: `Admin: ${error.message}` });
    };
    const onDisconnect = (reason: Socket.DisconnectReason) => {
      const wasGeneralBroadcaster = socket.data && (socket.data as any).isGeneralBroadcaster;
      console.log(
        `AdminLiveStream: Socket desconectado. Reason: ${reason}. WasGeneralBroadcaster: ${wasGeneralBroadcaster}, isPrivateCallActive: ${isPrivateCallActive}`
      );
      if (reason !== 'io client disconnect') {
        toast({
          variant: 'destructive',
          title: t('adminLivestream.toast.socketDisconnectedTitle'),
          description: `${t('adminLivestream.toast.socketDisconnectedStreamInterrupt')} Reason: ${reason}`
        });
      }
      // Cleanup general stream PCs
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setGeneralStreamViewerCount(0);
      if (wasGeneralBroadcaster) {
        setIsGeneralStreamActive(false);
        setAdminLocalStreamForGeneral(null);
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
      }
      if (isPrivateCallActive) {
        handleEndPrivateCall(false, 'Admin socket disconnected');
      }
    };

    // ---------- General Stream Events ----------
    const onNewGeneralViewer = ({ viewerId }: { viewerId: string }) => {
      console.log("AdminLiveStream: 'new-general-viewer' recibido de viewerId:", viewerId);
      setGeneralStreamViewerCount((prev) => prev + 1);

      // Intento inmediato de iniciar WebRTC para nuevo viewer
      if (isGeneralStreamActive && adminLocalStreamForGeneral && socket && socket.connected) {
        console.log('AdminLiveStream: Iniciando WebRTC para nuevo general viewer:', viewerId);
        initiateWebRTCForGeneralViewer(viewerId, adminLocalStreamForGeneral, socket);
      } else {
        // Si no está listo aún, reintentar hasta 3 veces cada segundo
        let retryCount = 0;
        const tryInitiate = () => {
          if (isGeneralStreamActive && adminLocalStreamForGeneral && socket && socket.connected) {
            console.log('AdminLiveStream: Reintentando WebRTC para general viewer:', viewerId);
            initiateWebRTCForGeneralViewer(viewerId, adminLocalStreamForGeneral, socket);
          } else if (retryCount < 3) {
            retryCount++;
            setTimeout(tryInitiate, 1000);
          } else {
            console.warn('AdminLiveStream: No se pudo iniciar WebRTC para viewer después de varios intentos:', viewerId);
          }
        };
        tryInitiate();
      }
    };
    const onAnswerFromGeneralViewer = async ({ viewerId, answer }: { viewerId: string; answer: RTCSessionDescriptionInit }) => {
      console.log("AdminLiveStream: 'answer-from-general-viewer' recibido de viewerId:", viewerId);
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('AdminLiveStream: Remote description (answer) establecida para viewer:', viewerId);
        } catch (error: any) {
          console.error('AdminLiveStream: Error al establecer remote description para general viewer:', viewerId, error.message);
        }
      } else {
        console.log(
          'AdminLiveStream: No se pudo establecer remote description. PC no encontrado o estado no válido. PC State:',
          pc?.signalingState
        );
      }
    };
    const onCandidateFromGeneralViewer = async ({ viewerId, candidate }: { viewerId: string; candidate: RTCIceCandidateInit }) => {
      console.log("AdminLiveStream: 'candidate-from-general-viewer' recibido de viewerId:", viewerId);
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && candidate && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('AdminLiveStream: ICE candidate agregado desde general viewer:', viewerId);
        } catch (error: any) {
          console.error('AdminLiveStream: Error al agregar ICE candidate desde general viewer:', viewerId, candidate, error.message);
        }
      } else {
        console.log(
          'AdminLiveStream: No se pudo agregar ICE candidate. PC no encontrado, sin remoteDescription, o candidate nulo.'
        );
      }
    };
    const onViewerDisconnected = ({ viewerId }: { viewerId: string }) => {
      console.log("AdminLiveStream: 'viewer-disconnected' evento para viewerId:", viewerId);
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc) pc.close();
      peerConnectionsRef.current.delete(viewerId);
      setGeneralStreamViewerCount((prev) => Math.max(0, prev - 1));
    };
    const onGeneralBroadcasterDisconnected = () => {
      console.log("AdminLiveStream: Evento 'general-broadcaster-disconnected' recibido.");
      // Otro admin / servidor detuvo el stream; limpiar estado local
      if (isGeneralStreamActive) {
        setIsGeneralStreamActive(false);
        if (adminLocalStreamForGeneral) {
          adminLocalStreamForGeneral.getTracks().forEach((track) => track.stop());
          setAdminLocalStreamForGeneral(null);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
        setGeneralStreamViewerCount(0);
        toast({
          title: t('adminLivestream.toast.streamStoppedByServerTitle'),
          description: t('adminLivestream.toast.streamStoppedByServerDescription'),
          variant: 'destructive'
        });
      }
    };

    // ---------- Authorized User Status ----------
    const onAuthorizedUserStatus = ({
      userId,
      isConnected,
      userSocketId
    }: {
      userId: string;
      isConnected: boolean;
      userSocketId: string | null;
    }) => {
      console.log('AdminLiveStream: "authorized-user-status" recibido:', { userId, isConnected, userSocketId });
      if (siteSettings?.liveStreamAuthorizedUserId === userId) {
        setIsAuthorizedUserConnected(isConnected);
        setAuthorizedUserSocketIdForCall(isConnected ? userSocketId : null);
        if (!isConnected && isPrivateCallActive) {
          toast({
            title: t('adminLivestream.privateCall.callEndedTitle'),
            description: t('adminLivestream.toast.callUserDisconnected'),
            variant: 'default'
          });
          handleEndPrivateCall(false, 'Authorized user disconnected');
        }
      }
    };

    // ---------- Private Call Events ----------
    const onPrivateCallUserReadyForOffer = ({ userSocketId, userAppUserId }: { userSocketId: string; userAppUserId: string }) => {
      console.log("AdminLiveStream: 'private-call-user-ready-for-offer' recibido:", { userSocketId, userAppUserId });
      // Intento inmediato o con retry para iniciar llamada
      const tryInitiateCall = (retryCount = 0) => {
        if (
          userAppUserId === siteSettings?.liveStreamAuthorizedUserId &&
          isPrivateCallActive &&
          adminLocalStreamForCall &&
          socket &&
          socket.connected
        ) {
          setAuthorizedUserSocketIdForCall(userSocketId);
          console.log('AdminLiveStream: Iniciando WebRTC offer para llamada privada a:', userSocketId);
          initiateWebRTCPrivateCallOffer(userSocketId, socket);
        } else if (retryCount < 3) {
          console.log('AdminLiveStream: Retry iniciar llamada privada en 1s (retryCount:', retryCount + 1, ')');
          setTimeout(() => tryInitiateCall(retryCount + 1), 1000);
        } else {
          console.warn('AdminLiveStream: No se pudo iniciar llamada privada después de varios intentos.');
        }
      };
      tryInitiateCall();
    };
    const onPrivateSdpAnswerReceived = async ({ senderSocketId, answer }: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      console.log("AdminLiveStream: 'private-sdp-answer-received' de senderSocketId:", senderSocketId);
      if (
        peerConnectionForCallRef.current &&
        senderSocketId === authorizedUserSocketIdForCall &&
        peerConnectionForCallRef.current.signalingState === 'have-local-offer'
      ) {
        try {
          await peerConnectionForCallRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setPrivateCallStatus(t('adminLivestream.privateCall.statusConnected', { userName: authorizedUserForStream?.name || 'User' }));
          console.log('AdminLiveStream: Remote description (answer) establecida para llamada privada.');
        } catch (error: any) {
          console.error('AdminLiveStream: Error al establecer remote description de private call answer:', error.message);
          setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed'));
          handleEndPrivateCall(false, 'Error estableciendo remote description (answer)');
        }
      } else {
        console.log(
          'AdminLiveStream: No se pudo establecer remote description para private call. PC no encontrado, estado inválido, o mismatch en senderSocketId. PC State:',
          peerConnectionForCallRef.current?.signalingState
        );
      }
    };
    const onPrivateIceCandidateReceived = async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      console.log("AdminLiveStream: 'private-ice-candidate-received' de senderSocketId:", senderSocketId);
      if (
        peerConnectionForCallRef.current &&
        senderSocketId === authorizedUserSocketIdForCall &&
        candidate &&
        peerConnectionForCallRef.current.remoteDescription
      ) {
        try {
          await peerConnectionForCallRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('AdminLiveStream: ICE candidate agregado para private call desde usuario.');
        } catch (error: any) {
          console.error('AdminLiveStream: Error al agregar ICE candidate privado:', candidate, error.message);
        }
      } else {
        console.log(
          'AdminLiveStream: No se pudo agregar ICE candidate para private call. PC no encontrado, sin remoteDescription, candidate nulo, o mismatch en senderSocketId.'
        );
      }
    };
    const onPrivateCallUserDisconnected = ({ userSocketId }: { userSocketId: string }) => {
      console.log("AdminLiveStream: 'private-call-user-disconnected' evento para userSocketId:", userSocketId);
      if (userSocketId === authorizedUserSocketIdForCall && isPrivateCallActive) {
        toast({
          title: t('adminLivestream.privateCall.callEndedTitle'),
          description: t('adminLivestream.toast.callUserDisconnected'),
          variant: 'default'
        });
        handleEndPrivateCall(false, 'Private call user disconnected');
      }
    };
    const onPrivateCallError = ({ message }: { message: string }) => {
      console.error('AdminLiveStream: Evento "private-call-error" del servidor:', message);
      toast({ variant: 'destructive', title: 'Private Call Error', description: message });
      if (isPrivateCallActive) handleEndPrivateCall(false, `Private call error: ${message}`);
    };

    // ---------- General Stream Error from Server ----------
    const onGeneralStreamError = ({ message }: { message: string }) => {
      console.error('AdminLiveStream: Evento "general-stream-error" del servidor:', message);
      toast({ variant: 'destructive', title: t('adminLivestream.toast.streamErrorTitle'), description: message });
      if (isGeneralStreamActive) handleToggleGeneralStreaming();
    };

    // ---------- Bind socket events ----------
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    socket.on('new-general-viewer', onNewGeneralViewer);
    socket.on('answer-from-general-viewer', onAnswerFromGeneralViewer);
    socket.on('candidate-from-general-viewer', onCandidateFromGeneralViewer);
    socket.on('viewer-disconnected', onViewerDisconnected);

    socket.on('general-broadcaster-disconnected', onGeneralBroadcasterDisconnected);

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

      socket.off('general-broadcaster-disconnected', onGeneralBroadcasterDisconnected);

      socket.off('authorized-user-status', onAuthorizedUserStatus);
      socket.off('private-call-user-ready-for-offer', onPrivateCallUserReadyForOffer);
      socket.off('private-sdp-answer-received', onPrivateSdpAnswerReceived);
      socket.off('private-ice-candidate-received', onPrivateIceCandidateReceived);
      socket.off('private-call-user-disconnected', onPrivateCallUserDisconnected);
      socket.off('private-call-error', onPrivateCallError);

      socket.off('general-stream-error', onGeneralStreamError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    siteSettings,
    isGeneralStreamActive,
    isPrivateCallActive,
    authorizedUserForStream,
    authorizedUserSocketIdForCall,
    t,
    handleEndPrivateCall,
    adminLocalStreamForGeneral,
    adminLocalStreamForCall,
    localLiveStreamForLoggedInOnly,
    currentGeneralStreamTitle,
    currentGeneralStreamSubtitle
  ]);

  // -------- Request camera/mic permission helper --------
  const getCameraPermission = async (forCall = false): Promise<MediaStream | null> => {
    console.log('AdminLiveStream: getCameraPermission llamado. forCall:', forCall);
    setIsLoadingVideo(true);
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: t('adminLivestream.toast.unsupportedBrowserTitle'),
        description: t('adminLivestream.toast.unsupportedBrowserDescription')
      });
      if (forCall) setAdminLocalStreamForCall(null);
      else setAdminLocalStreamForGeneral(null);
      setIsLoadingVideo(false);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('AdminLiveStream: Permiso de cámara concedido. Stream ID:', stream.id);
      setHasCameraPermission(true);
      stream.getAudioTracks().forEach((track) => (track.enabled = !isMicrophoneMuted));

      if (forCall) {
        setAdminLocalStreamForCall(stream);
      } else {
        setAdminLocalStreamForGeneral(stream);
      }
      return stream;
    } catch (error: any) {
      console.error('AdminLiveStream: Error obteniendo permiso de cámara:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: t('adminLivestream.toast.cameraAccessDeniedTitle'),
        description: t('adminLivestream.toast.cameraAccessDeniedDescription')
      });
      if (forCall) setAdminLocalStreamForCall(null);
      else setAdminLocalStreamForGeneral(null);
      setIsLoadingVideo(false);
      return null;
    }
  };

  // -------- Initiate WebRTC for a general viewer --------
  const initiateWebRTCForGeneralViewer = async (viewerId: string, stream: MediaStream, currentSocket: Socket) => {
    console.log('AdminLiveStream: initiateWebRTCForGeneralViewer para viewerId:', viewerId);
    if (!currentSocket || !currentSocket.connected) {
      console.log('AdminLiveStream: Socket no conectado, no se puede iniciar WebRTC.');
      return;
    }

    // Cerrar PC previo si existe
    if (peerConnectionsRef.current.has(viewerId)) {
      const oldPc = peerConnectionsRef.current.get(viewerId);
      if (oldPc && oldPc.signalingState !== 'closed') {
        console.log('AdminLiveStream: Cerrando PC existente para general viewer:', viewerId);
        oldPc.close();
      }
    }
    const pc = new RTCPeerConnection(PC_CONFIG);
    console.log('AdminLiveStream: Nueva RTCPeerConnection creada para general viewer:', viewerId);
    peerConnectionsRef.current.set(viewerId, pc);

    stream.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, stream);
      } catch (e: any) {
        console.error('AdminLiveStream: Error al agregar pista al PC general viewer', viewerId, track.kind, e.message);
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && currentSocket.connected) {
        console.log('AdminLiveStream: Enviando ICE candidate a general viewer:', viewerId);
        try {
          currentSocket.emit('general-stream-candidate-to-viewer', { viewerId, candidate: event.candidate });
        } catch (e: any) {
          console.error('AdminLiveStream: Error emitiendo ICE a general viewer:', e.message);
        }
      }
    };
    pc.onconnectionstatechange = () => {
      console.log(`AdminLiveStream: Estado PC para general viewer ${viewerId}: ${pc.connectionState}`);
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        pc.close();
        peerConnectionsRef.current.delete(viewerId);
        setGeneralStreamViewerCount((prev) => Math.max(0, prev - 1));
        console.log('AdminLiveStream: Conexión general viewer cerrada/fallida, removido PC para:', viewerId);
      }
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (currentSocket.connected) {
        console.log('AdminLiveStream: Enviando offer a general viewer:', viewerId);
        currentSocket.emit('general-stream-offer-to-viewer', { viewerId, offer });
      } else {
        console.log('AdminLiveStream: Socket desconectado antes de enviar offer a general viewer:', viewerId);
      }
    } catch (error: any) {
      console.error('AdminLiveStream: Error creando/enviando offer a general viewer:', viewerId, error.message);
    }
  };

  // -------- Toggle general streaming on/off --------
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
        title: 'Action Denied',
        description: 'Cannot manage general stream while in a private call. Please end the call first.',
        variant: 'destructive'
      });
      return;
    }

    if (isGeneralStreamActive) {
      // Detener el stream
      console.log('AdminLiveStream: Deteniendo general stream.');
      if (adminLocalStreamForGeneral) {
        adminLocalStreamForGeneral.getTracks().forEach((track) => track.stop());
        setAdminLocalStreamForGeneral(null);
        console.log('AdminLiveStream: Detenidas pistas locales de general stream.');
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      peerConnectionsRef.current.forEach((pc) => pc.close());
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
      // Iniciar el stream
      console.log('AdminLiveStream: Iniciando general stream.');
      if (!currentGeneralStreamTitle.trim()) {
        toast({
          title: 'Stream Title Required',
          description: 'Please enter a title for the live stream.',
          variant: 'destructive'
        });
        return;
      }
      const stream = await getCameraPermission(false);
      if (stream) {
        if (socket.connected) {
          socket.emit('register-general-broadcaster', {
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: localLiveStreamForLoggedInOnly
          });
          console.log(`AdminLiveStream: 'register-general-broadcaster' emitido, socket.id = ${socket.id}`);
        } else {
          toast({
            title: t('adminLivestream.toast.errorTitle'),
            description: 'Socket not connected. Cannot start stream.',
            variant: 'destructive'
          });
          stream.getTracks().forEach((track) => track.stop());
          setAdminLocalStreamForGeneral(null);
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          setHasCameraPermission(null);
          return;
        }
        setIsGeneralStreamActive(true);
        const streamTypeInfo = siteSettings?.liveStreamForLoggedInUsersOnly
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

  // -------- Initiate WebRTC offer for private call --------
  const initiateWebRTCPrivateCallOffer = async (targetUserSocketId: string, currentSocket: Socket) => {
    console.log('AdminLiveStream: initiateWebRTCPrivateCallOffer a:', targetUserSocketId);
    if (!currentSocket || !currentSocket.connected || !adminLocalStreamForCall) {
      console.error(
        'AdminLiveStream: No se puede iniciar oferta de llamada privada. Socket/stream ausente.',
        'adminLocalStreamForCall:',
        !!adminLocalStreamForCall
      );
      setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + ' (Internal Error)');
      return;
    }

    if (
      peerConnectionForCallRef.current &&
      peerConnectionForCallRef.current.signalingState !== 'closed'
    ) {
      console.log('AdminLiveStream: Cerrando PC privado existente antes de nueva offer.');
      peerConnectionForCallRef.current.close();
      peerConnectionForCallRef.current = null;
    }
    peerConnectionForCallRef.current = new RTCPeerConnection(PC_CONFIG);
    console.log('AdminLiveStream: Nueva RTCPeerConnection creada para llamada privada.');

    adminLocalStreamForCall.getTracks().forEach((track) => {
      try {
        peerConnectionForCallRef.current!.addTrack(track, adminLocalStreamForCall);
        console.log('AdminLiveStream: Añadido track local a llamada privada PC:', track.kind);
      } catch (e: any) {
        console.error('AdminLiveStream: Error al agregar track local a PC privado:', track.kind, e.message);
      }
    });

    peerConnectionForCallRef.current.onicecandidate = (event) => {
      if (event.candidate && currentSocket.connected) {
        console.log('AdminLiveStream: Enviando ICE candidate privado a usuario:', targetUserSocketId);
        try {
          currentSocket.emit('private-ice-candidate', { targetSocketId, candidate: event.candidate });
        } catch (e: any) {
          console.error('AdminLiveStream: Error emitiendo ICE privado:', e.message);
        }
      }
    };
    peerConnectionForCallRef.current.ontrack = (event) => {
      console.log('AdminLiveStream: Private call ontrack evento de usuario. Streams:', event.streams);
      if (event.streams[0]) {
        setPrivateCallRemoteStream(event.streams[0]);
      } else {
        setPrivateCallRemoteStream(null);
        console.warn('AdminLiveStream: private call ontrack pero sin stream[0].');
      }
    };
    peerConnectionForCallRef.current.onconnectionstatechange = () => {
      if (peerConnectionForCallRef.current) {
        const state = peerConnectionForCallRef.current.connectionState;
        console.log(`AdminLiveStream: Private call PC estado cambiado a: ${state}`);
        if (state === 'connected') {
          setPrivateCallStatus(t('adminLivestream.privateCall.statusConnected', { userName: authorizedUserForStream?.name || 'User' }));
          setIsLoadingVideo(false);
        } else if (['failed', 'disconnected', 'closed'].includes(state)) {
          if (isPrivateCallActive) handleEndPrivateCall(false, `PC state: ${state}`);
        }
      }
    };

    try {
      const offer = await peerConnectionForCallRef.current.createOffer();
      await peerConnectionForCallRef.current.setLocalDescription(offer);
      if (currentSocket.connected) {
        currentSocket.emit('private-sdp-offer', { targetSocketId, offer });
        setPrivateCallStatus(t('adminLivestream.privateCall.statusConnecting', { userName: authorizedUserForStream?.name || 'User' }));
        console.log('AdminLiveStream: SDP offer privado enviada a usuario:', targetUserSocketId);
      } else {
        setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + ' (Socket Disconnected)');
        handleEndPrivateCall(false, 'Socket disconnected antes de enviar offer');
      }
    } catch (error: any) {
      console.error('AdminLiveStream: Error creando/enviando oferta privada:', error.message);
      setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed'));
      toast({ variant: 'destructive', title: 'WebRTC Error', description: `Failed to create private call offer. Err: ${error.message}` });
      handleEndPrivateCall(false, 'Error creando/enviando oferta privada');
    }
  };

  // -------- Handle start/stop private call --------
  const handleStartPrivateCall = async () => {
    console.log('AdminLiveStream: handleStartPrivateCall llamado.');
    if (!socket) {
      toast({ title: t('adminLivestream.toast.errorTitle'), description: t('adminLivestream.toast.socketNotConnectedError'), variant: 'destructive' });
      return;
    }
    if (!siteSettings?.liveStreamAuthorizedUserId) {
      toast({ title: t('adminLivestream.privateCall.cannotStartTitle'), description: 'No authorized user configured for private calls.', variant: 'destructive' });
      return;
    }
    if (!isAuthorizedUserConnected || !authorizedUserSocketIdForCall) {
      toast({ title: t('adminLivestream.privateCall.cannotStartTitle'), description: t('adminLivestream.privateCall.noUserConnected'), variant: 'destructive' });
      return;
    }
    if (isGeneralStreamActive) {
      toast({ title: 'Action Denied', description: 'Cannot start private call while general stream is active. Stop general stream first.', variant: 'destructive' });
      return;
    }
    if (isPrivateCallActive) return;

    setIsPrivateCallActive(true);
    setIsLoadingVideo(true);
    setPrivateCallStatus(t('adminLivestream.privateCall.statusConnecting', { userName: authorizedUserForStream?.name || 'User' }));
    const stream = await getCameraPermission(true);
    if (stream) {
      if (socket.connected) {
        console.log('AdminLiveStream: Emitting admin-initiate-private-call-request to:', siteSettings.liveStreamAuthorizedUserId);
        socket.emit('admin-initiate-private-call-request', { targetUserAppId: siteSettings.liveStreamAuthorizedUserId });
      } else {
        setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + ' (Socket Error)');
        setIsPrivateCallActive(false);
        setIsLoadingVideo(false);
        stream.getTracks().forEach((track) => track.stop());
        setAdminLocalStreamForCall(null);
        setHasCameraPermission(null);
      }
    } else {
      setPrivateCallStatus(t('adminLivestream.privateCall.statusFailed') + ' (Camera/Mic Error)');
      setIsPrivateCallActive(false);
      setIsLoadingVideo(false);
    }
  };

  // -------- Save persistent settings --------
  const handleSaveChanges = async () => {
    setIsSubmittingSettings(true);
    try {
      const payload: Partial<SiteSettings> = {
        liveStreamDefaultTitle: currentGeneralStreamTitle,
        liveStreamSubtitle: currentGeneralStreamSubtitle,
        liveStreamOfflineMessage: localOfflineMessage,
        liveStreamForLoggedInUsersOnly: localLiveStreamForLoggedInOnly
      };

      const response = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (response.ok) {
        toast({ title: t('adminLivestream.toast.settingsSavedTitle'), description: result.message || t('adminLivestream.toast.persistentSettingsSavedDescription') });
        await refreshSiteSettings();
      } else {
        toast({ title: t('adminLivestream.toast.errorTitle'), description: result.message || t('adminLivestream.toast.genericError'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('AdminLiveStream: Error saving settings:', error);
      toast({ title: t('adminLivestream.toast.errorTitle'), description: t('adminLivestream.toast.genericError'), variant: 'destructive' });
    } finally {
      setIsSubmittingSettings(false);
    }
  };

  // -------- Toggle microphone in either general stream or private call --------
  const toggleMicrophone = () => {
    const streamToToggle = isPrivateCallActive ? adminLocalStreamForCall : adminLocalStreamForGeneral;
    if (streamToToggle) {
      const newMutedState = !isMicrophoneMuted;
      streamToToggle.getAudioTracks().forEach((track) => (track.enabled = !newMutedState));
      setIsMicrophoneMuted(newMutedState);
      toast({
        title: t('adminLivestream.toast.microphoneStatusTitle'),
        description: newMutedState ? t('adminLivestream.toast.microphoneMuted') : t('adminLivestream.toast.microphoneUnmuted')
      });
      console.log(`AdminLiveStream: Microphone ${newMutedState ? 'muted' : 'unmuted'}.`);
    }
  };

  // -------- Toggle local preview audio (only for general stream) --------
  const toggleLocalPreviewAudio = () => {
    const videoEl = localVideoRef.current;
    if (videoEl && (isGeneralStreamActive || adminLocalStreamForGeneral)) {
      const newMutedState = !videoEl.muted;
      videoEl.muted = newMutedState;
      setIsLocalPreviewAudioMuted(newMutedState);
      toast({
        title: t('adminLivestream.toast.localAudioStatusTitle'),
        description: newMutedState ? t('adminLivestream.toast.localAudioMuted') : t('adminLivestream.toast.localAudioUnmuted')
      });
      console.log(`AdminLiveStream: Local preview audio ${newMutedState ? 'muted' : 'unmuted'}.`);
    }
  };

  // -------- General Stream Preview Effect --------
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (videoEl) {
      if (!isPrivateCallActive && adminLocalStreamForGeneral) {
        if (videoEl.srcObject !== adminLocalStreamForGeneral) {
          console.log('AdminLiveStream (General Preview Effect): Asignando stream local al preview.');
          videoEl.srcObject = adminLocalStreamForGeneral;
          videoEl.muted = isLocalPreviewAudioMuted;
          const handleLoadedMetadata = () => {
            setIsLoadingVideo(false);
            videoEl
              .play()
              .catch((e) => {
                if (e.name !== 'AbortError') console.error('AdminLiveStream: Error al reproducir preview local:', e);
              });
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
          videoEl.onerror = (e) => {
            console.error('AdminLiveStream (General Preview Effect): Error en elemento video:', e);
            setIsLoadingVideo(false);
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
        } else if (videoEl.paused && !isLoadingVideo && videoEl.readyState >= 3) {
          videoEl.play().catch((e) => {
            if (e.name !== 'AbortError') console.error('AdminLiveStream: Error al re-reproducir preview local:', e);
          });
        }
      } else if (videoEl.srcObject && (isPrivateCallActive || !adminLocalStreamForGeneral)) {
        console.log('AdminLiveStream (General Preview Effect): Limpiando srcObject (llamada privada activa o stream terminado).');
        videoEl.srcObject = null;
        if (!isPrivateCallActive) setIsLoadingVideo(false);
      }
    }
  }, [isGeneralStreamActive, adminLocalStreamForGeneral, isPrivateCallActive, isLocalPreviewAudioMuted, isLoadingVideo]);

  // -------- Private Call Local PiP Effect --------
  useEffect(() => {
    const videoEl = localPipVideoRef.current;
    if (videoEl && adminLocalStreamForCall) {
      if (videoEl.srcObject !== adminLocalStreamForCall) {
        console.log('AdminLiveStream (PiP Effect): Asignando adminLocalStreamForCall al PiP.');
        videoEl.srcObject = adminLocalStreamForCall;
        videoEl.muted = true;
        const handleLoadedMetadata = () => {
          videoEl.play().catch((e) => {
            if (e.name !== 'AbortError') console.error('AdminLiveStream: Error al reproducir PiP admin:', e);
          });
          videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
        videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
      }
    } else if (videoEl && videoEl.srcObject && !adminLocalStreamForCall) {
      console.log('AdminLiveStream (PiP Effect): Limpiando srcObject del PiP debido a no adminLocalStreamForCall.');
      videoEl.srcObject = null;
    }
  }, [isPrivateCallActive, adminLocalStreamForCall]);

  // -------- Private Call Remote Video Effect --------
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl) {
      if (isPrivateCallActive && privateCallRemoteStream) {
        if (videoEl.srcObject !== privateCallRemoteStream) {
          console.log('AdminLiveStream (Remote Video Effect): Asignando privateCallRemoteStream al elemento remoto.');
          setIsLoadingVideo(true);
          videoEl.srcObject = privateCallRemoteStream;
          videoEl.muted = false;
          const handleLoadedMetadata = () => {
            console.log('AdminLiveStream (Remote Video Effect): Evento loadedmetadata del remoto.');
            setIsLoadingVideo(false);
            videoEl.play().catch((e) => {
              if (e.name !== 'AbortError') console.error('AdminLiveStream: Error al reproducir video remoto:', e);
            });
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
          videoEl.onerror = (e) => {
            console.error('AdminLiveStream (Remote Video Effect): Error en elemento remoto:', e);
            setIsLoadingVideo(false);
            videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
        }
      } else if (videoEl.srcObject) {
        console.log('AdminLiveStream (Remote Video Effect): Limpiando srcObject del remoto.');
        videoEl.srcObject = null;
        setIsLoadingVideo(false);
      }
    }
  }, [isPrivateCallActive, privateCallRemoteStream]);

  if (isLoadingSettings && !siteSettings) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const canStartPrivateCall =
    !!(
      siteSettings?.liveStreamAuthorizedUserId &&
      isAuthorizedUserConnected &&
      authorizedUserSocketIdForCall &&
      !isPrivateCallActive &&
      !isGeneralStreamActive
    );

  let mainVideoPlayerElementRef = isPrivateCallActive ? remoteVideoRef : localVideoRef;
  let mainVideoPlayerIsMuted = isPrivateCallActive ? false : isLocalPreviewAudioMuted;
  let videoAreaTitle = isPrivateCallActive
    ? t('adminLivestream.remoteUserVideoLabel')
    : currentGeneralStreamTitle || t('adminLivestream.videoArea.title');
  let videoAreaSubtitle = isPrivateCallActive
    ? privateCallStatus
    : isGeneralStreamActive
    ? currentGeneralStreamSubtitle
    : '';
  const showOfflineMessageInVideoArea = !isGeneralStreamActive && !isPrivateCallActive && !adminLocalStreamForGeneral;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <Radio className="mr-3 h-8 w-8" /> {t('adminLivestream.pageTitle')}
        </h1>
      </div>

      {/* -------- General Stream Configuration Card -------- */}
      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminLivestream.configCard.title')}</CardTitle>
          <CardDescription>{t('adminLivestream.configCard.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-live-stream-title" className="text-sm font-medium">
              {t('adminLivestream.configCard.currentLiveTitleLabel')}
            </Label>
            <Input
              id="current-live-stream-title"
              placeholder={t('adminLivestream.configCard.titlePlaceholder')}
              value={currentGeneralStreamTitle}
              onChange={(e) => setCurrentGeneralStreamTitle(e.target.value)}
              className="text-sm"
              disabled={isGeneralStreamActive || isPrivateCallActive}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('adminLivestream.configCard.currentLiveTitleHelpText')}
            </p>
          </div>
          <div>
            <Label htmlFor="current-live-stream-subtitle" className="text-sm font-medium">
              {t('adminLivestream.configCard.currentLiveSubtitleLabel')}
            </Label>
            <Input
              id="current-live-stream-subtitle"
              placeholder={t('adminLivestream.configCard.subtitlePlaceholder')}
              value={currentGeneralStreamSubtitle}
              onChange={(e) => setCurrentGeneralStreamSubtitle(e.target.value)}
              className="text-sm"
              disabled={isGeneralStreamActive || isPrivateCallActive}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('adminLivestream.configCard.currentLiveSubtitleHelpText')}
            </p>
          </div>
          <Button
            onClick={handleToggleGeneralStreaming}
            disabled={isPrivateCallActive || (!isGeneralStreamActive && !currentGeneralStreamTitle.trim()) || isLoadingVideo}
          >
            {isLoadingVideo && !isGeneralStreamActive && !isPrivateCallActive && !adminLocalStreamForGeneral && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isGeneralStreamActive ? <StopCircle className="mr-2 h-4 w-4" /> : <Radio className="mr-2 h-4 w-4" />}
            {isGeneralStreamActive
              ? t('adminLivestream.streamControlCard.stopStreamButton')
              : t('adminLivestream.streamControlCard.startStreamButton')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('adminLivestream.configCard.statusLabel')}{' '}
            <span className={cn('font-semibold', isGeneralStreamActive ? 'text-red-500' : 'text-gray-500')}>
              {isGeneralStreamActive ? t('adminLivestream.configCard.statusLive') : t('adminLivestream.configCard.statusOffline')}
            </span>{' '}
            {isGeneralStreamActive && (`${generalStreamViewerCount} ${t('adminLivestream.statsCard.viewersLabel')}`)}
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

      {/* -------- Private Call Card -------- */}
      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminLivestream.privateCall.cardTitle')}</CardTitle>
          <CardDescription>
            {isLoadingAuthorizedUser ? (
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            ) : siteSettings?.liveStreamAuthorizedUserId && authorizedUserForStream ? (
              `${t('adminLivestream.configCard.authorizedUserLabel')} ${authorizedUserForStream.name} ${authorizedUserForStream.surname} (${isAuthorizedUserConnected ? t('adminLivestream.privateCall.statusUserConnected') : t('adminLivestream.privateCall.statusUserDisconnected')})`
            ) : (
              t('adminLivestream.privateCall.noUserConfigured')
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={isPrivateCallActive ? () => handleEndPrivateCall(true, 'Admin manually ended call') : handleStartPrivateCall}
            disabled={!isPrivateCallActive && (isLoadingVideo || !canStartPrivateCall)}
          >
            {isLoadingVideo && !isPrivateCallActive && !adminLocalStreamForCall && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isPrivateCallActive ? <PhoneOff className="mr-2 h-4 w-4" /> : <PhoneCall className="mr-2 h-4 w-4" />}
            {isPrivateCallActive
              ? t('adminLivestream.endPrivateCallButton')
              : t('adminLivestream.startPrivateCallButton')}
          </Button>
          {isPrivateCallActive && privateCallStatus && (
            <p className="text-sm text-muted-foreground">{privateCallStatus}</p>
          )}
        </CardContent>
      </Card>

      {/* -------- Video Area Card -------- */}
      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{videoAreaTitle}</CardTitle>
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
                <p className="absolute top-0 left-0 bg-black/50 text-white text-xs px-1 py-0.5 rounded-br-md">
                  {t('adminLivestream.userLocalVideoLabel')}
                </p>
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
                <p className="text-md text-muted-foreground">
                  {isPrivateCallActive ? privateCallStatus : t('adminLivestream.videoArea.startingCamera')}
                </p>
              </div>
            )}
            {showOfflineMessageInVideoArea && !isLoadingVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                <VideoIconLucideSvg className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">
                  {localOfflineMessage || t('adminLivestream.videoArea.offlineMessage')}
                </p>
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
                  {isLocalPreviewAudioMuted
                    ? t('adminLivestream.configCard.unmuteLocalAudioButton')
                    : t('adminLivestream.configCard.muteLocalAudioButton')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* -------- Persistent Settings Card -------- */}
      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminLivestream.persistentSettings.title')}</CardTitle>
          <CardDescription>{persistentSettingsSubtitle || t('adminLivestream.persistentSettings.fallbackSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <Label htmlFor="persistent-subtitle" className="text-sm font-medium">
              Subtítulo Persistente
            </Label>
            <Input
              id="persistent-subtitle"
              placeholder="Escribe aquí el subtítulo que sólo se mostrará en Configuraciones Persistentes"
              value={persistentSettingsSubtitle}
              onChange={(e) => setPersistentSettingsSubtitle(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Este texto NO afectará al mensaje dentro del video.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="offline-message" className="text-sm font-medium">
              {t('adminLivestream.configCard.offlineMessageLabel')}
            </Label>
            <Textarea
              id="offline-message"
              placeholder={t('adminLivestream.configCard.offlineMessagePlaceholder')}
              value={localOfflineMessage}
              onChange={(e) => setLocalOfflineMessage(e.target.value)}
              className="text-sm"
              rows={2}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('adminLivestream.configCard.offlineMessageHelpText')}
            </p>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="liveStreamForLoggedInUsersOnly"
              checked={localLiveStreamForLoggedInOnly}
              onCheckedChange={setLocalLiveStreamForLoggedInOnly}
              disabled={isSubmittingSettings}
            />
            <Label htmlFor="liveStreamForLoggedInUsersOnly" className="text-sm font-medium">
              {t('adminLivestream.liveStreamForLoggedInUsersOnly')}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">{t('adminLivestream.liveStreamForLoggedInUsersOnlyDescription')}</p>
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
