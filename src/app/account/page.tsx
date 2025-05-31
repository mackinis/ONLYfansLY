
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserCircle, MessageSquareText, AlertTriangle, Edit } from 'lucide-react';
import type { UserProfile, Testimonial, SessionUserProfile } from '@/lib/types';
import { getUserProfileById, getTestimonials } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import Link from 'next/link';

export default function AccountPage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userTestimonials, setUserTestimonials] = useState<Testimonial[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = sessionStorage.getItem('aurum_user_id');
      const storedAdmin = sessionStorage.getItem('aurum_is_admin_logged_in');

      if (storedAdmin === 'true') {
        router.push('/admin'); // Admins should not be on this page
        return;
      }
      if (!storedUserId) {
        router.push('/login'); // Redirect if not logged in
        return;
      }
      setUserId(storedUserId);
    }
  }, [router]);

  useEffect(() => {
    if (userId) {
      const fetchProfile = async () => {
        setIsLoadingProfile(true);
        try {
          const profile = await getUserProfileById(userId);
          if (profile) {
            setUserProfile(profile);
          } else {
            toast({ title: t('accountPage.toasts.profileErrorTitle'), description: t('accountPage.toasts.profileErrorDescription'), variant: 'destructive' });
            router.push('/login'); // Or handle error appropriately
          }
        } catch (error) {
          toast({ title: t('accountPage.toasts.profileErrorTitle'), description: t('accountPage.toasts.genericError'), variant: 'destructive' });
        } finally {
          setIsLoadingProfile(false);
        }
      };

      const fetchTestimonials = async () => {
        setIsLoadingTestimonials(true);
        try {
          const testimonials = await getTestimonials(undefined, userId); // Fetch all statuses by user ID
          setUserTestimonials(testimonials);
        } catch (error) {
          console.error("Error fetching testimonials for account page:", error); // Added detailed log
          toast({ title: t('accountPage.toasts.testimonialsErrorTitle'), description: `${t('accountPage.toasts.genericError')} ${error instanceof Error ? `(${error.message})` : ''}`, variant: 'destructive' });
        } finally {
          setIsLoadingTestimonials(false);
        }
      };

      fetchProfile();
      fetchTestimonials();
    }
  }, [userId, toast, router, t]);

  if (!userId && !isLoadingProfile) { // If no userId and not loading, means redirect should have happened or will happen
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


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary mb-8">
          {t('accountPage.title')}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Section */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-primary/20">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-headline text-2xl flex items-center">
                    <UserCircle className="mr-3 h-7 w-7 text-primary" /> {t('accountPage.profileSection.title')}
                  </CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/account/edit">
                      <Edit className="mr-2 h-4 w-4" /> {t('accountPage.editProfileButton')}
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

          {/* Testimonials Section */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-primary/20">
              <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center">
                  <MessageSquareText className="mr-3 h-7 w-7 text-primary" /> {t('accountPage.testimonialsSection.title')}
                </CardTitle>
                <CardDescription>{t('accountPage.testimonialsSection.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTestimonials ? (
                  <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : userTestimonials.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('accountPage.testimonialsSection.table.date')}</TableHead>
                        <TableHead>{t('accountPage.testimonialsSection.table.testimonial')}</TableHead>
                        <TableHead className="text-right">{t('accountPage.testimonialsSection.table.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userTestimonials.map((testimonial) => (
                        <TableRow key={testimonial.id}>
                          <TableCell className="whitespace-nowrap">{new Date(testimonial.date).toLocaleDateString(language)}</TableCell>
                          <TableCell className="max-w-xs truncate" title={testimonial.text}>{testimonial.text}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={getStatusBadgeVariant(testimonial.status)}>
                                {getStatusText(testimonial.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
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
    </div>
  );
}
