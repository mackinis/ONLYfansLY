
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
  onCourseCardClick: (video: Video) => void; // New prop
  displayCurrency: ActiveCurrencySetting;
  exchangeRates: ExchangeRates;
}

export default function VideoCard({ video, onWatchNowClick, onCourseCardClick, displayCurrency, exchangeRates }: VideoCardProps) {
  const { t, language } = useTranslation();
  const [formattedUpdatedAt, setFormattedUpdatedAt] = useState<string | null>(null);
  const [displayPrice, setDisplayPrice] = useState<string | null>(null);

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
    if (video.priceArs && displayCurrency && exchangeRates) {
      let price = video.priceArs;
      let symbol = displayCurrency.symbol;
      let targetLocale = 'es-AR'; 

      if (displayCurrency.code === 'USD') {
        price = video.priceArs / exchangeRates.usdToArs;
        targetLocale = 'en-US';
      } else if (displayCurrency.code === 'EUR') {
        price = video.priceArs / exchangeRates.eurToArs;
        targetLocale = 'de-DE'; 
      }
      
      try {
        setDisplayPrice(`${symbol}${price.toLocaleString(targetLocale, { minimumFractionDigits: displayCurrency.code === 'ARS' ? 0 : 2, maximumFractionDigits: displayCurrency.code === 'ARS' ? 0 : 2 })}`);
      } catch(e) {
         setDisplayPrice(`${symbol}${price.toFixed(displayCurrency.code === 'ARS' ? 0 : 2)}`);
      }

    } else if (video.priceArs) {
      setDisplayPrice(`${video.priceArs.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ARS (raw)`);
    }
     else {
      setDisplayPrice(t('videoCard.loadingPrice'));
    }
  }, [video.priceArs, displayCurrency, exchangeRates, t]);


  const previewSrc = video.previewImageUrl || `https://placehold.co/600x400/1A1A1A/D4AF37?text=${encodeURIComponent(video.title)}`;
  const dataAiHintValue = video.title.split(' ').slice(0, 2).join(' ').toLowerCase() || 'course video';

  return (
    <Card 
      className="overflow-hidden shadow-lg hover:shadow-primary/20 transition-shadow duration-300 ease-in-out flex flex-col h-full rounded-lg border-border/50 cursor-pointer group"
      onClick={() => onCourseCardClick(video)} // Make entire card clickable
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
        <div className="flex items-center">
          <Tag className="h-4 w-4 mr-1.5 text-primary" />
          <span className="text-lg font-semibold text-primary">
            {displayPrice || t('videoCard.loadingPrice')}
          </span>
        </div>
        <Button 
            variant="default" 
            size="sm" 
            onClick={(e) => { 
                e.stopPropagation(); // Prevent card's onClick from firing
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

