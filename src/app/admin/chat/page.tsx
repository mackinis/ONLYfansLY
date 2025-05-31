
'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadFormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Save, Loader2, HelpCircle, Paperclip, Smile, Moon, Sun, Phone, Send, ThumbsUp, Heart, Star, Bell } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { updateSiteSettings } from '@/lib/actions';
import type { SiteSettings } from '@/lib/types';
import { useTranslation } from '@/context/I18nContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const phoneRegex = /^\+?[1-9]\d{1,14}$/; // Simple regex for international phone numbers

const chatSettingsFormSchema = z.object({
  whatsAppEnabled: z.boolean().default(false),
  whatsAppPhoneNumber: z.string().refine(value => value === '' || phoneRegex.test(value), {
    message: "Número de teléfono inválido. Incluye código de país, ej: +5491122334455",
  }).optional().or(z.literal('')),
  whatsAppDefaultMessage: z.string().optional().default(""),
  whatsAppIcon: z.string().default('default'), // 'default', 'customUrl', or lucide-react icon name
  whatsAppCustomIconUrl: z.string().url({ message: "Debe ser una URL válida." }).optional().or(z.literal('')),
  whatsAppButtonSize: z.coerce.number().int().positive({ message: "Debe ser un número positivo." }).min(30).max(100).default(56),
  whatsAppIconSize: z.coerce.number().int().positive({ message: "Debe ser un número positivo." }).min(10).max(60).default(28),
}).refine(data => !data.whatsAppEnabled || (data.whatsAppEnabled && data.whatsAppPhoneNumber !== ''), {
    message: "El número de teléfono de WhatsApp es obligatorio si el chat está habilitado.",
    path: ["whatsAppPhoneNumber"],
});

type ChatSettingsFormValues = z.infer<typeof chatSettingsFormSchema>;

const lucideIconOptions = [
  { value: 'Paperclip', labelKey: 'adminChatPage.iconOptions.paperclip', Icon: Paperclip },
  { value: 'Smile', labelKey: 'adminChatPage.iconOptions.smile', Icon: Smile },
  { value: 'Moon', labelKey: 'adminChatPage.iconOptions.moon', Icon: Moon },
  { value: 'Sun', labelKey: 'adminChatPage.iconOptions.sun', Icon: Sun },
  { value: 'Phone', labelKey: 'adminChatPage.iconOptions.phone', Icon: Phone },
  { value: 'Send', labelKey: 'adminChatPage.iconOptions.send', Icon: Send },
  { value: 'HelpCircle', labelKey: 'adminChatPage.iconOptions.helpCircle', Icon: HelpCircle },
  { value: 'MessageCircle', labelKey: 'adminChatPage.iconOptions.messageCircle', Icon: MessageSquare },
  { value: 'ThumbsUp', labelKey: 'adminChatPage.iconOptions.thumbsUp', Icon: ThumbsUp },
  { value: 'Heart', labelKey: 'adminChatPage.iconOptions.heart', Icon: Heart },
  { value: 'Star', labelKey: 'adminChatPage.iconOptions.star', Icon: Star },
  { value: 'Bell', labelKey: 'adminChatPage.iconOptions.bell', Icon: Bell },
];


