
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Radio, Settings, StopCircle, Video as VideoIcon, AlertTriangle, Save } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from '@/context/I18nContext';
import { updateSiteSettings } from '@/lib/actions';
import type { SiteSettings } from '@/lib/types';


const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function LiveStreamAdminPage() {
  const { t, siteSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const { toast } = useToast();

  const [isStreaming, setIsStreaming] = useState(false);
  const [currentLiveStreamTitle, setCurrentLiveStreamTitle] = useState(''); // For live updates via socket
  const [localDefaultStreamTitle, setLocalDefaultStreamTitle] = useState(''); // For Firestore
  const [localOfflineMessage, setLocalOfflineMessage] = useState(''); // For Firestore

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (siteSettings) {
      setCurrentLiveStreamTitle(siteSettings.liveStreamDefaultTitle || t('adminLivestream.defaultStreamTitle'));
      setLocalDefaultStreamTitle(siteSettings.liveStreamDefaultTitle || t('adminLivestream.defaultStreamTitle'));
      setLocalOfflineMessage(siteSettings.liveStreamOfflineMessage || t('adminLivestream.defaultOfflineMessage'));
    }
  }, [siteSettings, t]);


  useEffect(() => {
    const newSocket = io({ path: '/api/socket_io' });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Admin connected to Socket.IO server', newSocket.id);
      toast({ title: t('adminLivestream.toast.socketConnectedTitle'), description: t('adminLivestream.toast.socketConnectedDescription') });
      if (isStreaming && localStream) { 
        newSocket.emit('register-broadcaster', { streamTitle: currentLiveStreamTitle });
      }
    });

    newSocket.on('answer-from-viewer', async ({ viewerId, answer }) => {
      console.log('Admin received answer from viewer:', viewerId, answer);
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && pc.signalingState !== 'closed') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('Admin set remote description for viewer:', viewerId);
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
      console.log('Admin received ICE candidate from viewer:', viewerId, candidate);
      const pc = peerConnectionsRef.current.get(viewerId);
      if (pc && pc.signalingState !== 'closed' && candidate) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
          console.error('Error adding received ICE candidate for viewer:', viewerId, e);
        });
      }
    });

    newSocket.on('new-viewer', async ({ viewerId }) => {
      if (!localStream) {
        console.log('Admin: New viewer connected, but local stream is not ready.');
        toast({ title: t('adminLivestream.toast.viewerConnectedTitle'), description: t('adminLivestream.toast.viewerWaitingForStream', { viewerId : viewerId as string}), variant: 'default' });
        return;
      }
      console.log('Admin: New viewer connected:', viewerId);
      
      if (peerConnectionsRef.current.has(viewerId)) {
        console.log(`Admin: Peer connection for viewer ${viewerId} already exists. Closing old one.`);
        peerConnectionsRef.current.get(viewerId)?.close();
        peerConnectionsRef.current.delete(viewerId);
      }

      toast({ title: t('adminLivestream.toast.newViewerTitle'), description: t('adminLivestream.toast.newViewerDescription', { viewerId: viewerId as string }) });

      const pc = new RTCPeerConnection(PC_CONFIG);
      peerConnectionsRef.current.set(viewerId, pc);
      setViewerCount(peerConnectionsRef.current.size);

      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.onicecandidate = event => {
        if (event.candidate && newSocket && newSocket.connected) {
          console.log('Admin sending ICE candidate to viewer:', viewerId, event.candidate);
          newSocket.emit('candidate-to-viewer', { viewerId, candidate: event.candidate });
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log(`Admin: ICE connection state change for viewer ${viewerId}: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
             if (pc.signalingState !== 'closed') pc.close();
             peerConnectionsRef.current.delete(viewerId);
             setViewerCount(peerConnectionsRef.current.size);
             console.log(`Admin: Cleaned up peer connection for viewer ${viewerId} due to ICE state ${pc.iceConnectionState}`);
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('Admin sending offer to viewer:', viewerId, offer);
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
        console.log('Admin: Viewer disconnected:', viewerId);
        const pc = peerConnectionsRef.current.get(viewerId);
        if (pc) {
            if (pc.signalingState !== 'closed') pc.close();
            peerConnectionsRef.current.delete(viewerId);
            setViewerCount(peerConnectionsRef.current.size);
            console.log('Admin: Closed peer connection for viewer:', viewerId);
        }
        toast({ title: t('adminLivestream.toast.viewerLeftTitle'), description: t('adminLivestream.toast.viewerLeftDescription', {  viewerId: viewerId as string }) });
    });

    newSocket.on('disconnect', () => {
        console.log('Admin disconnected from Socket.IO server. Cleaning up.');
        peerConnectionsRef.current.forEach(pc => { if (pc.signalingState !== 'closed') pc.close(); });
        peerConnectionsRef.current.clear();
        setViewerCount(0);
        toast({ title: t('adminLivestream.toast.socketDisconnectedTitle'), description: t('adminLivestream.toast.socketDisconnectedStreamInterrupt'), variant: 'destructive' });
    });


    return () => {
      console.log('Admin cleaning up effect: stopping tracks (if any), closing PCs, disconnecting socket.');
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
  }, [localStream, isStreaming, toast, t]); // currentLiveStreamTitle removed from deps to avoid re-registering broadcaster on every title char change

  const getCameraPermission = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasCameraPermission(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
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

    if (isStreaming) { 
      console.log('Admin: Stopping stream...');
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      setLocalStream(null); 
      
      peerConnectionsRef.current.forEach(pc => { if (pc.signalingState !== 'closed') pc.close(); });
      peerConnectionsRef.current.clear();
      setViewerCount(0);
      
      if (socket && socket.connected) socket.emit('stop-stream');
      
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setIsStreaming(false);
      setHasCameraPermission(null); 
      toast({ title: t('adminLivestream.toast.streamStoppedTitle'), description: t('adminLivestream.toast.streamStoppedDescription') });
    } else { 
      console.log('Admin: Attempting to start stream...');
      const stream = await getCameraPermission(); 
      if (stream) {
        if (socket && socket.connected) {
            socket.emit('register-broadcaster', { streamTitle: currentLiveStreamTitle });
        } else {
            console.log("Socket not yet connected, registration will occur on connect event if localStream is set.");
        }
        setIsStreaming(true); 
        toast({ title: t('adminLivestream.toast.streamStartingTitle'), description: t('adminLivestream.toast.streamStartingDescription') });
      } else {
         setIsStreaming(false); 
      }
    }
  };
  
  // Called when the currentLiveStreamTitle input changes
  const handleLiveTitleChange = (newTitle: string) => {
    setCurrentLiveStreamTitle(newTitle);
    if (socket && socket.connected && isStreaming) {
      socket.emit('update-stream-title', { streamTitle: newTitle });
    }
  };
  
  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    const settingsToUpdate: Partial<SiteSettings> = {
      liveStreamDefaultTitle: localDefaultStreamTitle,
      liveStreamOfflineMessage: localOfflineMessage,
    };

    const result = await updateSiteSettings(settingsToUpdate);
    if (result.success) {
      toast({
        title: t('adminLivestream.toast.settingsSavedTitle'),
        description: t('adminLivestream.toast.persistentSettingsSavedDescription'),
      });
      await refreshSiteSettings();
       // If live, also update the current live title if it was changed in the "default" field
      if (isStreaming && socket && socket.connected && currentLiveStreamTitle !== localDefaultStreamTitle) {
         setCurrentLiveStreamTitle(localDefaultStreamTitle); // Sync current live title with new default
         socket.emit('update-stream-title', { streamTitle: localDefaultStreamTitle });
      }

    } else {
      toast({ title: t('adminLivestream.toast.errorTitle'), description: result.message || t('adminLivestream.toast.genericError'), variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (isLoadingSettings) {
    return <div className="flex justify-center items-center h-64"><Radio className="mr-3 h-8 w-8 animate-pulse text-primary" /></div>;
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
          <CardDescription>{t('adminLivestream.configCard.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4 p-4 border rounded-lg bg-card">
            <Label htmlFor="live-status-toggle" className="text-lg font-medium">
              {t('adminLivestream.configCard.statusLabel')}:
            </Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="live-status-toggle"
                checked={isStreaming}
                onCheckedChange={handleToggleStreaming}
                aria-label={t('adminLivestream.configCard.toggleStreamAriaLabel')}
              />
              <span className={`font-semibold ${isStreaming ? 'text-green-500' : 'text-red-500'}`}>
                {isStreaming ? `● ${t('adminLivestream.configCard.statusLive')}` : t('adminLivestream.configCard.statusOffline')}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current-live-stream-title" className="text-base font-medium">{t('adminLivestream.configCard.currentLiveTitleLabel')}</Label>
            <Input
              id="current-live-stream-title"
              placeholder={t('adminLivestream.configCard.titlePlaceholder')}
              value={currentLiveStreamTitle}
              onChange={(e) => handleLiveTitleChange(e.target.value)}
              className="text-base"
            />
             <p className="text-xs text-muted-foreground">{t('adminLivestream.configCard.currentLiveTitleHelpText')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-stream-title" className="text-base font-medium">{t('adminLivestream.configCard.defaultTitleLabel')}</Label>
            <Input
              id="default-stream-title"
              placeholder={t('adminLivestream.configCard.defaultTitlePlaceholder')}
              value={localDefaultStreamTitle}
              onChange={(e) => setLocalDefaultStreamTitle(e.target.value)}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">{t('adminLivestream.configCard.defaultTitleHelpText')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-message" className="text-base font-medium">{t('adminLivestream.configCard.offlineMessageLabel')}</Label>
            <Textarea
              id="offline-message"
              placeholder={t('adminLivestream.configCard.offlineMessagePlaceholder')}
              value={localOfflineMessage}
              onChange={(e) => setLocalOfflineMessage(e.target.value)}
              className="text-base"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{t('adminLivestream.configCard.offlineMessageHelpText')}</p>
          </div>


          {hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('adminLivestream.configCard.cameraPermissionDeniedAlert.title')}</AlertTitle>
              <AlertDescription>
                {t('adminLivestream.configCard.cameraPermissionDeniedAlert.description')}
              </AlertDescription>
            </Alert>
          )}

          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center"><VideoIcon className="mr-2 h-5 w-5" />{t('adminLivestream.configCard.cameraPreviewTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <video ref={localVideoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />
              {!isStreaming && hasCameraPermission !== false && (
                 <Alert variant="default" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('adminLivestream.configCard.cameraNotDetectedAlert.title')}</AlertTitle>
                    <AlertDescription>
                        {t('adminLivestream.configCard.cameraNotDetectedAlert.description')}
                    </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting && <Save className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> {t('adminLivestream.configCard.saveSettingsButton')}
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg border-primary/10">
        <CardHeader>
            <CardTitle className="font-headline text-xl">{t('adminLivestream.statsCard.title')}</CardTitle>
            <CardDescription>{t('adminLivestream.statsCard.description')}</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-lg">{t('adminLivestream.statsCard.viewersLabel')}: <span className="font-bold text-primary">{viewerCount}</span></p>
        </CardContent>
      </Card>
    </div>
  );
}
