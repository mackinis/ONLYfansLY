
export interface Video {
  id: string;
  title: string;
  description: string;
  previewImageUrl?: string;
  videoUrl: string;
  priceArs: number; // Price is always stored in ARS
  discountInput?: string; // Stores "10%" or "79990"
  finalPriceArs?: number; // Calculated price after discount
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
  date: string; // Submission date (used as createdAt)
  status: 'pending' | 'approved' | 'denied';
  email?: string;
  photoUrls?: string[];
  videoUrls?: string[];
  updatedAt?: string; // To track last modification
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

export type HeaderDisplayMode = 'logo' | 'title' | 'both';
export type FooterDisplayMode = 'logo' | 'title' | 'both';

export interface ColorSetting {
  id: string;
  labelKey: string;
  cssVar: string;
  defaultValueHex: string;
  value: string; 
}

export type TestimonialMediaOption = 'none' | 'photos' | 'videos' | 'both';
export type HeroTaglineSize = 'sm' | 'md' | 'lg';

export interface SiteSettings {
  siteTitle: string;
  siteIconUrl?: string; // General site icon / Favicon
  headerIconUrl?: string; // Specific icon for the header
  maintenanceMode: boolean;
  defaultLanguage: 'en' | 'es';
  allowUserToChooseLanguage: boolean;
  allowUserToChooseCurrency: boolean;
  activeCurrencies: ActiveCurrencySetting[];
  exchangeRates: ExchangeRates;
  themeColors: ColorSetting[];
  heroTitle: string;
  heroSubtitle: string;
  heroTagline?: string;
  heroTaglineColor?: string;
  heroTaglineSize?: HeroTaglineSize;
  liveStreamDefaultTitle: string;
  liveStreamOfflineMessage: string;
  liveStreamAuthorizedUserId?: string | null;
  liveStreamForLoggedInUsersOnly?: boolean; // New field
  socialLinks: SocialLink[];
  testimonialMediaOptions: TestimonialMediaOption;
  testimonialEditGracePeriodMinutes: number; 
  updatedAt?: string;
  whatsAppEnabled: boolean;
  whatsAppPhoneNumber: string;
  whatsAppDefaultMessage?: string;
  whatsAppIcon: string; 
  whatsAppCustomIconUrl?: string;
  whatsAppButtonSize: number; 
  whatsAppIconSize: number;   
  aiCurationEnabled: boolean;
  aiCurationMinTestimonials: number;
  headerDisplayMode: HeaderDisplayMode;
  footerDisplayMode: FooterDisplayMode;
  footerLogoSize?: number;
  // Mobile Apps Section
  mobileAppsSectionTitle?: string;
  showMobileAppsSection?: boolean;
  showAndroidApp?: boolean;
  androidAppLink?: string;
  androidAppIconUrl?: string; 
  showIosApp?: boolean;
  iosAppLink?: string;
  iosAppIconUrl?: string; 
  persistentSubtitle?: string;
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
  avatarUrl?: string; 
}

export type AnnouncementContentType = 'image-only' | 'text-image' | 'text-video' | 'video-only';

export interface Announcement {
  id: string;
  title: string;
  contentType: AnnouncementContentType;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  expiryDate: string; 
  isActive: boolean;
  showOnce?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalCourses: number;
  pendingTestimonials: number;
  activeUsers: number;
  totalUsers: number;
}

// Input type for updating a user's own testimonial
export interface UpdateUserOwnTestimonialData {
  text: string;
  photoUrlsInput?: string;
  videoUrlsInput?: string;
}

    