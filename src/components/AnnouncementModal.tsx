
'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Announcement } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Megaphone, X } from 'lucide-react';
// import { VideoPlayerModal } from './VideoPlayerModal'; // Not needed as we embed directly
import { getYoutubeEmbedUrl } from '@/lib/utils';

interface AnnouncementModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  announcement: Announcement | null;
}

export default function AnnouncementModal({ isOpen, onOpenChange, announcement }: AnnouncementModalProps) {
  const { t } = useTranslation();

  if (!announcement) {
    return null;
  }

  const youtubeEmbedUrl = announcement.videoUrl ? getYoutubeEmbedUrl(announcement.videoUrl) : null;

  const handleOpenChangeWithPersistence = (open: boolean) => {
    onOpenChange(open);
    if (!open && announcement?.showOnce && announcement.id && typeof window !== 'undefined') {
      localStorage.setItem(`announcement_viewed_${announcement.id}`, 'true');
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChangeWithPersistence}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl w-[90vw] bg-card border-primary/30 shadow-xl p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center">
            <Megaphone className="mr-3 h-7 w-7 text-primary" />
            <DialogTitle className="font-headline text-2xl text-primary">{announcement.title}</DialogTitle>
            <DialogDescription>Details of the announcement</DialogDescription>
          </div>
          {/* The default DialogContent includes its own close button, so this one is redundant.
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>
          */}
        </DialogHeader>

        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Text Content (if applicable) */}
            {(announcement.contentType === 'text-image' || announcement.contentType === 'text-video') && announcement.text && (
              <p className="text-foreground/90 text-base leading-relaxed whitespace-pre-wrap">{announcement.text}</p>
            )}

            {/* Image Content (if applicable) */}
            {(announcement.contentType === 'image-only' || announcement.contentType === 'text-image') && announcement.imageUrl && (
              <div className="relative aspect-video w-full rounded-md overflow-hidden border border-border">
                <Image src={announcement.imageUrl} alt={announcement.title || t('announcementModal.imageAlt', {defaultValue: 'Announcement Image'})} layout="fill" objectFit="contain" data-ai-hint="announcement banner" />
              </div>
            )}

            {/* Video Content (if applicable) */}
            {(announcement.contentType === 'text-video' || announcement.contentType === 'video-only') && announcement.videoUrl && (
              <div className="aspect-video rounded-md overflow-hidden border border-border">
                {youtubeEmbedUrl ? (
                  <iframe
                    width="100%"
                    height="100%"
                    src={youtubeEmbedUrl}
                    title={announcement.title || t('announcementModal.videoAlt', {defaultValue: 'Announcement Video'})}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <video className="w-full h-full bg-black" controls playsInline>
                    <source src={announcement.videoUrl} type="video/mp4" /> {/* Assuming mp4, adjust if other types are supported */}
                    {t('videoPlayerModal.unsupportedVideo')}
                  </video>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t border-border sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline">{t('announcementModal.closeButton', {defaultValue: 'Close'})}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
