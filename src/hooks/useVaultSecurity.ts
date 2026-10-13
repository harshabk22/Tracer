import { useState, useEffect } from 'react';
import { biometricVault } from '../services/biometricVault';
import { VaultSecurityState, AutoLockInterval } from '../types/goal';

export function useVaultSecurity() {
  const [vaultState, setVaultState] = useState<VaultSecurityState>(() => biometricVault.getState());

  useEffect(() => {
    const unsubscribe = biometricVault.subscribe((newState) => {
      setVaultState(newState);
    });
    return unsubscribe;
  }, []);

  const formatRemainingTime = (sec: number): string => {
    if (sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s > 0 ? `${s}s` : ''}`.trim();
  };

  return {
    ...vaultState,
    isShielded: vaultState.isShieldEnabled && !vaultState.isUnlocked,
    formattedRemainingTime: formatRemainingTime(vaultState.lockTimeRemainingSec),
    lock: () => biometricVault.lock(),
    unlock: (pin?: string) => biometricVault.unlock(pin),
    enableShield: (pin: string, useBiometrics?: boolean) => biometricVault.enableShield(pin, useBiometrics),
    disableShield: (pin: string) => biometricVault.disableShield(pin),
    setAutoLockInterval: (interval: AutoLockInterval) => biometricVault.setAutoLockInterval(interval),
  };
}
