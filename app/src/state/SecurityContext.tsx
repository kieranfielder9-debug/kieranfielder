import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import { api, SecuritySettings } from '../services/api';
import { useToast } from './ToastContext';
import { loadJSON, saveJSON } from './persist';

const STORAGE_KEY = 'storehouse.security-settings';

type SecurityState = {
  isHydrated: boolean;
  isAppLocked: boolean;
  isFaceIdSetUp: boolean;
  stepUpThreshold: number;
  shouldBalancesBlur: boolean;
  hasCompletedOnboarding: boolean;
  lockApp: () => void;
  unlockApp: () => void;
  setFaceIdSetUp: (value: boolean) => void;
  setStepUpThreshold: (value: number) => void;
  toggleBalanceBlur: () => void;
  completeOnboarding: () => void;
};

const SecurityContext = createContext<SecurityState | undefined>(undefined);

const DEFAULT_SETTINGS: SecuritySettings = {
  isFaceIdSetUp: false,
  stepUpThreshold: 500,
  shouldBalancesBlur: false,
  hasCompletedOnboarding: false,
};

type SecurityProviderProps = { children: ReactNode };

export function SecurityProvider({ children }: SecurityProviderProps) {
  const { showToast } = useToast();

  const [isHydrated, setIsHydrated] = useState(false);
  // isAppLocked never touches the server — it's per-device Local state
  // (per the state matrix), not something that should sync or persist.
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);

  function applySettings(next: SecuritySettings) {
    setSettings(next);
    saveJSON(STORAGE_KEY, next);
  }

  // Same cache-then-network pattern as FinanceContext: show whatever was
  // saved last time immediately, then reconcile with the server.
  useEffect(() => {
    loadJSON<SecuritySettings>(STORAGE_KEY).then((cached) => {
      if (cached) {
        setSettings(cached);
        setIsHydrated(true);
      }
      api
        .getSecurity()
        .then((fresh) => {
          setSettings(fresh);
          saveJSON(STORAGE_KEY, fresh);
          setIsHydrated(true);
        })
        .catch(() => {
          // No server reachable — fall back to cached/default settings
          // rather than blocking the app from ever finishing loading.
          setIsHydrated(true);
        });
    });
  }, []);

  async function updateSettings(patch: Partial<SecuritySettings>) {
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic); // feels instant; reconciled with the server's response below
    try {
      applySettings(await api.patchSecurity(patch));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save that setting', 'error');
    }
  }

  // Global privacy behavior: re-lock automatically the moment the app is
  // backgrounded (switching apps, the phone locking) — a standard banking-
  // app rule, not something any one screen should have to remember to do.
  // The function returned from useEffect is a *cleanup* — React calls it
  // right before this effect would run again (or the component unmounts),
  // which here removes the old listener before subscribing a new one.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && settings.isFaceIdSetUp) {
        setIsAppLocked(true);
      }
    });
    return () => subscription.remove();
  }, [settings.isFaceIdSetUp]);

  const value: SecurityState = {
    isHydrated,
    isAppLocked,
    isFaceIdSetUp: settings.isFaceIdSetUp,
    stepUpThreshold: settings.stepUpThreshold,
    shouldBalancesBlur: settings.shouldBalancesBlur,
    hasCompletedOnboarding: settings.hasCompletedOnboarding,
    lockApp: () => setIsAppLocked(true),
    unlockApp: () => setIsAppLocked(false),
    setFaceIdSetUp: (value) => updateSettings({ isFaceIdSetUp: value }),
    setStepUpThreshold: (value) => updateSettings({ stepUpThreshold: value }),
    toggleBalanceBlur: () => updateSettings({ shouldBalancesBlur: !settings.shouldBalancesBlur }),
    completeOnboarding: () => updateSettings({ hasCompletedOnboarding: true }),
  };

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used inside a SecurityProvider');
  }
  return context;
}
