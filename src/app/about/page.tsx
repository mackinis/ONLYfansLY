
'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useTranslation } from '@/context/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Film, Lightbulb, Target } from 'lucide-react';

export default function AboutPage() {
  const { t, currentSiteTitle } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12">
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary mb-8 text-center">
          {t('aboutPage.mainTitle', { siteTitle: currentSiteTitle })}
        </h1>
        
        <Card className="mb-12 shadow-xl border-primary/20">
          <CardHeader>
            <CardTitle className="font-headline text-3xl text-center text-primary">
              {t('aboutPage.welcome.title', { siteTitle: currentSiteTitle })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg text-foreground/80 space-y-4 leading-relaxed text-center">
            <p>{t('aboutPage.welcome.paragraph1', { siteTitle: currentSiteTitle })}</p>
            <p>{t('aboutPage.welcome.paragraph2')}</p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="text-center shadow-lg hover:shadow-primary/10 transition-shadow">
            <CardHeader>
              <Lightbulb className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle className="font-headline text-2xl text-primary">{t('aboutPage.mission.title')}</CardTitle>
            </CardHeader>
            <CardContent className="text-foreground/70">
              <p>{t('aboutPage.mission.text')}</p>
            </CardContent>
          </Card>
          <Card className="text-center shadow-lg hover:shadow-primary/10 transition-shadow">
            <CardHeader>
              <Target className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle className="font-headline text-2xl text-primary">{t('aboutPage.vision.title')}</CardTitle>
            </CardHeader>
            <CardContent className="text-foreground/70">
              <p>{t('aboutPage.vision.text')}</p>
            </CardContent>
          </Card>
           <Card className="text-center shadow-lg hover:shadow-primary/10 transition-shadow">
            <CardHeader>
              <Film className="mx-auto h-12 w-12 text-primary mb-2" />
              <CardTitle className="font-headline text-2xl text-primary">{t('aboutPage.whatWeOffer.title')}</CardTitle>
            </CardHeader>
            <CardContent className="text-foreground/70">
              <p>{t('aboutPage.whatWeOffer.text')}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-xl border-primary/20">
            <CardHeader>
                <CardTitle className="font-headline text-3xl text-center text-primary">
                    <Users className="inline-block mr-3 h-8 w-8" />
                    {t('aboutPage.team.title')}
                </CardTitle>
            </CardHeader>
            <CardContent className="text-lg text-foreground/80 space-y-4 leading-relaxed text-center">
                <p>{t('aboutPage.team.paragraph1')}</p>
                <p>{t('aboutPage.team.paragraph2', { siteTitle: currentSiteTitle })}</p>
            </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
