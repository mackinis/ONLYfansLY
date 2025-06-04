
'use client';

import Link from 'next/link';
import { useState } from 'react';
import TestimonialModal from '@/components/TestimonialModal';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Film, Facebook, Instagram, Twitter, Youtube, Linkedin, MessageCircle, Link2, Music2 } from 'lucide-react';
import { useTranslation } from '@/context/I18nContext';
import type { SocialLink, FooterDisplayMode } from '@/lib/types';
import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const SocialIcon = ({ name, className }: { name?: string, className?: string }) => {
  const lowerName = name?.toLowerCase() || '';
  if (lowerName.includes('facebook')) return <Facebook className={className} />;
  if (lowerName.includes('instagram')) return <Instagram className={className} />;
  if (lowerName.includes('twitter') || lowerName.includes('x.com')) return <Twitter className={className} />;
  if (lowerName.includes('youtube')) return <Youtube className={className} />;
  if (lowerName.includes('linkedin')) return <Linkedin className={className} />;
  if (lowerName.includes('tiktok')) return <Music2 className={className} />;
  if (lowerName.includes('discord')) return <MessageCircle className={className} />;
  return <Link2 className={className} />;
};


export default function Footer() {
  const { t, siteSettings, currentSiteTitle } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);

  const socialLinks = siteSettings?.socialLinks || [];
  const footerDisplayMode = siteSettings?.footerDisplayMode || 'logo';
  const footerLogoSize = siteSettings?.footerLogoSize || 64;

  const showAndroidApp = siteSettings?.showAndroidApp && siteSettings?.androidAppLink;
  const showIosApp = siteSettings?.showIosApp && siteSettings?.iosAppLink;
  const isMobileAppsSectionVisible = siteSettings?.showMobileAppsSection && (showAndroidApp || showIosApp);

  const renderFooterBrand = () => {
    const showLogo = footerDisplayMode === 'logo' || footerDisplayMode === 'both';
    const showTitle = footerDisplayMode === 'title' || footerDisplayMode === 'both';

    return (
      <div className={cn(
        "inline-flex flex-col items-center", 
        footerDisplayMode === 'both' ? "space-y-2" : ""
      )}>
        {showLogo && (
          <Link href="/" aria-label={currentSiteTitle || t('header.title')}>
            {siteSettings?.siteIconUrl ? (
              <Image src={siteSettings.siteIconUrl} alt={currentSiteTitle || t('header.title')} width={footerLogoSize} height={footerLogoSize} className="rounded-sm" data-ai-hint="logo" style={{width: `${footerLogoSize}px`, height: `${footerLogoSize}px`}} />
            ) : (
              <Film className="text-primary" style={{width: `${footerLogoSize}px`, height: `${footerLogoSize}px`}} />
            )}
          </Link>
        )}
        {showTitle && (
          <Link href="/" aria-label={currentSiteTitle || t('header.title')}>
            <span className={cn(
              "font-headline text-primary",
              footerDisplayMode === 'both' ? "text-lg mt-1" : "text-xl",
              !showLogo && "text-2xl" 
            )}>
              {currentSiteTitle || t('header.title')}
            </span>
          </Link>
        )}
      </div>
    );
  };

  return (
    <>
      <footer className="bg-card text-card-foreground border-t border-border/40 mt-auto">
        <div className="container py-12 px-4 md:px-6">
          <div 
            className={cn(
              "grid grid-cols-1 md:grid-cols-2 gap-10",
              isMobileAppsSectionVisible ? "lg:grid-cols-5" : "lg:grid-cols-4"
            )}
          >
            
            {/* Columna 1: Brand */}
            <div className="flex justify-center items-center text-center">
            {renderFooterBrand()}
            </div>

            {/* Columna 2: Quick Links */}
            <div>
              <h3 className="font-headline text-lg font-semibold mb-4 text-primary">{t('footer.quickLinks')}</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-primary transition-colors">{t('footer.aboutUs')}</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors">{t('footer.privacyPolicy')}</Link></li>
                <li><Link href="/terms" className="hover:text-primary transition-colors">{t('footer.termsOfService')}</Link></li>
              </ul>
            </div>

            {/* Column 3: Testimonials */}
            <div className="space-y-4">
              <h3 className="font-headline text-lg font-semibold text-primary">{t('footer.testimonialsTitle')}</h3>
              <Button variant="outline" onClick={() => setIsTestimonialModalOpen(true)}>
                {t('footer.shareYourStoryButton')}
              </Button>
            </div>
            
            {/* Column 4: Follow Us */}
            <div>
              <h3 className="font-headline text-lg font-semibold mb-4 text-primary">{t('footer.followUs')}</h3>
              {socialLinks.length > 0 ? (
                <div className="flex space-x-4 flex-wrap gap-y-2">
                  {socialLinks.map((link) => (
                    <Link 
                      key={link.id} 
                      href={link.url || "#"} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      aria-label={link.name || t('footer.socialLink')}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title={link.name}
                    >
                      <SocialIcon name={link.name || link.iconName} className="h-6 w-6" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('footer.noSocialLinks')}</p>
              )}
            </div>

            {/* Columna 5: Mobile Apps (Condicional) */}
            {isMobileAppsSectionVisible && (
              <div>
                <h3 className="font-headline text-lg font-semibold mb-4 text-primary">
                  {siteSettings?.mobileAppsSectionTitle || t('footer.mobileAppsSectionTitle', {defaultValue: 'Our Apps'})}
                </h3>
                <div className="space-y-3">
                  {showAndroidApp && siteSettings.androidAppLink && (
                    <a href={siteSettings.androidAppLink} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-sm hover:text-primary transition-colors">
                      {siteSettings.androidAppIconUrl ? (
                        <Image src={siteSettings.androidAppIconUrl} alt={t('footer.androidAppIconAlt', {defaultValue: 'Android App'})} width={24} height={24} className="rounded-sm" data-ai-hint="android playstore"/>
                      ) : (
                        <svg className="h-6 w-6" viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 12L12 15.5L8.5 12L5 15.5L1.5 12L5 8.5L8.5 5L12 1.5L15.5 5L19 8.5M19.5 12L19 11.5L15.5 15L19 18.5L19.5 19L22.5 15.5Z"/></svg>
                      )}
                      <span>{t('footer.downloadAndroidApp', {defaultValue: 'Get it on Google Play'})}</span>
                    </a>
                  )}
                  {showIosApp && siteSettings.iosAppLink && (
                    <a href={siteSettings.iosAppLink} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-sm hover:text-primary transition-colors">
                      {siteSettings.iosAppIconUrl ? (
                        <Image src={siteSettings.iosAppIconUrl} alt={t('footer.iosAppIconAlt', {defaultValue: 'iOS App'})} width={24} height={24} className="rounded-sm" data-ai-hint="apple appstore"/>
                      ) : (
                        <svg className="h-6 w-6" viewBox="0 0 24 24"><path fill="currentColor" d="M17.26 16.74C17.22 16.86 17.12 17.23 17.05 17.35C16.56 18.32 15.83 19.68 14.82 19.95C14.7 19.99 14.28 20.06 13.81 20.04C12.86 20.03 12.5 19.54 11.48 19.54C10.45 19.54 10.11 20.01 9.18 20.05C8.72 20.07 8.33 19.99 8.2 19.95C7.16 19.67 6.41 18.28 5.92 17.33C5.86 17.21 5.76 16.86 5.73 16.75C5.01 14.69 5.59 12.67 6.37 11.73C6.92 11.05 7.93 10.44 9.03 10.42C9.56 10.41 10.22 10.7 10.66 10.73C11.08 10.76 11.67 10.36 12.26 10.37C13.31 10.45 14.01 10.92 14.53 11.56C14.75 11.83 14.93 12.13 15.05 12.45C15.04 12.46 15.03 12.47 15.02 12.48C13.07 13.43 13.03 16.22 15.02 17.05C15.03 17.04 15.04 17.03 15.05 17.02C15.17 16.7 15.24 16.35 15.35 16.07C15.72 15.04 17.31 14.53 17.33 12.33C17.33 12.26 17.33 12.19 17.33 12.13C17.33 10.06 15.56 8.83 15.46 8.76C14.43 8.03 13.22 7.72 12.04 7.75C11.21 7.78 10.33 8.07 9.69 8.61C9.08 9.12 8.66 9.81 8.45 10.59C8.42 10.69 8.39 10.79 8.36 10.89C7.22 13.92 9.07 16.75 11.52 16.75C12.53 16.75 13.21 16.28 13.76 16.28C14.32 16.28 14.87 16.75 15.97 16.73C16.42 16.72 16.86 16.44 17.26 16.74Z"/></svg>
                      )}
                      <span>{t('footer.downloadIosApp', {defaultValue: 'Download on the App Store'})}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <Separator className="my-8 bg-border/50" />
          
          <div className="text-center text-sm text-muted-foreground">
            {t('footer.copyright', { year: currentYear.toString(), siteTitle: currentSiteTitle })}
          </div>
        </div>
      </footer>
      <TestimonialModal isOpen={isTestimonialModalOpen} onOpenChange={setIsTestimonialModalOpen} />
    </>
  );
}
