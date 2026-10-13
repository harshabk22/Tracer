/**
 * Tracer Tactile Deep Work Focus Session Stopwatch Engine
 * Implements high-precision stopwatch and countdown mechanics
 * using real timestamp deltas. Coupled with native Android haptics and soundManager.
 */

import { MicroMove } from '../types/goal';
import { soundManager } from './sound';
import { androidBridge } from './androidBridge';
import { notificationEngine } from './notificationEngine';

export interface FocusSessionState {
  isActive: boolean;
  isPaused: boolean;
  move: MicroMove | null;
  targetSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  overtimeSeconds: number;
  progressPct: number;
  droneActive: boolean;
  startedAt: number | null;
}

type SessionListener = (state: FocusSessionState) => void;

class FocusSessionEngine {
  private activeMove: MicroMove | null = null;
  private targetSeconds: number = 25 * 60;
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private accumulatedPauseMs: number = 0;
  private isPaused: boolean = false;
  private droneActive: boolean = false;
  private ticker: any = null;
  private listeners: Set<SessionListener> = new Set();

  constructor() {
    this.initLifecycleListeners();
  }

  private initLifecycleListeners(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.stopTicker();
      } else if (document.visibilityState === 'visible' && this.activeMove && !this.isPaused) {
        this.notify();
        this.startTicker();
      }
    });
  }

  public getState(): FocusSessionState {
    const now = Date.now();
    let elapsedSeconds = 0;

    if (this.startedAt) {
      const activeDurationMs = this.isPaused && this.pausedAt
        ? this.pausedAt - this.startedAt - this.accumulatedPauseMs
        : now - this.startedAt - this.accumulatedPauseMs;
      elapsedSeconds = Math.max(0, Math.floor(activeDurationMs / 1000));
    }

    const remainingSeconds = Math.max(0, this.targetSeconds - elapsedSeconds);
    const overtimeSeconds = Math.max(0, elapsedSeconds - this.targetSeconds);
    const progressPct = this.targetSeconds > 0
      ? Math.min(100, Math.max(0, parseFloat(((elapsedSeconds / this.targetSeconds) * 100).toFixed(1))))
      : 100;

    return {
      isActive: Boolean(this.activeMove),
      isPaused: this.isPaused,
      move: this.activeMove,
      targetSeconds: this.targetSeconds,
      elapsedSeconds,
      remainingSeconds,
      overtimeSeconds,
      progressPct,
      droneActive: this.droneActive,
      startedAt: this.startedAt,
    };
  }

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.error('[FocusSessionEngine] Listener error:', err);
      }
    });
  }

  public startSession(move: MicroMove, minutes?: number): FocusSessionState {
    this.cancelSession();

    this.activeMove = move;
    const durationMinutes = minutes ?? move.estimatedMinutes ?? 25;
    this.targetSeconds = Math.max(60, durationMinutes * 60);
    this.startedAt = Date.now();
    this.pausedAt = null;
    this.accumulatedPauseMs = 0;
    this.isPaused = false;

    this.startTicker();
    soundManager.playLatchTick();
    androidBridge.triggerHaptic('selection');

    // Schedule exact AlarmManager notification for session completion
    notificationEngine.scheduleFocusSessionCompletion(move.title, this.targetSeconds);

    this.notify();
    return this.getState();
  }

  public pauseSession(): void {
    if (!this.activeMove || this.isPaused) return;
    this.isPaused = true;
    this.pausedAt = Date.now();
    this.cancelSessionNotification();
    if (this.droneActive) {
      soundManager.stopFocusDrone();
    }
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    this.notify();
  }

  public resumeSession(): void {
    if (!this.activeMove || !this.isPaused || !this.pausedAt) return;
    const pauseDuration = Date.now() - this.pausedAt;
    this.accumulatedPauseMs += Math.max(0, pauseDuration);
    this.isPaused = false;
    this.pausedAt = null;
    if (this.droneActive) {
      soundManager.startFocusDrone();
    }
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');

    // Reschedule exact notification for remaining seconds
    const state = this.getState();
    notificationEngine.scheduleFocusSessionCompletion(this.activeMove.title, state.remainingSeconds);

    this.notify();
  }

  public extendBuffer(additionalMinutes: number = 5): void {
    if (!this.activeMove) return;
    this.targetSeconds += Math.max(60, additionalMinutes * 60);
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');

    // Reschedule notification with extended buffer
    const state = this.getState();
    notificationEngine.scheduleFocusSessionCompletion(this.activeMove.title, state.remainingSeconds);

    this.notify();
  }

  public toggleDrone(): boolean {
    if (!this.activeMove) return false;
    this.droneActive = !this.droneActive;
    if (this.droneActive && !this.isPaused) {
      soundManager.startFocusDrone();
    } else {
      soundManager.stopFocusDrone();
    }
    androidBridge.triggerHaptic('selection');
    this.notify();
    return this.droneActive;
  }

  public finishAndComplete(_note?: string): { moveId: string; actualMinutes: number } | null {
    if (!this.activeMove) return null;

    this.cancelSessionNotification();
    const moveId = this.activeMove.id;
    const state = this.getState();
    const actualMinutes = Math.max(1, Math.round(state.elapsedSeconds / 60));

    this.stopTicker();
    if (this.droneActive) {
      soundManager.stopFocusDrone();
      this.droneActive = false;
    }

    this.activeMove = null;
    this.startedAt = null;
    this.pausedAt = null;
    this.accumulatedPauseMs = 0;
    this.isPaused = false;

    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('complete');

    this.notify();
    return { moveId, actualMinutes };
  }

  public cancelSessionNotification(): void {
    notificationEngine.cancelSessionNotification();
  }

  public cancelSession(): void {
    this.cancelSessionNotification();
    this.stopTicker();
    if (this.droneActive) {
      soundManager.stopFocusDrone();
      this.droneActive = false;
    }
    this.activeMove = null;
    this.startedAt = null;
    this.pausedAt = null;
    this.accumulatedPauseMs = 0;
    this.isPaused = false;
    this.notify();
  }

  private startTicker(): void {
    this.stopTicker();
    this.ticker = setInterval(() => {
      this.notify();
    }, 1000);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}

export const focusSessionEngine = new FocusSessionEngine();
