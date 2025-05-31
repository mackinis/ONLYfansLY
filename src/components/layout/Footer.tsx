
'use client';

import Link from 'next/link';
import { useState } from 'react';
import TestimonialModal from '@/components/TestimonialModal';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Film, Facebook, Instagram, Twitter, Youtube, Linkedin, MessageCircle, Link2, Music2 } from 'lucide-react';
import { useTranslation } from '@/context/I18nContext';
import type { SocialLink } from '@/lib/types';
import React from 'react';
import Image from 'next/image';

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

  return (
    <>
      <footer className="bg-card text-card-foreground border-t border-border/40 mt-auto">
        <div className="container py-12 px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Column 1: Icon */}
            <div className="flex items-center justify-center"> {/* Removed md:justify-start */}
              <Link href="/" aria-label={currentSiteTitle || t('header.title')}>
                {siteSettings?.siteIconUrl ? (
                  <Image src={siteSettings.siteIconUrl} alt={currentSiteTitle || t('header.title')} width={64} height={64} className="h-16 w-16 rounded-sm" data-ai-hint="logo" />
                ) : (
                  <Film className="h-16 w-16 text-primary" />
                )}
              </Link>
            </div>

            {/* Column 2: Quick Links */}
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
