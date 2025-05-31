
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DollarSign, Settings, Save, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/context/I18nContext';
import type { SiteSettings, ActiveCurrencySetting, CurrencyDefinition, ExchangeRates } from '@/lib/types';
import { updateSiteSettings } from '@/lib/actions';

// Define all supported currencies by the platform
const SUPPORTED_CURRENCIES: CurrencyDefinition[] = [
  { id: 'ars', code: 'ARS', name: 'Argentine Peso', symbol: 'AR$' },
  { id: 'usd', code: 'USD', name: 'US Dollar', symbol: 'US$' },
  { id: 'eur', code: 'EUR', name: 'Euro', symbol: '€' },
];

export default function CurrenciesAdminPage() {
  const { t, siteSettings: currentGlobalSettings, refreshSiteSettings, isLoadingSettings } = useTranslation();
  const { toast } = useToast();

  const [localActiveCurrencies, setLocalActiveCurrencies] = useState<ActiveCurrencySetting[]>([]);
  const [localExchangeRates, setLocalExchangeRates] = useState<ExchangeRates>({ usdToArs: 1000, eurToArs: 1100 });
  const [localAllowUserToChooseCurrency, setLocalAllowUserToChooseCurrency] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initializeLocalState = useCallback(() => {
    if (currentGlobalSettings) {
      setLocalActiveCurrencies(
        SUPPORTED_CURRENCIES.map(def => {
          const activeSetting = currentGlobalSettings.activeCurrencies.find(ac => ac.id === def.id);
          return {
            id: def.id,
            code: def.code,
            name: def.name,
            symbol: def.symbol,
            isPrimary: activeSetting ? activeSetting.isPrimary : (def.id === 'ars' && !currentGlobalSettings.activeCurrencies.some(ac => ac.isPrimary)), 
          };
        }).filter(c => currentGlobalSettings.activeCurrencies.some(ac => ac.id === c.id)) // Only include locally if active in global
      );
      // Ensure at least ARS is active and primary if no active currencies are defined or no primary is set.
      if (!localActiveCurrencies.some(c => c.isPrimary) || localActiveCurrencies.length === 0) {
        const arsDef = SUPPORTED_CURRENCIES.find(c => c.id === 'ars')!;
        setLocalActiveCurrencies(prev => {
            const arsExists = prev.find(c => c.id === 'ars');
            if(arsExists) {
                return prev.map(c => ({...c, isPrimary: c.id === 'ars'}));
            }
            return [...prev, {...arsDef, isPrimary: true}];
        });
      }


      setLocalExchangeRates(currentGlobalSettings.exchangeRates || { usdToArs: 1000, eurToArs: 1100 });
      setLocalAllowUserToChooseCurrency(currentGlobalSettings.allowUserToChooseCurrency);
    }
  }, [currentGlobalSettings]);


  useEffect(() => {
    if (!isLoadingSettings && currentGlobalSettings) { // Ensure global settings are loaded
      initializeLocalState();
    }
  }, [isLoadingSettings, currentGlobalSettings, initializeLocalState]);


  const handleToggleActive = (id: string) => {
    setLocalActiveCurrencies(prev => {
      const currencyDef = SUPPORTED_CURRENCIES.find(c => c.id === id);
      if (!currencyDef) return prev;

      const isCurrentlyActive = prev.some(c => c.id === id);

      if (isCurrentlyActive) { // Deactivating
        if (prev.length <= 1) {
          toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: t('adminCurrenciesPage.toasts.atLeastOneActiveError'), variant: 'destructive' });
          return prev;
        }
        if (prev.find(c => c.id === id)?.isPrimary) {
            toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: t('adminCurrenciesPage.toasts.cannotDeactivatePrimaryError'), variant: 'destructive' });
            return prev;
        }
        return prev.filter(c => c.id !== id);
      } else { // Activating
        return [...prev, { ...currencyDef, isPrimary: false }];
      }
    });
  };
  
  const handleSetPrimary = (id: string) => {
     if (id !== 'ars') {
        toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: t('adminCurrenciesPage.toasts.primaryMustBeArsError'), variant: 'destructive' });
        return;
    }
    setLocalActiveCurrencies(prevSettings =>
      prevSettings.map(currency => ({
        ...currency,
        isPrimary: currency.id === id,
      }))
    );
  };

  const handleRateChange = (key: keyof ExchangeRates, value: string) => {
    const numValue = parseFloat(value);
    setLocalExchangeRates(prevRates => ({
      ...prevRates,
      [key]: isNaN(numValue) || numValue <= 0 ? 0 : numValue, 
    }));
  };

  const handleSaveChanges = async () => {
    const primaryCurrency = localActiveCurrencies.find(c => c.isPrimary);
    if (!primaryCurrency) {
      toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: t('adminCurrenciesPage.toasts.selectPrimaryError'), variant: "destructive" });
      return;
    }
    if (primaryCurrency.id !== 'ars') {
        toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: t('adminCurrenciesPage.toasts.primaryMustBeArsError'), variant: "destructive" });
        return;
    }

    if (localExchangeRates.usdToArs <= 0 || localExchangeRates.eurToArs <= 0) {
      toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: t('adminCurrenciesPage.toasts.ratesMustBePositiveError'), variant: "destructive"});
      return;
    }
    if (localActiveCurrencies.length === 0) {
        toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: t('adminCurrenciesPage.toasts.atLeastOneActiveError'), variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    const settingsToUpdate: Partial<SiteSettings> = {
      activeCurrencies: localActiveCurrencies, // Save the full local list
      exchangeRates: localExchangeRates,
      allowUserToChooseCurrency: localAllowUserToChooseCurrency,
    };

    const result = await updateSiteSettings(settingsToUpdate);
    if (result.success) {
      toast({
        title: t('adminCurrenciesPage.toasts.settingsSavedTitle'),
        description: t('adminCurrenciesPage.toasts.settingsSavedUpdatedDescription'),
      });
      await refreshSiteSettings(); 
    } else {
      toast({ title: t('adminCurrenciesPage.toasts.errorTitle'), description: result.message || t('adminCurrenciesPage.toasts.genericErrorDescription'), variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (isLoadingSettings || !currentGlobalSettings) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-primary flex items-center">
          <DollarSign className="mr-3 h-8 w-8" /> {t('adminCurrenciesPage.title')}
        </h1>
      </div>

      <Card className="shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">{t('adminCurrenciesPage.cardTitle')}</CardTitle>
          <CardDescription>
            {t('adminCurrenciesPage.cardDescriptionArsBase')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Exchange Rate Inputs */}
          <div className="space-y-4 p-4 border rounded-lg bg-card/50">
            <h3 className="text-lg font-semibold text-foreground">{t('adminCurrenciesPage.exchangeRatesTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="usd-rate" className="text-sm font-medium">
                  {t('adminCurrenciesPage.usdToArsRateLabel', { arsSymbol: SUPPORTED_CURRENCIES.find(c=>c.id==='ars')?.symbol || '$' })}
                </Label>
                <Input
                  id="usd-rate"
                  type="number"
                  step="any"
                  value={localExchangeRates.usdToArs}
                  onChange={(e) => handleRateChange('usdToArs', e.target.value)}
                  placeholder="e.g., 1200"
                  className="w-full text-sm"
                  min="0.000001"
                />
              </div>
              <div>
                <Label htmlFor="eur-rate" className="text-sm font-medium">
                  {t('adminCurrenciesPage.eurToArsRateLabel', { arsSymbol: SUPPORTED_CURRENCIES.find(c=>c.id==='ars')?.symbol || '$' })}
                </Label>
                <Input
                  id="eur-rate"
                  type="number"
                  step="any"
                  value={localExchangeRates.eurToArs}
                  onChange={(e) => handleRateChange('eurToArs', e.target.value)}
                  placeholder="e.g., 1450"
                  className="w-full text-sm"
                  min="0.000001"
                />
              </div>
            </div>
          </div>

          {/* Currency Activation and Primary Selection List */}
          <div className="space-y-3">
             <h3 className="text-lg font-semibold text-foreground">{t('adminCurrenciesPage.activeCurrenciesTitle')}</h3>
            {SUPPORTED_CURRENCIES.map(currencyDef => {
              const isActiveInLocal = localActiveCurrencies.some(ac => ac.id === currencyDef.id);
              const localCurrencyData = localActiveCurrencies.find(ac => ac.id === currencyDef.id);

              return (
                <div key={currencyDef.id} className="p-4 border rounded-lg bg-card/50 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-md font-semibold text-foreground">
                        {currencyDef.name} ({currencyDef.code}) - {currencyDef.symbol}
                        {localCurrencyData?.isPrimary && <Badge variant="default" className="ml-2 bg-primary text-primary-foreground">{t('adminCurrenciesPage.primaryBadge')}</Badge>}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-4 flex-shrink-0">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`currency-active-${currencyDef.id}`}
                          checked={isActiveInLocal}
                          onCheckedChange={() => handleToggleActive(currencyDef.id)}
                          aria-label={`Toggle ${currencyDef.name} active status`}
                           disabled={currencyDef.id === 'ars' && localActiveCurrencies.find(c => c.id === 'ars')?.isPrimary}
                        />
                        <Label htmlFor={`currency-active-${currencyDef.id}`}>
                          {isActiveInLocal ? t('adminCurrenciesPage.statusActive') : t('adminCurrenciesPage.statusInactive')}
                        </Label>
                      </div>
                      {isActiveInLocal && currencyDef.id === 'ars' && (
                        <Button
                          variant={localCurrencyData?.isPrimary ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSetPrimary(currencyDef.id)}
                          disabled={localCurrencyData?.isPrimary}
                        >
                          {localCurrencyData?.isPrimary ? t('adminCurrenciesPage.primaryButtonSet') : t('adminCurrenciesPage.setAsPrimaryButton')}
                        </Button>
                       )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
           <div className="flex items-center space-x-2 pt-4 border-t mt-4">
            <Switch
              id="allow-user-choice-currency"
              checked={localAllowUserToChooseCurrency}
              onCheckedChange={setLocalAllowUserToChooseCurrency}
              aria-label={t('adminCurrenciesPage.allowUserToChooseCurrencyAriaLabel')}
            />
            <Label htmlFor="allow-user-choice-currency" className="text-base font-medium">
              {t('adminCurrenciesPage.allowUserToChooseCurrency')}
            </Label>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button onClick={handleSaveChanges} disabled={isSubmitting} className="ml-auto">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> {t('adminCurrenciesPage.saveChangesButton')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
