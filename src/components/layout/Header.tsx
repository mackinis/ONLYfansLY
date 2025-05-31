
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Film, UserCircle, Zap, Languages as LanguagesIcon, Check, Settings, Menu, LogOut, LayoutDashboard } from 'lucide-react';
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

export default function Header() {
  const { t, language, setLanguage, siteSettings, currentSiteTitle, currentSiteIconUrl } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<SessionUserProfile | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isStreamActuallyLive, setIsStreamActuallyLive] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const updateLoginState = () => {
    if (typeof window !== 'undefined') {
      const adminLoggedIn = sessionStorage.getItem('aurum_is_admin_logged_in') === 'true';
      const userId = sessionStorage.getItem('aurum_user_id');
      const userProfileString = sessionStorage.getItem('aurum_user_profile');

      setIsAdminLoggedIn(adminLoggedIn);
      setIsUserLoggedIn(!!userId && !adminLoggedIn); // User is logged in if userId exists and not admin

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
    updateLoginState(); // Initial check

    const handleLoginStatusChange = () => {
      updateLoginState();
    };
    window.addEventListener('aurumLoginStatusChanged', handleLoginStatusChange);
    window.addEventListener('storage', (event) => { // Listen for storage changes from other tabs
      if (event.key === 'aurum_is_admin_logged_in' || event.key === 'aurum_user_id' || event.key === 'aurum_user_profile') {
        handleLoginStatusChange();
      }
    });

    const newSocket = io({ path: '/api/socket_io', autoConnect: true });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Header connected to Socket.IO for live status:', newSocket.id);
      newSocket.emit('register-viewer');
    });

    newSocket.on('broadcaster-ready', () => setIsStreamActuallyLive(true));
    newSocket.on('broadcaster-disconnected', () => setIsStreamActuallyLive(false));
    newSocket.on('disconnect', () => setIsStreamActuallyLive(false));

    return () => {
      window.removeEventListener('aurumLoginStatusChanged', handleLoginStatusChange);
      window.removeEventListener('storage', handleLoginStatusChange);
      if (newSocket) {
        newSocket.off('connect');
        newSocket.off('broadcaster-ready');
        newSocket.off('broadcaster-disconnected');
        newSocket.off('disconnect');
        newSocket.disconnect();
      }
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('aurum_is_admin_logged_in');
      sessionStorage.removeItem('aurum_user_id');
      sessionStorage.removeItem('aurum_user_profile');
    }
    updateLoginState(); // Update state immediately
    window.dispatchEvent(new Event('aurumLoginStatusChanged')); // Notify other components
    router.push('/login');
  };

  const allowUserToChooseLanguage = siteSettings?.allowUserToChooseLanguage ?? false;
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


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          {currentSiteIconUrl ? (
            <Image src={currentSiteIconUrl} alt={currentSiteTitle || t('header.title')} width={32} height={32} className="h-8 w-8 rounded-sm" data-ai-hint="logo" />
          ) : (
            <Film className="h-8 w-8 text-primary" />
          )}
          <span className="font-headline text-2xl font-bold text-primary">{currentSiteTitle || t('header.title')}</span>
        </Link>

        {!isAdminPage && (
          <>
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
              {navLinks.map(link => (
                <Link
                  key={link.labelKey}
                  href={link.href} // Always link to the href
                  className={cn(
                    "transition-colors flex items-center hover:text-primary"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.live && <Zap className={cn("h-4 w-4 mr-1 text-red-500", isStreamActuallyLive ? "animate-pulse" : "opacity-50")} />}
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>

            {/* Mobile Navigation Trigger */}
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">{t('header.mobileMenuButton')}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] bg-background p-0">
                  <SheetHeader className="p-4 border-b">
                     <SheetTitle className="text-primary font-headline flex items-center">
                        {currentSiteIconUrl ? (
                            <Image src={currentSiteIconUrl} alt={currentSiteTitle || t('header.title')} width={24} height={24} className="h-6 w-6 rounded-sm mr-2" data-ai-hint="logo small" />
                        ) : (
                            <Film className="h-6 w-6 text-primary mr-2" />
                        )}
                        {currentSiteTitle || t('header.title')}
                     </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col space-y-2 p-4">
                    {navLinks.map(link => (
                      <SheetClose asChild key={link.labelKey}>
                        <Link
                          href={link.href} // Always link to the href
                          className={cn(
                            "py-2 px-3 rounded-md flex items-center text-base hover:bg-accent hover:text-accent-foreground"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {link.live && <Zap className={cn("h-5 w-5 mr-2 text-red-500", isStreamActuallyLive ? "animate-pulse" : "opacity-50")} />}
                          {t(link.labelKey)}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}

        <div className="flex items-center space-x-2">
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
                    <AvatarImage src={`https://placehold.co/40x40/D4AF37/1A1A1A?text=${getAvatarFallback()}`} alt={currentUserProfile.name} data-ai-hint="user avatar"/>
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
        </div>
      </div>
    </header>
  );
}
