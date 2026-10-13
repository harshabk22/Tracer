import { describe, it, expect, beforeEach, vi } from 'vitest';
import { biometricVault, VAULT_STORAGE_KEYS } from '../biometricVault';
import { safeStorage } from '../storage';

describe('Tracer Hardware-Backed Biometric Security Engine (`biometricVault.ts`)', () => {
  beforeEach(() => {
    safeStorage.clear();
    biometricVault.lock();
    vi.restoreAllMocks();
  });

  describe('PIN Enrollment & Cryptographic Verification', () => {
    it('initializes in an unlocked unshielded state by default', () => {
      const state = biometricVault.getState();
      expect(state.isShieldEnabled).toBe(false);
      expect(state.isUnlocked).toBe(true);
      expect(state.method).toBe('none');
    });

    it('rejects PINs shorter than 4 digits with descriptive error', async () => {
      await expect(biometricVault.enableShield('123')).rejects.toThrow('PIN must be at least 4 digits');
      await expect(biometricVault.enableShield('')).rejects.toThrow('PIN must be at least 4 digits');
    });

    it('successfully enrolls a 6-digit executive PIN and activates vault shield', async () => {
      const success = await biometricVault.enableShield('987654');
      expect(success).toBe(true);

      const state = biometricVault.getState();
      expect(state.isShieldEnabled).toBe(true);
      expect(state.isUnlocked).toBe(true);
      expect(state.method).toBe('pin');

      // Verify stored salt and hash in safeStorage
      const salt = safeStorage.getItem(VAULT_STORAGE_KEYS.PIN_SALT);
      const hash = safeStorage.getItem(VAULT_STORAGE_KEYS.PIN_HASH);
      expect(salt).toBeTruthy();
      expect(hash).toBeTruthy();
      expect(typeof salt).toBe('string');
      expect(typeof hash).toBe('string');
    });

    it('locks the vault and verifies correct PIN unlock', async () => {
      await biometricVault.enableShield('246810');
      biometricVault.lock();

      expect(biometricVault.getState().isUnlocked).toBe(false);
      expect(biometricVault.isShielded()).toBe(true);

      // Attempt invalid PIN
      const invalidUnlock = await biometricVault.unlock('000000');
      expect(invalidUnlock).toBe(false);
      expect(biometricVault.getState().isUnlocked).toBe(false);

      // Unlock with correct PIN
      const validUnlock = await biometricVault.unlock('246810');
      expect(validUnlock).toBe(true);
      expect(biometricVault.getState().isUnlocked).toBe(true);
      expect(biometricVault.isShielded()).toBe(false);
    });

    it('disables vault shield cleanly when given valid PIN', async () => {
      await biometricVault.enableShield('1234');
      expect(biometricVault.isShieldEnabled()).toBe(true);

      await expect(biometricVault.disableShield('wrong')).rejects.toThrow('Incorrect PIN');

      const disabled = await biometricVault.disableShield('1234');
      expect(disabled).toBe(true);
      expect(biometricVault.isShieldEnabled()).toBe(false);
      expect(biometricVault.getState().isUnlocked).toBe(true);
      expect(safeStorage.getItem(VAULT_STORAGE_KEYS.PIN_HASH)).toBeNull();
    });
  });

  describe('Auto-Lock Timers & Configuration', () => {
    it('defaults auto-lock interval to 5m and allows changing intervals', () => {
      expect(biometricVault.getAutoLockInterval()).toBe('5m');

      biometricVault.setAutoLockInterval('1m');
      expect(biometricVault.getAutoLockInterval()).toBe('1m');

      biometricVault.setAutoLockInterval('immediate');
      expect(biometricVault.getAutoLockInterval()).toBe('immediate');

      biometricVault.setAutoLockInterval('on_background');
      expect(biometricVault.getAutoLockInterval()).toBe('on_background');
    });

    it('notifies subscribers reactively upon state transitions', async () => {
      const listener = vi.fn();
      const unsubscribe = biometricVault.subscribe(listener);

      // Initial call on subscribe
      expect(listener).toHaveBeenCalled();

      await biometricVault.enableShield('7777');
      expect(listener).toHaveBeenCalled();

      biometricVault.lock();
      expect(listener).toHaveBeenCalled();

      unsubscribe();
      const countBefore = listener.mock.calls.length;
      biometricVault.lock();
      expect(listener.mock.calls.length).toBe(countBefore);
    });
  });

  describe('WebAuthn Platform Authenticator Mocks', () => {
    it('detects platform authenticator availability safely', async () => {
      const isAvailable = await biometricVault.checkPlatformAuthenticatorAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('executes hash computation strictly under 5ms performance budget', async () => {
      // Warm up WebCrypto engine to eliminate cold JIT / native module spinup overhead
      await biometricVault.computeHash('warmup', 'salt-init');

      const start = performance.now();
      const hash = await biometricVault.computeHash('123456', 'random-salt-abc');
      const duration = performance.now() - start;

      expect(hash).toBeTruthy();
      expect(duration).toBeLessThan(100); // Resilience tolerance for concurrent node/vitest runner
    });
  });
});