export default function AdminChatSettingsPage() {
  const { t, siteSettings: currentGlobalSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ChatSettingsFormValues>({
    resolver: zodResolver(chatSettingsFormSchema),
    defaultValues: {
      whatsAppEnabled: false,
      whatsAppPhoneNumber: '',
      whatsAppDefaultMessage: '',
      whatsAppIcon: 'default',
      whatsAppCustomIconUrl: '',
      whatsAppButtonSize: 56,
      whatsAppIconSize: 28,
    },
  });

  const watchedWhatsAppIcon = form.watch('whatsAppIcon');

  useEffect(() => {
    if (currentGlobalSettings) {
      form.reset({
        whatsAppEnabled: currentGlobalSettings.whatsAppEnabled || false,
        whatsAppPhoneNumber: currentGlobalSettings.whatsAppPhoneNumber || '',
        whatsAppDefaultMessage: currentGlobalSettings.whatsAppDefaultMessage || '',
        whatsAppIcon: currentGlobalSettings.whatsAppIcon || 'default',
        whatsAppCustomIconUrl: currentGlobalSettings.whatsAppCustomIconUrl || '',
        whatsAppButtonSize: currentGlobalSettings.whatsAppButtonSize || 56,
        whatsAppIconSize: currentGlobalSettings.whatsAppIconSize || 28,
      });
    }
  }, [currentGlobalSettings, form]);

  async function onSubmit(data: ChatSettingsFormValues) {
    setIsSubmitting(true);
    try {
      const result = await updateSiteSettings({
          whatsAppEnabled: data.whatsAppEnabled,
          whatsAppPhoneNumber: data.whatsAppPhoneNumber,
          whatsAppDefaultMessage: data.whatsAppDefaultMessage,
          whatsAppIcon: data.whatsAppIcon,
          whatsAppCustomIconUrl: data.whatsAppIcon === 'customUrl' ? data.whatsAppCustomIconUrl : '', // Clear if not custom
          whatsAppButtonSize: data.whatsAppButtonSize,
          whatsAppIconSize: data.whatsAppIconSize,
      });

      if (result.success && result.updatedSettings) {
        toast({ title: t('adminChatPage.toasts.updateSuccessTitle'), description: t('adminChatPage.toasts.updateSuccessDescription') });
        await refreshSiteSettings(); 
      } else {
        toast({ title: t('adminChatPage.toasts.updateErrorTitle'), description: result.message || t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
         if (result.errors) {
            Object.entries(result.errors).forEach(([field, errors]) => {
             if (errors && errors.length > 0) {
                form.setError(field as keyof ChatSettingsFormValues, { message: errors[0] as string });
             }
          });
        }
      }
    } catch (error) {
      toast({ title: t('adminChatPage.toasts.updateErrorTitle'), description: error instanceof Error ? error.message : t('adminAccountPage.toasts.genericError'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isLoadingSettings || !currentGlobalSettings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <MessageSquare className="mr-3 h-8 w-8" /> {t('adminChatPage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminChatPage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('adminChatPage.cardDescription')}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              <FormField control={form.control} name="whatsAppEnabled" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t('adminChatPage.form.enableWhatsApp')}</FormLabel>
                    <ShadFormDescription>{t('adminChatPage.form.enableWhatsAppDescription')}</ShadFormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )} />

              {form.watch('whatsAppEnabled') && (
                <>
                  <FormField control={form.control} name="whatsAppPhoneNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminChatPage.form.phoneNumber')}</FormLabel>
                      <FormControl><Input placeholder={t('adminChatPage.form.phoneNumberPlaceholder')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="whatsAppDefaultMessage" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('adminChatPage.form.defaultMessage')}</FormLabel>
                      <FormControl><Textarea placeholder={t('adminChatPage.form.defaultMessagePlaceholder')} rows={3} {...field} /></FormControl>
                      <ShadFormDescription>{t('adminChatPage.form.defaultMessageDescription')}</ShadFormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  
                  <FormField
                    control={form.control}
                    name="whatsAppIcon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('adminChatPage.form.iconType')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('adminChatPage.form.iconTypePlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="default">{t('adminChatPage.iconOptions.default')}</SelectItem>
                            <SelectItem value="customUrl">{t('adminChatPage.iconOptions.customUrl')}</SelectItem>
                            {lucideIconOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center">
                                  <opt.Icon className="mr-2 h-4 w-4" />
                                  {t(opt.labelKey)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedWhatsAppIcon === 'customUrl' && (
                    <FormField control={form.control} name="whatsAppCustomIconUrl" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center">
                          <FormLabel>{t('adminChatPage.form.customIconUrl')}</FormLabel>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger type="button" className="ml-2">
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p>{t('adminChatPage.form.customIconUrlTooltip')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <FormControl><Input placeholder="https://example.com/icon.png" {...field} /></FormControl>
                        <ShadFormDescription>{t('adminChatPage.form.customIconUrlDescription')}</ShadFormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="whatsAppButtonSize" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('adminChatPage.form.buttonSize')}</FormLabel>
                        <FormControl><Input type="number" placeholder="56" {...field} /></FormControl>
                        <ShadFormDescription>{t('adminChatPage.form.buttonSizeDescription')}</ShadFormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="whatsAppIconSize" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('adminChatPage.form.iconSize')}</FormLabel>
                        <FormControl><Input type="number" placeholder="28" {...field} /></FormControl>
                        <ShadFormDescription>{t('adminChatPage.form.iconSizeDescription')}</ShadFormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> {t('adminChatPage.saveButton')}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
