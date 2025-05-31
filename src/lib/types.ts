
export interface Video {
  id: string;
  title: string;
  description: string;
  previewImageUrl?: string;
  videoUrl: string;
  priceArs: number; // Price is always stored in ARS
  duration?: string;
  order: number; // For manual ordering by admin
  views: number; // For automatic view count
  createdAt: string;
  updatedAt: string;
}

export interface TestimonialMediaLink {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string; // Optional, e.g., for YouTube videos
}

export interface Testimonial {
  id: string;
  text: string;
  author: string;
  userId: string;
  date: string;
  status: 'pending' | 'approved' | 'denied';
  email?: string;
  photoUrls?: string[];
  videoUrls?: string[];
}

export interface CuratedTestimonial extends Testimonial {
  reason?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone?: string;
  dni?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  country?: string;
  passwordHash?: string; // Consider security implications if stored directly
  isActive: boolean;
  role: 'user' | 'admin';
  isVerified: boolean;
  activationToken?: string | null;
  activationTokenExpires?: Date | null;
  canSubmitTestimonial?: boolean;
  avatarUrl?: string; // Field for avatar URL
  testimonialCount?: number; // Added to store the count of testimonials by this user
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CurrencyDefinition {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

export interface ActiveCurrencySetting extends CurrencyDefinition {
  isPrimary: boolean;
}

export interface ExchangeRates {
  usdToArs: number;
  eurToArs: number;
}

export interface SocialLink {
  id: string;
  name: string;
  url: string;
  iconName?: string;
}

export interface SiteSettings {
  siteTitle: string;
  siteIconUrl?: string;
  maintenanceMode: boolean;
  defaultLanguage: 'en' | 'es';
  allowUserToChooseLanguage: boolean;
  allowUserToChooseCurrency: boolean;
  activeCurrencies: ActiveCurrencySetting[];
  exchangeRates: ExchangeRates;
  heroTitle: string;
  heroSubtitle: string;
  liveStreamDefaultTitle: string;
  liveStreamOfflineMessage: string;
  socialLinks: SocialLink[];
  updatedAt?: string;

  // WhatsApp Settings
  whatsAppEnabled: boolean;
  whatsAppPhoneNumber: string;
  whatsAppDefaultMessage?: string;
  whatsAppIcon: string; // 'default', 'customUrl', or lucide-react icon name (e.g., 'Paperclip')
  whatsAppCustomIconUrl?: string;
  whatsAppButtonSize: number; // size of the circular button, e.g., 56
  whatsAppIconSize: number;   // size of the icon itself inside the button, e.g., 28

  // AI Testimonial Curation Settings
  aiCurationEnabled: boolean;
  aiCurationMinTestimonials: number;
}

export interface ThemeColorSetting {
  id: string;
  label: string;
  cssVar: string;
  value: string;
  type: 'text';
}

export interface SessionUserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: 'user' | 'admin';
  avatarUrl?: string; // Add avatarUrl here too
}

export type AnnouncementContentType = 'image-only' | 'text-image' | 'text-video' | 'video-only';

export interface Announcement {
  id: string;
  title: string;
  contentType: AnnouncementContentType;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  expiryDate: string; // ISO string for Firestore, Date object on client
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

