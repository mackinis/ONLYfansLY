
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
import type { Testimonial } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Quote, Star, Camera, Video as VideoIcon } from 'lucide-react';
import { Separator } from './ui/separator';
import { getYoutubeEmbedUrl } from '@/lib/utils'; // Importar la función

interface TestimonialDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  testimonial: Testimonial | null;
}

export default function TestimonialDetailModal({ isOpen, onOpenChange, testimonial }: TestimonialDetailModalProps) {
  const { t, language } = useTranslation();

  if (!testimonial) {
    return null;
  }

  const hasPhotos = testimonial.photoUrls && testimonial.photoUrls.length > 0;
  const hasVideos = testimonial.videoUrls && testimonial.videoUrls.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] bg-card border-primary/30 shadow-xl p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="font-headline text-2xl text-primary flex items-center">
            <Star className="mr-2 h-6 w-6 text-yellow-400 fill-yellow-400" />
            {t('testimonialDetailModal.title', { author: testimonial.author })}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {new Date(testimonial.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="relative">
              <Quote className="absolute -left-2 -top-2 h-8 w-8 text-primary/30 transform scale-x-[-1]" />
              <p className="text-foreground/90 italic text-base leading-relaxed pl-4">{testimonial.text}</p>
            </div>

            {hasPhotos && (
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center"><Camera className="mr-2 h-5 w-5 text-primary/80" />{t('testimonialDetailModal.photosTitle')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {testimonial.photoUrls?.map((url, index) => (
                    <a key={`photo-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square relative rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity">
                      <Image src={url} alt={`${t('testimonialDetailModal.photoAlt')} ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint="testimonial photo" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {hasVideos && (
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center"><VideoIcon className="mr-2 h-5 w-5 text-primary/80" />{t('testimonialDetailModal.videosTitle')}</h3>
                <div className="space-y-4">
                  {testimonial.videoUrls?.map((url, index) => {
                    const youtubeEmbedUrl = getYoutubeEmbedUrl(url);
                    return (
                      <div key={`video-${index}`} className="aspect-video rounded-md overflow-hidden border border-border">
                        {youtubeEmbedUrl ? (
                          <iframe
                            width="100%"
                            height="100%"
                            src={youtubeEmbedUrl}
                            title={`${t('testimonialDetailModal.videoAlt')} ${index + 1}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          ></iframe>
                        ) : (
                          <video className="w-full h-full bg-black" controls playsInline>
                            <source src={url} type="video/mp4" />
                            {t('videoPlayerModal.unsupportedVideo')}
                          </video>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {(!hasPhotos && !hasVideos) && (
                 <p className="text-sm text-muted-foreground text-center py-4">{t('testimonialDetailModal.noMedia')}</p>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t border-border">
          <DialogClose asChild>
            <Button variant="outline">{t('testimonialModal.closeButton')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
