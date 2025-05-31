
'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Film, Loader2 } from 'lucide-react';
import { registerUser } from '@/lib/actions';
import { useRouter } from 'next/navigation'; // Import useRouter
import { useTranslation } from '@/context/I18nContext';

const registerFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  surname: z.string().min(2, { message: "El apellido debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor ingresa un email válido." }),
  phone: z.string().min(1, { message: "El teléfono es requerido." }),
  dni: z.string().min(1, { message: "El DNI es requerido." }),
  address: z.string().min(1, { message: "La dirección es requerida." }),
  postalCode: z.string().min(1, { message: "El código postal es requerido." }),
  city: z.string().min(1, { message: "La ciudad es requerida." }),
  province: z.string().min(1, { message: "La provincia es requerida." }),
  country: z.string().min(1, { message: "El país es requerido." }),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres." }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const { toast } = useToast();
  const router = useRouter(); // Initialize router
  const { t } = useTranslation(); // For form labels

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: '',
      surname: '',
      email: '',
      phone: '',
      dni: '',
      address: '',
      postalCode: '',
      city: '',
      province: '',
      country: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: RegisterFormValues) {
    form.clearErrors(); 
    try {
      const { confirmPassword, ...submissionData } = data;
      const result = await registerUser(submissionData);

      if (result.success) {
        toast({
          title: t('registerPage.toasts.successTitle', {defaultValue: 'Registro Exitoso'}),
          description: result.message || t('registerPage.toasts.successDescription', {defaultValue: 'Revisa tu correo para activar tu cuenta.'}),
        });
        form.reset();
        router.push('/'); // Redirect to homepage
      } else {
        toast({
          title: t('registerPage.toasts.errorTitle', {defaultValue: 'Error en el Registro'}),
          description: result.message || t('registerPage.toasts.errorDescription', {defaultValue: 'No se pudo completar el registro.'}),
          variant: 'destructive',
        });
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, errors]) => {
            if (errors && errors.length > 0) {
              form.setError(field as keyof RegisterFormValues, { message: errors[0] });
            }
          });
        } else if (result.message && result.message.toLowerCase().includes('correo electrónico ya está registrado')) {
           form.setError('email', { message: result.message });
        }
      }
    } catch (error) {
      toast({
        title: t('registerPage.toasts.unexpectedErrorTitle', {defaultValue: 'Error Inesperado'}),
        description: t('registerPage.toasts.unexpectedErrorDescription', {defaultValue: 'Ocurrió un error. Por favor, inténtalo de nuevo.'}),
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow flex items-center justify-center py-8 px-4">
        <Card className="w-full max-w-2xl shadow-xl border-primary/20">
          <CardHeader className="text-center">
             <div className="mx-auto mb-4">
                <Film className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl text-primary">{t('registerPage.title', {defaultValue: 'Crea Tu Cuenta'})}</CardTitle>
            <CardDescription>{t('registerPage.description', {defaultValue: 'Únete a Aurum Media y desbloquea contenido exclusivo.'})}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[55vh] pr-6"> {/* Increased height slightly */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>{t('registerPage.form.name', {defaultValue: 'Nombre'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.namePlaceholder', {defaultValue: 'Juan'})} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="surname" render={({ field }) => (
                      <FormItem><FormLabel>{t('registerPage.form.surname', {defaultValue: 'Apellido'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.surnamePlaceholder', {defaultValue: 'Pérez'})} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>{t('registerPage.form.email', {defaultValue: 'Email'})}</FormLabel><FormControl><Input type="email" placeholder={t('registerPage.form.emailPlaceholder', {defaultValue: 'tu@ejemplo.com'})} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>{t('registerPage.form.phone', {defaultValue: 'Teléfono'})}</FormLabel><FormControl><Input type="tel" placeholder={t('registerPage.form.phonePlaceholder', {defaultValue: '+54911...'})} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="dni" render={({ field }) => (
                      <FormItem><FormLabel>{t('registerPage.form.dni', {defaultValue: 'DNI'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.dniPlaceholder', {defaultValue: '12345678'})} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem><FormLabel>{t('registerPage.form.address', {defaultValue: 'Dirección'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.addressPlaceholder', {defaultValue: 'Av. Siempre Viva 123'})} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField control={form.control} name="postalCode" render={({ field }) => (
                      <FormItem><FormLabel>{t('registerPage.form.postalCode', {defaultValue: 'Código Postal'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.postalCodePlaceholder', {defaultValue: 'C1414'})} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem><FormLabel>{t('registerPage.form.city', {defaultValue: 'Ciudad'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.cityPlaceholder', {defaultValue: 'Tu Ciudad'})} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="province" render={({ field }) => (
                      <FormItem><FormLabel>{t('registerPage.form.province', {defaultValue: 'Provincia'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.provincePlaceholder', {defaultValue: 'Tu Provincia'})} {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                   <FormField control={form.control} name="country" render={({ field }) => (
                    <FormItem><FormLabel>{t('registerPage.form.country', {defaultValue: 'País'})}</FormLabel><FormControl><Input placeholder={t('registerPage.form.countryPlaceholder', {defaultValue: 'Tu País'})} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>{t('registerPage.form.password', {defaultValue: 'Contraseña'})}</FormLabel><FormControl><PasswordInput placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem><FormLabel>{t('registerPage.form.confirmPassword', {defaultValue: 'Confirmar Contraseña'})}</FormLabel><FormControl><PasswordInput placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || form.formState.isLoading}>
                    {(form.formState.isSubmitting || form.formState.isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {form.formState.isSubmitting ? t('registerPage.submittingButton', {defaultValue: 'Creando Cuenta...'}) : t('registerPage.submitButton', {defaultValue: 'Crear Cuenta'})}
                  </Button>
                </form>
              </Form>
            </ScrollArea>
          </CardContent>
           <CardFooter className="flex flex-col items-center">
            <p className="text-sm text-muted-foreground">
              {t('registerPage.alreadyHaveAccount', {defaultValue: '¿Ya tienes una cuenta?'})}{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                {t('registerPage.loginLink', {defaultValue: 'Inicia Sesión'})}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
