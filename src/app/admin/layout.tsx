
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
import { Film, LayoutDashboard, Video as VideoIconLucide, MessageSquareText, Users, DollarSign, Palette, LogOut, Settings, ShieldCheck, Languages as LanguagesIcon, UserCircle, BookOpenCheck, Settings2, Megaphone, MessageSquare, Loader2 } from 'lucide-react';
import * as React from "react";
import { useTranslation } from '@/context/I18nContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { UserProfile } from '@/lib/types';
import { getAdminProfile } from '@/lib/actions';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [openSubMenus, setOpenSubMenus] = React.useState<Record<string, boolean>>({'settings': true});
  const { t, currentSiteTitle: globalSiteTitle, currentSiteIconUrl: globalSiteIconUrl } = useTranslation(); // Renamed to avoid conflict
  const [adminProfile, setAdminProfile] = React.useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);

  const fetchAdminDetails = React.useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const profile = await getAdminProfile();
      setAdminProfile(profile);
    } catch (error) {
      console.error("Failed to fetch admin profile for layout:", error);
      setAdminProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAdminDetails();
    
    const handleProfileUpdate = () => {
        fetchAdminDetails();
    };
    window.addEventListener('adminProfileUpdated', handleProfileUpdate);
    return () => {
        window.removeEventListener('adminProfileUpdated', handleProfileUpdate);
    };

  }, [fetchAdminDetails]);


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
     { href: '/admin/settings/security', labelKey: 'adminLayout.security', icon: ShieldCheck },
  ];

  const toggleSubMenu = (label: string) => {
    setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('aurum_is_admin_logged_in');
    sessionStorage.removeItem('aurum_user_profile'); // Clear admin profile from session too
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


  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background">
        <Sidebar variant="sidebar" collapsible="icon" className="border-r border-border/60">
          <SidebarHeader className="p-4">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              {globalSiteIconUrl ? (
                <Image src={globalSiteIconUrl} alt={globalSiteTitle || t('adminLayout.sidebarTitle')} width={32} height={32} className="h-8 w-8 rounded-sm" data-ai-hint="logo" />
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
             {isLoadingProfile ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
             ) : adminProfile ? (
                <span className="text-sm text-muted-foreground">
                  {t('adminLayout.welcomeAdmin', { adminName: adminProfile.name || 'Admin' })}
                </span>
              ) : (
                 <span className="text-sm text-muted-foreground">{t('adminLayout.welcomeAdmin', { adminName: 'Admin' })}</span>
              )}
              <Link href="/admin/settings/account">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={adminProfile?.avatarUrl || `https://placehold.co/40x40/D4AF37/1A1A1A?text=${getAdminAvatarFallback()}`} alt={adminProfile?.name || "Admin"} data-ai-hint="admin avatar" />
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
