
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserCircle, MessageSquareText, AlertTriangle, Edit as EditIcon, Clock } from 'lucide-react';
import type { UserProfile, Testimonial, SessionUserProfile, SiteSettings } from '@/lib/types';
import { getUserProfileById, getTestimonials, getSiteSettings } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import Link from 'next/link';
import { addMinutes, isAfter, format, formatDistanceToNowStrict, intervalToDuration } from 'date-fns';
import { es as esLocale, enUS as enUSLocale } from 'date-fns/locale';
import EditTestimonialModal from '@/components/EditTestimonialModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function AccountPage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userTestimonials, setUserTestimonials] = useState<Testimonial[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [siteSettings, setSiteSettingsState] = useState<SiteSettings | null>(null);
  const [isLoadingSiteSettings, setIsLoadingSiteSettings] = useState(true);

  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchSiteSettings = useCallback(async () => {
    setIsLoadingSiteSettings(true);
    try {
      const settings = await getSiteSettings();
      setSiteSettingsState(settings);
    } catch (error) {
      console.error("Failed to fetch site settings for account page:", error);
      toast({ title: "Error", description: "Could not load site configuration.", variant: "destructive" });
    } finally {
      setIsLoadingSiteSettings(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchSiteSettings();
  }, [fetchSiteSettings]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = sessionStorage.getItem('aurum_user_id');
      const storedAdmin = sessionStorage.getItem('aurum_is_admin_logged_in');

      if (storedAdmin === 'true') {
        router.push('/admin'); 
        return;
      }
      if (!storedUserId) {
        router.push('/login'); 
        return;
      }
      setUserId(storedUserId);
    }
  }, [router]);

  const fetchUserAndTestimonials = useCallback(async () => {
    if (userId) {
      setIsLoadingProfile(true);
      setIsLoadingTestimonials(true);
      try {
        const profile = await getUserProfileById(userId);
        if (profile) {
          setUserProfile(profile);
        } else {
          toast({ title: t('accountPage.toasts.profileErrorTitle'), description: t('accountPage.toasts.profileErrorDescription'), variant: 'destructive' });
          router.push('/login'); 
        }
      } catch (error) {
        toast({ title: t('accountPage.toasts.profileErrorTitle'), description: t('accountPage.toasts.genericError'), variant: 'destructive' });
      } finally {
        setIsLoadingProfile(false);
      }

      try {
        const testimonials = await getTestimonials(undefined, userId); 
        setUserTestimonials(testimonials);
      } catch (error) {
        console.error("Error fetching testimonials for account page:", error);
        toast({ title: t('accountPage.toasts.testimonialsErrorTitle'), description: `${t('accountPage.toasts.genericError')} ${error instanceof Error ? `(${error.message})` : ''}`, variant: 'destructive' });
      } finally {
        setIsLoadingTestimonials(false);
      }
    }
  }, [userId, toast, router, t]);

  useEffect(() => {
    fetchUserAndTestimonials();
  }, [fetchUserAndTestimonials]);


  const handleEditTestimonial = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    setIsEditModalOpen(true);
  };

  const onTestimonialUpdated = () => {
    fetchUserAndTestimonials(); // Refresh testimonials list after update
  };

  if (!userId && !isLoadingProfile) { 
     return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow flex items-center justify-center">
                <Card className="w-full max-w-md text-center p-8">
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t('accountPage.loginRequiredTitle')}</h2>
                    <p className="text-muted-foreground mb-4">{t('accountPage.loginRequiredDescription')}</p>
                    <Button asChild><Link href="/login">{t('header.login')}</Link></Button>
                </Card>
            </main>
            <Footer />
        </div>
     );
  }

  const getStatusBadgeVariant = (status: Testimonial['status']) => {
    switch (status) {
      case 'approved': return 'default'; 
      case 'pending': return 'secondary';
      case 'denied': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: Testimonial['status']) => {
    switch (status) {
      case 'approved': return t('accountPage.testimonialStatus.approved');
      case 'pending': return t('accountPage.testimonialStatus.pending');
      case 'denied': return t('accountPage.testimonialStatus.denied');
      default: return status;
    }
  }
  
  const formatRemainingTime = (endDate: Date) => {
      const duration = intervalToDuration({ start: new Date(), end: endDate });
      let parts = [];
      if (duration.days && duration.days > 0) parts.push(`${duration.days} ${t(duration.days > 1 ? 'adminTestimonialsPage.time.days' : 'adminTestimonialsPage.time.day')}`);
      if (duration.hours && duration.hours > 0) parts.push(`${duration.hours} ${t(duration.hours > 1 ? 'adminTestimonialsPage.time.hours' : 'adminTestimonialsPage.time.hour')}`);
      if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes} ${t(duration.minutes > 1 ? 'adminTestimonialsPage.time.minutes' : 'adminTestimonialsPage.time.minute')}`);
      if (parts.length === 0 && duration.seconds && duration.seconds > 0) parts.push(`${duration.seconds} ${t(duration.seconds > 1 ? 'adminTestimonialsPage.time.seconds' : 'adminTestimonialsPage.time.second')}`);
      return parts.join(', ') || t('adminTestimonialsPage.time.lessThanAMinute');
  };


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary mb-8">
          {t('accountPage.title')}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-primary/20">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-headline text-2xl flex items-center">
                    <UserCircle className="mr-3 h-7 w-7 text-primary" /> {t('accountPage.profileSection.title')}
                  </CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/account/edit">
                      <EditIcon className="mr-2 h-4 w-4" /> {t('accountPage.editProfileButton')}
                    </Link>
                  </Button>
                </div>
                <CardDescription>{t('accountPage.profileSection.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingProfile ? (
                  <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : userProfile ? (
                  <div className="space-y-3 text-sm">
                    <p><strong>{t('accountPage.profileSection.name')}:</strong> {userProfile.name} {userProfile.surname}</p>
                    <p><strong>{t('accountPage.profileSection.email')}:</strong> {userProfile.email}</p>
                    {userProfile.phone && <p><strong>{t('accountPage.profileSection.phone')}:</strong> {userProfile.phone}</p>}
                    {userProfile.dni && <p><strong>{t('accountPage.profileSection.dni')}:</strong> {userProfile.dni}</p>}
                    {userProfile.address && <p><strong>{t('accountPage.profileSection.address')}:</strong> {userProfile.address}</p>}
                    {(userProfile.city || userProfile.postalCode) && (
                        <p>
                            <strong>{t('accountPage.profileSection.cityPostal')}:</strong> 
                            {userProfile.city}{userProfile.city && userProfile.postalCode ? ', ' : ''}{userProfile.postalCode}
                        </p>
                    )}
                    {userProfile.province && <p><strong>{t('accountPage.profileSection.province')}:</strong> {userProfile.province}</p>}
                    {userProfile.country && <p><strong>{t('accountPage.profileSection.country')}:</strong> {userProfile.country}</p>}
                     <p>
                      <strong>{t('accountPage.profileSection.verified')}:</strong>
                      <Badge variant={userProfile.isVerified ? "default" : "destructive"} className="ml-2">
                        {userProfile.isVerified ? t('accountPage.profileSection.isVerifiedYes') : t('accountPage.profileSection.isVerifiedNo')}
                      </Badge>
                    </p>
                  </div>
                ) : (
                  <p>{t('accountPage.profileSection.notFound')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="shadow-lg border-primary/20">
              <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center">
                  <MessageSquareText className="mr-3 h-7 w-7 text-primary" /> {t('accountPage.testimonialsSection.title')}
                </CardTitle>
                <CardDescription>{t('accountPage.testimonialsSection.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTestimonials || isLoadingSiteSettings ? (
                  <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : userTestimonials.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('accountPage.testimonialsSection.table.date')}</TableHead>
                        <TableHead>{t('accountPage.testimonialsSection.table.testimonial')}</TableHead>
                        <TableHead>{t('accountPage.testimonialsSection.table.status')}</TableHead>
                        <TableHead className="text-right">{t('accountPage.testimonialsSection.table.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userTestimonials.map((testimonial) => {
                        const gracePeriodMinutes = siteSettings?.testimonialEditGracePeriodMinutes ?? 0;
                        const submissionDate = new Date(testimonial.date);
                        const gracePeriodEndDate = addMinutes(submissionDate, gracePeriodMinutes);
                        const isEditable = testimonial.status === 'pending' && isAfter(gracePeriodEndDate, new Date());
                        const timeRemainingStr = isEditable ? formatRemainingTime(gracePeriodEndDate) : '';
                        const currentLocale = language === 'es' ? esLocale : enUSLocale;

                        return (
                          <TableRow key={testimonial.id}>
                            <TableCell className="whitespace-nowrap">{new Date(testimonial.date).toLocaleDateString(language)}</TableCell>
                            <TableCell className="max-w-xs truncate" title={testimonial.text}>{testimonial.text}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(testimonial.status)}>
                                  {getStatusText(testimonial.status)}
                              </Badge>
                              {isEditable && (
                                 <TooltipProvider>
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Clock className="ml-2 h-4 w-4 text-yellow-500 inline-block" />
                                     </TooltipTrigger>
                                     <TooltipContent>
                                       <p>{t('accountPage.editableUntilTooltip', { date: format(gracePeriodEndDate, 'Pp', { locale: currentLocale }) })}</p>
                                       <p>{t('accountPage.timeRemainingTooltip', { time: timeRemainingStr })}</p>
                                     </TooltipContent>
                                   </Tooltip>
                                 </TooltipProvider>
                               )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isEditable && (
                                <Button variant="outline" size="sm" onClick={() => handleEditTestimonial(testimonial)}>
                                  <EditIcon className="mr-1 h-3 w-3" /> {t('accountPage.editButton')}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">{t('accountPage.testimonialsSection.noTestimonials')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
      {editingTestimonial && siteSettings && (
        <EditTestimonialModal
            isOpen={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            testimonial={editingTestimonial}
            onTestimonialUpdated={onTestimonialUpdated}
            siteSettings={siteSettings}
        />
      )}
    </div>
  );
}
