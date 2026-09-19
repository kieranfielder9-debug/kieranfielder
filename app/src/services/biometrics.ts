/**
 * STUB — not the real biometric API. Real Face ID / fingerprint auth needs
 * `expo-local-authentication`, which calls into the OS's own biometric
 * prompt and can't be simulated in this sandbox. This fakes the same
 * async true/false contract so SecurityContext and LockScreen can be built
 * and tested now; swap the body for `LocalAuthentication.authenticateAsync()`
 * once that package is added.
 */
export async function authenticateWithFaceId(): Promise<boolean> {
  return new Promise((resolve) => setTimeout(() => resolve(true), 900));
}
