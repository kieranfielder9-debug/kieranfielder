/**
 * STUB — no real Plaid credentials are configured (PLAID_CLIENT_ID /
 * PLAID_SECRET are unset). Real Plaid integration replaces this file's
 * body with calls into the official `plaid` npm package: `linkTokenCreate`
 * server-side to get a token the mobile app's Plaid Link SDK can open, then
 * `itemPublicTokenExchange` here to trade the public_token Link returns
 * for a permanent access_token — which must be stored server-side only,
 * never sent to the app. Everything below fakes the same shape so the
 * routes and the app can be built against a realistic contract now.
 */

export async function createLinkToken(): Promise<{ linkToken: string }> {
  return { linkToken: `stub-link-token-${Date.now()}` };
}

export async function exchangePublicToken(
  publicToken: string
): Promise<{ accountId: string; institutionName: string }> {
  if (!publicToken) {
    throw new Error('publicToken is required');
  }
  return { accountId: 'mock-account-1', institutionName: 'Mock Bank' };
}
