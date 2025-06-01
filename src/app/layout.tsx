
'use client';

import { Toaster } from "@/components/ui/toaster";
import { I18nProvider, useTranslation } from '@/context/I18nContext';
import './globals.css';
import { useEffect, useState, useCallback } from 'react';
import WhatsAppChatButton from '@/components/WhatsAppChatButton';
import { usePathname, useRouter } from 'next/navigation';
import { type ColorSetting, defaultThemeColorsHex } from '@/lib/config';
import { hexToHslString } from '@/lib/utils';

function applyThemeToDocumentFromSettings(themeColors?: ColorSetting[]) {
  const colorsToApply = (themeColors && themeColors.length > 0)
    ? themeColors
    : defaultThemeColorsHex.map(c => ({ ...c, value: c.defaultValueHex }));

  colorsToApply.forEach(color => {
    // Ensure 'value' is a valid HEX before conversion, otherwise use defaultValueHex
    const hexValue = /^#[0-9A-Fa-f]{6}$/.test(color.value) ? color.value : color.defaultValueHex;
    const hslValue = hexToHslString(hexValue);
    document.documentElement.style.setProperty(color.cssVar, hslValue);
  });
}

function DynamicMetadataAndMaintenance() {
  const { currentSiteTitle, currentSiteIconUrl, siteSettings, isLoadingSettings } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    if (!isLoadingSettings && siteSettings?.themeColors) {
      applyThemeToDocumentFromSettings(siteSettings.themeColors);
    } else if (!isLoadingSettings && !siteSettings?.themeColors) {
      // This case should ideally be handled by getSiteSettings initializing themeColors
      applyThemeToDocumentFromSettings(defaultThemeColorsHex.map(c => ({...c, value: c.defaultValueHex })));
    }
  }, [siteSettings, isLoadingSettings]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkAdminStatus = () => {
        const adminLoggedIn = sessionStorage.getItem('aurum_is_admin_logged_in') === 'true';
        setIsAdminLoggedIn(adminLoggedIn);
      };
      checkAdminStatus();

      window.addEventListener('aurumLoginStatusChanged', checkAdminStatus);
      window.addEventListener('storage', (event) => {
        if (event.key === 'aurum_is_admin_logged_in') {
          checkAdminStatus();
        }
      });

      return () => {
        window.removeEventListener('aurumLoginStatusChanged', checkAdminStatus);
        window.removeEventListener('storage', (event) => {
          if (event.key === 'aurum_is_admin_logged_in') {
            checkAdminStatus();
          }
        });
      };
    }
  }, []);

  useEffect(() => {
    document.title = currentSiteTitle || 'Aurum Media';

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (currentSiteIconUrl) {
      link.href = currentSiteIconUrl;
    } else {
      link.href = '/favicon.ico';
    }
  }, [currentSiteTitle, currentSiteIconUrl]);

  useEffect(() => {
    if (!isLoadingSettings && siteSettings?.maintenanceMode) {
      const allowedPaths = ['/maintenance', '/login'];
      const isAdminArea = pathname.startsWith('/admin');

      const isPathCurrentlyAllowed = allowedPaths.includes(pathname) || isAdminArea;

      if (!isPathCurrentlyAllowed && !isAdminLoggedIn) {
        router.replace('/maintenance');
      }
    }
  }, [siteSettings, isLoadingSettings, pathname, router, isAdminLoggedIn]);

  return null;
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="description" content="Luxury Video Streaming and Content Platform" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <I18nProvider>
          <DynamicMetadataAndMaintenance />
          {children}
          <Toaster />
          <WhatsAppChatButton />
        </I18nProvider>
      </body>
    </html>
  );
}
