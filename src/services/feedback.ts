// Executive Material 3 Unified Feedback Governance
// Consolidates tactile haptics and acoustic chimes under a single policy:
// 1. Honors user audio mute & volume preferences (storage.getSoundMuted()).
// 2. Honors user haptics toggle (storage.getHapticsEnabled()).
// 3. Honors OS reduced-motion accessibility preference (prefers-reduced-motion: reduce).
// 4. Provides a unified feedback.action(...) API.

import { soundManager } from './sound';
import { androidBridge, HapticFeedbackType } from './androidBridge';
import { storage } from './storage';

export type FeedbackActionType =
  | 'tick'
  | 'tap'
  | 'toggle'
  | 'selection'
  | 'tabSwitch'
  | 'stepper'
  | 'complete'
  | 'success'
  | 'warning'
  | 'error'
  | 'impact';

class FeedbackGovernance {
  public isReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  public action(type: FeedbackActionType = 'tick'): void {
    const reducedMotion = this.isReducedMotion();
    const hapticsEnabled = storage.getHapticsEnabled();
    const soundMuted = storage.getSoundMuted();

    // Sound Governance
    if (!soundMuted) {
      try {
        switch (type) {
          case 'tick':
          case 'tap':
          case 'toggle':
          case 'selection':
          case 'tabSwitch':
          case 'stepper':
            soundManager.playTick();
            break;
          case 'complete':
          case 'success':
            soundManager.playCompleteChime();
            break;
          case 'warning':
          case 'error':
            soundManager.playBlockerThud();
            break;
          default:
            soundManager.playTick();
            break;
        }
      } catch {
        // Audio playback fallback
      }
    }

    // Haptic Governance (suppressed when haptics are disabled or reduced motion is requested)
    if (hapticsEnabled && !reducedMotion) {
      try {
        const hapticMap: Record<FeedbackActionType, HapticFeedbackType> = {
          tick: 'light',
          tap: 'light',
          toggle: 'selection',
          selection: 'selection',
          tabSwitch: 'tabSwitch',
          stepper: 'stepper',
          complete: 'complete',
          success: 'complete',
          warning: 'warning',
          error: 'error',
          impact: 'impact',
        };
        const hapticType = hapticMap[type] || 'light';
        androidBridge.triggerHaptic(hapticType);
      } catch {
        // Haptics fallback
      }
    }
  }

  public tick(): void {
    this.action('tick');
  }

  public selection(): void {
    this.action('selection');
  }

  public tabSwitch(): void {
    this.action('tabSwitch');
  }

  public stepper(): void {
    this.action('stepper');
  }

  public complete(): void {
    this.action('complete');
  }

  public success(): void {
    this.action('success');
  }

  public warning(): void {
    this.action('warning');
  }

  public error(): void {
    this.action('error');
  }
}

export const feedback = new FeedbackGovernance();
