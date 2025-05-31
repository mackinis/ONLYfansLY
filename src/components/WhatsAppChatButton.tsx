
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image'; 
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/context/I18nContext';
import { cn } from '@/lib/utils';
import { MessageCircle, Paperclip, Smile, Moon, Sun, Phone, Send, ThumbsUp, Heart, Star, Bell, HelpCircle as HelpCircleLucide } from 'lucide-react';

// Default WhatsApp SVG Icon (Green official-like)
const DefaultWhatsAppIcon = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12C2 14.275 2.847 16.347 4.252 17.957L2.044 22L6.39 20.04C7.838 20.697 9.45 21 11.123 21H12C17.523 21 22 16.523 22 11C22 5.477 17.523 2 12 2ZM9.972 15.903C9.72 16.012 8.82 16.512 8.072 16.573C7.434 16.625 6.872 16.427 6.487 16.083C6.102 15.738 5.322 14.908 5.322 13.74C5.322 12.572 6.152 11.772 6.39 11.488C6.628 11.203 7.128 11.055 7.472 11.055C7.817 11.055 8.055 11.083 8.237 11.112C8.42 11.14 9.152 11.54 9.344 11.953C9.537 12.366 9.628 12.652 9.555 12.834C9.482 13.016 9.417 13.125 9.249 13.322C9.082 13.52 8.952 13.659 8.822 13.827C8.692 13.994 8.562 14.187 8.744 14.488C8.927 14.79 9.427 15.352 10.011 15.852C10.782 16.54 11.391 16.731 11.682 16.837C11.974 16.942 12.195 16.903 12.362 16.721C12.53 16.538 13.044 15.99 13.282 15.68C13.52 15.369 13.772 15.327 14.05 15.327C14.327 15.327 15.242 15.381 15.242 15.808C15.242 16.236 15.242 17.354 15.242 17.354C15.242 17.354 15.015 17.423 14.4 17.453C13.785 17.482 13.057 17.225 12.31 16.609C11.502 15.945 10.345 15.71 9.972 15.903Z"
      fill="white" 
    />
  </svg>
);

// Lucide Icon Components Map
const LucideIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  Paperclip,
  Smile,
  Moon,
  Sun,
  Phone,
  Send,
  HelpCircle: HelpCircleLucide,
  MessageCircle,
  ThumbsUp,
  Heart,
  Star,
  Bell,
};

export default function WhatsAppChatButton() {
  const { siteSettings, isLoadingSettings } = useTranslation();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isLoadingSettings || !siteSettings || !siteSettings.whatsAppEnabled || !siteSettings.whatsAppPhoneNumber) {
    return null;
  }

  if (pathname.startsWith('/admin')) {
    return null;
  }

  const {
    whatsAppPhoneNumber,
    whatsAppDefaultMessage = '',
    whatsAppIcon = 'default', // 'default', 'customUrl', or lucide-react icon name
    whatsAppCustomIconUrl,
    whatsAppButtonSize = 56,
    whatsAppIconSize = 28,
  } = siteSettings;

  const whatsAppUrl = `https://wa.me/${whatsAppPhoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(whatsAppDefaultMessage)}`;

  const buttonStyle: React.CSSProperties = {
    width: `${whatsAppButtonSize}px`,
    height: `${whatsAppButtonSize}px`,
    borderRadius: '50%',
    backgroundColor: 'hsl(var(--primary))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    color: 'hsl(var(--primary-foreground))',
  };

  const iconContainerStyle: React.CSSProperties = {
    width: `${whatsAppIconSize}px`,
    height: `${whatsAppIconSize}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  let IconComponent;
  if (whatsAppIcon === 'customUrl' && whatsAppCustomIconUrl) {
    IconComponent = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={whatsAppCustomIconUrl}
        alt="WhatsApp"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    );
  } else if (whatsAppIcon !== 'default' && whatsAppIcon !== 'customUrl' && LucideIcons[whatsAppIcon]) {
    const LucideIcon = LucideIcons[whatsAppIcon];
    IconComponent = <LucideIcon style={{ width: `${whatsAppIconSize}px`, height: `${whatsAppIconSize}px` }} />;
  } else {
    IconComponent = <DefaultWhatsAppIcon size={whatsAppIconSize} />;
  }


  return (
    <a
      href={whatsAppUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 transition-transform hover:scale-110"
      style={buttonStyle}
      aria-label="Chat on WhatsApp"
    >
      <div style={iconContainerStyle}>
        {IconComponent}
      </div>
    </a>
  );
}
