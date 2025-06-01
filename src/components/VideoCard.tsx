
'use client';

import Image from 'next/image';
import type { Video, ActiveCurrencySetting, ExchangeRates } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Tag, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/context/I18nContext';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  video: Video;
  onWatchNowClick: (video: Video) => void;
  onCourseCardClick: (video: Video) => void;
  displayCurrency: ActiveCurrencySetting | null; 
  exchangeRates: ExchangeRates | null; 
}

export default function VideoCard({ video, onWatchNowClick, onCourseCardClick, displayCurrency, exchangeRates }: VideoCardProps) {
  const { t, language } = useTranslation();
  const [formattedUpdatedAt, setFormattedUpdatedAt] = useState<string | null>(null);
  const [originalPriceDisplay, setOriginalPriceDisplay] = useState<string | null>(null);
  const [finalPriceDisplay, setFinalPriceDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (video.updatedAt) {
      try {
        const date = new Date(video.updatedAt);
        if (!isNaN(date.getTime())) {
           setFormattedUpdatedAt(date.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' }));
        } else {
            setFormattedUpdatedAt(t('videoCard.invalidDate'));
        }
      } catch (e) {
        setFormattedUpdatedAt(t('videoCard.invalidDate'));
      }
    }
  }, [video.updatedAt, language, t]);

  useEffect(() => {
    if (displayCurrency && exchangeRates && video) {
        const originalPrice = video.priceArs;
        // Use finalPriceArs if it exists and is a valid number, otherwise default to originalPrice
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

        // Show original price strikethrough if there's a valid discount
        if (video.discountInput && video.discountInput.trim() !== '' && typeof video.finalPriceArs === 'number' && video.finalPriceArs < originalPrice) {
            const currentOriginalPriceStr = formatPrice(originalPrice, displayCurrency, exchangeRates);
            setOriginalPriceDisplay(currentOriginalPriceStr);
        } else {
            setOriginalPriceDisplay(null); // No discount or final price is not less than original
        }

    } else if (video?.priceArs) { // Fallback if displayCurrency or rates are not ready
        setOriginalPriceDisplay(null);
        setFinalPriceDisplay(`${video.priceArs.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ARS`);
    } else {
        setOriginalPriceDisplay(null);
        setFinalPriceDisplay(t('videoCard.loadingPrice'));
    }
  }, [video, displayCurrency, exchangeRates, language, t]);


  const previewSrc = video.previewImageUrl || `https://placehold.co/600x400/1A1A1A/D4AF37?text=${encodeURIComponent(video.title)}`;
  const dataAiHintValue = video.title.split(' ').slice(0, 2).join(' ').toLowerCase() || 'course video';

  return (
    <Card
      className="overflow-hidden shadow-lg hover:shadow-primary/20 transition-shadow duration-300 ease-in-out flex flex-col h-full rounded-lg border-border/50 cursor-pointer group"
      onClick={() => onCourseCardClick(video)}
      role="button"
      tabIndex={0}
      aria-label={`${t('videoCard.viewDetailsAriaLabel')} ${video.title}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCourseCardClick(video); }}
    >
      <CardHeader className="p-0 relative">
        <Image
          src={previewSrc}
          alt={video.title}
          width={600}
          height={400}
          className="object-cover aspect-video w-full"
          data-ai-hint={dataAiHintValue}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
         <div className="absolute bottom-4 left-4">
          <h3 className="font-headline text-xl font-semibold text-white line-clamp-2">{video.title}</h3>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-black/50 rounded-full">
            <ExternalLink className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <p className="text-sm text-foreground/80 mb-3 line-clamp-3">
          {video.description}
        </p>
        <div className="flex items-center text-xs text-muted-foreground space-x-3">
          {video.duration && (
            <div className="flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1" />
              <span>{video.duration}</span>
            </div>
          )}
          {formattedUpdatedAt && (
             <div className="flex items-center">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              <span>{t('videoCard.updatedLabel')}: {formattedUpdatedAt}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t border-border/30 flex justify-between items-center">
        <div className="flex flex-col items-end"> {/* Changed items-start to items-end */}
          {originalPriceDisplay && (
            <span className="line-through text-muted-foreground text-xs">
              {originalPriceDisplay}
            </span>
          )}
          <div className="flex items-center">
            <Tag className="h-3.5 w-3.5 mr-1 text-primary" />
            <span className="text-base font-semibold text-primary">
              {finalPriceDisplay || t('videoCard.loadingPrice')}
            </span>
          </div>
        </div>
        <Button
            variant="default"
            size="sm"
            onClick={(e) => {
                e.stopPropagation();
                onWatchNowClick(video);
            }}
            aria-label={`${t('videoCard.watchNowButtonAriaLabel')} ${video.title}`}
        >
          <PlayCircle className="mr-2 h-4 w-4" /> {t('videoCard.watchNowButton')}
        </Button>
      </CardFooter>
    </Card>
  );
}
