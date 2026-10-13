/**
 * Tracer Hardware-Backed Biometric Security & Cryptographic Vault Engine
 * File: src/services/biometricVault.ts
 *
 * Implements WebAuthn Platform Authenticator (Android Biometrics / Fingerprint / Face / Passkey)
 * with zero-dependency WebCrypto SHA-256 salted PIN fallback, configurable auto-relock timers,
 * lifecycle background detection (Capacitor App state + Document visibility), and tactile haptics.
 */

import { AutoLockInterval, VaultSecurityState } from '../types/goal';
import { safeStorage } from './storage';
import { androidBridge } from './androidBridge';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export const VAULT_STORAGE_KEYS = {
  SHIELD_ENABLED: 'tracer_vault_shield_enabled_v1',
  AUTOLOCK_INTERVAL: 'tracer_vault_autolock_interval_v1',
  PIN_HASH: 'tracer_vault_pin_hash_v1',
  PIN_SALT: 'tracer_vault_pin_salt_v1',
  CRED_ID: 'tracer_vault_cred_id_v1',
  AUTH_METHOD: 'tracer_vault_auth_method_v1',
};

const INTERVAL_DURATIONS: Record<AutoLockInterval, number> = {
  immediate: 0,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  on_background: Infinity,
};

type StateListener = (state: VaultSecurityState) => void;

class BiometricVaultService {
  private isUnlocked: boolean = false;
  private lastUnlockedAt: number | null = null;
  private lockTimer: any = null;
  private tickerTimer: any = null;
  private lockTimeRemainingSec: number = 0;
  private listeners: Set<StateListener> = new Set();
  private hasPlatformAuthCached: boolean | null = null;

  constructor() {
    this.initLifecycleListeners();
  }

