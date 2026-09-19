import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchAccountsSnapshot } from '../services/plaid';
import { useToast } from './ToastContext';

export type Vault = { id: string; name: string; splitLabel: string; balance: number };
export type ActivityGroup = 'purchases' | 'cancelledPurchases' | 'streamAllocations' | 'kingdomImpacts';
export type ActivityItem = { id: string; label: string; amount: number; group: ActivityGroup };
export type Assessment = { id: string; title: string; subtitle: string; status: 'completed' | 'continue' };
export type ExpenseAuditItem = { id: string; label: string; amountLabel: string };
export type KingdomImpactItem = { id: string; title: string; subtitle: string; amountLabel: string };
export type HarvestMode = 'Standard' | 'Bull' | 'Bear' | 'Jubilee';
export type InvestmentMode = 'Standard' | 'Personalise' | 'Auto';

type FinanceState = {
  isLoading: boolean;
  totalValue: number;
  healthScore: number;
  unallocatedFunds: number;
  vaults: Vault[];
  recentActivity: ActivityItem[];
  expenseAudit: ExpenseAuditItem[];
  assessments: Assessment[];
  kingdomImpactLog: KingdomImpactItem[];
  harvestMode: HarvestMode;
  investmentMode: InvestmentMode;
  refresh: () => Promise<void>;
  transferFunds: (amount: number, recipient: string) => void;
  createAllocationRule: (name: string, percent: number) => void;
  deployCapital: (amount: number, product: string) => void;
  prunePayment: (id: string) => void;
  logImpact: (title: string, amountLabel: string) => void;
  setHarvestMode: (mode: HarvestMode) => void;
  setInvestmentMode: (mode: InvestmentMode) => void;
};

const FinanceContext = createContext<FinanceState | undefined>(undefined);

const initialVaults: Vault[] = [
  { id: 'emergency-fund', name: 'Emergency Fund', splitLabel: '10% Auto-Split', balance: 1800 },
  { id: 'wellspring-fund', name: 'Wellspring Fund', splitLabel: '5% Auto-Split', balance: 900 },
  { id: 'gold-vault', name: 'Gold Vault', splitLabel: 'Manual', balance: 2400 },
  { id: 'kingdom-fund', name: 'Kingdom Fund', splitLabel: 'Manual', balance: 1200 },
  { id: 'manse-fund', name: 'Manse Fund', splitLabel: 'Manual', balance: 1000 },
];

const initialActivity: ActivityItem[] = [
  { id: 'a1', label: 'Groceries', amount: -45.0, group: 'purchases' },
  { id: 'a2', label: 'Fuel', amount: -32.5, group: 'purchases' },
  { id: 'a3', label: 'Subscription Refund', amount: 12.0, group: 'cancelledPurchases' },
  { id: 'a4', label: 'Duplicate Charge', amount: 9.99, group: 'cancelledPurchases' },
  { id: 'a5', label: 'Gold Vault', amount: 200.0, group: 'streamAllocations' },
  { id: 'a6', label: 'Wellspring Fund', amount: 150.0, group: 'streamAllocations' },
  { id: 'a7', label: 'Tithe', amount: 100.0, group: 'kingdomImpacts' },
  { id: 'a8', label: 'Offering', amount: 25.0, group: 'kingdomImpacts' },
];

const initialExpenseAudit: ExpenseAuditItem[] = [
  { id: 'streaming', label: 'Streaming Subscription', amountLabel: '£9.99/mo' },
  { id: 'gym', label: 'Unused Gym Membership', amountLabel: '£24.99/mo' },
  { id: 'insurance', label: 'Duplicate Insurance', amountLabel: '£15.00/mo' },
];

const initialAssessments: Assessment[] = [
  { id: 'expense-audit', title: 'Expense Audit', subtitle: 'Reviewed your last 30 days of spending', status: 'completed' },
  { id: 'kingdom-obligations', title: 'Kingdom Obligations', subtitle: 'Confirmed tithe & giving commitments', status: 'completed' },
  { id: 'identity-profile', title: 'Identity Profile', subtitle: '3 of 5 questions answered — tap to continue', status: 'continue' },
];

