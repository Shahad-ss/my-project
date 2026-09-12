import { useEffect, useState } from 'react';
import { useListDebts, useCreateDebt, useUpdateDebt, useDeleteDebt, useRecordDebtPayment, getListDebtsQueryKey, getGetDashboardQueryKey, useGetProfile } from '@workspace/api-client-react';
import { Card, CardContent, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Progress } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Landmark, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/providers/language-provider';
import { formatDateOnly } from '@/lib/date';

export default function Debts() {
  const { t } = useLanguage();
  const { data: debts, isLoading } = useListDebts();
  const { data: profile } = useGetProfile();
  const createDebt = useCreateDebt();
  const deleteDebt = useDeleteDebt();
  const recordPayment = useRecordDebtPayment();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(() => window.location.hash === "#add");
  useEffect(() => {
    if (window.location.hash === "#add") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);
  const [paymentOpenId, setPaymentOpenId] = useState<number | null>(null);
  
  const currency = profile?.preferredCurrency || "USD";
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      totalAmount: Number(formData.get('totalAmount')),
      remainingAmount: Number(formData.get('totalAmount')), // initially same
      monthlyPayment: Number(formData.get('monthlyPayment')),
      dueDate: formData.get('dueDate') as string,
    };

    createDebt.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDebtsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setIsOpen(false);
        toast.success("Debt tracker created");
      },
      onError: () => toast.error("Enter valid debt amounts and a monthly payment greater than zero")
    });
  };

  const onPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!paymentOpenId) return;
    const formData = new FormData(e.currentTarget);
    recordPayment.mutate({ id: paymentOpenId, data: { amount: Number(formData.get('amount')) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDebtsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setPaymentOpenId(null);
        toast.success("Payment recorded");
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Delete this debt record?")) {
      deleteDebt.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDebtsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t('debts')}</h1>
          <p className="text-muted-foreground mt-1 text-lg">Focus on clearing balances intentionally.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="rounded-full px-6 shadow-md" size="lg">
          <Plus className="ms-[-0.25rem] me-2 h-5 w-5" /> {t('add_debt')}
        </Button>
      </header>

      {/* CREATE DIALOG */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-x-hidden">
          <DialogHeader><DialogTitle>{t('add_debt')}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input name="name" required placeholder="e.g. Student Loan" className="h-11 w-full min-w-0" />
            </div>
            <div className="space-y-2">
              <Label>{t('total_amount')}</Label>
              <Input name="totalAmount" type="number" inputMode="decimal" step="0.01" required className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>{t('monthly_payment')}</Label>
              <Input name="monthlyPayment" type="number" inputMode="decimal" min="0.01" step="0.01" required className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input name="dueDate" type="date" required className="h-11 w-full min-w-0" />
            </div>
            <Button type="submit" className="w-full mt-6" disabled={createDebt.isPending}>{t('save')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* PAYMENT DIALOG */}
      <Dialog open={!!paymentOpenId} onOpenChange={(open) => !open && setPaymentOpenId(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-x-hidden">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={onPayment} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('amount')}</Label>
              <Input name="amount" type="number" inputMode="decimal" step="0.01" required placeholder="0.00" className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <Button type="submit" className="w-full mt-6" disabled={recordPayment.isPending}>Submit Payment</Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-6">
          {[1,2].map(i => <div key={i} className="h-40 rounded-3xl bg-muted animate-pulse" />)}
        </div>
      ) : debts?.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-16 text-center flex flex-col items-center justify-center">
            <div className="h-16 w-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mb-6">
              <Landmark className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-serif font-bold mb-2">No debts added</h3>
            <p className="text-muted-foreground mb-6">Add a debt to start tracking your payments and remaining balance.</p>
            <Button onClick={() => setIsOpen(true)} variant="outline" className="rounded-full">
              Add Debt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {debts?.map(debt => (
            <Card key={debt.id} className="min-w-0 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8 items-stretch sm:items-center min-w-0">
                <div className="flex-1 min-w-0 w-full space-y-4">
                  <div className="flex justify-between items-start gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-bold break-words [overflow-wrap:anywhere]">{debt.name}</h3>
                      <p className="text-muted-foreground text-sm mt-1">Started: {formatDateOnly(debt.dueDate)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(debt.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div>
                    <div className="flex flex-col xs:flex-row justify-between items-start xs:items-end gap-2 mb-2 min-w-0">
                      <span className="max-w-full text-[clamp(0.9rem,4.5vw,1.875rem)] sm:text-3xl tracking-tight leading-tight font-serif text-foreground font-bold tabular-nums whitespace-nowrap">{formatCurrency(debt.remainingAmount)} <span className="text-base font-sans text-muted-foreground font-normal">left</span></span>
                      <span className="text-sm font-medium shrink-0">{Math.round(debt.progress)}% Paid</span>
                    </div>
                    <Progress value={debt.progress} className="h-3" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-sm text-muted-foreground">
                      <p>
                        {debt.estimatedMonthsRemaining === null
                          ? "Add a monthly payment to estimate payoff"
                          : debt.estimatedMonthsRemaining === 0
                            ? "Paid in full"
                            : `Estimated payoff: ${debt.estimatedMonthsRemaining} month${debt.estimatedMonthsRemaining === 1 ? "" : "s"}`}
                      </p>
                      {debt.estimatedPayoffDate && (
                        <p className="sm:text-end">
                          Payoff date: {formatDateOnly(debt.estimatedPayoffDate, { month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="w-full sm:w-52 sm:shrink-0 bg-muted/50 p-6 rounded-2xl flex flex-col items-center justify-center min-w-0 border border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">{t('monthly_payment')}</p>
                  <p className="max-w-full text-lg sm:text-xl leading-tight text-center font-bold text-foreground mb-4 tabular-nums break-words [overflow-wrap:anywhere]">{formatCurrency(debt.monthlyPayment)}</p>
                  <Button className="w-full rounded-xl" onClick={() => setPaymentOpenId(debt.id)}>
                    <HandCoins className="h-4 w-4 me-2" /> Pay
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}