
'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useTranslation } from '@/context/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function TermsOfServicePage() {
  const { t, currentSiteTitle } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12">
        <Card className="shadow-xl border-primary/20">
          <CardHeader className="text-center">
            <FileText className="mx-auto h-16 w-16 text-primary mb-4" />
            <CardTitle className="font-headline text-4xl md:text-5xl text-primary">
              {t('termsPage.mainTitle')}
            </CardTitle>
             <p className="text-sm text-muted-foreground">
              {t('termsPage.lastUpdated', { date: 'October 26, 2023', siteTitle: currentSiteTitle })}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none mx-auto text-foreground/80 leading-relaxed space-y-6">
            <p>{t('termsPage.introduction.paragraph1', { siteTitle: currentSiteTitle })}</p>
            <p>{t('termsPage.introduction.paragraph2')}</p>

            <h2>{t('termsPage.userAccounts.title')}</h2>
            <p>{t('termsPage.userAccounts.paragraph1')}</p>
            <p>{t('termsPage.userAccounts.paragraph2')}</p>

            <h2>{t('termsPage.content.title')}</h2>
            <p>{t('termsPage.content.paragraph1', { siteTitle: currentSiteTitle })}</p>
            <p>{t('termsPage.content.paragraph2')}</p>

            <h2>{t('termsPage.userConduct.title')}</h2>
            <p>{t('termsPage.userConduct.paragraph1')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('termsPage.userConduct.item1')}</li>
              <li>{t('termsPage.userConduct.item2')}</li>
              <li>{t('termsPage.userConduct.item3')}</li>
            </ul>

            <h2>{t('termsPage.intellectualProperty.title')}</h2>
            <p>{t('termsPage.intellectualProperty.paragraph1', { siteTitle: currentSiteTitle })}</p>

            <h2>{t('termsPage.termination.title')}</h2>
            <p>{t('termsPage.termination.paragraph1', { siteTitle: currentSiteTitle })}</p>

            <h2>{t('termsPage.disclaimers.title')}</h2>
            <p>{t('termsPage.disclaimers.paragraph1', { siteTitle: currentSiteTitle })}</p>

            <h2>{t('termsPage.limitationOfLiability.title')}</h2>
            <p>{t('termsPage.limitationOfLiability.paragraph1', { siteTitle: currentSiteTitle })}</p>

            <h2>{t('termsPage.governingLaw.title')}</h2>
            <p>{t('termsPage.governingLaw.paragraph1')}</p>
            
            <h2>{t('termsPage.changesToTerms.title')}</h2>
            <p>{t('termsPage.changesToTerms.paragraph1')}</p>

            <h2>{t('termsPage.contactUs.title')}</h2>
            <p>{t('termsPage.contactUs.paragraph1', { email: `support@${currentSiteTitle.toLowerCase().replace(/\s+/g, '')}.com` })}</p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
