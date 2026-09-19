/**
 * STUB — not the real Plaid Link SDK.
 *
 * Real Plaid integration needs: a backend that holds the Plaid secret key,
 * an endpoint that creates a link_token server-side, the actual
 * react-native-plaid-link-sdk to open the bank-selection UI, and a second
 * backend endpoint to exchange the public_token it returns for a permanent
 * access_token. None of that exists yet (the backend architecture itself is
 * still an open decision), so these functions fake the same *shape* — an
 * async call that eventually resolves or rejects — so the rest of the app
 * can be built against a realistic contract now, and only this file needs
 * to change once the real integration lands.
 */

function wait<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export type LinkedAccount = {
  accountId: string;
  institutionName: string;
};

export async function linkBank(): Promise<LinkedAccount> {
  return wait({ accountId: 'mock-account-1', institutionName: 'Mock Bank' }, 1200);
}

export type AccountsSnapshot = {
  totalValue: number;
  healthScore: number;
  unallocatedFunds: number;
};

export async function fetchAccountsSnapshot(): Promise<AccountsSnapshot> {
  return wait({ totalValue: 6000, healthScore: 85, unallocatedFunds: 600 }, 800);
}
