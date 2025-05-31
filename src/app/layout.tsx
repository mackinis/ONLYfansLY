
'use client'; // Required because we're using a hook (useTranslation) for dynamic title/icon

// import type { Metadata } from 'next'; // Metadata type is not used for static export here
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider, useTranslation } from '@/context/I18nContext';
import './globals.css';
import { useEffect } from 'react';
import WhatsAppChatButton from '@/components/WhatsAppChatButton'; // Import the WhatsApp button

// Component to dynamically set title and icon
function DynamicMetadata() {
  const { currentSiteTitle, currentSiteIconUrl } = useTranslation();

  useEffect(() => {
    document.title = currentSiteTitle || 'Aurum Media'; // Fallback title

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (currentSiteIconUrl) {
      link.href = currentSiteIconUrl;
    } else {
      // Fallback icon, ensure you have a favicon.ico in /public
      link.href = '/favicon.ico';
    }
  }, [currentSiteTitle, currentSiteIconUrl]);

  return null; // This component doesn't render anything itself
}

// Static metadata export is removed as this is a client component.
// SEO metadata like description can be added directly in the <head> below if static,
// or managed by DynamicMetadata if it needs to be dynamic.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* 
          The <title> and <link rel="icon"> tags are managed by the DynamicMetadata component.
          You can add other static meta tags here if needed, e.g.:
          <meta name="description" content="Luxury Video Streaming and Content Platform" />
        */}
        <meta name="description" content="Luxury Video Streaming and Content Platform" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <I18nProvider>
          <DynamicMetadata /> {/* Component to handle dynamic title and icon */}
          {children}
          <Toaster />
          <WhatsAppChatButton /> {/* Add the WhatsApp button here */}
        </I18nProvider>
      </body>
    </html>
  );
}
