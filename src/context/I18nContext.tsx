
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import enTranslations from '@/locales/en.json';
import esTranslations from '@/locales/es.json';
import { getSiteSettings, updateSiteSettings as updateGlobalSiteSettings } from '@/lib/actions'; // Renamed import
import type { SiteSettings } from '@/lib/types';

type Translations = Record<string, any>;

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  siteSettings: SiteSettings | null;
  isLoadingSettings: boolean;
  currentSiteTitle: string; 
  currentSiteIconUrl?: string; 
  refreshSiteSettings: () => Promise<void>;
  // Removed saveAdminLanguageSettings as updateSiteSettings in actions.ts handles all partial updates now
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

  const fetchAllSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const settings = await getSiteSettings();
      setSiteSettings(settings);

      let initialLang = settings.defaultLanguage;
      if (settings.allowUserToChooseLanguage) {
        if (typeof navigator !== 'undefined') {
          const browserLang = navigator.language.split('-')[0];
          if (translationsMap[browserLang]) {
            initialLang = browserLang;
          }
        }
      }
      
      setLanguageState(initialLang);
      setCurrentTranslations(translationsMap[initialLang] || translationsMap.es);

    } catch (error) {
      console.error("Failed to fetch site settings:", error);
      const defaultSettingsFallback: SiteSettings = {
        siteTitle: 'Aurum Media (Error)',
        siteIconUrl: '',
        maintenanceMode: false,
        defaultLanguage: 'es',
        allowUserToChooseLanguage: true,
        allowUserToChooseCurrency: true,
        activeCurrencies: [{ id: "ars", code: "ARS", name: "Argentine Peso", symbol: "$", isPrimary: true }],
        exchangeRates: { usdToArs: 1000, eurToArs: 1100 },
        updatedAt: new Date().toISOString(),
      };
      setSiteSettings(defaultSettingsFallback);
      setLanguageState('es');
      setCurrentTranslations(translationsMap.es);
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
      // Note: Persisting user-chosen language to Firestore user profile would go here
      // if the user is logged in.
    }
  };
  
  const refreshSiteSettings = useCallback(async () => {
    // Re-fetch settings from Firestore. This function can be called by admin pages after updates.
    await fetchAllSettings();
  }, [fetchAllSettings]);

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    if (!isInitialized && !siteSettings) return key; // Or a loading string

    let translation = getNestedValue(currentTranslations, key);
    if (translation === undefined) {
      console.warn(`Translation not found for key: "${key}" in language: "${language}". Falling back to 'es'.`);
      translation = getNestedValue(translationsMap.es, key); 
      if (translation === undefined) {
         console.error(`Fallback translation not found for key: "${key}" in Spanish.`);
         return key; 
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

  return (
    <I18nContext.Provider value={{ 
        language, 
        setLanguage, 
        t, 
        siteSettings,
        isLoadingSettings,
        currentSiteTitle: siteSettings?.siteTitle || 'Aurum Media',
        currentSiteIconUrl: siteSettings?.siteIconUrl,
        refreshSiteSettings,
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
