
'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import VideoCard from '@/components/VideoCard';
import type { Video, SiteSettings, ActiveCurrencySetting, ExchangeRates, Announcement } from '@/lib/types';
import CuratedTestimonialsDisplay from '@/components/CuratedTestimonialsDisplay';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import AnnouncementModal from '@/components/AnnouncementModal';
import CourseDetailModal from '@/components/CourseDetailModal'; // Import CourseDetailModal
import { Button } from '@/components/ui/button';
import { PlayCircle, Loader2, Video as VideoIconLucide, AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from '@/context/I18nContext';
import { getVideoCourses, getAnnouncements, incrementVideoCourseViews } from '@/lib/actions';

const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function HomePage() {
  const { t, siteSettings, isLoadingSettings: isLoadingSiteSettings } = useTranslation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isStreamLive, setIsStreamLive] = useState(false); 
  const [streamTitleToDisplay, setStreamTitleToDisplay] = useState('');
  const [receivedRemoteStream, setReceivedRemoteStream] = useState<MediaStream | null>(null); 
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [webRtcError, setWebRtcError] = useState<string | null>(null);

  const [videoCourses, setVideoCourses] = useState<Video[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  
  // For VideoPlayerModal
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<Video | null>(null);
  const [isVideoPlayerModalOpen, setIsVideoPlayerModalOpen] = useState(false);

  // For CourseDetailModal
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<Video | null>(null);
  const [isCourseDetailModalOpen, setIsCourseDetailModalOpen] = useState(false);


  const [displayCurrency, setDisplayCurrency] = useState<ActiveCurrencySetting | null>(null);
  const [currentExchangeRates, setCurrentExchangeRates] = useState<ExchangeRates | null>(null);

  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isLoadingAnnouncement, setIsLoadingAnnouncement] = useState(true);

  const siteLiveStreamDefaultTitle = siteSettings?.liveStreamDefaultTitle;
  const siteLiveStreamOfflineMessage = siteSettings?.liveStreamOfflineMessage;

  useEffect(() => {
    if (siteSettings) {
      const primary = siteSettings.activeCurrencies.find(c => c.isPrimary);
      setDisplayCurrency(primary || siteSettings.activeCurrencies.find(c => c.id === 'ars') || siteSettings.activeCurrencies[0] || null);
      setCurrentExchangeRates(siteSettings.exchangeRates);
      setStreamTitleToDisplay(siteLiveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    }
  }, [siteSettings, siteLiveStreamDefaultTitle, t]);

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const courses = await getVideoCourses(); // This should now fetch courses ordered by 'order'
        setVideoCourses(courses); 
      } catch (error) {
        console.error("Failed to fetch video courses:", error);
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchAndShowAnnouncement = async () => {
      if (isLoadingSiteSettings) return; 
      setIsLoadingAnnouncement(true);
      try {
        const announcements = await getAnnouncements({ activeOnly: true, nonExpiredOnly: true });
        if (announcements.length > 0) {
          const latestAnnouncement = announcements[0]; // Already sorted by server
          setCurrentAnnouncement(latestAnnouncement);
          setIsAnnouncementModalOpen(true); 
        } else {
          setCurrentAnnouncement(null);
          setIsAnnouncementModalOpen(false);
        }
      } catch (error) {
        console.error("Failed to fetch or process announcements:", error);
      } finally {
        setIsLoadingAnnouncement(false);
      }
    };
    fetchAndShowAnnouncement();
  }, [isLoadingSiteSettings]);

  const handleOpenVideoPlayer = (video: Video) => {
    setSelectedVideoForPlayer(video);
    setIsVideoPlayerModalOpen(true);
    // Increment views when the video player modal is opened
    incrementVideoCourseViews(video.id).catch(err => {
        console.error("Failed to increment views for video:", video.id, err);
        // Optionally, add a toast or some other user feedback if necessary
    });
  };

  const handleOpenCourseDetail = (video: Video) => {
    setSelectedCourseForDetail(video);
    setIsCourseDetailModalOpen(true);
  };
  
  const handleWatchFromDetailModal = (video: Video) => {
    setIsCourseDetailModalOpen(false); // Close detail modal
    handleOpenVideoPlayer(video); // Open player modal
  };


  useEffect(() => {
    const newSocket = io({ path: '/api/socket_io' });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Visitor connected to Socket.IO server', newSocket.id);
      newSocket.emit('register-viewer');
    });

    newSocket.on('broadcaster-ready', (data: { broadcasterId: string, streamTitle?: string }) => {
      console.log('Visitor: Broadcaster is ready', data.broadcasterId, "Title:", data.streamTitle);
      setBroadcasterId(data.broadcasterId);
      setIsStreamLive(true);
      setWebRtcError(null);
      setStreamTitleToDisplay(data.streamTitle || siteLiveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    });

    newSocket.on('stream-title-updated', (data: { streamTitle: string }) => {
      console.log('Visitor: Stream title updated', data.streamTitle);
      setStreamTitleToDisplay(data.streamTitle);
    });

    newSocket.on('offer-from-broadcaster', async ({ broadcasterId: bId, offer }) => {
      if (bId !== broadcasterId && !broadcasterId) setBroadcasterId(bId);
      console.log('Visitor received offer from broadcaster:', bId, offer);
      setWebRtcError(null);

      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
        console.log('Visitor: Peer connection already exists. Closing before creating a new one.');
        peerConnectionRef.current.close();
      }

      const pc = new RTCPeerConnection(PC_CONFIG);
      peerConnectionRef.current = pc;

      pc.ontrack = event => {
        console.log('Visitor: Received remote track event. Full event object:', event);
        if (event.streams && event.streams[0]) {
          const remoteStreamInstance = event.streams[0];
          console.log('Visitor: event.streams[0] is available. Stream ID:', remoteStreamInstance.id, 'Active:', remoteStreamInstance.active);
          console.log('Visitor: Audio tracks:', remoteStreamInstance.getAudioTracks().length, 'Video tracks:', remoteStreamInstance.getVideoTracks().length);
          setReceivedRemoteStream(remoteStreamInstance);
          setIsStreamLive(true);
        } else {
          console.warn('Visitor: ontrack event fired but no event.streams[0] found. event.track:', event.track);
          setWebRtcError(t('homepage.live.webrtcSetupError') + ': No valid stream received in ontrack.');
          setReceivedRemoteStream(null);
          setIsStreamLive(false); // Ensure live status is false if stream is not valid
        }
      };

      pc.onicecandidate = event => {
        if (event.candidate && newSocket && newSocket.connected) {
          newSocket.emit('candidate-to-broadcaster', { broadcasterId: bId, candidate: event.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!pc) return;
        const currentState = pc.iceConnectionState;
        console.log(`Visitor: ICE connection state change: ${currentState}`);
        if (currentState === 'connected' || currentState === 'completed') {
          setIsStreamLive(true);
          setWebRtcError(null);
        } else if (currentState === 'failed') {
          console.error('Visitor: ICE connection failed.');
          setIsStreamLive(false);
          setReceivedRemoteStream(null);
          setWebRtcError(t('homepage.live.connectionLostError'));
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null; // Clear ref after closing
          }
        } else if (currentState === 'disconnected' || currentState === 'closed') {
           if (isStreamLive) { // Only act if it was previously live
                console.log(`Visitor: ICE connection ${currentState}. Stream might have ended or been interrupted.`);
                setIsStreamLive(false);
                setReceivedRemoteStream(null);
                // Do not set WebRtcError here for 'disconnected', as it could be a temporary network blip or normal closure.
                // 'failed' is a more definitive error state.
           }
           if (peerConnectionRef.current) {
              peerConnectionRef.current.close();
              peerConnectionRef.current = null; // Clear ref after closing
           }
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (newSocket && newSocket.connected) {
          newSocket.emit('answer-to-broadcaster', { broadcasterId: bId, answer });
        }
      } catch (error) {
        console.error('Error handling offer or creating answer:', error);
        setWebRtcError(`${t('homepage.live.webrtcSetupError')}: ${error instanceof Error ? error.message : String(error)}`);
        setIsStreamLive(false);
        setReceivedRemoteStream(null);
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      }
    });

    newSocket.on('candidate-from-broadcaster', ({ candidate }) => {
      if (peerConnectionRef.current && candidate && peerConnectionRef.current.signalingState !== 'closed') {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
          console.error('Error adding received ICE candidate:', e);
          setWebRtcError(`${t('homepage.live.iceCandidateError')}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
    });

    newSocket.on('broadcaster-disconnected', () => {
      console.log('Visitor: Broadcaster disconnected (event received).');
      setIsStreamLive(false);
      setReceivedRemoteStream(null);
      setWebRtcError(null); 
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setBroadcasterId(null);
      setStreamTitleToDisplay(siteLiveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Visitor disconnected from Socket.IO server. Reason:', reason);
      // If socket disconnects, we should probably also consider the stream "not live" from user perspective
      setIsStreamLive(false);
      setReceivedRemoteStream(null);
       if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    });

    return () => {
      console.log('Homepage cleaning up: closing peer connection, disconnecting socket.');
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (newSocket) {
        newSocket.disconnect();
      }
      setSocket(null);
      setReceivedRemoteStream(null);
      setIsStreamLive(false);
    };
  }, [siteSettings, siteLiveStreamDefaultTitle, t]); // Simplified dependencies

  useEffect(() => {
    if (receivedRemoteStream && remoteVideoRef.current) {
      console.log('Visitor: Assigning receivedRemoteStream to video element. Stream ID:', receivedRemoteStream.id, 'Active:', receivedRemoteStream.active);
      remoteVideoRef.current.srcObject = receivedRemoteStream;
      remoteVideoRef.current.play().then(() => {
        console.log("Visitor: Video element play() successful after stream assignment.");
        setWebRtcError(null); // Clear any previous error if playback starts
      }).catch(e => {
        console.error("Visitor: Video element play() error after stream assignment:", e);
        setWebRtcError(`${t('homepage.live.webrtcSetupError')}: Video playback failed - ${e instanceof Error ? e.message : String(e)}`);
      });
    } else if (!receivedRemoteStream && remoteVideoRef.current) {
      console.log('Visitor: receivedRemoteStream is null, clearing srcObject.');
      remoteVideoRef.current.srcObject = null;
    }
  }, [receivedRemoteStream, t]); // Removed remoteVideoRef from deps as it's a ref


  if (isLoadingSiteSettings || !siteSettings) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  const displayedCourses = videoCourses.slice(0, 3);


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section className="py-16 md:py-24 bg-gradient-to-br from-background to-card/50">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-headline text-4xl md:text-6xl font-bold text-primary mb-6">
              {siteSettings.heroTitle || t('homepage.hero.title')}
            </h1>
            <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-8">
              {siteSettings.heroSubtitle || t('homepage.hero.subtitle')}
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
              <a href="#courses"><PlayCircle className="mr-2 h-5 w-5" /> {t('homepage.hero.exploreButton')}</a>
            </Button>
          </div>
        </section>

        <section id="live" className="py-12 md:py-16 bg-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-3xl md:text-4xl font-bold mb-4">
              <span className="text-primary">{streamTitleToDisplay}</span>
            </h2>
            <p className="text-muted-foreground mb-6">
              {isStreamLive && receivedRemoteStream ? t('homepage.live.broadcastingNow') : (siteLiveStreamOfflineMessage || t('homepage.live.currentlyOffline'))}
            </p>
            <div className="bg-card p-4 md:p-8 rounded-lg shadow-xl max-w-3xl mx-auto relative">
              <video ref={remoteVideoRef} className="w-full aspect-video rounded-md bg-black" playsInline controls />
              {(!isStreamLive || !receivedRemoteStream) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 rounded-md pointer-events-none">
                  <VideoIconLucide className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-xl text-muted-foreground">
                     {socket && socket.connected && !broadcasterId && !isStreamLive ?
                      t('homepage.live.statusOffline') :
                       (socket && socket.connected && broadcasterId && !receivedRemoteStream && !webRtcError ? t('homepage.live.waitingForStream') : t('homepage.live.connecting'))}
                  </p>
                </div>
              )}

              {webRtcError && (
                <Alert variant="destructive" className="mt-4 text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('homepage.live.streamingIssueTitle')}</AlertTitle>
                  <AlertDescription>{webRtcError}</AlertDescription>
                </Alert>
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
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : displayedCourses.length > 0 && displayCurrency && currentExchangeRates ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {displayedCourses.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onWatchNowClick={handleOpenVideoPlayer}
                    onCourseCardClick={handleOpenCourseDetail} // Pass new handler
                    displayCurrency={displayCurrency}
                    exchangeRates={currentExchangeRates}
                  />
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
              {t('homepage.testimonials.title')}
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
      {selectedCourseForDetail && displayCurrency && currentExchangeRates && (
        <CourseDetailModal
          isOpen={isCourseDetailModalOpen}
          onOpenChange={setIsCourseDetailModalOpen}
          video={selectedCourseForDetail}
          onWatchVideo={handleWatchFromDetailModal}
          displayCurrency={displayCurrency}
          exchangeRates={currentExchangeRates}
        />
      )}
      {!isLoadingAnnouncement && currentAnnouncement && (
        <AnnouncementModal
          isOpen={isAnnouncementModalOpen}
          onOpenChange={setIsAnnouncementModalOpen}
          announcement={currentAnnouncement}
        />
      )}
    </div>
  );
}
    
