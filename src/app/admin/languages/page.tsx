
'use client';

import { useEffect, useState }from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Languages as LanguagesIcon, Save, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import type { SiteSettings } from '@/lib/types';
import { updateSiteSettings } from '@/lib/actions';

export default function LanguagesAdminPage() {
  const { t, siteSettings, isLoadingSettings, refreshSiteSettings } = useTranslation();
  const { toast } = useToast();
  
  const [localDefaultLanguage, setLocalDefaultLanguage] = useState<'en' | 'es'>('es');
  const [localAllowUserToChoose, setLocalAllowUserToChoose] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (siteSettings) {
      setLocalDefaultLanguage(siteSettings.defaultLanguage);
      setLocalAllowUserToChoose(siteSettings.allowUserToChooseLanguage);
    }
  }, [siteSettings]);


  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    try {
      const result = await updateSiteSettings({
        defaultLanguage: localDefaultLanguage,
        allowUserToChooseLanguage: localAllowUserToChoose,
      });

      if (result.success) {
        toast({
          title: t('adminLanguagesPage.settingsSaved'),
          description: t('adminLanguagesPage.settingsSavedDescription'),
        });
        await refreshSiteSettings();
      } else {
        toast({
          title: t('adminLanguagesPage.errorSavingTitle'),
          description: result.message || t('adminLanguagesPage.genericErrorDescription'),
          variant: 'destructive',
        });
      }
    } catch (error) {
       toast({
        title: t('adminLanguagesPage.errorSavingTitle'),
        description: error instanceof Error ? error.message : t('adminLanguagesPage.genericErrorDescription'),
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoadingSettings || !siteSettings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <LanguagesIcon className="mr-3 h-8 w-8" aria-label={t('adminLanguagesPage.titleIconDescription')} />
          {t('adminLanguagesPage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminLanguagesPage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('adminLanguagesPage.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-medium">{t('adminLanguagesPage.defaultSiteLanguage')}</Label>
            <RadioGroup
              value={localDefaultLanguage}
              onValueChange={(value) => setLocalDefaultLanguage(value as 'en' | 'es')}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="en" id="lang-en" />
                <Label htmlFor="lang-en">{t('adminLanguagesPage.english')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="es" id="lang-es" />
                <Label htmlFor="lang-es">{t('adminLanguagesPage.spanish')}</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="allow-user-choice"
              checked={localAllowUserToChoose}
              onCheckedChange={setLocalAllowUserToChoose}
              aria-label={t('adminLanguagesPage.allowUserToChooseAriaLabel')}
            />
            <Label htmlFor="allow-user-choice" className="text-base font-medium">
              {t('adminLanguagesPage.allowUserToChoose')}
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> {t('adminLanguagesPage.saveChanges')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
