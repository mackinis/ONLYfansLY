
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
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/context/I18nContext';
// Removed: import { submitTestimonial } from '@/lib/actions';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SessionUserProfile, TestimonialMediaOption } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { testimonialSubmitSchema } from '@/lib/actions'; // Import schema

type TestimonialFormValues = z.infer<typeof testimonialSubmitSchema>;

interface TestimonialSubmissionFormProps {
  isOpen?: boolean;
}

export default function TestimonialSubmissionForm({ isOpen }: TestimonialSubmissionFormProps) {
  const { toast } = useToast();
  const { t, siteSettings, isLoadingSettings } = useTranslation();
  const [loggedInUser, setLoggedInUser] = useState<SessionUserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [effectiveMediaOptions, setEffectiveMediaOptions] = useState<TestimonialMediaOption>('both');

  const form = useForm<TestimonialFormValues>({
    resolver: zodResolver(testimonialSubmitSchema),
    defaultValues: {
      author: '',
      text: '',
      email: '',
      userId: '',
      photoUrlsInput: '',
      videoUrlsInput: '',
    },
  });

  useEffect(() => {
    if (!isLoadingSettings && siteSettings) {
      setEffectiveMediaOptions(siteSettings.testimonialMediaOptions || 'both');
    }
  }, [siteSettings, isLoadingSettings]);

  useEffect(() => {
    if (isOpen === undefined || isOpen) {
      setIsLoadingUser(true);
      if (typeof window !== 'undefined') {
        const storedUserProfile = sessionStorage.getItem('aurum_user_profile');
        if (storedUserProfile) {
          try {
            const user = JSON.parse(storedUserProfile) as SessionUserProfile;
            setLoggedInUser(user);
            form.reset({
              author: `${user.name} ${user.surname}`,
              email: user.email,
              userId: user.id,
              text: '',
              photoUrlsInput: '',
              videoUrlsInput: '',
            });
          } catch (e) {
            console.error("Failed to parse user profile", e);
            setLoggedInUser(null);
            form.reset({ author: '', text: '', email: '', userId: '', photoUrlsInput: '', videoUrlsInput: '' });
          }
        } else {
          setLoggedInUser(null);
          form.reset({ author: '', text: '', email: '', userId: '', photoUrlsInput: '', videoUrlsInput: '' });
        }
      }
      setIsLoadingUser(false);
    }
  }, [form, isOpen]);

  async function onSubmit(data: TestimonialFormValues) {
    if (!loggedInUser) {
      toast({
        title: t('testimonialForm.toast.loginRequiredTitle'),
        description: t('testimonialForm.toast.loginRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    const submissionData = {
      author: `${loggedInUser.name} ${loggedInUser.surname}`,
      email: loggedInUser.email,
      userId: loggedInUser.id,
      text: data.text,
      photoUrlsInput: (effectiveMediaOptions === 'photos' || effectiveMediaOptions === 'both') ? data.photoUrlsInput : undefined,
      videoUrlsInput: (effectiveMediaOptions === 'videos' || effectiveMediaOptions === 'both') ? data.videoUrlsInput : undefined,
    };

    try {
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });
      const result = await response.json();

      if (response.ok) {
        toast({
          title: t('testimonialForm.toast.successTitle'),
          description: t('testimonialForm.toast.successDescription'),
        });
        form.reset({
          author: `${loggedInUser.name} ${loggedInUser.surname}`,
          email: loggedInUser.email,
          userId: loggedInUser.id,
          text: '',
          photoUrlsInput: '',
          videoUrlsInput: '',
        });
      } else {
        toast({
          title: t('testimonialForm.toast.errorTitle'),
          description: result.message || t('testimonialForm.toast.errorDescription'),
          variant: 'destructive',
        });
      }
    } catch (error) {
        toast({
          title: t('testimonialForm.toast.errorTitle'),
          description: t('testimonialForm.toast.genericError'),
          variant: 'destructive',
        });
    }
  }

  if (isOpen === false) return null;


  if (isLoadingUser || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center py-4 h-[60vh]">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p>{t('testimonialForm.loadingUser')}</p>
      </div>
    );
  }

  if (!loggedInUser) {
    return (
      <div className="text-center py-4 h-[60vh] flex flex-col items-center justify-center">
        <p className="mb-4 text-lg">{t('testimonialForm.loginToSubmit')}</p>
        <Button asChild size="lg">
          <Link href="/login">{t('header.login')}</Link>
        </Button>
      </div>
    );
  }

  const showPhotoInput = effectiveMediaOptions === 'photos' || effectiveMediaOptions === 'both';
  const showVideoInput = effectiveMediaOptions === 'videos' || effectiveMediaOptions === 'both';

  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-md border p-4 shadow-sm bg-card text-card-foreground">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="author"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('testimonialForm.yourName')}</FormLabel>
                <FormControl>
                  <Input {...field} readOnly className="bg-muted/50 cursor-not-allowed" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('testimonialForm.yourEmail')}</FormLabel>
                <FormControl>
                  <Input type="email" {...field} readOnly className="bg-muted/50 cursor-not-allowed" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('testimonialForm.yourTestimonial')}</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} className="resize-none bg-background/90" />
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
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form.formState.isSubmitting
              ? t('testimonialForm.submitting')
              : t('testimonialForm.submitTestimonial')}
          </Button>
        </form>
      </Form>
    </div>
  );
}

    