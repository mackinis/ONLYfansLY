
'use client';

import { useEffect, useState } from 'react';
import type { Testimonial, CuratedTestimonial } from '@/lib/types';
// Removed direct import of getTestimonials, updateTestimonialStatus, deleteTestimonialById
// Removed direct import of curateTestimonials function
import type { CurateTestimonialsInput, CurateTestimonialsOutput } from '@/ai/flows/curate-testimonials';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, MessageSquareText, Sparkles, Loader2, Trash2, Hourglass, ExternalLink, Clock } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { addMinutes, format, isAfter, formatDistanceToNowStrict, intervalToDuration } from 'date-fns';
import { es as esLocale, enUS as enUSLocale } from 'date-fns/locale';

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
      const [pendingRes, approvedRes, deniedRes] = await Promise.all([
        fetch('/api/testimonials?status=pending'),
        fetch('/api/testimonials?status=approved'),
        fetch('/api/testimonials?status=denied'),
      ]);
      if (!pendingRes.ok || !approvedRes.ok || !deniedRes.ok) {
        throw new Error('Failed to fetch one or more testimonial lists');
      }
      const pending = await pendingRes.json();
      const approved = await approvedRes.json();
      const denied = await deniedRes.json();
      
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
      // This assumes an API route for updating status exists or will be created
      // For now, we'll assume it would be /api/admin/testimonials/[id]/status
      // For simplicity, using the existing `updateTestimonialStatusLogic` via a hypothetical general testimonial update route
      const response = await fetch(`/api/testimonials/${id}/status`, { // Placeholder, needs specific API route
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update status');
      }

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
      const response = await fetch(`/api/testimonials/${testimonialId}`, { method: 'DELETE' });
      const result = await response.json();

      if (response.ok && result.success) {
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
      
      const response = await fetch('/api/ai/curate-testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputForAI),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse AI error response' }));
        throw new Error(errorData.message || `AI Curation API request failed with status ${response.status}`);
      }

      const curatedOutput: CurateTestimonialsOutput = await response.json();
      
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

  const renderTestimonialTable = (testimonials: Testimonial[], type: 'pending' | 'approved' | 'denied') => {
    const gracePeriodMinutes = siteSettings?.testimonialEditGracePeriodMinutes ?? 60;
    const currentLocale = language === 'es' ? esLocale : enUSLocale;
    
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[20%]">{t('adminTestimonialsPage.table.author')}</TableHead>
          <TableHead className="w-[20%]">{t('adminTestimonialsPage.table.email')}</TableHead>
          <TableHead>{t('adminTestimonialsPage.table.testimonial')}</TableHead>
          <TableHead className="w-[15%]">{t('adminTestimonialsPage.table.date')}</TableHead>
          {type === 'pending' && <TableHead className="w-[10%] text-center">{t('adminTestimonialsPage.table.status')}</TableHead>}
          <TableHead className="text-right w-[20%]">{t('adminTestimonialsPage.table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {testimonials.length === 0 ? (
          <TableRow><TableCell colSpan={type === 'pending' ? 6 : 5} className="h-24 text-center">{t('adminTestimonialsPage.noTestimonialsInCategory')}</TableCell></TableRow>
        ) : (
          testimonials.map(item => {
            let isEditableByUser = false;
            let gracePeriodEndDate: Date | null = null;
            let timeRemainingStr = '';

            if (type === 'pending' && item.status === 'pending') {
              const submissionDate = new Date(item.date);
              gracePeriodEndDate = addMinutes(submissionDate, gracePeriodMinutes);
              isEditableByUser = isAfter(gracePeriodEndDate, new Date());
              if (isEditableByUser) {
                timeRemainingStr = formatRemainingTime(gracePeriodEndDate);
              }
            }

            return (
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
              {type === 'pending' && (
                <TableCell className="text-center">
                  {isEditableByUser && gracePeriodEndDate ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center text-yellow-500">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{t('adminTestimonialsPage.status.pending')}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('adminTestimonialsPage.tooltip.userCanEditUntil', { date: format(gracePeriodEndDate, 'Pp', { locale: currentLocale }) })}</p>
                          <p>{t('adminTestimonialsPage.tooltip.timeRemaining', { time: timeRemainingStr })}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span>{t('adminTestimonialsPage.status.pending')}</span>
                  )}
                </TableCell>
              )}
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
          )})
        )}
      </TableBody>
    </Table>
  )};
  
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
    