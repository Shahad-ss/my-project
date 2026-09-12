import { useGetDashboard, useGetProfile } from '@workspace/api-client-react';
import { Card, CardContent, Button, Progress, Skeleton } from '@/components/ui';
import { Wallet, Receipt, Landmark, PiggyBank, Calendar, ArrowUpRight, Plus } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import { DashboardFinancialAssistant } from '@/components/FinancialAssistant';
import { useLocation } from 'wouter';

export default function Dashboard() {
  const { t } = useLanguage();
  const { data: dashboard, isLoading: dashLoading } = useGetDashboard();
  const { data: profile } = useGetProfile();
  const [, navigate] = useLocation();

  if (dashLoading || !dashboard) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const currency = profile?.preferredCurrency || "USD";
  const isAllEmpty = !dashboard.recentActivity?.length;
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
          {t('welcome_back')}{profile?.displayName ? `, ${profile.displayName}` : ''}
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">{t('financial_overview')}</p>
      </header>

      {isAllEmpty && (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-8 md:p-12 text-center flex flex-col items-center justify-center">
            <div className="h-16 w-16 bg-secondary text-secondary-foreground rounded-2xl flex items-center justify-center mb-6">
              <Wallet className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-2">Welcome to Mizan!</h2>
            <p className="text-muted-foreground max-w-xl mb-6">
              Start organizing your finances by adding your first bill, debt, or savings goal.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
              <Button onClick={() => navigate('/bills#add')} className="rounded-full">
                <Plus className="h-4 w-4 me-2" /> Add Bill
              </Button>
              <Button onClick={() => navigate('/debts#add')} variant="outline" className="rounded-full">
                <Plus className="h-4 w-4 me-2" /> Add Debt
              </Button>
              <Button onClick={() => navigate('/savings#add')} variant="outline" className="rounded-full">
                <Plus className="h-4 w-4 me-2" /> Create Savings Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="rounded-3xl border-transparent shadow-sm bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/20 rounded-xl"><Wallet className="h-6 w-6 text-white" /></div>
            </div>
            <p className="text-primary-foreground/80 font-medium mb-1">{t('monthly_income')}</p>
            <h3 className="text-3xl font-serif font-bold">{formatCurrency(dashboard.monthlyIncome)}</h3>
          </CardContent>
        </Card>
        
        <Card className="rounded-3xl shadow-sm border-border">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-destructive/10 rounded-xl"><Receipt className="h-6 w-6 text-destructive" /></div>
            </div>
            <p className="text-muted-foreground font-medium mb-1">{t('upcoming_bills')}</p>
            <h3 className="text-3xl font-serif font-bold text-foreground">{dashboard.upcomingBills}</h3>
            {dashboard.nextBill && (
              <p className="text-sm text-destructive mt-2 flex items-center gap-1 font-medium">
                <Calendar className="h-4 w-4" /> Next: {dashboard.nextBill}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-sm border-border">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-accent/10 rounded-xl"><Landmark className="h-6 w-6 text-accent" /></div>
            </div>
            <p className="text-muted-foreground font-medium mb-1">{t('total_debt')}</p>
            <h3 className="text-3xl font-serif font-bold text-foreground">{formatCurrency(dashboard.totalRemainingDebt)}</h3>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-sm border-border">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-secondary rounded-xl"><PiggyBank className="h-6 w-6 text-secondary-foreground" /></div>
            </div>
            <p className="text-muted-foreground font-medium mb-1">{t('current_savings')}</p>
            <h3 className="text-3xl font-serif font-bold text-foreground">{formatCurrency(dashboard.currentSavings)}</h3>
            <div className="mt-4 flex items-center gap-3">
              <Progress value={dashboard.savingsProgress} className="h-2 flex-1" />
              <span className="text-sm font-medium">{Math.round(dashboard.savingsProgress)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-serif font-bold mb-6">{t('recent_activity')}</h2>
          {dashboard.recentActivity && dashboard.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {dashboard.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm transition-all hover:shadow-md">
                  <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <ArrowUpRight className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{activity.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{activity.detail}</p>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(activity.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          ) : !isAllEmpty ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Calendar className="h-12 w-12 opacity-20 mb-4" />
                <p className="text-lg">{t('no_activity')}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
        
        <div className="space-y-6">
          <DashboardFinancialAssistant />
        </div>
      </div>
    </div>
  );
}