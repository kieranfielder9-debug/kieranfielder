/**
 * Static reference data — things screens display but nothing in the app
 * currently changes. Because nothing mutates these, they don't need
 * useState or a Context; they're just plain constants, imported directly.
 */

export const storehouseCube = {
  goldPercent: 40,
  streamsPercent: 30,
  goodsPercent: 30,
};

export const expenseCategories = [
  { id: 'groceries', label: 'Groc.', amount: 320, active: false },
  { id: 'utilities', label: 'Util.', amount: 440, active: false },
  { id: 'transport', label: 'Trans.', amount: 240, active: false },
  { id: 'subscriptions', label: 'Subs.', amount: 720, active: true },
  { id: 'giving', label: 'Give', amount: 600, active: false },
];

export const streamSplitter = [
  { id: 'gold-vault', name: 'Gold Vault', amount: 2400, percent: 40 },
  { id: 'wellspring', name: 'Wellspring', amount: 1800, percent: 30 },
  { id: 'kingdom-fund', name: 'Kingdom Fund', amount: 1200, percent: 20 },
];

export const yieldCurve = {
  points: [
    { month: 0, label: 'Now', value: 172 },
    { month: 6, label: '6 Mo', value: 148 },
    { month: 12, label: '12 Mo', value: 109 },
    { month: 24, label: '24 Mo', value: 31 },
  ],
  estYield: 12500,
  horizonMonths: 24,
};

export const financialGoals = [
  { id: 'emergency-vault', name: 'Emergency Vault', percent: 65, target: 5000 },
  { id: 'debt-freedom', name: 'Debt Freedom', percent: 45, target: 3000 },
  { id: 'vault-reserve', name: 'Vault Reserve', percent: 20, target: 8000 },
  { id: 'home-deposit', name: 'Home Deposit', percent: 15, target: 15000 },
];

export const givingTargets = [
  { id: 'tithe', name: 'Tithe', given: 1200, target: 1200 },
  { id: 'offerings', name: 'Offerings', given: 450, target: 600 },
  { id: 'kingdom-fund', name: 'Kingdom Fund', given: 1000, target: 2000 },
  { id: 'mission-fund', name: 'Mission Fund', given: 200, target: 800 },
];

export const growthTrackers = [
  { id: '1', label: 'Tracker 1', percent: 100, locked: false },
  { id: '2', label: 'Tracker 2', percent: 100, locked: false },
  { id: '3', label: 'Tracker 3', percent: 62, locked: false },
  { id: '4', label: 'Locked', percent: 0, locked: true },
];

export const jubileeCountdown = { months: 20, weeks: 3, days: 4, daysToGo: 612 };

export const wellspringLegend = [
  { id: 'emergency-fund', label: 'Emergency Fund', amount: 1800 },
  { id: 'insurance-buffer', label: 'Insurance Buffer', amount: 1200 },
  { id: 'manse-fund', label: 'Manse Fund', amount: 1000 },
];

export const pruneSuggestions = [
  { id: 'growth-fund', label: 'Underperforming Growth Fund', metricLabel: '-3.2% YTD' },
  { id: 'idle-cash', label: 'Idle Cash Reserve', metricLabel: '0.0% Yield' },
  { id: 'duplicate-invest', label: 'Duplicate Micro-Investment', metricLabel: 'Redundant' },
];