  /**
   * Initializes visibility change & Capacitor app state background listeners.
   */
  private initLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    // Document visibility change listener
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.handleBackgroundEvent();
      }
    });

    // Window blur listener for desktop/laptop privacy
    window.addEventListener('blur', () => {
      const interval = this.getAutoLockInterval();
      if (interval === 'immediate') {
        this.lock();
      }
    });

    // Capacitor Native App state listener
    if (Capacitor.isNativePlatform()) {
      try {
        CapApp.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            this.handleBackgroundEvent();
          }
        }).catch(() => {});
      } catch {}
    }
  }

  private handleBackgroundEvent(): void {
    if (!this.isShieldEnabled()) return;
    const interval = this.getAutoLockInterval();
    if (interval === 'immediate' || interval === 'on_background') {
      this.lock();
    }
  }

  /**
   * Detects if device supports hardware-backed platform biometrics (WebAuthn / Android Fingerprint).
   */
  public async checkPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (this.hasPlatformAuthCached !== null) {
      return this.hasPlatformAuthCached;
    }

    if (
      typeof window === 'undefined' ||
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
    ) {
      this.hasPlatformAuthCached = false;
      return false;
    }

    try {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      this.hasPlatformAuthCached = Boolean(available);
      return this.hasPlatformAuthCached;
    } catch {
      this.hasPlatformAuthCached = false;
      return false;
    }
  }

  /**
   * Generates or retrieves cryptographic salt for PIN hashing.
   */
  private getOrCreateSalt(): string {
    let salt = safeStorage.getItem(VAULT_STORAGE_KEYS.PIN_SALT);
    if (!salt) {
      const randomBytes = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
      } else {
        for (let i = 0; i < 16; i++) randomBytes[i] = Math.floor(Math.random() * 256);
      }
      salt = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      safeStorage.setItem(VAULT_STORAGE_KEYS.PIN_SALT, salt);
    }
    return salt;
  }

  /**
   * Computes SHA-256 hash of (salt + pin) using WebCrypto API.
   */
  public async computeHash(text: string, salt: string): Promise<string> {
    const combined = `${salt}:${text.trim()}`;
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(combined);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {}
    }

    // Fallback deterministic bitwise hash for test runners lacking SubtleCrypto
    let h1 = 0xdeadbeef ^ combined.length;
    let h2 = 0x41c6ce57 ^ combined.length;
    for (let i = 0; i < combined.length; i++) {
      const ch = combined.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  /**
   * Checks whether the vault shield is currently active in user settings.
   */
  public isShieldEnabled(): boolean {
    return safeStorage.getItem(VAULT_STORAGE_KEYS.SHIELD_ENABLED) === 'true';
  }

  public getAutoLockInterval(): AutoLockInterval {
    const val = safeStorage.getItem(VAULT_STORAGE_KEYS.AUTOLOCK_INTERVAL) as AutoLockInterval;
    if (val && ['immediate', '1m', '5m', '15m', 'on_background'].includes(val)) {
      return val;
    }
    return '5m';
  }

  public setAutoLockInterval(interval: AutoLockInterval): void {
    safeStorage.setItem(VAULT_STORAGE_KEYS.AUTOLOCK_INTERVAL, interval);
    if (this.isUnlocked) {
      this.resetAutoLockTimer();
    }
    this.notifyListeners();
  }

  public getAuthMethod(): 'biometric' | 'pin' | 'none' {
    if (!this.isShieldEnabled()) return 'none';
    const method = safeStorage.getItem(VAULT_STORAGE_KEYS.AUTH_METHOD);
    return method === 'biometric' ? 'biometric' : 'pin';
  }

  /**
   * Returns current consolidated security state.
   */
  public getState(): VaultSecurityState {
    const shieldEnabled = this.isShieldEnabled();
    return {
      isShieldEnabled: shieldEnabled,
      isUnlocked: shieldEnabled ? this.isUnlocked : true,
      hasPlatformAuthenticator: Boolean(this.hasPlatformAuthCached),
      lockTimeRemainingSec: shieldEnabled && this.isUnlocked ? this.lockTimeRemainingSec : 0,
      autoLockInterval: this.getAutoLockInterval(),
      lastUnlockedAt: this.lastUnlockedAt,
      method: this.getAuthMethod(),
    };
  }

  /**
   * Subscribes to vault lock/unlock status changes.
   */
  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.error('[BiometricVault] Listener error:', err);
      }
    });
  }

  /**
   * Enrolls a new PIN and activates Vault Shield.
   * If useBiometrics is true and supported, also registers a WebAuthn credential.
   */
  public async enableShield(pin: string, useBiometrics: boolean = false): Promise<boolean> {
    if (!pin || pin.trim().length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    const salt = this.getOrCreateSalt();
    const pinHash = await this.computeHash(pin, salt);
    safeStorage.setItem(VAULT_STORAGE_KEYS.PIN_HASH, pinHash);
    safeStorage.setItem(VAULT_STORAGE_KEYS.SHIELD_ENABLED, 'true');

    let method: 'biometric' | 'pin' = 'pin';

    if (useBiometrics && (await this.checkPlatformAuthenticatorAvailable())) {
      try {
        const credId = await this.registerWebAuthnCredential();
        if (credId) {
          safeStorage.setItem(VAULT_STORAGE_KEYS.CRED_ID, credId);
          method = 'biometric';
        }
      } catch (e) {
        console.warn('[BiometricVault] WebAuthn enrollment skipped or cancelled, using PIN:', e);
      }
    }

    safeStorage.setItem(VAULT_STORAGE_KEYS.AUTH_METHOD, method);
    this.isUnlocked = true;
    this.lastUnlockedAt = Date.now();
    this.resetAutoLockTimer();
    this.notifyListeners();
    androidBridge.triggerHaptic('success');
    return true;
  }

  /**
   * Registers a WebAuthn platform credential.
   */
  private async registerWebAuthnCredential(): Promise<string | null> {
    if (typeof window === 'undefined' || !navigator.credentials?.create) return null;

    const challenge = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(challenge);
    }

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Tracer Executive Vault',
        id: window.location.hostname || 'localhost',
      },
      user: {
        id: new Uint8Array([84, 82, 65, 67, 69, 82]), // "TRACER"
        name: 'executive@tracer.local',
        displayName: 'Tracer Executive Lead',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential;

    if (credential && credential.id) {
      return credential.id;
    }
    return null;
  }

  /**
   * Authenticates using WebAuthn or PIN.
   */
  public async unlock(pin?: string): Promise<boolean> {
    if (!this.isShieldEnabled()) {
      this.isUnlocked = true;
      this.notifyListeners();
      return true;
    }

    // Attempt WebAuthn if no PIN passed and biometric enabled
    if (!pin && this.getAuthMethod() === 'biometric') {
      try {
        const success = await this.verifyWebAuthn();
        if (success) {
          this.setUnlockedSuccess();
          return true;
        }
      } catch (err: any) {
        console.warn('[BiometricVault] Biometric auth cancelled or failed:', err);
        androidBridge.triggerHaptic('error');
        return false;
      }
    }

    // Verify PIN
    if (pin) {
      const storedHash = safeStorage.getItem(VAULT_STORAGE_KEYS.PIN_HASH);
      const salt = safeStorage.getItem(VAULT_STORAGE_KEYS.PIN_SALT) || '';
      if (!storedHash) return false;

      const computed = await this.computeHash(pin, salt);
      if (computed === storedHash) {
        this.setUnlockedSuccess();
        return true;
      } else {
        androidBridge.triggerHaptic('error');
        return false;
      }
    }

    return false;
  }

  private async verifyWebAuthn(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.credentials?.get) return false;

    const challenge = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(challenge);
    }

    const credId = safeStorage.getItem(VAULT_STORAGE_KEYS.CRED_ID);
    const allowCredentials: PublicKeyCredentialDescriptor[] = credId
      ? [
          {
            id: Uint8Array.from(atob(credId.replace(/_/g, '/').replace(/-/g, '+')), (c) => c.charCodeAt(0)),
            type: 'public-key',
          },
        ]
      : [];

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: allowCredentials.length ? allowCredentials : undefined,
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return Boolean(credential);
  }

  private setUnlockedSuccess(): void {
    this.isUnlocked = true;
    this.lastUnlockedAt = Date.now();
    this.resetAutoLockTimer();
    this.notifyListeners();
    androidBridge.triggerHaptic('success');
  }

  /**
   * Immediately locks the vault.
   */
  public lock(): void {
    if (!this.isShieldEnabled()) return;
    this.isUnlocked = false;
    this.clearTimers();
    this.lockTimeRemainingSec = 0;
    this.notifyListeners();
    androidBridge.triggerHaptic('light');
  }

  /**
   * Completely disables vault shielding (requires PIN verification).
   */
  public async disableShield(pin: string): Promise<boolean> {
    const verified = await this.unlock(pin);
    if (!verified) {
      throw new Error('Incorrect PIN. Cannot disable vault shield.');
    }

    safeStorage.removeItem(VAULT_STORAGE_KEYS.SHIELD_ENABLED);
    safeStorage.removeItem(VAULT_STORAGE_KEYS.PIN_HASH);
    safeStorage.removeItem(VAULT_STORAGE_KEYS.PIN_SALT);
    safeStorage.removeItem(VAULT_STORAGE_KEYS.CRED_ID);
    safeStorage.removeItem(VAULT_STORAGE_KEYS.AUTH_METHOD);

    this.isUnlocked = true;
    this.clearTimers();
    this.notifyListeners();
    androidBridge.triggerHaptic('complete');
    return true;
  }

  /**
   * Resets auto-lock timer countdown.
   */
  private resetAutoLockTimer(): void {
    this.clearTimers();
    const interval = this.getAutoLockInterval();
    const durationSec = INTERVAL_DURATIONS[interval];

    if (!isFinite(durationSec) || durationSec <= 0) {
      if (durationSec === 0) {
        // Immediate locking
        this.lockTimeRemainingSec = 0;
      }
      return;
    }

    this.lockTimeRemainingSec = durationSec;

    // Ticker timer for reactive UI countdown
    this.tickerTimer = setInterval(() => {
      if (this.lockTimeRemainingSec > 0) {
        this.lockTimeRemainingSec -= 1;
        this.notifyListeners();
      } else {
        this.lock();
      }
    }, 1000);
  }

  private clearTimers(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
  }

  /**
   * True if shield is active and vault is currently locked.
   */
  public isShielded(): boolean {
    return this.isShieldEnabled() && !this.isUnlocked;
  }
}

export const biometricVault = new BiometricVaultService();
