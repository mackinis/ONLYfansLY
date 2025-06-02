
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Radio, Settings, StopCircle, Video as VideoIconLucideSvg, AlertTriangle, Save, Mic, MicOff, Loader2, VolumeX, Volume2, Users, UserCheck, ShieldAlert, CheckCircle, Eye, EyeOff } from "lucide-react"; // Renamed VideoIcon
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from '@/context/I18nContext';
import type { SiteSettings, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
// import { FormDescription } from '@/components/ui/form'; // No longer needed if not using RHF for this


const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function LiveStreamAdminPage() {
  const { t, siteSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const { toast } = useToast();

  const [isStreaming, setIsStreaming] = useState(false);
  const [currentLiveStreamTitle, setCurrentLiveStreamTitle] = useState('');
  const [localDefaultStreamTitle, setLocalDefaultStreamTitle] = useState('');
  const [localOfflineMessage, setLocalOfflineMessage] = useState('');
  const [localLiveStreamForLoggedInOnly, setLocalLiveStreamForLoggedInOnly] = useState(false);
  const [authorizedUserForStream, setAuthorizedUserForStream] = useState<UserProfile | null>(null);
  const [isLoadingAuthorizedUser, setIsLoadingAuthorizedUser] = useState(false);


  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isSubmittingSettings, setIsSubmittingSettings] = useState(false);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isLocalPreviewMuted, setIsLocalPreviewMuted] = useState(true);


  useEffect(() => {
    if (siteSettings) {
      setCurrentLiveStreamTitle(siteSettings.liveStreamDefaultTitle || t('adminLivestream.defaultStreamTitle'));
      setLocalDefaultStreamTitle(siteSettings.liveStreamDefaultTitle || t('adminLivestream.defaultStreamTitle'));
      setLocalOfflineMessage(siteSettings.liveStreamOfflineMessage || t('adminLivestream.defaultOfflineMessage'));
      setLocalLiveStreamForLoggedInOnly(siteSettings.liveStreamForLoggedInUsersOnly || false);
      
      if (siteSettings.liveStreamAuthorizedUserId) {
        setIsLoadingAuthorizedUser(true);
        fetch(`/api/users/${siteSettings.liveStreamAuthorizedUserId}`)
          .then(res => res.ok ? res.json() : null)
          .then(userProfile => setAuthorizedUserForStream(userProfile))
          .catch(err => {
            console.error("Failed to fetch authorized user details:", err);
            setAuthorizedUserForStream(null);
          })
          .finally(() => setIsLoadingAuthorizedUser(false));
      } else {
        setAuthorizedUserForStream(null);
        setIsLoadingAuthorizedUser(false);
      }
    }
  }, [siteSettings, t]);


  useEffect(() => {
    const newSocket = io({ path: '/api/socket_io' });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Admin connected to Socket.IO server', newSocket.id);
      if (isStreaming && localStream && siteSettings) { 
        newSocket.emit('register-broadcaster', { 
            streamTitle: currentLiveStreamTitle,
            authorizedUserId: siteSettings.liveStreamAuthorizedUserId || null,
            forLoggedInUsersOnly: siteSettings.liveStreamForLoggedInUsersOnly || false
        });
      }
    });

    newSocket.on('answer-from-viewer', async ({ viewerId, answer }) => {
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && pc.signalingState !== 'closed') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error setting remote description for viewer:', viewerId, error);
          toast({ title: t('adminLivestream.toast.streamErrorTitle'), description: t('adminLivestream.toast.setRemoteDescriptionError', { viewerId: viewerId as string }), variant: 'destructive' });
          if (pc.signalingState !== 'closed') pc.close();
          peerConnectionsRef.current.delete(viewerId);
          setViewerCount(peerConnectionsRef.current.size);
        }
      }
    });

    newSocket.on('candidate-from-viewer', ({ viewerId, candidate }) => {
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && pc.signalingState !== 'closed' && candidate) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
          console.error('Error adding received ICE candidate for viewer:', viewerId, e);
        });
      }
    });

    newSocket.on('new-viewer', async ({ viewerId }) => {
      if (!localStream || !isStreaming) { // Also check if admin is actually streaming
        return;
      }
      if (peerConnectionsRef.current.has(viewerId)) {
        peerConnectionsRef.current.get(viewerId)?.close();
        peerConnectionsRef.current.delete(viewerId);
      }

      const pc = new RTCPeerConnection(PC_CONFIG);
      peerConnectionsRef.current.set(viewerId, pc);
      setViewerCount(peerConnectionsRef.current.size);

      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.onicecandidate = event => {
        if (event.candidate && newSocket && newSocket.connected) {
          newSocket.emit('candidate-to-viewer', { viewerId, candidate: event.candidate });
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
             if (pc.signalingState !== 'closed') pc.close();
             peerConnectionsRef.current.delete(viewerId);
             setViewerCount(peerConnectionsRef.current.size);
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (newSocket && newSocket.connected) {
          newSocket.emit('offer-to-viewer', { viewerId, offer });
        }
      } catch (error) {
        console.error('Error creating offer for viewer:', viewerId, error);
        toast({ title: t('adminLivestream.toast.streamErrorTitle'), description: t('adminLivestream.toast.createOfferError', { viewerId: viewerId as string }), variant: 'destructive' });
        if (pc.signalingState !== 'closed') pc.close();
        peerConnectionsRef.current.delete(viewerId);
        setViewerCount(peerConnectionsRef.current.size);
      }
    });
    
    newSocket.on('viewer-disconnected', ({ viewerId }) => {
        const pc = peerConnectionsRef.current.get(viewerId);
        if (pc) {
            if (pc.signalingState !== 'closed') pc.close();
            peerConnectionsRef.current.delete(viewerId);
            setViewerCount(peerConnectionsRef.current.size);
        }
    });

    newSocket.on('disconnect', () => {
        peerConnectionsRef.current.forEach(pc => { if (pc.signalingState !== 'closed') pc.close(); });
        peerConnectionsRef.current.clear();
        setViewerCount(0);
    });

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      peerConnectionsRef.current.forEach(pc => { if (pc.signalingState !== 'closed') pc.close();});
      peerConnectionsRef.current.clear();
      setViewerCount(0);
      if (newSocket) {
        newSocket.off('connect');
        newSocket.off('answer-from-viewer');
        newSocket.off('candidate-from-viewer');
        newSocket.off('new-viewer');
        newSocket.off('viewer-disconnected');
        newSocket.off('disconnect');
        newSocket.disconnect();
      }
      setSocket(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, isStreaming, toast, t, currentLiveStreamTitle, siteSettings]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.muted = isLocalPreviewMuted;
    }
  }, [isLocalPreviewMuted]);

  const getCameraPermission = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasCameraPermission(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = isLocalPreviewMuted;
        }
        setLocalStream(stream); 
        return stream;
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: t('adminLivestream.toast.cameraAccessDeniedTitle'),
          description: t('adminLivestream.toast.cameraAccessDeniedDescription'),
        });
        return null;
      }
    } else {
      setHasCameraPermission(false);
      toast({ variant: 'destructive', title: t('adminLivestream.toast.unsupportedBrowserTitle'), description: t('adminLivestream.toast.unsupportedBrowserDescription') });
      return null;
    }
  };

  const handleToggleStreaming = async () => {
    if (!socket) {
      toast({ title: t('adminLivestream.toast.errorTitle'), description: t('adminLivestream.toast.socketNotConnectedError'), variant: 'destructive' });
      return;
    }
    if (isLoadingSettings || !siteSettings) {
        toast({ title: t('adminLivestream.toast.errorTitle'), description: "Site settings not loaded yet.", variant: 'destructive' });
        return;
    }

    if (isStreaming) { 
      if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
      }
      setLocalStream(null); 
      
      peerConnectionsRef.current.forEach(pc => { if (pc.signalingState !== 'closed') pc.close(); });
      peerConnectionsRef.current.clear();
      setViewerCount(0);
      
      if (socket && socket.connected) socket.emit('stop-stream');
      
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setIsStreaming(false);
      setHasCameraPermission(null); 
      setIsMicrophoneMuted(false); 
      toast({ title: t('adminLivestream.toast.streamStoppedTitle'), description: t('adminLivestream.toast.streamStoppedDescription') });
    } else { 
      const stream = await getCameraPermission(); 
      if (stream) {
        stream.getAudioTracks().forEach(track => track.enabled = !isMicrophoneMuted);
        
        const authorizedUserId = siteSettings.liveStreamAuthorizedUserId || null;
        const forLoggedInOnly = siteSettings.liveStreamForLoggedInUsersOnly || false;
        
        if (socket && socket.connected) {
            socket.emit('register-broadcaster', { 
                streamTitle: currentLiveStreamTitle,
                authorizedUserId: authorizedUserId,
                forLoggedInUsersOnly: forLoggedInOnly
            });
        }
        setIsStreaming(true); 
        if (authorizedUserId && authorizedUserForStream) {
            toast({ title: t('adminLivestream.toast.streamStartingTitle'), description: t('adminLivestream.toast.privateStreamInfo', {userName: authorizedUserForStream.email}) });
        } else if (authorizedUserId && !authorizedUserForStream && !isLoadingAuthorizedUser) {
            toast({ title: t('adminLivestream.toast.streamStartingTitle'), description: t('adminLivestream.toast.privateStreamNoUserWarning'), variant: 'destructive' });
        } else if (forLoggedInOnly) {
            toast({ title: t('adminLivestream.toast.streamStartingTitle'), description: t('adminLivestream.toast.loggedInOnlyStreamInfo') });
        } else {
            toast({ title: t('adminLivestream.toast.streamStartingTitle'), description: t('adminLivestream.toast.publicStreamInfo') });
        }
      } else {
         setIsStreaming(false); 
      }
    }
  };
  
  const handleLiveTitleChange = (newTitle: string) => {
    setCurrentLiveStreamTitle(newTitle);
    if (socket && socket.connected && isStreaming) {
      socket.emit('update-stream-title', { streamTitle: newTitle });
    }
  };
  
  const handleSaveChanges = async () => {
    setIsSubmittingSettings(true);
    const settingsToUpdate: Partial<SiteSettings> = {
      liveStreamDefaultTitle: localDefaultStreamTitle,
      liveStreamOfflineMessage: localOfflineMessage,
      liveStreamForLoggedInUsersOnly: localLiveStreamForLoggedInOnly,
      liveStreamAuthorizedUserId: localLiveStreamForLoggedInOnly ? null : siteSettings?.liveStreamAuthorizedUserId
    };

    try {
        const response = await fetch('/api/site-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsToUpdate),
        });
        const result = await response.json();

        if (response.ok) {
            toast({
                title: t('adminLivestream.toast.settingsSavedTitle'),
                description: result.message || t('adminLivestream.toast.persistentSettingsSavedDescription'),
            });
            await refreshSiteSettings();
            if (isStreaming && socket && socket.connected && currentLiveStreamTitle !== localDefaultStreamTitle) {
                if (currentLiveStreamTitle === siteSettings?.liveStreamDefaultTitle) { 
                    setCurrentLiveStreamTitle(localDefaultStreamTitle); 
                    socket.emit('update-stream-title', { streamTitle: localDefaultStreamTitle });
                }
            }
            if (isStreaming && socket && socket.connected && 
                (localLiveStreamForLoggedInOnly !== siteSettings?.liveStreamForLoggedInUsersOnly || 
                 settingsToUpdate.liveStreamAuthorizedUserId !== siteSettings?.liveStreamAuthorizedUserId)) {
                socket.emit('register-broadcaster', {
                    streamTitle: currentLiveStreamTitle,
                    authorizedUserId: settingsToUpdate.liveStreamAuthorizedUserId,
                    forLoggedInUsersOnly: settingsToUpdate.liveStreamForLoggedInUsersOnly
                });
                 if (settingsToUpdate.liveStreamForLoggedInUsersOnly) {
                    toast({ title: t('adminLivestream.toast.settingsSavedTitle'), description: t('adminLivestream.toast.loggedInOnlyStreamInfo')});
                } else if (settingsToUpdate.liveStreamAuthorizedUserId && authorizedUserForStream) {
                    toast({ title: t('adminLivestream.toast.settingsSavedTitle'), description: t('adminLivestream.toast.privateStreamInfo', {userName: authorizedUserForStream.email})});
                } else {
                    toast({ title: t('adminLivestream.toast.settingsSavedTitle'), description: t('adminLivestream.toast.publicStreamInfo')});
                }
            }
        } else {
            toast({ 
                title: t('adminLivestream.toast.errorTitle'), 
                description: result.message || t('adminLivestream.toast.genericError'), 
                variant: "destructive" 
            });
        }
    } catch (error) {
        toast({ 
            title: t('adminLivestream.toast.errorTitle'), 
            description: t('adminLivestream.toast.genericError'), 
            variant: "destructive" 
        });
    } finally {
        setIsSubmittingSettings(false);
    }
  };

  const toggleMicrophone = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsMicrophoneMuted(!audioTracks[0].enabled);
        toast({ title: t('adminLivestream.toast.microphoneStatusTitle'), description: audioTracks[0].enabled ? t('adminLivestream.toast.microphoneUnmuted') : t('adminLivestream.toast.microphoneMuted') });
      }
    }
  };

  const toggleLocalPreviewAudio = () => {
    if (localVideoRef.current) {
      const newMutedState = !localVideoRef.current.muted;
      localVideoRef.current.muted = newMutedState;
      setIsLocalPreviewMuted(newMutedState);
      toast({ 
        title: t('adminLivestream.toast.localAudioStatusTitle'), 
        description: newMutedState ? t('adminLivestream.toast.localAudioMuted') : t('adminLivestream.toast.localAudioUnmuted')
      });
    }
  };
  
  const streamAccessStatus = () => {
    if (isLoadingSettings || isLoadingAuthorizedUser) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (siteSettings?.liveStreamForLoggedInUsersOnly) {
      return <span className="text-blue-400 flex items-center"><Eye className="mr-1.5 h-4 w-4" /> {t('adminLivestream.toast.loggedInOnlyStreamInfo')}</span>;
    }
    if (siteSettings?.liveStreamAuthorizedUserId && authorizedUserForStream) {
      return <span className="text-orange-400 flex items-center"><UserCheck className="mr-1.5 h-4 w-4" /> {t('adminLivestream.configCard.authorizedUserLabel')} {authorizedUserForStream.email}</span>;
    }
    if (siteSettings?.liveStreamAuthorizedUserId && !authorizedUserForStream) {
      return <span className="text-red-500 flex items-center"><ShieldAlert className="mr-1.5 h-4 w-4" /> {t('adminLivestream.configCard.noUserAuthorized')}</span>;
    }
    return <span className="text-green-400 flex items-center"><CheckCircle className="mr-1.5 h-4 w-4" /> {t('adminLivestream.toast.publicStreamInfo')}</span>;
  };


  if (isLoadingSettings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

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
          <CardDescription>
            {t('adminLivestream.configCard.description')}{' '}
            <span className="block mt-1 text-xs">{streamAccessStatus()}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Player and Overlays Section */}
          <div className="relative bg-background/50 p-2 sm:p-4 rounded-lg border border-border shadow-inner">
            <video ref={localVideoRef} className="w-full aspect-video rounded-md bg-black" autoPlay playsInline muted />
            
            {/* Viewer Count Overlay */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-black/50 text-white px-2 py-1 rounded-md text-xs sm:text-sm flex items-center">
              <Users className="h-4 w-4 mr-1.5" />
              {t('adminLivestream.statsCard.viewersLabel')}: {viewerCount}
            </div>

            {/* Live Status Switch Overlay */}
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-black/50 p-1.5 sm:p-2 rounded-md flex items-center space-x-2">
              <Switch
                id="live-status-toggle-overlay"
                checked={isStreaming}
                onCheckedChange={handleToggleStreaming}
                aria-label={t('adminLivestream.configCard.toggleStreamAriaLabel')}
              />
              <span className={cn("text-xs sm:text-sm font-semibold", isStreaming ? 'text-red-400' : 'text-gray-400')}>
                {isStreaming ? `● ${t('adminLivestream.configCard.statusLive')}` : t('adminLivestream.configCard.statusOffline')}
              </span>
            </div>

            {(!isStreaming || !localStream) && hasCameraPermission !== false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                  <VideoIconLucideSvg className="h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p className="text-md text-muted-foreground text-center px-4">
                     {t('adminLivestream.configCard.cameraNotDetectedAlert.description')}
                  </p>
                </div>
            )}

            {isStreaming && localStream && (
              <div className="mt-3 flex items-center justify-center space-x-2 sm:space-x-3">
                <Button onClick={toggleMicrophone} variant="outline" size="sm" className="bg-card/80 hover:bg-card">
                  {isMicrophoneMuted ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
                  {isMicrophoneMuted ? t('adminLivestream.configCard.unmuteMicButton') : t('adminLivestream.configCard.muteMicButton')}
                </Button>
                <Button onClick={toggleLocalPreviewAudio} variant="outline" size="sm" className="bg-card/80 hover:bg-card">
                  {isLocalPreviewMuted ? <VolumeX className="mr-1.5 h-4 w-4" /> : <Volume2 className="mr-1.5 h-4 w-4" />}
                  {isLocalPreviewMuted ? t('adminLivestream.configCard.unmuteLocalAudioButton') : t('adminLivestream.configCard.muteLocalAudioButton')}
                </Button>
              </div>
            )}
             {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('adminLivestream.configCard.cameraPermissionDeniedAlert.title')}</AlertTitle>
                  <AlertDescription>
                    {t('adminLivestream.configCard.cameraPermissionDeniedAlert.description')}
                  </AlertDescription>
                </Alert>
              )}
          </div>
          
          {/* Configuration Inputs Section */}
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label htmlFor="current-live-stream-title" className="text-sm font-medium">{t('adminLivestream.configCard.currentLiveTitleLabel')}</Label>
              <Input
                id="current-live-stream-title"
                placeholder={t('adminLivestream.configCard.titlePlaceholder')}
                value={currentLiveStreamTitle}
                onChange={(e) => handleLiveTitleChange(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{t('adminLivestream.configCard.currentLiveTitleHelpText')}</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="default-stream-title" className="text-sm font-medium">{t('adminLivestream.configCard.defaultTitleLabel')}</Label>
              <Input
                id="default-stream-title"
                placeholder={t('adminLivestream.configCard.defaultTitlePlaceholder')}
                value={localDefaultStreamTitle}
                onChange={(e) => setLocalDefaultStreamTitle(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{t('adminLivestream.configCard.defaultTitleHelpText')}</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="offline-message" className="text-sm font-medium">{t('adminLivestream.configCard.offlineMessageLabel')}</Label>
              <Textarea
                id="offline-message"
                placeholder={t('adminLivestream.configCard.offlineMessagePlaceholder')}
                value={localOfflineMessage}
                onChange={(e) => setLocalOfflineMessage(e.target.value)}
                className="text-sm"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">{t('adminLivestream.configCard.offlineMessageHelpText')}</p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="liveStreamForLoggedInUsersOnly"
                checked={localLiveStreamForLoggedInOnly}
                onCheckedChange={setLocalLiveStreamForLoggedInOnly}
                disabled={isSubmittingSettings}
              />
              <Label htmlFor="liveStreamForLoggedInUsersOnly" className="text-sm font-medium">
                {t('adminLiveStreamPage.loggedInUsersOnly')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('adminLiveStreamPage.loggedInUsersOnlyDescription')}
            </p>
            {localLiveStreamForLoggedInOnly && siteSettings?.liveStreamAuthorizedUserId && (
                <Alert variant="default" className="mt-2 text-sm">
                    <UserCheck className="h-4 w-4" />
                    <AlertDescription>
                        {t('adminLivestream.toast.loggedInOnlyClearsSpecificUser')}
                    </AlertDescription>
                </Alert>
            )}

          </div>
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

    