const initialImpactLog: KingdomImpactItem[] = [
  { id: 'k1', title: 'Tithe Consistency', subtitle: 'Gave 10%+ for 6 consecutive months', amountLabel: '£1,200' },
  { id: 'k2', title: 'Local Outreach Funded', subtitle: 'Supported the City Mission food bank drive', amountLabel: '£250' },
  { id: 'k3', title: 'Mission Trip Supported', subtitle: 'Contributed to the summer mission trip fund', amountLabel: '£180' },
  { id: 'k4', title: 'Widow & Orphan Care', subtitle: 'Monthly support commitment fulfilled', amountLabel: '£75/mo' },
  { id: 'k5', title: 'Disaster Relief Response', subtitle: 'One-time gift to the relief fund', amountLabel: '£120' },
];

type FinanceProviderProps = { children: ReactNode };

export function FinanceProvider({ children }: FinanceProviderProps) {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(6000);
  const [healthScore, setHealthScore] = useState(85);
  const [unallocatedFunds, setUnallocatedFunds] = useState(600);
  const [vaults, setVaults] = useState<Vault[]>(initialVaults);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>(initialActivity);
  const [expenseAudit, setExpenseAudit] = useState<ExpenseAuditItem[]>(initialExpenseAudit);
  const [assessments] = useState<Assessment[]>(initialAssessments);
  const [kingdomImpactLog, setKingdomImpactLog] = useState<KingdomImpactItem[]>(initialImpactLog);
  const [harvestMode, setHarvestMode] = useState<HarvestMode>('Standard');
  const [investmentMode, setInvestmentMode] = useState<InvestmentMode>('Standard');

  async function refresh() {
    setIsLoading(true);
    const snapshot = await fetchAccountsSnapshot();
    setTotalValue(snapshot.totalValue);
    setHealthScore(snapshot.healthScore);
    setUnallocatedFunds(snapshot.unallocatedFunds);
    setIsLoading(false);
  }

  // Runs once, right after this provider first mounts — the "load the
  // starting data" effect every real screen like this needs.
  useEffect(() => {
    refresh();
  }, []);

  function transferFunds(amount: number, recipient: string) {
    setTotalValue((prev) => prev - amount);
    setRecentActivity((prev) => [
      { id: `transfer-${Date.now()}`, label: `Transfer to ${recipient}`, amount: -amount, group: 'purchases' },
      ...prev,
    ]);
    showToast(`Sent £${amount.toFixed(2)} to ${recipient}`, 'success');
  }

  function createAllocationRule(name: string, percent: number) {
    setVaults((prev) => [
      { id: `vault-${Date.now()}`, name, splitLabel: `${percent}% Auto-Split`, balance: 0 },
      ...prev,
    ]);
    showToast(`New allocation rule created for ${name}`, 'success');
  }

  function deployCapital(amount: number, product: string) {
    setUnallocatedFunds((prev) => Math.max(0, prev - amount));
    showToast(`Deployed £${amount.toFixed(2)} into ${product}`, 'success');
  }

  function prunePayment(id: string) {
    setExpenseAudit((prev) => prev.filter((item) => item.id !== id));
    showToast('Payment pruned', 'success');
  }

  function logImpact(title: string, amountLabel: string) {
    setKingdomImpactLog((prev) => [
      { id: `impact-${Date.now()}`, title, subtitle: 'Logged by you', amountLabel },
      ...prev,
    ]);
    showToast('Kingdom impact logged', 'success');
  }

  const value: FinanceState = {
    isLoading,
    totalValue,
    healthScore,
    unallocatedFunds,
    vaults,
    recentActivity,
    expenseAudit,
    assessments,
    kingdomImpactLog,
    harvestMode,
    investmentMode,
    refresh,
    transferFunds,
    createAllocationRule,
    deployCapital,
    prunePayment,
    logImpact,
    setHarvestMode,
    setInvestmentMode,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used inside a FinanceProvider');
  }
  return context;
}
