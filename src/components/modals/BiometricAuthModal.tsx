import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Delete,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ModalSheet } from '../common/ModalSheet';
import { biometricVault } from '../../services/biometricVault';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

export interface BiometricAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  actionType?: 'unlock' | 'destructive' | 'setup' | 'export';
}

export const BiometricAuthModal: React.FC<BiometricAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title,
  description,
  actionType = 'unlock',
}) => {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [useBiometricsForSetup, setUseBiometricsForSetup] = useState<boolean>(true);
  const [hasPlatformAuth, setHasPlatformAuth] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const [showPinPad, setShowPinPad] = useState<boolean>(() => {
    // If setting up or no biometric method, default to PIN
    return actionType === 'setup' || biometricVault.getAuthMethod() === 'pin';
  });

  const isShieldEnabled = biometricVault.isShieldEnabled();
  const isSetupMode = actionType === 'setup' || !isShieldEnabled;

  // Query platform authenticator support on mount
  useEffect(() => {
    biometricVault.checkPlatformAuthenticatorAvailable().then((available) => {
      setHasPlatformAuth(available);
      if (!available) {
        setShowPinPad(true);
      }
    });
  }, []);

  // Auto-prompt WebAuthn on open if biometric method is configured and not setup
  useEffect(() => {
    if (isOpen && !isSetupMode && biometricVault.getAuthMethod() === 'biometric' && !showPinPad) {
      handleBiometricPrompt();
    }
  }, [isOpen, isSetupMode]);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    androidBridge.triggerHaptic('error');
    setTimeout(() => {
      setShake(false);
      setPin('');
      if (isSetupMode && setupStep === 'confirm') {
        setConfirmPin('');
        setSetupStep('enter');
      }
    }, 600);
  };

  const handleBiometricPrompt = async () => {
    setIsAuthenticating(true);
    setErrorMsg(null);
    try {
      soundManager.playTick();
      androidBridge.triggerHaptic('selection');
      const success = await biometricVault.unlock();
      if (success) {
        soundManager.playCompleteChime();
        androidBridge.triggerHaptic('success');
        onSuccess();
        onClose();
      } else {
        triggerError('Biometric verification failed. Use PIN below.');
        setShowPinPad(true);
      }
    } catch (err: any) {
      triggerError('Biometric verification cancelled.');
      setShowPinPad(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleKeypadPress = async (digit: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    setErrorMsg(null);

    if (isSetupMode) {
      if (setupStep === 'enter') {
        if (pin.length < 4) {
          const nextPin = pin + digit;
          setPin(nextPin);
          if (nextPin.length === 4) {
            // Advance to confirmation step
            setTimeout(() => {
              setSetupStep('confirm');
              androidBridge.triggerHaptic('selection');
            }, 250);
          }
        }
      } else {
        // Confirm step
        if (confirmPin.length < 4) {
          const nextConfirm = confirmPin + digit;
          setConfirmPin(nextConfirm);
          if (nextConfirm.length === 4) {
            if (nextConfirm === pin) {
              // Successfully matched!
              try {
                await biometricVault.enableShield(pin, useBiometricsForSetup && hasPlatformAuth);
                soundManager.playCompleteChime();
                androidBridge.triggerHaptic('success');
                onSuccess();
                onClose();
              } catch (err: any) {
                triggerError(err.message || 'Failed to activate vault shield');
              }
            } else {
              triggerError('PINs did not match. Please re-enter.');
            }
          }
        }
      }
      return;
    }

    // Standard Unlock Mode
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 4) {
        setIsAuthenticating(true);
        const success = await biometricVault.unlock(nextPin);
        setIsAuthenticating(false);

        if (success) {
          soundManager.playCompleteChime();
          androidBridge.triggerHaptic('success');
          onSuccess();
          onClose();
        } else {
          triggerError('Incorrect PIN. Access Denied.');
        }
      }
    }
  };

  const handleDelete = () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    if (isSetupMode) {
      if (setupStep === 'confirm') {
        setConfirmPin((prev) => prev.slice(0, -1));
      } else {
        setPin((prev) => prev.slice(0, -1));
      }
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  if (!isOpen) return null;

  const currentPinDisplay = isSetupMode && setupStep === 'confirm' ? confirmPin : pin;

  const resolvedTitle =
    title ||
    (isSetupMode
      ? 'Setup Cryptographic Shield'
      : actionType === 'destructive'
      ? 'Biometric Confirmation Required'
      : actionType === 'export'
      ? 'Unshield Sensitive Briefing'
      : 'Tracer Cryptographic Shield');

  const resolvedSubtitle =
    description ||
    (isSetupMode
      ? setupStep === 'enter'
        ? 'Create a 4-digit master PIN to secure your private notes & data'
        : 'Re-enter your 4-digit PIN to confirm'
      : actionType === 'destructive'
      ? 'Authenticate to authorize irreversible database reset'
      : 'Hardware-backed authorization required to access protected space');

  return (
    <ModalSheet
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <span>{resolvedTitle}</span>
          {actionType === 'destructive' ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rust/15 text-rust border border-rust/30">
              HIGH SECURITY
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-terracotta/15 text-terracotta border border-terracotta/30">
              WEBAUTHN
            </span>
          )}
        </div>
      }
      subtitle={resolvedSubtitle}
      icon={actionType === 'destructive' ? ShieldAlert : Fingerprint}
      iconBgColor={
        actionType === 'destructive'
          ? 'bg-rust/15 text-rust border border-rust/30'
          : 'bg-terracotta/15 text-terracotta border border-terracotta/30'
      }
      maxWidth="max-w-sm"
      showDragHandle={true}
    >
      <div className="py-2 space-y-5">
        {/* Visual Centerpiece: Biometric Radar Pulse */}
        <div className="relative flex flex-col items-center justify-center py-4">
          <div className="relative flex items-center justify-center w-28 h-28">
            {/* Concentric glowing radar rings */}
            <motion.div
              animate={{
                scale: isAuthenticating ? [1, 1.45, 1.8] : [1, 1.25, 1],
                opacity: isAuthenticating ? [0.6, 0.25, 0] : [0.35, 0.15, 0.35],
              }}
              transition={{
                duration: isAuthenticating ? 1.5 : 3.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 rounded-full border border-terracotta/40 pointer-events-none"
            />
            <motion.div
              animate={{
                scale: isAuthenticating ? [1, 1.2, 1.5] : [1, 1.15, 1],
                opacity: isAuthenticating ? [0.7, 0.35, 0] : [0.45, 0.2, 0.45],
              }}
              transition={{
                duration: isAuthenticating ? 1.5 : 3.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.3,
              }}
              className="absolute inset-2 rounded-full border border-amber/35 pointer-events-none"
            />

            {/* Central Specular Shield Disc */}
            <div
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-specular transition-all duration-300 ${
                actionType === 'destructive'
                  ? 'bg-gradient-to-b from-rust/20 to-obsidian-surface border border-rust/40 text-rust'
                  : 'bg-gradient-to-b from-terracotta/20 to-obsidian-surface border border-terracotta/40 text-terracotta'
              }`}
            >
              {isShieldEnabled ? (
                <Fingerprint className="w-10 h-10 animate-pulse" />
              ) : (
                <ShieldCheck className="w-10 h-10 text-sage" />
              )}
            </div>
          </div>

          <div className="text-center mt-2">
            <span className="text-[11px] font-mono text-bone-400 uppercase tracking-wider">
              {isSetupMode
                ? setupStep === 'enter'
                  ? 'Step 1 of 2: Create Master PIN'
                  : 'Step 2 of 2: Verify Master PIN'
                : actionType === 'destructive'
                ? 'Cryptographic Confirmation Gate'
                : 'Zero-Knowledge Biometric Vault'}
            </span>
          </div>
        </div>

        {/* 4-Dot Masked PIN Indicator */}
        <motion.div
          animate={{ x: shake ? [-12, 12, -8, 8, -4, 4, 0] : 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center space-y-2"
        >
          <div className="flex items-center space-x-4 py-2">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = currentPinDisplay.length > idx;
              return (
                <motion.div
                  key={idx}
                  animate={{
                    scale: isFilled ? 1.15 : 1,
                    backgroundColor: isFilled
                      ? actionType === 'destructive'
                        ? '#BC4749'
                        : '#D97736'
                      : 'rgba(255, 255, 255, 0.08)',
                  }}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                    isFilled
                      ? actionType === 'destructive'
                        ? 'border-rust shadow-sm'
                        : 'border-terracotta shadow-sm'
                      : 'border-obsidian-borderSubtle'
                  }`}
                />
              );
            })}
          </div>

          {errorMsg ? (
            <div className="flex items-center space-x-1.5 text-xs text-rust animate-fade-in font-medium">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <div className="text-[10px] text-bone-400 font-mono">
              {isSetupMode
                ? setupStep === 'enter'
                  ? 'Enter 4 digits'
                  : 'Re-enter same 4 digits'
                : 'Enter your 4-digit PIN'}
            </div>
          )}
        </motion.div>

        {/* Platform Biometric Trigger (if available & not in setup mode) */}
        {!isSetupMode && hasPlatformAuth && !showPinPad && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleBiometricPrompt}
              disabled={isAuthenticating}
              className="w-full min-h-[56px] rounded-2xl bg-terracotta hover:bg-terracotta-hover text-white font-bold text-sm transition-all flex items-center justify-center space-x-2 m3-press shadow-surface active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <Fingerprint className="w-5 h-5" />
              <span>{isAuthenticating ? 'Authenticating...' : 'Use Android Biometrics / Touch ID'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playTick();
                androidBridge.triggerHaptic('light');
                setShowPinPad(true);
              }}
              className="w-full min-h-[48px] py-2 text-xs text-bone-400 hover:text-bone-200 transition-colors font-mono text-center flex items-center justify-center m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
            >
              Or enter PIN passcode instead
            </button>
          </div>
        )}

        {/* Tactile 10-Key Numeric PIN Pad */}
        {(showPinPad || isSetupMode) && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  aria-label={`Digit ${digit}`}
                  onClick={() => handleKeypadPress(digit)}
                  className="w-full h-14 min-h-[52px] rounded-2xl bg-obsidian-surface hover:bg-obsidian-elevated active:bg-terracotta/20 border border-obsidian-border text-lg font-semibold text-bone-100 transition-all m3-press shadow-specular-subtle flex items-center justify-center select-none"
                >
                  {digit}
                </button>
              ))}

              {/* Bottom Row: Biometrics/Cancel, 0, Backspace */}
              <div className="flex items-center justify-center">
                {!isSetupMode && hasPlatformAuth ? (
                  <button
                    type="button"
                    aria-label="Authenticate with Platform Biometrics"
                    onClick={handleBiometricPrompt}
                    className="w-full h-14 min-h-[52px] rounded-2xl bg-obsidian-highlight hover:bg-white/10 text-terracotta border border-obsidian-border transition-all m3-press shadow-specular-subtle flex items-center justify-center"
                    title="Authenticate with Biometrics"
                  >
                    <Fingerprint className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={isSetupMode && setupStep === 'confirm' ? 'Back' : 'Cancel'}
                    onClick={() => {
                      if (isSetupMode && setupStep === 'confirm') {
                        setSetupStep('enter');
                        setConfirmPin('');
                        setPin('');
                      } else {
                        onClose();
                      }
                    }}
                    className="w-full h-14 min-h-[52px] rounded-2xl text-xs font-mono text-bone-400 hover:text-bone-200 transition-colors flex items-center justify-center"
                  >
                    {isSetupMode && setupStep === 'confirm' ? 'Back' : 'Cancel'}
                  </button>
                )}
              </div>

              <button
                type="button"
                aria-label="Digit 0"
                onClick={() => handleKeypadPress('0')}
                className="w-full h-14 min-h-[52px] rounded-2xl bg-obsidian-surface hover:bg-obsidian-elevated active:bg-terracotta/20 border border-obsidian-border text-lg font-semibold text-bone-100 transition-all m3-press shadow-specular-subtle flex items-center justify-center select-none"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="w-full h-14 min-h-[52px] rounded-2xl bg-obsidian-surface hover:bg-obsidian-elevated active:bg-rust/20 border border-obsidian-border text-bone-300 hover:text-bone-100 transition-all m3-press shadow-specular-subtle flex items-center justify-center"
                title="Delete digit"
                aria-label="Delete digit"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Biometric Toggle for Setup Mode */}
            {isSetupMode && hasPlatformAuth && (
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-obsidian-elevated border border-obsidian-borderSubtle text-xs text-bone-200 cursor-pointer select-none">
                <div className="flex items-center space-x-2">
                  <Fingerprint className="w-4 h-4 text-terracotta" />
                  <span>Enable Biometrics (Fingerprint / Face ID)</span>
                </div>
                <input
                  type="checkbox"
                  checked={useBiometricsForSetup}
                  onChange={(e) => setUseBiometricsForSetup(e.target.checked)}
                  className="rounded border-obsidian-border text-terracotta focus:ring-terracotta"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </ModalSheet>
  );
};
