
'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useTranslation } from '@/context/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const { t, currentSiteTitle } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12">
        <Card className="shadow-xl border-primary/20">
          <CardHeader className="text-center">
            <ShieldCheck className="mx-auto h-16 w-16 text-primary mb-4" />
            <CardTitle className="font-headline text-4xl md:text-5xl text-primary">
              {t('privacyPage.mainTitle')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('privacyPage.lastUpdated', { date: 'October 26, 2023', siteTitle: currentSiteTitle})}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none mx-auto text-foreground/80 leading-relaxed space-y-6">
            <p>{t('privacyPage.introduction.paragraph1', { siteTitle: currentSiteTitle })}</p>
            <p>{t('privacyPage.introduction.paragraph2')}</p>

            <h2>{t('privacyPage.informationCollection.title')}</h2>
            <p>{t('privacyPage.informationCollection.paragraph1')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('privacyPage.informationCollection.item1')}</li>
              <li>{t('privacyPage.informationCollection.item2')}</li>
              <li>{t('privacyPage.informationCollection.item3')}</li>
              <li>{t('privacyPage.informationCollection.item4')}</li>
            </ul>

            <h2>{t('privacyPage.useOfInformation.title')}</h2>
            <p>{t('privacyPage.useOfInformation.paragraph1')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('privacyPage.useOfInformation.item1')}</li>
              <li>{t('privacyPage.useOfInformation.item2')}</li>
              <li>{t('privacyPage.useOfInformation.item3')}</li>
              <li>{t('privacyPage.useOfInformation.item4')}</li>
            </ul>

            <h2>{t('privacyPage.informationSharing.title')}</h2>
            <p>{t('privacyPage.informationSharing.paragraph1')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('privacyPage.informationSharing.item1')}</li>
              <li>{t('privacyPage.informationSharing.item2')}</li>
              <li>{t('privacyPage.informationSharing.item3')}</li>
            </ul>
            <p>{t('privacyPage.informationSharing.paragraph2')}</p>
            
            <h2>{t('privacyPage.dataSecurity.title')}</h2>
            <p>{t('privacyPage.dataSecurity.paragraph1')}</p>

            <h2>{t('privacyPage.cookies.title')}</h2>
            <p>{t('privacyPage.cookies.paragraph1', { siteTitle: currentSiteTitle })}</p>

            <h2>{t('privacyPage.yourRights.title')}</h2>
            <p>{t('privacyPage.yourRights.paragraph1')}</p>

            <h2>{t('privacyPage.childrensPrivacy.title')}</h2>
            <p>{t('privacyPage.childrensPrivacy.paragraph1', { siteTitle: currentSiteTitle })}</p>
            
            <h2>{t('privacyPage.changesToPolicy.title')}</h2>
            <p>{t('privacyPage.changesToPolicy.paragraph1')}</p>

            <h2>{t('privacyPage.contactUs.title')}</h2>
            <p>{t('privacyPage.contactUs.paragraph1', { email: `support@${currentSiteTitle.toLowerCase().replace(/\s+/g, '')}.com` })}</p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
