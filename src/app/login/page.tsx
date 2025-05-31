
'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Film, MailCheck, Send, Loader2 } from 'lucide-react';
import { getUserByEmailForLogin, verifyUserActivationToken, resendActivationToken } from '@/lib/actions';
import type { UserProfile, SessionUserProfile } from '@/lib/types';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/I18nContext';

const loginFormSchema = z.object({
  email: z.string().email({ message: 'Por favor ingresa un email válido.' }),
  password: z.string().min(1, { message: 'La contraseña es requerida.' }),
});

const tokenFormSchema = z.object({
  activationToken: z.string().length(24, { message: 'El token debe tener 24 caracteres.' }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;
type TokenFormValues = z.infer<typeof tokenFormSchema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [currentUserForActivation, setCurrentUserForActivation] = useState<UserProfile | null>(null);
  const [isResendingToken, setIsResendingToken] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);


  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const tokenForm = useForm<TokenFormValues>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: { activationToken: '' },
  });

  const dispatchLoginStatusChangedEvent = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('aurumLoginStatusChanged'));
    }
  };

  async function onLoginSubmit(data: LoginFormValues) {
    setIsLoggingIn(true);
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem('aurum_is_admin_logged_in');
        sessionStorage.removeItem('aurum_user_id');
        sessionStorage.removeItem('aurum_user_profile');
    }

    try {
      const user = await getUserByEmailForLogin(data.email);

      if (!user) {
        toast({ title: t('loginPage.toasts.loginErrorTitle'), description: t('loginPage.toasts.incorrectCredentials'), variant: 'destructive' });
        setIsLoggingIn(false);
        dispatchLoginStatusChangedEvent();
        return;
      }

      const passwordMatch = data.password === user.passwordHash;

      if (!passwordMatch) {
        toast({ title: t('loginPage.toasts.loginErrorTitle'), description: t('loginPage.toasts.incorrectCredentials'), variant: 'destructive' });
        setIsLoggingIn(false);
        dispatchLoginStatusChangedEvent();
        return;
      }

      if (!user.isVerified) {
        setCurrentUserForActivation(user);
        tokenForm.reset({ activationToken: '' });
        setShowTokenForm(true);
        toast({ title: t('loginPage.toasts.unverifiedAccountTitle'), description: t('loginPage.toasts.enterActivationToken') });
        setIsLoggingIn(false);
        dispatchLoginStatusChangedEvent();
        return;
      }

      if (!user.isActive) {
        toast({ title: t('loginPage.toasts.inactiveAccountTitle'), description: t('loginPage.toasts.contactSupport'), variant: 'destructive' });
        setIsLoggingIn(false);
        dispatchLoginStatusChangedEvent();
        return;
      }

      toast({ title: t('loginPage.toasts.loginSuccessTitle'), description: t('loginPage.toasts.welcomeBack') });

      if (user.role === 'admin') {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('aurum_is_admin_logged_in', 'true');
            const adminProfile: SessionUserProfile = { id: user.id, name: user.name, surname: user.surname, email: user.email, role: 'admin' };
            sessionStorage.setItem('aurum_user_profile', JSON.stringify(adminProfile));
        }
        router.push('/admin');
      } else {
         if (typeof window !== 'undefined') {
            sessionStorage.setItem('aurum_user_id', user.id);
            const userProfile: SessionUserProfile = { id: user.id, name: user.name, surname: user.surname, email: user.email, role: 'user' };
            sessionStorage.setItem('aurum_user_profile', JSON.stringify(userProfile));
        }
        router.push('/account'); // Redirect regular user to their account page
      }
      dispatchLoginStatusChangedEvent();

    } catch (error) {
      toast({ title: t('loginPage.toasts.errorTitle'), description: t('loginPage.toasts.unexpectedError'), variant: 'destructive' });
      dispatchLoginStatusChangedEvent();
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function onTokenSubmit(data: TokenFormValues) {
    if (!currentUserForActivation) return;
    setIsVerifyingToken(true);
    try {
      const result = await verifyUserActivationToken(currentUserForActivation.id, data.activationToken);
      if (result.success) {
        toast({ title: t('loginPage.toasts.activationSuccessTitle'), description: result.message });
        setShowTokenForm(false);
        setCurrentUserForActivation(null);
        loginForm.reset();
        tokenForm.reset({ activationToken: '' });
      } else {
        toast({ title: t('loginPage.toasts.activationErrorTitle'), description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('loginPage.toasts.errorTitle'), description: t('loginPage.toasts.tokenVerificationError'), variant: 'destructive' });
    } finally {
      setIsVerifyingToken(false);
    }
  }

  async function handleResendToken() {
    if (!currentUserForActivation) return;
    setIsResendingToken(true);
    try {
      const result = await resendActivationToken(currentUserForActivation.email);
      if (result.success) {
        toast({ title: t('loginPage.toasts.tokenResentTitle'), description: result.message });
      } else {
        toast({ title: t('loginPage.toasts.resendErrorTitle'), description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('loginPage.toasts.errorTitle'), description: t('loginPage.toasts.tokenResendError'), variant: 'destructive' });
    } finally {
      setIsResendingToken(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md shadow-xl border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
                <Film className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl text-primary">
              {showTokenForm ? t('loginPage.activateAccountTitle') : t('loginPage.welcomeBackTitle')}
            </CardTitle>
            <CardDescription>
              {showTokenForm
                ? t('loginPage.enterTokenDescription')
                : t('loginPage.loginToAccessDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showTokenForm ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                  <FormField control={loginForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('loginPage.emailLabel')}</FormLabel>
                      <FormControl><Input type="email" placeholder={t('loginPage.emailPlaceholder')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={loginForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('loginPage.passwordLabel')}</FormLabel>
                      <FormControl><PasswordInput placeholder="••••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={isLoggingIn}>
                    {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoggingIn ? t('loginPage.loggingInButton') : t('loginPage.loginButton')}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...tokenForm} key={showTokenForm ? "token-form-visible" : "token-form-hidden"}>
                <form key="inner-token-form-element" onSubmit={tokenForm.handleSubmit(onTokenSubmit)} className="space-y-6">
                  <FormField control={tokenForm.control} name="activationToken" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('loginPage.activationTokenLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('loginPage.activationTokenPlaceholder')}
                          {...field}
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={isVerifyingToken}>
                    {isVerifyingToken && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <MailCheck className="mr-2 h-4 w-4" />
                    {isVerifyingToken ? t('loginPage.verifyingButton') : t('loginPage.activateAccountButton')}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={handleResendToken} disabled={isResendingToken}>
                    {isResendingToken && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     <Send className="mr-2 h-4 w-4" />
                    {isResendingToken ? t('loginPage.resendingTokenButton') : t('loginPage.resendTokenButton')}
                  </Button>
                   <Button type="button" variant="link" className="w-full" onClick={() => { setShowTokenForm(false); setCurrentUserForActivation(null); loginForm.reset(); tokenForm.reset({ activationToken: '' }); }}>
                    {t('loginPage.backToLoginButton')}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          {!showTokenForm && (
            <CardFooter className="flex flex-col items-center space-y-2">
              <Link href="#" className="text-sm text-primary hover:underline">
                {t('loginPage.forgotPasswordLink')}
              </Link>
              <p className="text-sm text-muted-foreground">
                {t('loginPage.noAccountPrompt')}{' '}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  {t('loginPage.registerHereLink')}
                </Link>
              </p>
            </CardFooter>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
