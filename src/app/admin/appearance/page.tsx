
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Save, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import { type ColorSetting, defaultThemeColorsHex } from '@/lib/config';
import { hexToHslString } from '@/lib/utils';

export default function AppearanceAdminPage() {
  const { t, siteSettings, isLoadingSettings, refreshSiteSettings } = useTranslation();
  const [colorSettings, setColorSettings] = useState<ColorSetting[]>(
    JSON.parse(JSON.stringify(defaultThemeColorsHex)) // Deep clone for initial state
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const applyThemeToDocument = useCallback((theme: ColorSetting[]) => {
    theme.forEach(color => {
      const hslValue = hexToHslString(color.value);
      document.documentElement.style.setProperty(color.cssVar, hslValue);
    });
  }, []);

  useEffect(() => {
    if (!isLoadingSettings && siteSettings?.themeColors) {
      const mergedSettings = defaultThemeColorsHex.map(defaultSetting => {
        const dbSetting = siteSettings.themeColors.find(s => s.id === defaultSetting.id);
        const value = dbSetting?.value && /^#[0-9A-Fa-f]{6}$/.test(dbSetting.value)
                        ? dbSetting.value
                        : defaultSetting.defaultValueHex;
        return { ...defaultSetting, value };
      });
      setColorSettings(mergedSettings);
      applyThemeToDocument(mergedSettings); 
    } else if (!isLoadingSettings && !siteSettings?.themeColors) {
      const defaults = defaultThemeColorsHex.map(c => ({ ...c, value: c.defaultValueHex }));
      setColorSettings(defaults);
      applyThemeToDocument(defaults);
    }
  }, [siteSettings, isLoadingSettings, applyThemeToDocument]);


  const handleColorChange = (id: string, newValueHex: string) => {
    setColorSettings(prevSettings => {
      const newSettings = prevSettings.map(setting =>
        setting.id === id ? { ...setting, value: newValueHex.toUpperCase() } : setting
      );
      applyThemeToDocument(newSettings); 
      return newSettings;
    });
  };

  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeColors: colorSettings }),
      });
      const result = await response.json();

      if (response.ok) {
        toast({
          title: t('adminAppearancePage.toasts.updateTitle'),
          description: result.message || t('adminAppearancePage.toasts.updateDescription'),
        });
        await refreshSiteSettings(); 
      } else {
        toast({ title: t('adminAppearancePage.toasts.errorTitle', {defaultValue: "Error"}), description: result.message || "Failed to save settings.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t('adminAppearancePage.toasts.errorTitle', {defaultValue: "Error"}), description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefaults = async () => {
    setIsSubmitting(true);
    const defaultsToSave = defaultThemeColorsHex.map(setting => ({
      ...setting,
      value: setting.defaultValueHex 
    }));
    
    setColorSettings(defaultsToSave); 
    applyThemeToDocument(defaultsToSave); 

    try {
      const response = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeColors: defaultsToSave }),
      });
      const result = await response.json();

      if (response.ok) {
        toast({
          title: t('adminAppearancePage.toasts.resetTitle'),
          description: result.message || t('adminAppearancePage.toasts.resetDescription'),
        });
        await refreshSiteSettings(); 
      } else {
        toast({ title: t('adminAppearancePage.toasts.errorTitle', {defaultValue: "Error"}), description: result.message || "Failed to reset settings.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t('adminAppearancePage.toasts.errorTitle', {defaultValue: "Error"}), description: "An unexpected error occurred while resetting.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSettingLabel = (setting: ColorSetting): string => {
    const translated = t(setting.labelKey);
    return translated === setting.labelKey ? setting.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : translated;
  };

  if (isLoadingSettings && !siteSettings) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <Palette className="mr-3 h-8 w-8" /> {t('adminAppearancePage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminAppearancePage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('adminAppearancePage.cardDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
          {colorSettings.map(setting => (
            <div key={setting.id} className="space-y-2">
              <Label htmlFor={`color-text-${setting.id}`} className="text-sm font-medium">
                {getSettingLabel(setting)} ({setting.cssVar})
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="color"
                  id={`color-picker-${setting.id}`}
                  value={setting.value}
                  onChange={(e) => handleColorChange(setting.id, e.target.value)}
                  className="w-12 h-10 p-1 rounded-md border-input"
                  aria-label={`${getSettingLabel(setting)} color picker`}
                />
                <Input
                  type="text"
                  id={`color-text-${setting.id}`}
                  value={setting.value}
                  onChange={(e) => handleColorChange(setting.id, e.target.value)}
                  placeholder={t('adminAppearancePage.hexPlaceholder')}
                  className="text-sm flex-grow"
                  aria-label={`${getSettingLabel(setting)} HEX value`}
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('adminAppearancePage.hexHelpText')}</p>
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex justify-end space-x-3 border-t pt-6 mt-6">
          <Button variant="outline" onClick={handleResetToDefaults} disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RotateCcw className="mr-2 h-4 w-4" /> {t('adminAppearancePage.resetButton')}
          </Button>
          <Button onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> {t('adminAppearancePage.saveButton')}
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">{t('adminAppearancePage.livePreview.title')}</CardTitle>
          <CardDescription>{t('adminAppearancePage.livePreview.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-md" style={{ backgroundColor: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'background')?.value || '#1A1A1A')})`, color: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'foreground')?.value || '#EEEEEE')})`, border: `1px solid hsl(${hexToHslString(colorSettings.find(s => s.id === 'border')?.value || '#333333')})` }}>
            {t('adminAppearancePage.livePreview.boxText')}
            <p style={{ color: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'primary')?.value || '#D4AF37')})` }}>{t('adminAppearancePage.livePreview.primaryColorText')}</p>
          </div>
          <Button style={{ backgroundColor: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'primary')?.value || '#D4AF37')})`, color: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'primary-foreground')?.value || '#1A1A1A')})` }}>
            {t('adminAppearancePage.livePreview.primaryButton')}
          </Button>
           <Button variant="secondary" style={{ backgroundColor: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'secondary')?.value || '#262626')})`, color: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'secondary-foreground')?.value || '#EEEEEE')})` }}>
            {t('adminAppearancePage.livePreview.secondaryButton')}
          </Button>
          <div className="p-4 rounded-md" style={{ backgroundColor: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'card')?.value || '#1F1F1F')})`, color: `hsl(${hexToHslString(colorSettings.find(s => s.id === 'card-foreground')?.value || '#EEEEEE')})` }}>
            {t('adminAppearancePage.livePreview.cardText')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
