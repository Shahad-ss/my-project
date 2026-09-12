import { useState, useEffect } from 'react';
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey, getGetDashboardQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLanguage } from '@/providers/language-provider';
import { useTheme } from '@/providers/theme-provider';

const currencyLabels: Record<string, string> = {
  USD: "USD ($)",
  EUR: "EUR (€)",
  GBP: "GBP (£)",
  AED: "AED",
  SAR: "SAR",
  KWD: "KWD (KD)",
  EGP: "EGP",
};

const themeLabels: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export default function Settings() {
  const { t } = useLanguage();
  const { setTheme: setContextTheme } = useTheme();
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    monthlyIncome: 0,
    preferredCurrency: "USD",
    language: "en",
    theme: "system"
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        monthlyIncome: profile.monthlyIncome,
        preferredCurrency: profile.preferredCurrency || "USD",
        language: "en",
        theme: profile.theme || "system"
      });
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        toast.success("Preferences updated successfully");
        if (formData.theme) {
          setContextTheme(formData.theme as any);
        }
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-3xl font-serif font-bold text-foreground">{t('settings')}</h1>
        <p className="text-muted-foreground mt-1 text-lg">Customize your financial space.</p>
      </header>

      <form onSubmit={handleSubmit}>
        <Card className="rounded-3xl shadow-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-base">{t('monthly_income')}</Label>
              <Input 
                type="number" 
                step="0.01" 
                className="h-12 text-lg"
                value={formData.monthlyIncome} 
                onChange={e => setFormData(current => ({ ...current, monthlyIncome: Number(e.target.value) }))}
              />
              <p className="text-sm text-muted-foreground">Used to calculate dashboard insights.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-base">{t('currency')}</Label>
              <Select value={formData.preferredCurrency} onValueChange={v => setFormData(current => ({ ...current, preferredCurrency: v }))}>
                <SelectTrigger className="h-12"><SelectValue>{currencyLabels[formData.preferredCurrency]}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="SAR">SAR</SelectItem>
                  <SelectItem value="KWD">KWD (KD)</SelectItem>
                  <SelectItem value="EGP">EGP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base">{t('theme')}</Label>
              <Select value={formData.theme} onValueChange={v => setFormData(current => ({ ...current, theme: v }))}>
                <SelectTrigger className="h-12"><SelectValue>{themeLabels[formData.theme]}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Button type="submit" size="lg" className="w-full sm:w-auto rounded-full px-8" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Saving...' : t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}