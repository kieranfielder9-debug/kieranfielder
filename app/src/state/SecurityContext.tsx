import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';

type SecurityState = {
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
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isFaceIdSetUp, setIsFaceIdSetUp] = useState(false);
  const [stepUpThreshold, setStepUpThreshold] = useState(500);
  const [shouldBalancesBlur, setShouldBalancesBlur] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

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
