import { useEffect, useState } from 'react';
import { useListSavingsGoals, useCreateSavingsGoal, useUpdateSavingsGoal, useDeleteSavingsGoal, useAddSavingsContribution, getListSavingsGoalsQueryKey, getGetDashboardQueryKey, useGetProfile } from '@workspace/api-client-react';
import { Card, CardContent, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Progress } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, PiggyBank, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/providers/language-provider';
import { formatDateOnly } from '@/lib/date';

export default function Savings() {
  const { t } = useLanguage();
  const { data: goals, isLoading } = useListSavingsGoals();
  const { data: profile } = useGetProfile();
  const createGoal = useCreateSavingsGoal();
  const deleteGoal = useDeleteSavingsGoal();
  const addContrib = useAddSavingsContribution();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(() => window.location.hash === "#add");
  useEffect(() => {
    if (window.location.hash === "#add") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);
  const [contribOpenId, setContribOpenId] = useState<number | null>(null);
  
  const currency = profile?.preferredCurrency || "USD";
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      targetAmount: Number(formData.get('targetAmount')),
      currentAmount: Number(formData.get('currentAmount') || 0),
      monthlyContribution: Number(formData.get('monthlyContribution')),
    };

    createGoal.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSavingsGoalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setIsOpen(false);
        toast.success("Savings goal created");
      },
      onError: () => toast.error("Enter valid savings amounts and a monthly saving greater than zero")
    });
  };

  const onContribute = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contribOpenId) return;
    const formData = new FormData(e.currentTarget);
    addContrib.mutate({ id: contribOpenId, data: { amount: Number(formData.get('amount')) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSavingsGoalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setContribOpenId(null);
        toast.success("Contribution added!");
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Delete this savings goal?")) {
      deleteGoal.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSavingsGoalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t('savings')}</h1>
          <p className="text-muted-foreground mt-1 text-lg">Save intentionally for what matters most.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="rounded-full px-6 shadow-md" size="lg">
          <Plus className="ms-[-0.25rem] me-2 h-5 w-5" /> {t('add_savings')}
        </Button>
      </header>

      {/* CREATE DIALOG */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-x-hidden">
          <DialogHeader><DialogTitle>{t('add_savings')}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input name="name" required placeholder="e.g. Dream Vacation" className="h-11 w-full min-w-0" />
            </div>
            <div className="space-y-2">
              <Label>{t('target_amount')}</Label>
              <Input name="targetAmount" type="number" inputMode="decimal" step="0.01" required className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Initial Deposit (Optional)</Label>
              <Input name="currentAmount" type="number" inputMode="decimal" step="0.01" defaultValue="0" className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Planned Monthly Saving</Label>
              <Input name="monthlyContribution" type="number" inputMode="decimal" min="0.01" step="0.01" required className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <Button type="submit" className="w-full mt-6" disabled={createGoal.isPending}>{t('save')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONTRIBUTE DIALOG */}
      <Dialog open={!!contribOpenId} onOpenChange={(open) => !open && setContribOpenId(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-x-hidden">
          <DialogHeader><DialogTitle>Add Contribution</DialogTitle></DialogHeader>
          <form onSubmit={onContribute} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('amount')}</Label>
              <Input name="amount" type="number" inputMode="decimal" step="0.01" required placeholder="0.00" className="h-11 w-full min-w-0 text-base tabular-nums" />
            </div>
            <Button type="submit" className="w-full mt-6" disabled={addContrib.isPending}>Add Funds</Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1,2].map(i => <div key={i} className="h-64 rounded-3xl bg-muted animate-pulse" />)}
        </div>
      ) : goals?.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-16 text-center flex flex-col items-center justify-center">
            <div className="h-16 w-16 bg-secondary text-secondary-foreground rounded-2xl flex items-center justify-center mb-6">
              <PiggyBank className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-serif font-bold mb-2">No savings goals yet</h3>
            <p className="text-muted-foreground mb-6">Create your first goal and start tracking your progress.</p>
            <Button onClick={() => setIsOpen(true)} variant="outline" className="rounded-full">
              Create Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {goals?.map(goal => (
            <Card key={goal.id} className="h-full min-w-0 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <CardContent className="p-6 min-w-0 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-3 mb-6 min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold break-words [overflow-wrap:anywhere]">{goal.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1 tabular-nums break-words [overflow-wrap:anywhere]">Goal: {formatCurrency(goal.targetAmount)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(goal.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="mb-6 flex-1 flex flex-col justify-center">
                  <div className="flex flex-col xs:flex-row justify-between items-start xs:items-end gap-2 mb-2 min-w-0">
                    <span className="max-w-full text-[clamp(0.9rem,4.5vw,1.875rem)] sm:text-3xl tracking-tight leading-tight font-serif text-foreground font-bold tabular-nums whitespace-nowrap">{formatCurrency(goal.currentAmount)}</span>
                    <span className="text-sm font-medium px-2 py-1 bg-secondary rounded-lg shrink-0">{Math.round(goal.progress)}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-3 bg-secondary/50" />
                  <div className="grid grid-cols-1 gap-1 pt-3 text-sm text-muted-foreground">
                    <p>Remaining: {formatCurrency(goal.remainingAmount)}</p>
                    <p>Monthly saving: {formatCurrency(goal.monthlyContribution)}</p>
                    <p>
                      {goal.estimatedMonthsRemaining === null
                        ? "Add a monthly saving amount to estimate completion"
                        : goal.estimatedMonthsRemaining === 0
                          ? "Goal reached"
                          : `Estimated completion: ${goal.estimatedMonthsRemaining} month${goal.estimatedMonthsRemaining === 1 ? "" : "s"}`}
                    </p>
                    {goal.estimatedCompletionDate && (
                      <p>
                        Target date: {formatDateOnly(goal.estimatedCompletionDate, { month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 mt-auto">
                  <div className="text-sm text-muted-foreground min-w-0">
                    Planned monthly: {formatCurrency(goal.monthlyContribution)}
                  </div>
                  <Button variant="outline" className="rounded-xl px-6" onClick={() => setContribOpenId(goal.id)}>
                    <Plus className="h-4 w-4 me-2" /> Add
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