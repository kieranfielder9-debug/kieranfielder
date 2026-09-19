# Storehouse API

A minimal Express + SQLite backend for the Storehouse app. It is **not** wired
into the Expo app yet — the app currently reads/writes its own local state
(Context + AsyncStorage). This server exists as a working, independently
tested service that the app *could* call next, once that integration is
explicitly wanted (see the note at the bottom).

## Running it

```
npm install
cp .env.example .env   # optional — defaults already match .env.example
npm run dev             # starts on http://localhost:4000, auto-restarts on save
```

`npm start` runs the compiled build (`npm run build` first). `npm test` runs
the test suite (Node's built-in test runner + supertest, no extra test
framework dependency).

## What's real vs. stubbed

- **Real**: the Express server, the SQLite database (via Node's built-in
  `node:sqlite`, so no native module to compile), every finance and security
  endpoint below, and their tests.
- **Stubbed** (`src/plaid.ts`): no Plaid sandbox credentials were available,
  so `createLinkToken`/`exchangePublicToken` return fake data with the same
  shape the real Plaid Node SDK would — swap that file's body for real SDK
  calls once you have `PLAID_CLIENT_ID`/`PLAID_SECRET` (see `.env.example`).
  Never commit those values; they're meant to live in a local `.env` only.
- **Single-user**: there's no login system. One row of settings, one set of
  finance data — matching the app's current scope, which has no multi-user
  concept either.

## Endpoints

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/finance` | — | full snapshot |
| POST | `/api/finance/transfer` | `{ amount, recipient }` | |
| POST | `/api/finance/allocation-rules` | `{ name, percent }` | |
| POST | `/api/finance/deploy-capital` | `{ amount, product }` | |
| DELETE | `/api/finance/expense-audit/:id` | — | |
| POST | `/api/finance/kingdom-impact` | `{ title, amountLabel }` | |
| PATCH | `/api/finance/harvest-mode` | `{ mode }` | one of Standard/Bull/Bear/Jubilee |
| PATCH | `/api/finance/investment-mode` | `{ mode }` | one of Standard/Personalise/Auto |
| GET | `/api/security` | — | never includes `isAppLocked` — that's per-device Local state, not server state |
| PATCH | `/api/security` | any subset of `{ isFaceIdSetUp, stepUpThreshold, shouldBalancesBlur, hasCompletedOnboarding }` | |
| POST | `/api/plaid/link-token` | — | stub |
| POST | `/api/plaid/exchange-token` | `{ publicToken }` | stub |

All response bodies use the same field names as `FinanceContext`/
`SecurityContext` in the app, so wiring the app to call this later is mostly
replacing `useState` initial values with `fetch` calls, not renaming fields.

## Wiring the app to this server (not done yet)

The app currently persists locally (AsyncStorage) and has no networking
code at all. Pointing it at this server instead would mean: deciding whether
data lives only on the server or in both places, adding `fetch` calls with
loading/error handling to `FinanceContext`/`SecurityContext`, and giving the
Expo app this server's URL (its own env variable, since a phone on Expo Go
can't reach `localhost` on your computer — it needs your machine's LAN IP,
or a tunnel/deployment). That's a distinct decision, not something this
change makes silently.
