'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Film, UserCircle, Zap, Languages as LanguagesIcon, Check, Settings, Menu, LogOut, LayoutDashboard, Coins } from 'lucide-react';
import { useTranslation } from '@/context/I18nContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { cn } from '@/lib/utils';
import type { SessionUserProfile } from '@/lib/types';
import { Separator } from '../ui/separator';
import { defaultThemeColorsHex } from '@/lib/config';

export default function Header() {
  const {
    t,
    language,
    setLanguage,
    siteSettings,
    currentSiteTitle,
    displayCurrency,
    setDisplayCurrency,
  } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<SessionUserProfile | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isStreamActuallyLive, setIsStreamActuallyLive] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [userAvatarPrimaryColor, setUserAvatarPrimaryColor] = useState('D4AF37');
  const [userAvatarPrimaryFgColor, setUserAvatarPrimaryFgColor] = useState('1A1A1A');

  const headerDisplayMode = siteSettings?.headerDisplayMode || 'both';
  const allowUserToChooseLanguage = siteSettings?.allowUserToChooseLanguage ?? false;
  const allowUserToChooseCurrency = siteSettings?.allowUserToChooseCurrency ?? false;
  const activeCurrencies = siteSettings?.activeCurrencies || [];

  const effectiveHeaderIconUrl = siteSettings?.headerIconUrl || siteSettings?.siteIconUrl;

  useEffect(() => {
    if (siteSettings?.themeColors) {
      const primarySetting = siteSettings.themeColors.find(s => s.id === 'primary');
      const primaryFgSetting = siteSettings.themeColors.find(s => s.id === 'primary-foreground');

      if (primarySetting?.value) {
        setUserAvatarPrimaryColor(primarySetting.value.replace('#', ''));
      } else {
        const defaultPrimary = defaultThemeColorsHex.find(s => s.id === 'primary')?.defaultValueHex || 'D4AF37';
        setUserAvatarPrimaryColor(defaultPrimary.replace('#', ''));
      }

      if (primaryFgSetting?.value) {
        setUserAvatarPrimaryFgColor(primaryFgSetting.value.replace('#', ''));
      } else {
        const defaultPrimaryFg = defaultThemeColorsHex.find(s => s.id === 'primary-foreground')?.defaultValueHex || '1A1A1A';
        setUserAvatarPrimaryFgColor(defaultPrimaryFg.replace('#', ''));
      }
    }
  }, [siteSettings]);

  const updateLoginState = () => {
    if (typeof window !== 'undefined') {
      const adminLoggedIn = sessionStorage.getItem('aurum_is_admin_logged_in') === 'true';
      const userId = sessionStorage.getItem('aurum_user_id');
      const userProfileString = sessionStorage.getItem('aurum_user_profile');

      setIsAdminLoggedIn(adminLoggedIn);
      setIsUserLoggedIn(!!userId && !adminLoggedIn);

      if (userProfileString) {
        try {
          setCurrentUserProfile(JSON.parse(userProfileString));
        } catch (e) {
          console.error("Failed to parse user profile from session storage", e);
          setCurrentUserProfile(null);
        }
      } else {
        setCurrentUserProfile(null);
      }
    }
  };

  useEffect(() => {
    setIsClient(true);
    updateLoginState();

    const handleLoginStatusChange = () => updateLoginState();
    window.addEventListener('aurumLoginStatusChanged', handleLoginStatusChange);
    window.addEventListener('storage', (event) => {
      if (event.key === 'aurum_is_admin_logged_in' || event.key === 'aurum_user_id' || event.key === 'aurum_user_profile') {
        handleLoginStatusChange();
      }
    });

    const newSocket = io({ path: '/api/socket_io', autoConnect: true });
    setSocket(newSocket);
    newSocket.on('connect', () => newSocket.emit('register-viewer'));
    newSocket.on('broadcaster-ready', () => setIsStreamActuallyLive(true));
    newSocket.on('broadcaster-disconnected', () => setIsStreamActuallyLive(false));
    newSocket.on('disconnect', () => setIsStreamActuallyLive(false));

    return () => {
      window.removeEventListener('aurumLoginStatusChanged', handleLoginStatusChange);
      window.removeEventListener('storage', handleLoginStatusChange);
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('aurum_is_admin_logged_in');
      sessionStorage.removeItem('aurum_user_id');
      sessionStorage.removeItem('aurum_user_profile');
    }
    updateLoginState();
    window.dispatchEvent(new Event('aurumLoginStatusChanged'));
    router.push('/login');
    setIsMobileMenuOpen(false);
  };

  const isAdminPage = pathname.startsWith('/admin');

  const navLinks = [
    { href: "/", labelKey: "header.home" },
    { href: "/#courses", labelKey: "header.videos" },
    { href: "/#live", labelKey: "header.live", icon: Zap, live: true },
    { href: "/#testimonials", labelKey: "header.testimonials" },
  ];

  const getAvatarFallback = () => {
    if (currentUserProfile) {
      const nameInitial = currentUserProfile.name ? currentUserProfile.name[0] : '';
      const surnameInitial = currentUserProfile.surname ? currentUserProfile.surname[0] : '';
      return `${nameInitial}${surnameInitial}`.toUpperCase() || 'U';
    }
    return 'U';
  };

  const userAvatarPlaceholderUrl = `https://placehold.co/40x40/${userAvatarPrimaryColor}/${userAvatarPrimaryFgColor}?text=${getAvatarFallback()}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-screen-2xl px-4 h-16 grid grid-cols-3 items-center">
        {/* LOGO (izquierda) */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            {(headerDisplayMode === 'logo' || headerDisplayMode === 'both') && (
              effectiveHeaderIconUrl ? (
                <Image src={effectiveHeaderIconUrl} alt={currentSiteTitle || t('header.title')} width={32} height={32} className="h-8 w-8 rounded-sm" data-ai-hint="logo" />
              ) : (
                <Film className="h-8 w-8 text-primary" />
              )
            )}
            {(headerDisplayMode === 'title' || headerDisplayMode === 'both') && (
              <span className={cn(
                "font-headline text-2xl font-bold text-primary",
                headerDisplayMode === 'logo' && "sr-only md:not-sr-only"
              )}>
                {currentSiteTitle || t('header.title')}
              </span>
            )}
          </Link>
        </div>

        {/* NAV (CENTRADO SIEMPRE) */}
        {!isAdminPage && (
          <nav className="hidden md:flex justify-center items-center text-sm font-medium space-x-6">
            {navLinks.map(link => (
              <Link
                key={link.labelKey}
                href={link.href}
                className={cn("transition-colors flex items-center hover:text-primary")}
              >
                {link.live && <Zap className={cn("h-4 w-4 mr-1 text-red-500", isStreamActuallyLive ? "animate-pulse" : "opacity-50")} />}
                {t(link.labelKey)}
              </Link>
            ))}
          </nav>
        )}

        {/* BOTONES DERECHA */}
        <div className="flex items-center justify-end space-x-1 sm:space-x-2">
          {allowUserToChooseCurrency && !isAdminPage && activeCurrencies.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2 sm:px-3" aria-label={t('header.currencySelectorTooltip', {defaultValue: 'Select Currency'})}>
                  <Coins className="h-5 w-5 sm:mr-1" />
                  <span className="hidden sm:inline">{displayCurrency?.code}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('header.currencySelectorTooltip', {defaultValue: 'Select Currency'})}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activeCurrencies.map(currency => (
                  <DropdownMenuItem key={currency.id} onClick={() => setDisplayCurrency(currency)} disabled={displayCurrency?.id === currency.id}>
                    {displayCurrency?.id === currency.id && <Check className="mr-2 h-4 w-4" />}
                    {currency.name} ({currency.symbol})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {allowUserToChooseLanguage && !isAdminPage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('header.languageSelectorTooltip')}>
                  <LanguagesIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('header.languageSelectorTooltip')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLanguage('en')} disabled={language === 'en'}>
                  {language === 'en' && <Check className="mr-2 h-4 w-4" />}
                  {t('header.english')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('es')} disabled={language === 'es'}>
                  {language === 'es' && <Check className="mr-2 h-4 w-4" />}
                  {t('header.spanish')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isClient && !isAdminLoggedIn && !isUserLoggedIn && !isAdminPage && (
            <>
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/login">
                  <UserCircle className="mr-2 h-4 w-4" /> {t('header.login')}
                </Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/register">{t('header.register')}</Link>
              </Button>
            </>
          )}

          {isClient && isAdminLoggedIn && !isAdminPage && (
             <Button variant="ghost" size="sm" asChild className="hidden lg:inline-flex">
              <Link href="/admin"><LayoutDashboard className="mr-2 h-4 w-4" />{t('header.adminPanel')}</Link>
             </Button>
           )}

          {isClient && isUserLoggedIn && !isAdminPage && currentUserProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUserProfile.avatarUrl || userAvatarPlaceholderUrl} alt={currentUserProfile.name || 'User'} data-ai-hint="user avatar"/>
                    <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUserProfile.name} {currentUserProfile.surname}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentUserProfile.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserCircle className="mr-2 h-4 w-4" />
                    {t('header.myAccount')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('header.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* MOBILE MENU */}
          {!isAdminPage && (
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">{t('header.mobileMenuButton')}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] bg-background p-0 flex flex-col">
                  <SheetHeader className="p-4 border-b">
                     <SheetTitle className="text-primary font-headline flex items-center text-lg">
                        {(headerDisplayMode === 'logo' || headerDisplayMode === 'both') && (
                          effectiveHeaderIconUrl ? (
                              <Image src={effectiveHeaderIconUrl} alt={currentSiteTitle || t('header.title')} width={24} height={24} className="h-6 w-6 rounded-sm mr-2" data-ai-hint="logo small" />
                          ) : (
                              <Film className="h-6 w-6 text-primary mr-2" />
                          )
                        )}
                        {(headerDisplayMode === 'title' || headerDisplayMode === 'both') && (
                           currentSiteTitle || t('header.title')
                        )}
                     </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col space-y-1 p-4 flex-grow">
                    {navLinks.map(link => (
                      <SheetClose asChild key={link.labelKey}>
                        <Link
                          href={link.href}
                          className={cn("py-2.5 px-3 rounded-md flex items-center text-base hover:bg-accent hover:text-accent-foreground")}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {link.live && <Zap className={cn("h-5 w-5 mr-2 text-red-500", isStreamActuallyLive ? "animate-pulse" : "opacity-50")} />}
                          {t(link.labelKey)}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                  <Separator />
                  <div className="p-4 space-y-2">
                    {isClient && !isAdminLoggedIn && !isUserLoggedIn && (
                      <>
                        <SheetClose asChild>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href="/login"><UserCircle className="mr-2 h-4 w-4" /> {t('header.login')}</Link>
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                            <Button className="w-full" asChild>
                                <Link href="/register">{t('header.register')}</Link>
                            </Button>
                        </SheetClose>
                      </>
                    )}
                    {isClient && isAdminLoggedIn && (
                        <>
                        <SheetClose asChild>
                            <Button variant="ghost" className="w-full justify-start" asChild>
                            <Link href="/admin"><LayoutDashboard className="mr-2 h-4 w-4" />{t('header.adminPanel')}</Link>
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                            <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />{t('header.logout')}
                            </Button>
                        </SheetClose>
                        </>
                    )}
                    {isClient && isUserLoggedIn && (
                        <>
                        <SheetClose asChild>
                            <Button variant="ghost" className="w-full justify-start" asChild>
                            <Link href="/account"><UserCircle className="mr-2 h-4 w-4" />{t('header.myAccount')}</Link>
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                            <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />{t('header.logout')}
                            </Button>
                        </SheetClose>
                        </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}