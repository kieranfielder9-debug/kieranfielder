/**
 * The real network client for the backend in /server. Every function here
 * returns the same shape the server responds with, which was deliberately
 * designed to match FinanceContext/SecurityContext's own field names — so
 * those files mostly just apply whatever this returns, rather than
 * reshaping it.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type FinanceSnapshot = {
  isLoading: boolean;
  totalValue: number;
  healthScore: number;
  unallocatedFunds: number;
  harvestMode: string;
  investmentMode: string;
  vaults: { id: string; name: string; splitLabel: string; balance: number }[];
  recentActivity: { id: string; label: string; amount: number; group: string }[];
  expenseAudit: { id: string; label: string; amountLabel: string }[];
  kingdomImpactLog: { id: string; title: string; subtitle: string; amountLabel: string }[];
  assessments: { id: string; title: string; subtitle: string; status: string }[];
};

export type SecuritySettings = {
  isFaceIdSetUp: boolean;
  stepUpThreshold: number;
  shouldBalancesBlur: boolean;
  hasCompletedOnboarding: boolean;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request to ${path} failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  getFinance: () => request<FinanceSnapshot>('/api/finance'),
  transfer: (amount: number, recipient: string) =>
    request<FinanceSnapshot>('/api/finance/transfer', { method: 'POST', body: JSON.stringify({ amount, recipient }) }),
  createAllocationRule: (name: string, percent: number) =>
    request<FinanceSnapshot>('/api/finance/allocation-rules', { method: 'POST', body: JSON.stringify({ name, percent }) }),
  deployCapital: (amount: number, product: string) =>
    request<FinanceSnapshot>('/api/finance/deploy-capital', { method: 'POST', body: JSON.stringify({ amount, product }) }),
  prunePayment: (id: string) => request<FinanceSnapshot>(`/api/finance/expense-audit/${id}`, { method: 'DELETE' }),
  logImpact: (title: string, amountLabel: string) =>
    request<FinanceSnapshot>('/api/finance/kingdom-impact', { method: 'POST', body: JSON.stringify({ title, amountLabel }) }),
  setHarvestMode: (mode: string) =>
    request<FinanceSnapshot>('/api/finance/harvest-mode', { method: 'PATCH', body: JSON.stringify({ mode }) }),
  setInvestmentMode: (mode: string) =>
    request<FinanceSnapshot>('/api/finance/investment-mode', { method: 'PATCH', body: JSON.stringify({ mode }) }),
  getSecurity: () => request<SecuritySettings>('/api/security'),
  patchSecurity: (patch: Partial<SecuritySettings>) =>
    request<SecuritySettings>('/api/security', { method: 'PATCH', body: JSON.stringify(patch) }),
};
