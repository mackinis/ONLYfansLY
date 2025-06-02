
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import enTranslations from '@/locales/en.json';
import esTranslations from '@/locales/es.json';
// Removed: import { getSiteSettings } from '@/lib/actions';
import type { SiteSettings, ActiveCurrencySetting, ColorSetting } from '@/lib/types';
import { defaultThemeColorsHex } from '@/lib/config';

type Translations = Record<string, any>;

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  siteSettings: SiteSettings | null;
  isLoadingSettings: boolean;
  currentSiteTitle: string;
  currentSiteIconUrl?: string;
  currentHeaderIconUrl?: string;
  refreshSiteSettings: () => Promise<void>;
  displayCurrency: ActiveCurrencySetting | null;
  setDisplayCurrency: (currency: ActiveCurrencySetting) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translationsMap: Record<string, Translations> = {
  en: enTranslations,
  es: esTranslations,
};

const getNestedValue = (obj: Translations, key: string): string | undefined => {
  return key.split('.').reduce((o, i) => (o && typeof o === 'object' && o[i] !== undefined ? o[i] : undefined), obj);
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<string>('es');
  const [currentTranslations, setCurrentTranslations] = useState<Translations>(translationsMap.es);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [displayCurrency, setDisplayCurrencyState] = useState<ActiveCurrencySetting | null>(null);

  const fetchAllSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/site-settings');
      if (!response.ok) {
        let errorBodyMessage = "Could not read error body.";
        try {
          // Attempt to parse as JSON first, as our API routes should return JSON errors
          const jsonError = await response.json();
          errorBodyMessage = jsonError.message || JSON.stringify(jsonError);
        } catch (e) {
          // If JSON parsing fails, try to read as text
          try {
            errorBodyMessage = await response.text();
          } catch (textError) {
            // If text reading also fails, keep the default message
          }
        }
        // Truncate long error bodies
        if (errorBodyMessage.length > 200) {
            errorBodyMessage = errorBodyMessage.substring(0, 200) + "...";
        }
        throw new Error(`Failed to fetch site settings. Status: ${response.status}, StatusText: ${response.statusText || 'N/A'}, Body: ${errorBodyMessage}`);
      }
      const settings: SiteSettings = await response.json();
      setSiteSettings(settings);

      let initialLang = settings.defaultLanguage;
      if (settings.allowUserToChooseLanguage) {
        if (typeof window !== 'undefined') {
          const storedLang = localStorage.getItem('aurum_user_language');
          if (storedLang && translationsMap[storedLang]) {
            initialLang = storedLang;
          } else {
            const browserLang = navigator.language.split('-')[0];
            if (translationsMap[browserLang]) {
              initialLang = browserLang;
            }
          }
        }
      }
      setLanguageState(initialLang);
      setCurrentTranslations(translationsMap[initialLang] || translationsMap.es);

      let initialCurrency: ActiveCurrencySetting | null = null;
      if (settings.activeCurrencies && settings.activeCurrencies.length > 0) {
        if (settings.allowUserToChooseCurrency && typeof window !== 'undefined') {
          const storedCurrencyId = localStorage.getItem('aurum_user_currency');
          const foundStoredCurrency = settings.activeCurrencies.find(c => c.id === storedCurrencyId);
          if (foundStoredCurrency) {
            initialCurrency = foundStoredCurrency;
          }
        }
        if (!initialCurrency) {
          initialCurrency = settings.activeCurrencies.find(c => c.isPrimary) || settings.activeCurrencies[0];
        }
      }
      setDisplayCurrencyState(initialCurrency);

    } catch (error) {
      console.error("Failed to fetch site settings via API:", error);
      const defaultSettingsFallback: SiteSettings = {
        siteTitle: 'Aurum Media (Error)',
        siteIconUrl: '',
        headerIconUrl: '',
        maintenanceMode: false,
        defaultLanguage: 'es',
        allowUserToChooseLanguage: true,
        allowUserToChooseCurrency: true,
        activeCurrencies: [{ id: "ars", code: "ARS", name: "Argentine Peso", symbol: "AR$", isPrimary: true }],
        exchangeRates: { usdToArs: 1000, eurToArs: 1100 },
        themeColors: defaultThemeColorsHex.map(c => ({...c, value: c.defaultValueHex})),
        updatedAt: new Date().toISOString(),
        heroTitle: 'Aurum Media',
        heroSubtitle: 'Premium video content.',
        liveStreamDefaultTitle: 'Live Event',
        liveStreamOfflineMessage: 'Stream is offline.',
        socialLinks: [],
        whatsAppEnabled: false,
        whatsAppPhoneNumber: '',
        whatsAppButtonSize: 56,
        whatsAppIconSize: 28,
        whatsAppIcon: 'default',
        aiCurationEnabled: true,
        aiCurationMinTestimonials: 5,
        headerDisplayMode: 'both',
        footerDisplayMode: 'logo',
        footerLogoSize: 64,
        heroTagline: '',
        heroTaglineColor: '#FFFFFF',
        heroTaglineSize: 'md',
        testimonialMediaOptions: 'both',
        testimonialEditGracePeriodMinutes: 60,
        mobileAppsSectionTitle: "Nuestras Apps",
        showMobileAppsSection: false,
        showAndroidApp: false,
        androidAppLink: "",
        showIosApp: false,
        iosAppLink: "",
      };
      setSiteSettings(defaultSettingsFallback);
      setLanguageState('es');
      setCurrentTranslations(translationsMap.es);
      setDisplayCurrencyState(defaultSettingsFallback.activeCurrencies.find(c => c.isPrimary) || null);
    } finally {
      setIsLoadingSettings(false);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    fetchAllSettings();
  }, [fetchAllSettings]);

  const setLanguage = (lang: string) => {
    if (translationsMap[lang] && siteSettings?.allowUserToChooseLanguage) {
      setLanguageState(lang);
      setCurrentTranslations(translationsMap[lang]);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aurum_user_language', lang);
      }
    }
  };

  const setDisplayCurrency = (currency: ActiveCurrencySetting) => {
    if (siteSettings?.allowUserToChooseCurrency && siteSettings.activeCurrencies.some(ac => ac.id === currency.id)) {
      setDisplayCurrencyState(currency);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aurum_user_currency', currency.id);
      }
    }
  };

  const refreshSiteSettings = useCallback(async () => {
    await fetchAllSettings();
  }, [fetchAllSettings]);

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    if (!isInitialized && !siteSettings) return key;

    let translation = getNestedValue(currentTranslations, key);
    if (translation === undefined) {
      console.warn(`Translation not found for key: "${key}" in language: "${language}". Falling back to 'es'.`);
      translation = getNestedValue(translationsMap.es, key);
      if (translation === undefined) {
         console.error(`Fallback translation not found for key: "${key}" in Spanish.`);
         return `{${key}}`;
      }
    }
    if (replacements && typeof translation === 'string') {
      Object.keys(replacements).forEach((placeholder) => {
        translation = (translation as string).replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return String(translation);
  };

  if (!isInitialized) {
    return null;
  }

  const currentHeaderIconUrl = siteSettings?.headerIconUrl || siteSettings?.siteIconUrl;

  return (
    <I18nContext.Provider value={{
        language,
        setLanguage,
        t,
        siteSettings,
        isLoadingSettings,
        currentSiteTitle: siteSettings?.siteTitle || 'Aurum Media',
        currentSiteIconUrl: siteSettings?.siteIconUrl,
        currentHeaderIconUrl: currentHeaderIconUrl,
        refreshSiteSettings,
        displayCurrency,
        setDisplayCurrency,
    }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};

