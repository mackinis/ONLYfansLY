
'use client';

import { useEffect, useState } from 'react';
import type { Testimonial, CuratedTestimonial } from '@/lib/types';
import { getTestimonials, updateTestimonialStatus, deleteTestimonialById } from '@/lib/actions';
import { curateTestimonials, CurateTestimonialsInput } from '@/ai/flows/curate-testimonials';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, MessageSquareText, Sparkles, Loader2, Trash2, Hourglass, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
import TestimonialDetailModal from '@/components/TestimonialDetailModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function TestimonialsAdminPage() {
  const { t, language, siteSettings, isLoadingSettings } = useTranslation();
  const [pendingTestimonials, setPendingTestimonials] = useState<Testimonial[]>([]);
  const [approvedTestimonials, setApprovedTestimonials] = useState<Testimonial[]>([]);
  const [deniedTestimonials, setDeniedTestimonials] = useState<Testimonial[]>([]);
  const [curatedDisplayTestimonials, setCuratedDisplayTestimonials] = useState<CuratedTestimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCurationLoading, setIsCurationLoading] = useState(false);
  const { toast } = useToast();

  const [selectedTestimonialForDetail, setSelectedTestimonialForDetail] = useState<Testimonial | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchAllTestimonials = async () => {
    setIsLoading(true);
    try {
      const [pending, approved, denied] = await Promise.all([
        getTestimonials('pending'),
        getTestimonials('approved'),
        getTestimonials('denied'),
      ]);
      setPendingTestimonials(pending);
      setApprovedTestimonials(approved);
      setDeniedTestimonials(denied);
    } catch (error) {
      toast({ title: t('adminTestimonialsPage.toasts.fetchErrorTitle'), description: `Failed to fetch testimonials: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTestimonials();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDetailModal = (testimonial: Testimonial) => {
    setSelectedTestimonialForDetail(testimonial);
    setIsDetailModalOpen(true);
  };

  const handleStatusUpdate = async (id: string, status: Testimonial['status']) => {
    try {
      await updateTestimonialStatus(id, status);
      toast({ title: t('adminTestimonialsPage.toasts.updateSuccessTitle'), description: t('adminTestimonialsPage.toasts.updateSuccessDescription', { status }) });
      fetchAllTestimonials(); 
      if (status === 'approved' || status === 'denied') { 
        setCuratedDisplayTestimonials([]); 
      }
    } catch (error) {
      toast({ title: t('adminTestimonialsPage.toasts.updateErrorTitle'), description: `Failed to update testimonial status: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };
  
  const handleDeleteTestimonial = async (testimonialId: string) => {
    try {
      const result = await deleteTestimonialById(testimonialId);
      if (result.success) {
        toast({ title: t('adminTestimonialsPage.toasts.deleteSuccessTitle'), description: result.message });
        fetchAllTestimonials();
        setCuratedDisplayTestimonials([]); 
      } else {
        toast({ title: t('adminTestimonialsPage.toasts.deleteErrorTitle'), description: result.message || t('adminTestimonialsPage.toasts.deleteErrorDescription'), variant: 'destructive' });
      }
    } catch (error) {
       toast({ title: t('adminTestimonialsPage.toasts.deleteErrorTitle'), description: error instanceof Error ? error.message : t('adminTestimonialsPage.toasts.genericErrorDescription'), variant: 'destructive' });
    }
  };

  const handleCurateNow = async () => {
    if (isLoadingSettings || !siteSettings) {
      toast({ title: t('adminGeneralPage.toasts.fetchErrorTitle'), description: "Site settings are not loaded yet.", variant: 'destructive' });
      return;
    }

    if (!siteSettings.aiCurationEnabled) {
      toast({ title: t('adminTestimonialsPage.toasts.curationSkippedTitle'), description: t('adminTestimonialsPage.toasts.aiCurationDisabledAdmin'), variant: 'default' });
      setCuratedDisplayTestimonials([]);
      return;
    }
    
    if (approvedTestimonials.length < siteSettings.aiCurationMinTestimonials) {
      toast({ 
        title: t('adminTestimonialsPage.toasts.curationSkippedTitle'), 
        description: t('adminTestimonialsPage.toasts.notEnoughForAIAdmin', { 
          currentCount: approvedTestimonials.length.toString(), 
          minRequired: siteSettings.aiCurationMinTestimonials.toString() 
        }), 
        variant: 'default' 
      });
      setCuratedDisplayTestimonials([]);
      return;
    }
    
    if (approvedTestimonials.length === 0) {
      toast({ title: t('adminTestimonialsPage.toasts.curationSkippedTitle'), description: t('adminTestimonialsPage.toasts.curationSkippedDescription'), variant: 'default' });
      setCuratedDisplayTestimonials([]);
      return;
    }

    setIsCurationLoading(true);
    try {
      const inputForAI: CurateTestimonialsInput = approvedTestimonials.map(item => ({
        id: item.id,
        text: item.text,
        author: item.author,
        date: item.date, 
      }));
      const curatedOutput = await curateTestimonials(inputForAI);
      
      const curatedMap = new Map(curatedOutput.map(item => [item.id, item.reason]));
      const enrichedTestimonials = approvedTestimonials
        .filter(item => curatedMap.has(item.id))
        .map(item => ({ ...item, reason: curatedMap.get(item.id) }))
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 

      setCuratedDisplayTestimonials(enrichedTestimonials);
      toast({ title: t('adminTestimonialsPage.toasts.curationCompleteTitle'), description: t('adminTestimonialsPage.toasts.curationCompleteDescription', { count: enrichedTestimonials.length.toString() }) });
    } catch (error) {
      console.error("AI Curation Error:", error);
      toast({ title: t('adminTestimonialsPage.toasts.curationErrorTitle'), description: t('adminTestimonialsPage.toasts.curationErrorDescription'), variant: 'destructive' });
    } finally {
      setIsCurationLoading(false);
    }
  };

  const renderTestimonialTable = (testimonials: Testimonial[], type: 'pending' | 'approved' | 'denied') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[20%]">{t('adminTestimonialsPage.table.author')}</TableHead>
          <TableHead className="w-[20%]">{t('adminTestimonialsPage.table.email')}</TableHead>
          <TableHead>{t('adminTestimonialsPage.table.testimonial')}</TableHead>
          <TableHead className="w-[15%]">{t('adminTestimonialsPage.table.date')}</TableHead>
          <TableHead className="text-right w-[20%]">{t('adminTestimonialsPage.table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {testimonials.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="h-24 text-center">{t('adminTestimonialsPage.noTestimonialsInCategory')}</TableCell></TableRow>
        ) : (
          testimonials.map(item => (
            <TableRow key={item.id}>
              <TableCell 
                className="font-medium cursor-pointer hover:text-primary hover:underline"
                onClick={() => handleOpenDetailModal(item)}
                title={t('adminTestimonialsPage.viewDetailsTooltip')}
              >
                {item.author}
              </TableCell>
              <TableCell 
                 className="text-sm text-muted-foreground truncate cursor-pointer hover:text-primary hover:underline"
                 onClick={() => handleOpenDetailModal(item)}
                 title={item.email}
              >
                {item.email}
              </TableCell>
              <TableCell 
                className="max-w-xs truncate cursor-pointer hover:text-primary hover:underline"
                onClick={() => handleOpenDetailModal(item)}
                title={item.text}
              >
                {item.text}
              </TableCell>
              <TableCell>{new Date(item.date).toLocaleDateString(language)}</TableCell>
              <TableCell className="text-right space-x-1">
                {type === 'pending' && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(item.id, 'approved')} className="text-green-500 hover:text-green-600" title={t('adminTestimonialsPage.approveButton')}>
                      <CheckCircle className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(item.id, 'denied')} className="text-red-500 hover:text-red-600" title={t('adminTestimonialsPage.denyButton')}>
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </>
                )}
                {type === 'approved' && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(item.id, 'denied')} className="text-red-500 hover:text-red-600" title={t('adminTestimonialsPage.denyButton')}>
                      <XCircle className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(item.id, 'pending')} className="text-yellow-500 hover:text-yellow-600" title={t('adminTestimonialsPage.moveToPendingButton')}>
                      <Hourglass className="h-5 w-5" />
                    </Button>
                  </>
                )}
                {type === 'denied' && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(item.id, 'approved')} className="text-green-500 hover:text-green-600" title={t('adminTestimonialsPage.approveButton')}>
                      <CheckCircle className="h-5 w-5" />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(item.id, 'pending')} className="text-yellow-500 hover:text-yellow-600" title={t('adminTestimonialsPage.moveToPendingButton')}>
                      <Hourglass className="h-5 w-5" />
                    </Button>
                  </>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title={t('adminTestimonialsPage.deleteButton')}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('adminTestimonialsPage.deleteDialog.title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('adminTestimonialsPage.deleteDialog.description', { author: item.author, text: item.text.substring(0, 50) + (item.text.length > 50 ? '...' : '') })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('adminTestimonialsPage.deleteDialog.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteTestimonial(item.id)} className={buttonVariants({ variant: "destructive" })}>
                        {t('adminTestimonialsPage.deleteDialog.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="ghost" size="icon" onClick={() => handleOpenDetailModal(item)} className="text-muted-foreground hover:text-primary" title={t('adminTestimonialsPage.viewDetailsTooltip')}>
                    <ExternalLink className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
  
  if (isLoading || isLoadingSettings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const aiCurationMinTestimonials = siteSettings?.aiCurationMinTestimonials ?? 5;
  const aiCurationIsEnabled = siteSettings?.aiCurationEnabled ?? true;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <MessageSquareText className="mr-3 h-8 w-8" /> {t('adminTestimonialsPage.title')}
        </h1>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
          <TabsTrigger value="pending">{t('adminTestimonialsPage.tabs.pending')} <Badge variant="outline" className="ml-2">{pendingTestimonials.length}</Badge></TabsTrigger>
          <TabsTrigger value="approved">{t('adminTestimonialsPage.tabs.approved')} <Badge variant="outline" className="ml-2">{approvedTestimonials.length}</Badge></TabsTrigger>
          <TabsTrigger value="denied">{t('adminTestimonialsPage.tabs.denied')} <Badge variant="outline" className="ml-2">{deniedTestimonials.length}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle>{t('adminTestimonialsPage.cardPending.title')}</CardTitle><CardDescription>{t('adminTestimonialsPage.cardPending.description')}</CardDescription></CardHeader>
            <CardContent>{renderTestimonialTable(pendingTestimonials, 'pending')}</CardContent>
            <CardFooter />
          </Card>
        </TabsContent>
        <TabsContent value="approved">
          <Card>
            <CardHeader><CardTitle>{t('adminTestimonialsPage.cardApproved.title')}</CardTitle><CardDescription>{t('adminTestimonialsPage.cardApproved.description')}</CardDescription></CardHeader>
            <CardContent>{renderTestimonialTable(approvedTestimonials, 'approved')}</CardContent>
            <CardFooter />
          </Card>
        </TabsContent>
        <TabsContent value="denied">
          <Card>
            <CardHeader><CardTitle>{t('adminTestimonialsPage.cardDenied.title')}</CardTitle><CardDescription>{t('adminTestimonialsPage.cardDenied.description')}</CardDescription></CardHeader>
            <CardContent>{renderTestimonialTable(deniedTestimonials, 'denied')}</CardContent>
            <CardFooter />
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center"><Sparkles className="mr-2 h-6 w-6 text-primary" /> {t('adminTestimonialsPage.cardAICuration.title')}</CardTitle>
          <CardDescription>{t('adminTestimonialsPage.cardAICuration.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isCurationLoading ? (
             <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{t('adminTestimonialsPage.curationLoadingText')}</p></div>
          ) : curatedDisplayTestimonials.length > 0 ? (
            <div className="space-y-4">
              {curatedDisplayTestimonials.map(item => (
                <div key={item.id} className="p-4 border rounded-lg bg-card/50 cursor-pointer hover:bg-card/70" onClick={() => handleOpenDetailModal(item)}>
                  <h4 className="font-semibold text-primary">{item.author} <span className="text-xs text-muted-foreground">({new Date(item.date).toLocaleDateString(language)})</span></h4>
                  <p className="text-sm italic my-1 line-clamp-2">&ldquo;{item.text}&rdquo;</p>
                  {item.reason && <p className="text-xs text-primary/80 mt-2"><Sparkles className="h-3 w-3 inline mr-1 text-primary" /> {item.reason}</p> }
                </div>
              ))}
            </div>
          ) : !aiCurationIsEnabled ? (
            <p className="text-muted-foreground">{t('adminTestimonialsPage.toasts.aiCurationDisabledAdmin')}</p>
          ) : approvedTestimonials.length < aiCurationMinTestimonials && approvedTestimonials.length > 0 ? (
             <p className="text-muted-foreground">{t('adminTestimonialsPage.toasts.notEnoughForAIAdmin', { currentCount: approvedTestimonials.length.toString(), minRequired: aiCurationMinTestimonials.toString() })}</p>
          ) : (
            <p className="text-muted-foreground">{t('adminTestimonialsPage.noCuratedTestimonials')}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleCurateNow} 
            disabled={isCurationLoading || isLoadingSettings || !aiCurationIsEnabled || approvedTestimonials.length < (siteSettings?.aiCurationMinTestimonials ?? 5)}
          >
            {isCurationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {t('adminTestimonialsPage.curateNowButton')}
          </Button>
        </CardFooter>
      </Card>
      {selectedTestimonialForDetail && (
        <TestimonialDetailModal
            isOpen={isDetailModalOpen}
            onOpenChange={setIsDetailModalOpen}
            testimonial={selectedTestimonialForDetail}
        />
      )}
    </div>
  );
}

