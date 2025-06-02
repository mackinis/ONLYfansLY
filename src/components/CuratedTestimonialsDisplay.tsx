
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { CuratedTestimonial, Testimonial, SiteSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Quote, Loader2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
// Removed: import { getTestimonials } from '@/lib/actions';
// Removed: import { curateTestimonials, CurateTestimonialsInput } from '@/ai/flows/curate-testimonials';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import TestimonialDetailModal from './TestimonialDetailModal';
import { cn } from '@/lib/utils';
import type { CurateTestimonialsInput, CurateTestimonialsOutput } from '@/ai/flows/curate-testimonials';

const ROTATION_INTERVAL = 4000;

export default function CuratedTestimonialsDisplay() {
  const [allCuratedTestimonials, setAllCuratedTestimonials] = useState<CuratedTestimonial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t, language, siteSettings, isLoadingSettings } = useTranslation();

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAndDisplayTestimonials = useCallback(async () => {
    if (isLoadingSettings || !siteSettings) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/testimonials?status=approved');
      if (!response.ok) throw new Error('Failed to fetch approved testimonials');
      const approvedTestimonials: Testimonial[] = await response.json();

      if (approvedTestimonials.length === 0) {
        setAllCuratedTestimonials([]);
        setIsLoading(false);
        return;
      }

      const useAICuration = siteSettings.aiCurationEnabled && approvedTestimonials.length >= siteSettings.aiCurationMinTestimonials;

      if (useAICuration) {
        const inputForAI: CurateTestimonialsInput = approvedTestimonials.map(item => ({
          id: item.id,
          text: item.text,
          author: item.author,
          date: item.date,
        }));

        const aiResponse = await fetch('/api/ai/curate-testimonials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputForAI),
        });

        if (!aiResponse.ok) {
            console.error("AI Curation API error:", await aiResponse.text());
            throw new Error('AI Curation API request failed');
        }
        const curatedOutput: CurateTestimonialsOutput = await aiResponse.json();


        const curatedMap = new Map(curatedOutput.map(item => [item.id, item.reason]));
        let enrichedTestimonials = approvedTestimonials
          .filter(item => curatedMap.has(item.id))
          .map(item => ({
            ...item,
            photoUrls: item.photoUrls || [],
            videoUrls: item.videoUrls || [],
            reason: curatedMap.get(item.id) || t('curatedTestimonials.defaultAiReason')
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (enrichedTestimonials.length === 0 && approvedTestimonials.length > 0) {
          enrichedTestimonials = approvedTestimonials
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(item => ({ ...item, photoUrls: item.photoUrls || [], videoUrls: item.videoUrls || [], reason: t('curatedTestimonials.recentTestimonialReason') }));
        }
        setAllCuratedTestimonials(enrichedTestimonials);
      } else {
        const recentTestimonials = approvedTestimonials
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map(item => ({ ...item, photoUrls: item.photoUrls || [], videoUrls: item.videoUrls || [], reason: t('curatedTestimonials.recentTestimonialReason') }));
        setAllCuratedTestimonials(recentTestimonials);

        if (!siteSettings.aiCurationEnabled) {
          console.info(t('curatedTestimonials.aiCurationDisabled'));
        } else if (approvedTestimonials.length < siteSettings.aiCurationMinTestimonials) {
          console.info(t('curatedTestimonials.notEnoughForAICuration', { currentCount: approvedTestimonials.length.toString(), minRequired: siteSettings.aiCurationMinTestimonials.toString() }));
        }
      }
    } catch (error) {
      console.error("Error fetching or curating testimonials for display:", error);
      toast({
        title: t('curatedTestimonials.toast.loadErrorTitle'),
        description: t('curatedTestimonials.toast.loadErrorDescription'),
        variant: "destructive"
      });
      try {
        const approvedResponse = await fetch('/api/testimonials?status=approved');
        if (!approvedResponse.ok) throw new Error('Failed to fetch fallback approved testimonials');
        const approved: Testimonial[] = await approvedResponse.json();
        setAllCuratedTestimonials(
          approved
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(item => ({
              ...item,
              photoUrls: item.photoUrls || [],
              videoUrls: item.videoUrls || [],
              reason: t('curatedTestimonials.fallbackReason')
            }))
        );
      } catch (fallbackError) {
        console.error("Error fetching fallback testimonials for display:", fallbackError);
        setAllCuratedTestimonials([]);
      }
    } finally {
      setIsLoading(false);
      setCurrentIndex(0);
    }
  }, [isLoadingSettings, siteSettings, t, toast]);

  useEffect(() => {
    if (!isLoadingSettings && siteSettings) {
      fetchAndDisplayTestimonials();
    }
  }, [fetchAndDisplayTestimonials, isLoadingSettings, siteSettings]);

  const resetInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (allCuratedTestimonials.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prevIndex => (prevIndex + 1) % allCuratedTestimonials.length);
      }, ROTATION_INTERVAL);
    }
  }, [allCuratedTestimonials.length]);

  useEffect(() => {
    resetInterval();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [allCuratedTestimonials.length, resetInterval]);


  const handleNext = () => {
    setCurrentIndex(prevIndex => (prevIndex + 1) % allCuratedTestimonials.length);
    resetInterval();
  };

  const handlePrevious = () => {
    setCurrentIndex(prevIndex => (prevIndex - 1 + allCuratedTestimonials.length) % allCuratedTestimonials.length);
    resetInterval();
  };

  const handleOpenDetailModal = (testimonial: Testimonial) => {
    setSelectedTestimonial(testimonial);
    setIsDetailModalOpen(true);
  };

  const handleDotClick = (index: number) => {
    if (allCuratedTestimonials.length <= 3) {
      setCurrentIndex(index);
      resetInterval();
    }
  };

  const currentDisplayedTestimonial = allCuratedTestimonials[currentIndex];

  if (isLoading || isLoadingSettings) {
    return (
      <div className="min-h-[250px] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (allCuratedTestimonials.length === 0) {
    return <p className="text-center text-muted-foreground min-h-[100px] flex items-center justify-center">{t('curatedTestimonials.noTestimonials')}</p>;
  }

  const numTotalTestimonials = allCuratedTestimonials.length;
  const numDotsToShow = Math.min(numTotalTestimonials, 3);
  let activeDotIndex = 0;

  if (numTotalTestimonials <= 3) {
    activeDotIndex = currentIndex;
  } else {
    const third = numTotalTestimonials / 3;
    if (currentIndex < Math.floor(third)) {
      activeDotIndex = 0;
    } else if (currentIndex < Math.floor(2 * third)) {
      activeDotIndex = 1;
    } else {
      activeDotIndex = 2;
    }
  }


  return (
    <>
      <div className="relative">
        {currentDisplayedTestimonial && (
          <Card
            key={currentDisplayedTestimonial.id}
            className="bg-card/80 shadow-lg border-border/50 flex flex-col min-h-[220px] cursor-pointer hover:border-primary/50 transition-all duration-200 w-full max-w-lg mx-auto"
            onClick={() => handleOpenDetailModal(currentDisplayedTestimonial)}
            tabIndex={0}
            role="button"
            aria-label={`${t('curatedTestimonials.viewTestimonialAriaLabel')} ${currentDisplayedTestimonial.author}`}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="font-headline text-xl text-primary">{currentDisplayedTestimonial.author}</CardTitle>
                <div className="flex text-primary">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                {new Date(currentDisplayedTestimonial.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </CardHeader>
            <CardContent className="flex-grow">
              <Quote className="h-6 w-6 text-primary/50 mb-2 transform scale-x-[-1]" />
              <p className="text-foreground/90 italic mb-3 text-sm line-clamp-3">&ldquo;{currentDisplayedTestimonial.text}&rdquo;</p>
              {currentDisplayedTestimonial.reason && (
                <p className="text-xs text-primary/80 mt-2">
                  <Star className="h-3 w-3 inline mr-1 text-primary" />
                  {currentDisplayedTestimonial.reason}
                </p>
              )}
            </CardContent>
            <div className="p-4 pt-2 text-right">
              <span className="text-xs text-muted-foreground flex items-center justify-end">
                {t('curatedTestimonials.clickToViewMore')} <ExternalLink className="ml-1 h-3 w-3" />
              </span>
            </div>
          </Card>
        )}

        {numTotalTestimonials > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 transform sm:-translate-x-1/2 bg-background/70 hover:bg-accent disabled:opacity-30 z-10"
              aria-label={t('curatedTestimonials.previousPage')}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 transform sm:translate-x-1/2 bg-background/70 hover:bg-accent disabled:opacity-30 z-10"
              aria-label={t('curatedTestimonials.nextPage')}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>

      {numTotalTestimonials > 1 && (
         <div className="flex justify-center mt-4 space-x-2">
          {[...Array(numDotsToShow)].map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                activeDotIndex === index ? "bg-primary" : "bg-muted hover:bg-muted-foreground/50",
                numTotalTestimonials > 3 ? "cursor-default" : "cursor-pointer"
              )}
              aria-label={numTotalTestimonials <=3 ? `Go to testimonial ${index + 1}` : `Page indicator ${index + 1} of ${numDotsToShow}`}
              disabled={numTotalTestimonials > 3}
            />
          ))}
        </div>
      )}

      {selectedTestimonial && (
        <TestimonialDetailModal
          isOpen={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          testimonial={selectedTestimonial}
        />
      )}
    </>
  );
}

    