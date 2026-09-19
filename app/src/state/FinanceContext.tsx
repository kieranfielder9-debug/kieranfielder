import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, FinanceSnapshot } from '../services/api';
import { useToast } from './ToastContext';
import { loadJSON, saveJSON } from './persist';

const STORAGE_KEY = 'storehouse.finance-data';

export type Vault = FinanceSnapshot['vaults'][number];
export type ActivityGroup = 'purchases' | 'cancelledPurchases' | 'streamAllocations' | 'kingdomImpacts';
export type ActivityItem = FinanceSnapshot['recentActivity'][number];
export type Assessment = FinanceSnapshot['assessments'][number];
export type ExpenseAuditItem = FinanceSnapshot['expenseAudit'][number];
export type KingdomImpactItem = FinanceSnapshot['kingdomImpactLog'][number];
export type HarvestMode = 'Standard' | 'Bull' | 'Bear' | 'Jubilee';
export type InvestmentMode = 'Standard' | 'Personalise' | 'Auto';

type FinanceState = {
  isLoading: boolean;
  isOffline: boolean;
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
  transferFunds: (amount: number, recipient: string) => Promise<void>;
  createAllocationRule: (name: string, percent: number) => Promise<void>;
  deployCapital: (amount: number, product: string) => Promise<void>;
  prunePayment: (id: string) => Promise<void>;
  logImpact: (title: string, amountLabel: string) => Promise<void>;
  setHarvestMode: (mode: HarvestMode) => Promise<void>;
  setInvestmentMode: (mode: InvestmentMode) => Promise<void>;
};

const FinanceContext = createContext<FinanceState | undefined>(undefined);

const EMPTY_SNAPSHOT: FinanceSnapshot = {
  isLoading: false,
  totalValue: 0,
  healthScore: 0,
  unallocatedFunds: 0,
  harvestMode: 'Standard',
  investmentMode: 'Standard',
  vaults: [],
  recentActivity: [],
  expenseAudit: [],
  kingdomImpactLog: [],
  assessments: [],
};

type FinanceProviderProps = { children: ReactNode };

export function FinanceProvider({ children }: FinanceProviderProps) {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>(EMPTY_SNAPSHOT);

  function applySnapshot(next: FinanceSnapshot) {
    setSnapshot(next);
    saveJSON(STORAGE_KEY, next);
  }

  async function refresh() {
    try {
      const fresh = await api.getFinance();
      applySnapshot(fresh);
      setIsOffline(false);
    } catch {
      // The server might be asleep (Render's free tier spins down after
      // idle) or unreachable — fall back to whatever's cached rather than
      // showing an empty screen.
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }

  // Show cached data instantly if there is any, then always try the real
  // network request — this is the "cache now, confirm with the server"
  // pattern real finance apps use so a balance isn't blank while waiting
  // on a slow or sleeping backend.
  useEffect(() => {
    loadJSON<FinanceSnapshot>(STORAGE_KEY).then((cached) => {
      if (cached) {
        setSnapshot(cached);
        setIsLoading(false);
      }
      refresh();
    });
  }, []);

  async function transferFunds(amount: number, recipient: string) {
    try {
      applySnapshot(await api.transfer(amount, recipient));
      showToast(`Sent £${amount.toFixed(2)} to ${recipient}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Transfer failed', 'error');
    }
  }

  async function createAllocationRule(name: string, percent: number) {
    try {
      applySnapshot(await api.createAllocationRule(name, percent));
      showToast(`New allocation rule created for ${name}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the rule', 'error');
    }
  }

  async function deployCapital(amount: number, product: string) {
    try {
      applySnapshot(await api.deployCapital(amount, product));
      showToast(`Deployed £${amount.toFixed(2)} into ${product}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Deploy failed', 'error');
    }
  }

  async function prunePayment(id: string) {
    try {
      applySnapshot(await api.prunePayment(id));
      showToast('Payment pruned', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not prune that payment', 'error');
    }
  }

  async function logImpact(title: string, amountLabel: string) {
    try {
      applySnapshot(await api.logImpact(title, amountLabel));
      showToast('Kingdom impact logged', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not log that impact', 'error');
    }
  }

  async function setHarvestMode(mode: HarvestMode) {
    try {
      applySnapshot(await api.setHarvestMode(mode));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not change harvest mode', 'error');
    }
  }

  async function setInvestmentMode(mode: InvestmentMode) {
    try {
      applySnapshot(await api.setInvestmentMode(mode));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not change investment mode', 'error');
    }
  }

  const value: FinanceState = {
    isLoading,
    isOffline,
    totalValue: snapshot.totalValue,
    healthScore: snapshot.healthScore,
    unallocatedFunds: snapshot.unallocatedFunds,
    vaults: snapshot.vaults,
    recentActivity: snapshot.recentActivity,
    expenseAudit: snapshot.expenseAudit,
    assessments: snapshot.assessments,
    kingdomImpactLog: snapshot.kingdomImpactLog,
    harvestMode: snapshot.harvestMode as HarvestMode,
    investmentMode: snapshot.investmentMode as InvestmentMode,
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
