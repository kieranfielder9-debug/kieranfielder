import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import { loadJSON, saveJSON } from './persist';

const STORAGE_KEY = 'storehouse.security-settings';

type PersistedSettings = {
  isFaceIdSetUp: boolean;
  stepUpThreshold: number;
  shouldBalancesBlur: boolean;
  hasCompletedOnboarding: boolean;
};

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

type SecurityProviderProps = { children: ReactNode };

export function SecurityProvider({ children }: SecurityProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isFaceIdSetUp, setIsFaceIdSetUp] = useState(false);
  const [stepUpThreshold, setStepUpThreshold] = useState(500);
  const [shouldBalancesBlur, setShouldBalancesBlur] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Runs once on mount: read whatever was saved last time, before this
  // provider ever renders real content off of it.
  useEffect(() => {
    loadJSON<PersistedSettings>(STORAGE_KEY).then((saved) => {
      if (saved) {
        setIsFaceIdSetUp(saved.isFaceIdSetUp);
        setStepUpThreshold(saved.stepUpThreshold);
        setShouldBalancesBlur(saved.shouldBalancesBlur);
        setHasCompletedOnboarding(saved.hasCompletedOnboarding);
      }
      setIsHydrated(true);
    });
  }, []);

  // Runs on every change after that — but the `isHydrated` guard stops it
  // firing on the very first render, which would otherwise immediately
  // overwrite the saved file with these defaults before the load above
  // has had a chance to run.
  useEffect(() => {
    if (!isHydrated) return;
    saveJSON<PersistedSettings>(STORAGE_KEY, {
      isFaceIdSetUp,
      stepUpThreshold,
      shouldBalancesBlur,
      hasCompletedOnboarding,
    });
  }, [isHydrated, isFaceIdSetUp, stepUpThreshold, shouldBalancesBlur, hasCompletedOnboarding]);

  // Global privacy behavior: re-lock automatically the moment the app is
  // backgrounded (switching apps, the phone locking) — a standard banking-
  // app rule, not something any one screen should have to remember to do.
  // The function returned from useEffect is a *cleanup* — React calls it
  // right before this effect would run again (or the component unmounts),
  // which here removes the old listener before subscribing a new one.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && isFaceIdSetUp) {
        setIsAppLocked(true);
      }
    });
    return () => subscription.remove();
  }, [isFaceIdSetUp]);

  const value: SecurityState = {
    isHydrated,
    isAppLocked,
    isFaceIdSetUp,
    stepUpThreshold,
    shouldBalancesBlur,
    hasCompletedOnboarding,
    lockApp: () => setIsAppLocked(true),
    unlockApp: () => setIsAppLocked(false),
    setFaceIdSetUp: (value) => setIsFaceIdSetUp(value),
    setStepUpThreshold: (value) => setStepUpThreshold(value),
    toggleBalanceBlur: () => setShouldBalancesBlur((prev) => !prev),
    completeOnboarding: () => setHasCompletedOnboarding(true),
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
