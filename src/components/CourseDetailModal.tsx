
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
import type { Video, ActiveCurrencySetting, ExchangeRates } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlayCircle, Tag, Clock, X, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CourseDetailModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  video: Video | null;
  onWatchVideo: (video: Video) => void; 
  displayCurrency: ActiveCurrencySetting | null;
  exchangeRates: ExchangeRates | null;
}

export default function CourseDetailModal({
  isOpen,
  onOpenChange,
  video,
  onWatchVideo,
  displayCurrency,
  exchangeRates,
}: CourseDetailModalProps) {
  const { t, language } = useTranslation();
  const [formattedUpdatedAt, setFormattedUpdatedAt] = useState<string | null>(null);
  const [originalPriceDisplay, setOriginalPriceDisplay] = useState<string | null>(null);
  const [finalPriceDisplay, setFinalPriceDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (video?.updatedAt) {
      try {
        const date = new Date(video.updatedAt);
        setFormattedUpdatedAt(date.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' }));
      } catch (e) {
        setFormattedUpdatedAt(t('videoCard.invalidDate'));
      }
    } else {
      setFormattedUpdatedAt(null);
    }
  }, [video?.updatedAt, language, t]);

  useEffect(() => {
    if (displayCurrency && exchangeRates && video) {
        const originalPrice = video.priceArs;
        const finalPrice = (typeof video.finalPriceArs === 'number' && !isNaN(video.finalPriceArs)) 
                            ? video.finalPriceArs 
                            : originalPrice;

        const formatPrice = (price: number, currency: ActiveCurrencySetting, rates: ExchangeRates) => {
            let p = price;
            let sym = currency.symbol;
            let loc = language === 'es' ? 'es-AR' : 'en-US';

            if (currency.code === 'USD') {
                p = price / rates.usdToArs;
                loc = 'en-US';
            } else if (currency.code === 'EUR') {
                p = price / rates.eurToArs;
                loc = language === 'es' ? 'es-ES' : 'de-DE';
            }
            try {
                return `${sym}${p.toLocaleString(loc, { minimumFractionDigits: currency.code === 'ARS' ? 0 : 2, maximumFractionDigits: currency.code === 'ARS' ? 0 : 2 })}`;
            } catch(e) {
                 return `${sym}${p.toFixed(currency.code === 'ARS' ? 0 : 2)}`;
            }
        };

        const currentFinalPriceStr = formatPrice(finalPrice, displayCurrency, exchangeRates);
        setFinalPriceDisplay(currentFinalPriceStr);

        if (video.discountInput && video.discountInput.trim() !== '' && typeof video.finalPriceArs === 'number' && video.finalPriceArs < originalPrice) {
            const currentOriginalPriceStr = formatPrice(originalPrice, displayCurrency, exchangeRates);
            setOriginalPriceDisplay(currentOriginalPriceStr);
        } else {
            setOriginalPriceDisplay(null);
        }
    } else if (video?.priceArs) {
        setOriginalPriceDisplay(null);
        setFinalPriceDisplay(`${video.priceArs.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ARS (raw)`);
    } else {
        setOriginalPriceDisplay(null);
        setFinalPriceDisplay(t('videoCard.loadingPrice'));
    }
  }, [video, displayCurrency, exchangeRates, t, language]);

  if (!video) {
    return null;
  }

  const previewSrc = video.previewImageUrl || `https://placehold.co/800x450/1A1A1A/D4AF37?text=${encodeURIComponent(video.title)}`;
  const dataAiHintValue = video.title.split(' ').slice(0, 2).join(' ').toLowerCase() || 'course detail';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] bg-card border-primary/30 shadow-xl p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="font-headline text-2xl text-primary">{video.title}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="relative aspect-video w-full rounded-md overflow-hidden border border-border">
              <Image src={previewSrc} alt={video.title} layout="fill" objectFit="cover" data-ai-hint={dataAiHintValue} />
            </div>
            
            <h3 className="font-semibold text-lg mt-4">{t('courseDetailModal.descriptionTitle')}</h3>
            <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
              {video.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider">{t('courseDetailModal.priceTitle')}</h4>
                <div className="flex flex-col items-start"> {/* Changed to flex-col and items-start */}
                  {originalPriceDisplay && (
                    <span className="line-through text-muted-foreground text-sm">
                      {originalPriceDisplay}
                    </span>
                  )}
                  <div className="flex items-center mt-0.5"> {/* Keep Tag and final price inline */}
                    <Tag className="h-5 w-5 mr-1.5 text-primary" />
                    <p className="text-lg font-semibold text-primary">
                      {finalPriceDisplay}
                    </p>
                  </div>
                </div>
              </div>
              {video.duration && (
                <div>
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider">{t('courseDetailModal.durationTitle')}</h4>
                  <p className="text-lg font-semibold text-foreground flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    {video.duration}
                  </p>
                </div>
              )}
            </div>
            {formattedUpdatedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                    {t('videoCard.updatedLabel')}: {formattedUpdatedAt}
                </p>
            )}

          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t border-border flex-shrink-0 sm:justify-between items-center">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            <X className="mr-2 h-4 w-4" />
            {t('courseDetailModal.closeButton')}
          </Button>
          <Button onClick={() => onWatchVideo(video)} className="w-full sm:w-auto mt-2 sm:mt-0">
            <PlayCircle className="mr-2 h-5 w-5" />
            {t('courseDetailModal.watchVideoButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
