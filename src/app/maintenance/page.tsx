
'use client';

import { Film, HardHat } from 'lucide-react';
import { useTranslation } from '@/context/I18nContext';
import Image from 'next/image';

export default function MaintenancePage() {
  const { t, siteSettings, currentSiteTitle, currentSiteIconUrl } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 text-center">
      <div className="mb-8">
        {currentSiteIconUrl ? (
          <Image src={currentSiteIconUrl} alt={currentSiteTitle || t('header.title')} width={80} height={80} className="h-20 w-20 rounded-lg mx-auto" data-ai-hint="logo" />
        ) : (
          <Film className="h-20 w-20 text-primary mx-auto" />
        )}
      </div>
      <HardHat className="h-16 w-16 text-primary mb-6" />
      <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary mb-4">
        {siteSettings?.siteTitle || t('header.title')}
      </h1>
      <h2 className="text-2xl md:text-3xl font-semibold mb-3">{t('maintenancePage.title')}</h2>
      <p className="text-lg text-muted-foreground max-w-md">
        {t('maintenancePage.message')}
      </p>
      {siteSettings?.maintenanceMode && (
        <p className="mt-6 text-sm text-muted-foreground">
          {t('maintenancePage.adminAccess')} <a href="/login" className="text-primary hover:underline">{t('maintenancePage.loginLink')}</a>.
        </p>
      )}
    </div>
  );
}
