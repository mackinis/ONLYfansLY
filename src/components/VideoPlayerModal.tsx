
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
 DialogDescription,
} from '@/components/ui/dialog';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/context/I18nContext';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  videoUrl: string;
  title: string;
}

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  let videoId = null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      if (urlObj.pathname === '/watch') {
        videoId = urlObj.searchParams.get('v');
      } else if (urlObj.pathname.startsWith('/embed/')) {
        videoId = urlObj.pathname.split('/embed/')[1].split('?')[0];
      } else if (urlObj.pathname.startsWith('/v/')) {
        videoId = urlObj.pathname.split('/v/')[1].split('?')[0];
      }
    } else if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.substring(1).split('?')[0];
    }
  } catch (e) {
    // Invalid URL, try regex as a fallback for non-URL strings that might be IDs or fragments
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i;
    const match = url.match(regex);
    if (match && match[1]) {
      videoId = match[1];
    }
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1`; // Added autoplay
  }
  return null;
}

export default function VideoPlayerModal({ isOpen, onOpenChange, videoUrl, title }: VideoPlayerModalProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const embedUrl = getYoutubeEmbedUrl(videoUrl);
    setYoutubeEmbedUrl(embedUrl);

    if (isOpen) {
      if (embedUrl) {
        // For iframe, source change is handled by React's re-render
        // Autoplay is in the URL
      } else if (videoRef.current) {
        videoRef.current.src = videoUrl; // Ensure src is set
        videoRef.current.load();
        videoRef.current.play().catch(error => console.error("Video play failed:", error));
      }
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = ''; // Clear src when modal closes
      }
      // For iframe, when modal closes, the content remains, but it's hidden.
      // To stop YouTube video, we can set src to empty when closing.
      if (iframeRef.current) {
         // To effectively stop the video, we can re-assign the src or remove it
         // However, simply hiding the dialog is usually enough. 
         // If strict stop is needed: iframeRef.current.src = ''; 
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, videoUrl]);


  if (!isClient) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] w-[90vw] bg-black border-primary shadow-xl p-2 md:p-4">
        <DialogHeader className="px-2 pt-2 md:px-4 md:pt-4">
          <DialogTitle className="font-headline text-xl md:text-2xl text-primary truncate">{title}</DialogTitle>
          <DialogDescription>
            Video playback window
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video bg-black flex items-center justify-center mt-2 md:mt-0">
          {youtubeEmbedUrl ? (
            <iframe
              ref={iframeRef}
              width="100%"
              height="100%"
              src={youtubeEmbedUrl}
              title={title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          ) : videoUrl ? (
            <video ref={videoRef} className="w-full h-full" controls controlsList="nodownload noremoteplayback" autoPlay playsInline>
              <source src={videoUrl} type="video/mp4" />
              {t('videoPlayerModal.unsupportedVideo')}
            </video>
          ) : (
            <p className="text-muted-foreground text-lg">{t('videoPlayerModal.noVideoUrl')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
