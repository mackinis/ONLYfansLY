
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
// import { updateUserOwnTestimonial } from '@/lib/actions'; // Removed direct import
import type { Testimonial, SiteSettings, TestimonialMediaOption } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const editTestimonialFormSchema = z.object({
  text: z.string().min(10, "Testimonial must be at least 10 characters.").max(500),
  photoUrlsInput: z.string().optional(),
  videoUrlsInput: z.string().optional(),
});

type EditTestimonialFormValues = z.infer<typeof editTestimonialFormSchema>;

interface EditTestimonialFormProps {
  testimonial: Testimonial;
  onSuccessfulEdit: () => void;
  siteSettings: SiteSettings;
}

export default function EditTestimonialForm({ testimonial, onSuccessfulEdit, siteSettings }: EditTestimonialFormProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveMediaOptions = siteSettings.testimonialMediaOptions || 'both';

  const form = useForm<EditTestimonialFormValues>({
    resolver: zodResolver(editTestimonialFormSchema),
    defaultValues: {
      text: testimonial.text || '',
      photoUrlsInput: testimonial.photoUrls?.join(', ') || '',
      videoUrlsInput: testimonial.videoUrls?.join(', ') || '',
    },
  });

  useEffect(() => {
    form.reset({
        text: testimonial.text || '',
        photoUrlsInput: testimonial.photoUrls?.join(', ') || '',
        videoUrlsInput: testimonial.videoUrls?.join(', ') || '',
    });
  }, [testimonial, form]);

  async function onSubmit(data: EditTestimonialFormValues) {
    setIsSubmitting(true);
    try {
      const payload = {
        text: data.text,
        photoUrlsInput: (effectiveMediaOptions === 'photos' || effectiveMediaOptions === 'both') ? data.photoUrlsInput : undefined,
        videoUrlsInput: (effectiveMediaOptions === 'videos' || effectiveMediaOptions === 'both') ? data.videoUrlsInput : undefined,
        userId: testimonial.userId, // Important for authorization on the backend
      };

      const response = await fetch(`/api/testimonials/${testimonial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: t('editTestimonialModal.toast.successTitle'),
          description: t('editTestimonialModal.toast.successDescription'),
        });
        onSuccessfulEdit();
      } else {
        toast({
          title: t('editTestimonialModal.toast.errorTitle'),
          description: result.message || t('editTestimonialModal.toast.errorDescription'),
          variant: 'destructive',
        });
      }
    } catch (error) {
        toast({
          title: t('editTestimonialModal.toast.errorTitle'),
          description: t('editTestimonialModal.toast.errorDescription'),
          variant: 'destructive',
        });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const showPhotoInput = effectiveMediaOptions === 'photos' || effectiveMediaOptions === 'both';
  const showVideoInput = effectiveMediaOptions === 'videos' || effectiveMediaOptions === 'both';

  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-md border p-4 shadow-sm bg-background text-card-foreground">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('testimonialForm.yourTestimonial')}</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={4} className="resize-none bg-background/90" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {showPhotoInput && (
            <FormField
              control={form.control}
              name="photoUrlsInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('testimonialForm.photoUrlsLabel')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder={t('testimonialForm.photoUrlsPlaceholder')} className="resize-none bg-background/90" />
                  </FormControl>
                  <FormDescription>{t('testimonialForm.urlsHelperText')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {showVideoInput && (
            <FormField
              control={form.control}
              name="videoUrlsInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('testimonialForm.videoUrlsLabel')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder={t('testimonialForm.videoUrlsPlaceholder')} className="resize-none bg-background/90" />
                  </FormControl>
                  <FormDescription>{t('testimonialForm.urlsHelperText')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
           {(effectiveMediaOptions === 'none' && !showPhotoInput && !showVideoInput) && (
            <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">{t('testimonialForm.mediaSubmissionDisabled')}</p>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isSubmitting}>
                {t('editTestimonialModal.cancelButton')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? t('editTestimonialModal.savingButton') : t('editTestimonialModal.saveButton')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
