
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Film, LayoutDashboard, Video as VideoIconLucide, MessageSquareText, Users, DollarSign, Palette, LogOut, Settings, ShieldCheck, Languages as LanguagesIcon, UserCircle, BookOpenCheck, Settings2, Megaphone, MessageSquare, Loader2, Smartphone } from 'lucide-react';
import * as React from "react";
import { useTranslation } from '@/context/I18nContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { UserProfile, ColorSetting } from '@/lib/types';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [openSubMenus, setOpenSubMenus] = React.useState<Record<string, boolean>>({'settings': true});
  const { t, siteSettings, currentSiteTitle: globalSiteTitle, currentHeaderIconUrl } = useTranslation();
  const [adminProfile, setAdminProfile] = React.useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [avatarPrimaryColor, setAvatarPrimaryColor] = React.useState('D4AF37'); 
  const [avatarPrimaryFgColor, setAvatarPrimaryFgColor] = React.useState('1A1A1A'); 

  // Early check for admin login status from sessionStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAdminLoggedIn = sessionStorage.getItem('aurum_is_admin_logged_in');
      if (isAdminLoggedIn !== 'true') {
        router.push('/login');
      }
    }
  }, [router]);

  const fetchAdminDetails = React.useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const response = await fetch('/api/admin/profile');
      if (!response.ok) {
        console.error('Failed to fetch admin profile, redirecting to login.');
        router.push('/login'); // Redirect if API call fails
        return;
      }
      const profile: UserProfile = await response.json();
      if (profile && profile.role === 'admin') {
        setAdminProfile(profile);
      } else {
        console.error('Fetched profile is not admin or profile is null, redirecting to login.');
        setAdminProfile(null);
        router.push('/login'); // Redirect if not admin or profile is null
      }
    } catch (error) {
      console.error("Failed to fetch admin profile for layout:", error);
      setAdminProfile(null);
      router.push('/login'); // Redirect on any other error during fetch
    } finally {
      setIsLoadingProfile(false);
    }
  }, [router]);

  React.useEffect(() => {
    // Only fetch admin details if sessionStorage indicates admin is logged in
    if (typeof window !== 'undefined' && sessionStorage.getItem('aurum_is_admin_logged_in') === 'true') {
      fetchAdminDetails();
    } else if (typeof window !== 'undefined') { // If not marked as logged in, but no redirect happened yet, force it
      router.push('/login');
    }
    
    const handleProfileUpdate = () => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('aurum_is_admin_logged_in') === 'true') {
            fetchAdminDetails();
        }
    };
    window.addEventListener('adminProfileUpdated', handleProfileUpdate);
    return () => {
        window.removeEventListener('adminProfileUpdated', handleProfileUpdate);
    };
  }, [fetchAdminDetails, router]);

  // Additional check: if loading is finished and profile is still null, redirect
  React.useEffect(() => {
    if (!isLoadingProfile && !adminProfile && typeof window !== 'undefined' && sessionStorage.getItem('aurum_is_admin_logged_in') === 'true') {
        // This condition means fetchAdminDetails completed but didn't set a valid admin profile,
        // or it was called when sessionStorage was true, but the backend check failed.
        console.log('Admin profile not loaded after fetch, redirecting.');
        router.push('/login');
    }
  }, [isLoadingProfile, adminProfile, router]);


  React.useEffect(() => {
    if (siteSettings?.themeColors) {
      const primarySetting = siteSettings.themeColors.find(s => s.id === 'primary');
      const primaryFgSetting = siteSettings.themeColors.find(s => s.id === 'primary-foreground');

      if (primarySetting?.value) {
        setAvatarPrimaryColor(primarySetting.value.replace('#', ''));
      } else {
        
        const defaultPrimary = siteSettings.themeColors.find(s => s.id === 'primary')?.defaultValueHex || 'D4AF37';
        setAvatarPrimaryColor(defaultPrimary.replace('#',''));
      }
      if (primaryFgSetting?.value) {
        setAvatarPrimaryFgColor(primaryFgSetting.value.replace('#', ''));
      } else {
        const defaultPrimaryFg = siteSettings.themeColors.find(s => s.id === 'primary-foreground')?.defaultValueHex || '1A1A1A';
        setAvatarPrimaryFgColor(defaultPrimaryFg.replace('#',''));
      }
    }
  }, [siteSettings]);


  const adminNavItems = [
    { href: '/admin', labelKey: 'adminLayout.dashboard', icon: LayoutDashboard },
    { href: '/admin/courses', labelKey: 'adminLayout.courses', icon: BookOpenCheck },
    { href: '/admin/livestream', labelKey: 'adminLayout.liveStream', icon: VideoIconLucide },
    { href: '/admin/testimonials', labelKey: 'adminLayout.testimonials', icon: MessageSquareText },
    { href: '/admin/announcements', labelKey: 'adminLayout.announcements', icon: Megaphone },
    { href: '/admin/users', labelKey: 'adminLayout.users', icon: Users },
    { href: '/admin/chat', labelKey: 'adminLayout.chat', icon: MessageSquare },
    { href: '/admin/currencies', labelKey: 'adminLayout.currencies', icon: DollarSign },
    { href: '/admin/appearance', labelKey: 'adminLayout.appearance', icon: Palette },
    { href: '/admin/languages', labelKey: 'adminLayout.languages', icon: LanguagesIcon },
  ];

  const settingsNavItems = [
     { href: '/admin/settings/account', labelKey: 'adminLayout.account', icon: UserCircle },
     { href: '/admin/settings/general', labelKey: 'adminLayout.general', icon: Settings2 },
     { href: '/admin/settings/mobile-apps', labelKey: 'adminLayout.mobileApps', icon: Smartphone },
     { href: '/admin/settings/security', labelKey: 'adminLayout.security', icon: ShieldCheck },
  ];

  const toggleSubMenu = (label: string) => {
    setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('aurum_is_admin_logged_in');
    sessionStorage.removeItem('aurum_user_profile');
    sessionStorage.removeItem('aurum_user_id'); 
    window.dispatchEvent(new Event('aurumLoginStatusChanged'));
    router.push('/login');
  };
  
  const getAdminAvatarFallback = () => {
    if (adminProfile) {
      const nameInitial = adminProfile.name ? adminProfile.name[0] : '';
      const surnameInitial = adminProfile.surname ? adminProfile.surname[0] : '';
      return `${nameInitial}${surnameInitial}`.toUpperCase() || 'AD';
    }
    return 'AD';
  };

  const avatarPlaceholderUrl = `https://placehold.co/40x40/${avatarPrimaryColor}/${avatarPrimaryFgColor}?text=${getAdminAvatarFallback()}`;
  
  // If still loading profile and no admin profile yet, show loader or minimal layout to prevent flashing content.
  // This is a basic loading state; could be more sophisticated.
  if (isLoadingProfile && !adminProfile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  // If after loading, there's still no admin profile, it means redirection should have happened or is happening.
  // Rendering null here prevents flashing the admin layout if redirection is imminent.
  if (!adminProfile) {
    return null; 
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background">
        <Sidebar variant="sidebar" collapsible="icon" className="border-r border-border/60">
          <SidebarHeader className="p-4">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              {currentHeaderIconUrl ? (
                <Image src={currentHeaderIconUrl} alt={globalSiteTitle || t('adminLayout.sidebarTitle')} width={32} height={32} className="h-8 w-8 rounded-sm" data-ai-hint="logo" />
              ) : (
                <Film className="h-8 w-8 text-primary" />
              )}
              <span className="font-headline text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">{globalSiteTitle || t('adminLayout.sidebarTitle')}</span>
            </Link>
          </SidebarHeader>
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <SidebarContent className="p-2">
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href} legacyBehavior passHref>
                      <SidebarMenuButton
                        isActive={pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/admin') || (pathname === '/admin' && item.href === '/admin')}
                        tooltip={t(item.labelKey)}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">{t(item.labelKey)}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
                 <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => toggleSubMenu('settings')} tooltip={t('adminLayout.settings')}>
                        <Settings className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">{t('adminLayout.settings')}</span>
                    </SidebarMenuButton>
                    {openSubMenus['settings'] && (
                    <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
                        {settingsNavItems.map((item) => (
                           <SidebarMenuSubItem key={item.href}>
                           <Link href={item.href} legacyBehavior passHref>
                               <SidebarMenuSubButton isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                                <item.icon className="h-4 w-4 mr-2" />
                                {t(item.labelKey)}
                               </SidebarMenuSubButton>
                           </Link>
                           </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                    )}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </ScrollArea>
          <SidebarFooter className="p-4 mt-auto border-t border-border/60">
            <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center" onClick={handleLogout}>
              <LogOut className="h-5 w-5 group-data-[collapsible=icon]:mr-0 mr-2" />
              <span className="group-data-[collapsible=icon]:hidden">{t('adminLayout.logout')}</span>
            </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 flex flex-col">
           <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/60 bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:justify-end">
            <SidebarTrigger className="md:hidden" />
            <div className="flex items-center gap-4">
             {isLoadingProfile && !adminProfile ? ( // Show loader if actively loading and no profile yet
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
             ) : adminProfile ? (
                <span className="text-sm text-muted-foreground">
                  {t('adminLayout.welcomeAdmin', { adminName: adminProfile.name || 'Admin' })}
                </span>
              ) : (
                 // Fallback if profile somehow null after loading (should have redirected)
                 <span className="text-sm text-muted-foreground">{t('adminLayout.welcomeAdmin', { adminName: 'Admin' })}</span>
              )}
              <Link href="/admin/settings/account">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={adminProfile?.avatarUrl || avatarPlaceholderUrl} alt={adminProfile?.name || "Admin"} data-ai-hint="admin avatar" />
                  <AvatarFallback>{getAdminAvatarFallback()}</AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
