
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Save, RotateCcw } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';

interface ColorSetting {
  id: string;
  label: string;
  cssVar: string; 
  value: string; 
  type: 'color' | 'text'; 
}

const defaultThemeColors: ColorSetting[] = [
  { id: 'primary', label: 'Primary Color', cssVar: '--primary', value: '45 69% 52%', type: 'text' }, 
  { id: 'primary-foreground', label: 'Primary Text', cssVar: '--primary-foreground', value: '0 0% 10%', type: 'text' }, 
  { id: 'background', label: 'Background Color', cssVar: '--background', value: '0 0% 10%', type: 'text' }, 
  { id: 'foreground', label: 'Main Text Color', cssVar: '--foreground', value: '0 0% 93%', type: 'text' }, 
  { id: 'card', label: 'Card Background', cssVar: '--card', value: '0 0% 12%', type: 'text' },
  { id: 'accent', label: 'Accent Color (UI Elements)', cssVar: '--accent', value: '0 0% 20%', type: 'text' },
  { id: 'button-default-bg', label: 'Default Button BG (Primary)', cssVar: '--primary', value: '45 69% 52%', type: 'text' },
  { id: 'button-default-text', label: 'Default Button Text (Primary FG)', cssVar: '--primary-foreground', value: '0 0% 10%', type: 'text' },
];

const hslToHex = (hsl: string): string => {
  if (hsl.includes('%')) { 
    const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (parts) {
      let [h, s, l] = [parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3])];
      s /= 100;
      l /= 100;
      const k = (n:number) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n:number) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return `#${[0, 8, 4].map(n => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return hsl.startsWith('#') ? hsl : '#000000'; 
};

const hexToHslString = (hex: string): string => {
  return hex; 
};


export default function AppearanceAdminPage() {
  const { t } = useTranslation();
  const [colorSettings, setColorSettings] = useState<ColorSetting[]>(defaultThemeColors);
  const { toast } = useToast();

  useEffect(() => {
    const savedColors = localStorage.getItem('aurum_theme_colors');
    if (savedColors) {
      setColorSettings(JSON.parse(savedColors));
    }
  }, []);

  const handleColorChange = (id: string, newValue: string) => {
    setColorSettings(prevSettings =>
      prevSettings.map(setting =>
        setting.id === id ? { ...setting, value: setting.type === 'color' ? newValue : newValue } : setting
      )
    );
  };

  const handleSaveChanges = () => {
    localStorage.setItem('aurum_theme_colors', JSON.stringify(colorSettings));
    colorSettings.forEach(color => {
      let valueToSet = color.value;
      document.documentElement.style.setProperty(color.cssVar, valueToSet);
    });
    toast({
      title: t('adminAppearancePage.toasts.updateTitle'),
      description: t('adminAppearancePage.toasts.updateDescription'),
    });
  };
  
  const handleResetToDefaults = () => {
    setColorSettings(defaultThemeColors);
    localStorage.removeItem('aurum_theme_colors');
     defaultThemeColors.forEach(color => {
      document.documentElement.style.setProperty(color.cssVar, color.value);
    });
    toast({
      title: t('adminAppearancePage.toasts.resetTitle'),
      description: t('adminAppearancePage.toasts.resetDescription'),
    });
  };

  // Helper to get a translated label or fallback to original label
  const getSettingLabel = (setting: ColorSetting): string => {
    const translationKey = `adminAppearancePage.colorLabels.${setting.id.replace(/-/g, '_')}`; // e.g. primary_foreground
    const translated = t(translationKey);
    return translated === translationKey ? setting.label : translated; // Fallback to original if no translation
  };


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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {colorSettings.map(setting => (
            <div key={setting.id} className="space-y-2">
              <Label htmlFor={`color-${setting.id}`} className="text-base font-medium">{getSettingLabel(setting)} ({setting.cssVar})</Label>
              <div className="flex items-center space-x-2">
                {setting.type === 'color' && (
                  <Input
                    type="color"
                    id={`color-picker-${setting.id}`}
                    value={hslToHex(setting.value)} 
                    onChange={(e) => handleColorChange(setting.id, hexToHslString(e.target.value))} 
                    className="w-16 h-10 p-1"
                    aria-label={`${getSettingLabel(setting)} color picker`}
                  />
                )}
                <Input
                  type="text" 
                  id={`color-${setting.id}`}
                  value={setting.value}
                  onChange={(e) => handleColorChange(setting.id, e.target.value)}
                  placeholder={setting.type === 'color' ? '#RRGGBB or HSL' : t('adminAppearancePage.hslPlaceholder')}
                  className="text-base"
                  aria-label={`${getSettingLabel(setting)} value`}
                />
              </div>
               {setting.type === 'text' && <p className="text-xs text-muted-foreground">{t('adminAppearancePage.hslHelpText')}</p>}
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex justify-end space-x-3">
          <Button variant="outline" onClick={handleResetToDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" /> {t('adminAppearancePage.resetButton')}
          </Button>
          <Button onClick={handleSaveChanges}>
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
          <div className="p-4 rounded-md" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}>
            {t('adminAppearancePage.livePreview.boxText')}
            <p style={{ color: 'hsl(var(--primary))' }}>{t('adminAppearancePage.livePreview.primaryColorText')}</p>
          </div>
          <Button style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            {t('adminAppearancePage.livePreview.primaryButton')}
          </Button>
           <Button variant="secondary" style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}>
            {t('adminAppearancePage.livePreview.secondaryButton')}
          </Button>
          <div className="p-4 rounded-md" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}>
            {t('adminAppearancePage.livePreview.cardText')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
