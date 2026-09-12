import { useEffect, useState } from 'react';
import { useListBills, useCreateBill, useUpdateBill, useDeleteBill, getListBillsQueryKey, getGetDashboardQueryKey, useGetProfile } from '@workspace/api-client-react';
import { Card, CardContent, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Trash2, Calendar, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/providers/language-provider';
import { formatDateOnly } from '@/lib/date';

export default function Bills() {
  const { t } = useLanguage();
  const { data: bills, isLoading } = useListBills();
  const { data: profile } = useGetProfile();
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(() => window.location.hash === "#add");
  useEffect(() => {
    if (window.location.hash === "#add") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly" | "one_time">("monthly");
  
  const currency = profile?.preferredCurrency || "USD";
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      amount: Number(formData.get('amount')),
      dueDate: formData.get('dueDate') as string,
      frequency,
      endDate: frequency === "one_time" ? null : (formData.get('endDate') as string) || null,
    };

    createBill.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setIsOpen(false);
        toast.success("Bill created successfully");
      },
      onError: () => toast.error("Failed to create bill")
    });
  };

  const togglePaid = (id: number, currentPaid: boolean, frequency: string) => {
    updateBill.mutate({ id, data: { paid: !currentPaid } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        toast.success(
          frequency !== "one_time" && !currentPaid
            ? "Payment recorded and next bill scheduled"
            : `Bill marked as ${!currentPaid ? 'paid' : 'unpaid'}`,
        );
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Are you sure you want to delete this bill?")) {
      deleteBill.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast.success("Bill deleted");
        }
      });
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t('bills')}</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage and track your recurring payments.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="rounded-full px-6 shadow-md" size="lg">
          <Plus className="ms-[-0.25rem] me-2 h-5 w-5" /> {t('add_bill')}
        </Button>
      </header>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{t('add_bill')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" name="name" required placeholder="e.g. Electricity" className="h-11 w-full min-w-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">{t('amount')}</Label>
              <Input id="amount" name="amount" type="number" inputMode="decimal" step="0.01" required placeholder="0.00" className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">{t('due_date')}</Label>
              <Input id="dueDate" name="dueDate" type="date" required className="h-11 w-full min-w-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">{t('frequency')}</Label>
              <Select name="frequency" value={frequency} onValueChange={(value) => setFrequency(value as typeof frequency)}>
                <SelectTrigger className="h-11 w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('monthly')}</SelectItem>
                  <SelectItem value="yearly">{t('yearly')}</SelectItem>
                  <SelectItem value="weekly">{t('weekly')}</SelectItem>
                  <SelectItem value="one_time">{t('one_time')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {frequency !== "one_time" && (
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Input id="endDate" name="endDate" type="date" className="h-11 w-full min-w-0" />
              </div>
            )}
            <Button type="submit" className="w-full mt-6" disabled={createBill.isPending}>
              {createBill.isPending ? 'Saving...' : t('save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />)}
        </div>
      ) : bills?.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-16 text-center flex flex-col items-center justify-center">
            <div className="h-16 w-16 bg-secondary text-secondary-foreground rounded-2xl flex items-center justify-center mb-6">
              <Receipt className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-serif font-bold mb-2">No bills yet</h3>
            <p className="text-muted-foreground mb-6">Add your first bill to start tracking your upcoming payments.</p>
            <Button onClick={() => setIsOpen(true)} variant="outline" className="rounded-full">
              Add Bill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bills?.map(bill => (
            <Card key={bill.id} className="h-full min-w-0 rounded-3xl overflow-hidden transition-all hover:shadow-md group">
              <div className={`h-2 w-full ${bill.status === 'overdue' && !bill.paid ? 'bg-destructive' : bill.paid ? 'bg-primary' : 'bg-accent'}`} />
              <CardContent className="p-6 h-full min-w-0 flex flex-col">
                <div className="flex justify-between items-start gap-3 mb-6 min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold break-words [overflow-wrap:anywhere]">{bill.name}</h3>
                    <p className="text-xl sm:text-2xl leading-tight font-serif mt-1 text-foreground tabular-nums break-words [overflow-wrap:anywhere]">{formatCurrency(bill.amount)}</p>
                  </div>
                  <Badge variant={bill.paid ? 'success' : bill.status === 'overdue' ? 'destructive' : 'secondary'} className="px-3 py-1 shrink-0">
                    {bill.paid ? t('paid') : bill.status === 'overdue' ? t('overdue') : t('pending')}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap items-center text-sm text-muted-foreground mb-2 gap-2 min-w-0">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {bill.frequency === "one_time" ? "Due" : "Next payment"}:{" "}
                    {bill.nextPaymentDate ? formatDateOnly(bill.nextPaymentDate) : "No upcoming payment"}
                  </span>
                  <span className="px-2">&bull;</span>
                  <span className="capitalize">{bill.frequency === "one_time" ? t(bill.frequency) : `${t(bill.frequency)} recurring`}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  {bill.frequency === "one_time"
                    ? bill.daysRemaining !== null && bill.daysRemaining >= 0
                      ? `${bill.daysRemaining} day${bill.daysRemaining === 1 ? "" : "s"} remaining`
                      : "Past due"
                    : bill.endDate
                      ? `Ends on ${formatDateOnly(bill.endDate, { month: "long", day: "numeric", year: "numeric" })}`
                      : "Continues until you stop it"}
                </p>

                <div className="flex items-center gap-2 mt-auto pt-4 border-t">
                  <Button 
                    variant={bill.paid ? "outline" : "default"} 
                    className="flex-1 rounded-xl"
                    onClick={() => togglePaid(bill.id, bill.paid, bill.frequency)}
                    disabled={updateBill.isPending}
                  >
                    {bill.paid ? <CheckCircle2 className="h-4 w-4 me-2" /> : <Circle className="h-4 w-4 me-2" />}
                    {bill.paid ? t('mark_unpaid') : t('mark_paid')}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(bill.id)}>
                    <Trash2 className="h-4 w-4" />
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