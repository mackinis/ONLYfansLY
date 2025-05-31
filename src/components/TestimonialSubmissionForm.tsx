
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
import { submitTestimonial } from '@/lib/actions';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SessionUserProfile } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const testimonialFormSchema = z.object({
  author: z.string().min(2).max(50),
  text: z.string().min(10).max(500),
  email: z.string().email(),
  userId: z.string().min(1),
  photoUrlsInput: z.string().optional(),
  videoUrlsInput: z.string().optional(),
});

type TestimonialFormValues = z.infer<typeof testimonialFormSchema>;

// Interface to include isOpen, matching the TestimonialModal's usage
interface TestimonialSubmissionFormProps {
  isOpen?: boolean;
}

export default function TestimonialSubmissionForm({ isOpen }: TestimonialSubmissionFormProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loggedInUser, setLoggedInUser] = useState<SessionUserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const form = useForm<TestimonialFormValues>({
    resolver: zodResolver(testimonialFormSchema),
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
    // Only re-initialize if the modal is being opened or if isOpen prop is explicitly managed
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
            // Reset to empty if parsing fails
            form.reset({ author: '', text: '', email: '', userId: '', photoUrlsInput: '', videoUrlsInput: '' });
          }
        } else {
          setLoggedInUser(null);
          // Reset to empty if no user profile in session
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

    const result = await submitTestimonial({
      author: `${loggedInUser.name} ${loggedInUser.surname}`,
      email: loggedInUser.email,
      userId: loggedInUser.id,
      text: data.text,
      photoUrlsInput: data.photoUrlsInput,
      videoUrlsInput: data.videoUrlsInput,
    });

    if (result.success) {
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
  }
  
  // If isOpen is explicitly false, don't render the form (matches behavior of modal controlling visibility)
  if (isOpen === false) return null;


  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center py-4 h-[60vh]"> {/* Match height if form is not rendered */}
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p>{t('testimonialForm.loadingUser')}</p>
      </div>
    );
  }

  if (!loggedInUser) {
    return (
      <div className="text-center py-4 h-[60vh] flex flex-col items-center justify-center"> {/* Match height */}
        <p className="mb-4 text-lg">{t('testimonialForm.loginToSubmit')}</p>
        <Button asChild size="lg">
          <Link href="/login">{t('header.login')}</Link>
        </Button>
      </div>
    );
  }

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

    