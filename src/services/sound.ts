// Executive Material 3 Tactile Web Audio & Haptic Synthesizer
// Synthesizes elegant low-latency feedback without external audio asset dependencies.

import { storage } from './storage';
import { AndroidBridge } from './androidBridge';

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  constructor() {
    try {
      this.isMuted = storage.getSoundMuted();
      this.volume = storage.getSoundVolume();
    } catch {
      this.isMuted = false;
      this.volume = 0.8;
    }
    this.initUserInteractionUnlock();
    this.initLifecycleListeners();
  }

  private initLifecycleListeners() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      } else if (document.visibilityState === 'visible') {
        if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
          this.ctx.resume().catch(() => {});
        }
      }
    });
  }

  private initUserInteractionUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      try {
        if (!this.ctx) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            this.ctx = new AudioContextClass();
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      } catch {
        // Ignore errors during unlock attempt
      }
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  private getContext(): AudioContext | null {
    if (this.isMuted || this.volume <= 0.001) return null;
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    storage.saveSoundMuted(muted);
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    storage.saveSoundVolume(this.volume);
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Luxury 2-tone ascending chime for micro-move completion
   * D5 (587.33Hz) -> A5 (880Hz) with gentle exponential decay
   */
  public playCompleteChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Harmonic step: starts at 587.33, leaps to 880 at 45ms
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.05);

      // Volume envelope: soft attack, gentle exponential decay
      const peakGain = Math.max(0.0001, 0.08 * this.volume);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
      AndroidBridge.hapticSuccess();
    } catch {
      // Silent fail if audio is blocked
    }
  }

  public playCelebration() {
    this.playCompleteChime();
  }

  /**
   * Subtle descending acoustic tone for undo
   */
  public playUndoChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(440.0, now + 0.12); // A4

      const peakGain = Math.max(0.0001, 0.06 * this.volume);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
      AndroidBridge.hapticTick();
    } catch {
      // Silent fail
    }
  }

  /**
   * Crisp micro-click for UI buttons and toggles
   */
  public playTick() {
    this.playLatchTick();
  }

  /**
   * Crisp micro-click for swipe latch threshold engagement
   */
  public playLatchTick() {
    try {
      AndroidBridge.hapticTick();
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.02);

      const peakGain = Math.max(0.0001, 0.03 * this.volume);
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch {
      // Silent fail
    }
  }

  /**
   * Low resonant alert for blockers
   */
  public playBlockerThud() {
    try {
      AndroidBridge.hapticWarning();
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

      const peakGain = Math.max(0.0001, 0.07 * this.volume);
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Silent fail
    }
  }

  private droneOsc: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private isDroneActive: boolean = false;
  private droneStopTimer: any = null;

  /**
   * 432Hz ambient focus drone with subtle 2Hz binaural alpha beat and gentle exponential envelope
   */
  public startFocusDrone() {
    try {
      if (this.droneStopTimer) {
        clearTimeout(this.droneStopTimer);
        this.droneStopTimer = null;
      }
      if (this.isMuted || this.volume <= 0.001 || this.isDroneActive) return;
      const ctx = this.getContext();
      if (!ctx) return;

      this.stopFocusDrone();

      const now = ctx.currentTime;
      this.droneGain = ctx.createGain();
      const targetGain = Math.max(0.0001, 0.035 * this.volume);
      this.droneGain.gain.setValueAtTime(0.0001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(targetGain, now + 1.5);

      // Primary 432Hz sine oscillator
      this.droneOsc = ctx.createOscillator();
      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.setValueAtTime(432, now);

      // Secondary 434Hz harmonic oscillator (2Hz gentle alpha focus beat)
      this.droneOsc2 = ctx.createOscillator();
      this.droneOsc2.type = 'sine';
      this.droneOsc2.frequency.setValueAtTime(434, now);

      this.droneOsc.connect(this.droneGain);
      this.droneOsc2.connect(this.droneGain);
      this.droneGain.connect(ctx.destination);

      this.droneOsc.start(now);
      this.droneOsc2.start(now);
      this.isDroneActive = true;
    } catch {}
  }

  public stopFocusDrone() {
    try {
      if (this.droneStopTimer) {
        clearTimeout(this.droneStopTimer);
        this.droneStopTimer = null;
      }

      const osc1 = this.droneOsc;
      const osc2 = this.droneOsc2;
      const gain = this.droneGain;
      this.droneOsc = null;
      this.droneOsc2 = null;
      this.droneGain = null;
      this.isDroneActive = false;

      if (gain && this.ctx) {
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      }

      this.droneStopTimer = setTimeout(() => {
        try {
          if (osc1) {
            osc1.stop();
            osc1.disconnect();
          }
          if (osc2) {
            osc2.stop();
            osc2.disconnect();
          }
          if (gain) {
            gain.disconnect();
          }
        } catch {}
        this.droneStopTimer = null;
      }, 700);
    } catch {
      this.isDroneActive = false;
    }
  }

  public isDronePlaying(): boolean {
    return this.isDroneActive;
  }
}

export const soundManager = new SoundManager();
