
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
import { PlayCircle, Loader2, Video as VideoIconLucideSvg, AlertTriangle } from 'lucide-react'; // Renamed VideoIcon
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from '@/context/I18nContext';
import { cn } from '@/lib/utils';

const PC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function HomePage() {
  const { t, siteSettings, isLoadingSettings: isLoadingSiteSettings, displayCurrency, 
    exchangeRates: contextExchangeRates 
  } = useTranslation();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isStreamLive, setIsStreamLive] = useState(false);
  const [streamTitleToDisplay, setStreamTitleToDisplay] = useState('');
  const [receivedRemoteStream, setReceivedRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [webRtcError, setWebRtcError] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);


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

  const siteLiveStreamDefaultTitle = siteSettings?.liveStreamDefaultTitle;
  const siteLiveStreamOfflineMessage = siteSettings?.liveStreamOfflineMessage;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserProfileString = sessionStorage.getItem('aurum_user_profile');
      if (storedUserProfileString) {
        try {
          const userProfile: SessionUserProfile = JSON.parse(storedUserProfileString);
          setLoggedInUserId(userProfile.id);
        } catch (e) {
          console.error("Failed to parse user profile for stream auth:", e);
        }
      }
    }
  }, []);


  useEffect(() => {
    if (siteSettings) {
      setCurrentExchangeRates(siteSettings.exchangeRates); 
      setStreamTitleToDisplay(siteLiveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    }
  }, [siteSettings, siteLiveStreamDefaultTitle, t]);


  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const response = await fetch('/api/video-courses');
        if (!response.ok) {
          throw new Error(`Failed to fetch video courses: ${response.statusText}`);
        }
        const courses: Video[] = await response.json();
        setVideoCourses(courses);
      } catch (error) {
        console.error("Failed to fetch video courses:", error);
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  const fetchAndShowAnnouncement = useCallback(async () => {
    if (isLoadingSiteSettings) return;
    setIsLoadingAnnouncement(true);
    try {
      const response = await fetch('/api/announcements?activeOnly=true&nonExpiredOnly=true');
      if (!response.ok) {
        throw new Error(`Failed to fetch announcements: ${response.statusText}`);
      }
      const allAnnouncements: Announcement[] = await response.json();
      
      let announcementToShow: Announcement | null = null;

      for (const ann of allAnnouncements) {
        if (ann.showOnce) {
          if (typeof window !== 'undefined') {
            const viewedKey = `announcement_viewed_${ann.id}`;
            if (!localStorage.getItem(viewedKey)) {
              announcementToShow = ann;
              break;
            }
          }
        } else {
          announcementToShow = ann; 
          break;
        }
      }
      
      if (announcementToShow) {
        setCurrentAnnouncement(announcementToShow);
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
  }, [isLoadingSiteSettings]);

  useEffect(() => {
    fetchAndShowAnnouncement();
  }, [fetchAndShowAnnouncement]);

  const handleOpenVideoPlayer = (video: Video) => {
    setSelectedVideoForPlayer(video);
    setIsVideoPlayerModalOpen(true);
    fetch(`/api/video-courses/${video.id}/increment-view`, { method: 'POST' })
      .then(response => {
        if (!response.ok) {
          console.error("Failed to increment views for video:", video.id, response.statusText);
        }
      })
      .catch(err => {
          console.error("Error incrementing views for video:", video.id, err);
      });
  };

  const handleOpenCourseDetail = (video: Video) => {
    setSelectedCourseForDetail(video);
    setIsCourseDetailModalOpen(true);
  };

  const handleWatchFromDetailModal = (video: Video) => {
    setIsCourseDetailModalOpen(false);
    handleOpenVideoPlayer(video);
  };

  useEffect(() => {
    const newSocket = io({ path: '/api/socket_io' });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Visitor connected to Socket.IO server', newSocket.id);
      newSocket.emit('register-viewer', { userId: loggedInUserId }); // Send userId if available
    });

    newSocket.on('broadcaster-ready', (data: { broadcasterId: string, streamTitle?: string }) => {
      setBroadcasterId(data.broadcasterId);
      setIsStreamLive(true);
      setWebRtcError(null);
      setStreamTitleToDisplay(data.streamTitle || siteLiveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    });

    newSocket.on('stream-title-updated', (data: { streamTitle: string }) => {
      setStreamTitleToDisplay(data.streamTitle);
    });

    newSocket.on('offer-from-broadcaster', async ({ broadcasterId: bId, offer }) => {
      if (bId !== broadcasterId && !broadcasterId) setBroadcasterId(bId);
      setWebRtcError(null);
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
        peerConnectionRef.current.close();
      }
      const pc = new RTCPeerConnection(PC_CONFIG);
      peerConnectionRef.current = pc;
      pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
          setReceivedRemoteStream(event.streams[0]);
          setIsStreamLive(true);
        } else {
          setWebRtcError(t('homepage.live.webrtcSetupError') + ': No valid stream received in ontrack.');
          setReceivedRemoteStream(null);
          setIsStreamLive(false);
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
        if (currentState === 'connected' || currentState === 'completed') {
          setIsStreamLive(true); setWebRtcError(null);
        } else if (currentState === 'failed') {
          setIsStreamLive(false); setReceivedRemoteStream(null); setWebRtcError(t('homepage.live.connectionLostError'));
          if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
        } else if (currentState === 'disconnected' || currentState === 'closed') {
           if (isStreamLive) { setIsStreamLive(false); setReceivedRemoteStream(null); }
           if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
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
        setWebRtcError(`${t('homepage.live.webrtcSetupError')}: ${error instanceof Error ? error.message : String(error)}`);
        setIsStreamLive(false); setReceivedRemoteStream(null);
        if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
      }
    });
    newSocket.on('candidate-from-broadcaster', ({ candidate }) => {
      if (peerConnectionRef.current && candidate && peerConnectionRef.current.signalingState !== 'closed') {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
          setWebRtcError(`${t('homepage.live.iceCandidateError')}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
    });
    newSocket.on('broadcaster-disconnected', () => {
      setIsStreamLive(false); setReceivedRemoteStream(null); setWebRtcError(null);
      if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
      setBroadcasterId(null);
      setStreamTitleToDisplay(siteLiveStreamDefaultTitle || t('homepage.live.defaultTitle'));
    });
    newSocket.on('disconnect', () => {
      setIsStreamLive(false); setReceivedRemoteStream(null);
       if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    });
    return () => {
      if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
      if (newSocket) newSocket.disconnect();
      setSocket(null); setReceivedRemoteStream(null); setIsStreamLive(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteSettings, siteLiveStreamDefaultTitle, t, broadcasterId, loggedInUserId]); // Added loggedInUserId to dependencies

  useEffect(() => {
    if (receivedRemoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = receivedRemoteStream;
      remoteVideoRef.current.play().then(() => setWebRtcError(null))
      .catch(e => setWebRtcError(`${t('homepage.live.webrtcSetupError')}: Video playback failed - ${e instanceof Error ? e.message : String(e)}`));
    } else if (!receivedRemoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [receivedRemoteStream, t]);

  if (isLoadingSiteSettings || !siteSettings) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const displayedCourses = videoCourses.slice(0, 3);
  const effectiveExchangeRates = currentExchangeRates || siteSettings.exchangeRates;

  const getTaglineSizeClass = (size?: HeroTaglineSize) => {
    switch (size) {
      case 'sm': return 'text-base md:text-lg'; // Smaller than subtitle
      case 'lg': return 'text-xl md:text-2xl'; // Larger than default subtitle
      case 'md':
      default:
        return 'text-lg md:text-xl'; // Same as subtitle or a default
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section className="py-16 md:py-24 bg-gradient-to-br from-background to-card/50">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-headline text-4xl md:text-6xl font-bold text-primary mb-4">
              {siteSettings.heroTitle || t('homepage.hero.title')}
            </h1>
            {siteSettings.heroTagline && (
              <p 
                className={cn(
                  "mb-4 mx-auto max-w-2xl", 
                  getTaglineSizeClass(siteSettings.heroTaglineSize)
                )}
                style={{ color: siteSettings.heroTaglineColor || 'inherit' }}
              >
                {siteSettings.heroTagline}
              </p>
            )}
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
                  <VideoIconLucideSvg className="h-16 w-16 text-muted-foreground/50 mb-4" />
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
            ) : displayedCourses.length > 0 && displayCurrency && effectiveExchangeRates ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {displayedCourses.map((video) => (
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
