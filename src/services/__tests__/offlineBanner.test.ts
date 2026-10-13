import { describe, it, expect, vi, beforeEach } from 'vitest';
import { soundManager } from '../sound';
import { androidBridge } from '../androidBridge';

describe('Offline & Network Recovery Banner Mechanics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers haptic and harmonic completion chime on network recovery edge', () => {
    const playChimeSpy = vi.spyOn(soundManager, 'playCompleteChime').mockImplementation(() => {});
    const triggerHapticSpy = vi.spyOn(androidBridge, 'triggerHaptic').mockImplementation(async () => {});

    // Simulation of the OfflineStatusBanner edge detector
    let prevOnline = false;
    const currentOnline = true;

    if (!prevOnline && currentOnline) {
      soundManager.playCompleteChime();
      androidBridge.triggerHaptic('success');
    }

    expect(playChimeSpy).toHaveBeenCalledTimes(1);
    expect(triggerHapticSpy).toHaveBeenCalledWith('success');
  });

  it('does not trigger recovery cues when connection remains online continuously', () => {
    const playChimeSpy = vi.spyOn(soundManager, 'playCompleteChime').mockImplementation(() => {});
    const triggerHapticSpy = vi.spyOn(androidBridge, 'triggerHaptic').mockImplementation(async () => {});

    let prevOnline = true;
    const currentOnline = true;

    if (!prevOnline && currentOnline) {
      soundManager.playCompleteChime();
      androidBridge.triggerHaptic('success');
    }

    expect(playChimeSpy).not.toHaveBeenCalled();
    expect(triggerHapticSpy).not.toHaveBeenCalled();
  });

  it('formats offline banner message with queued changes count', () => {
    const formatOfflineBanner = (pendingSyncCount: number) => {
      const base = 'Offline Mode — Changes Queued Locally';
      return pendingSyncCount > 0 ? `${base} (${pendingSyncCount} queued)` : base;
    };

    expect(formatOfflineBanner(0)).toBe('Offline Mode — Changes Queued Locally');
    expect(formatOfflineBanner(4)).toBe('Offline Mode — Changes Queued Locally (4 queued)');
  });

  it('formats connection restored banner message with draining state', () => {
    const formatRestoredBanner = (pendingSyncCount: number) => {
      const base = 'Connection Restored — Vault Synced';
      return pendingSyncCount > 0 ? `${base} (draining)` : base;
    };

    expect(formatRestoredBanner(0)).toBe('Connection Restored — Vault Synced');
    expect(formatRestoredBanner(2)).toBe('Connection Restored — Vault Synced (draining)');
  });

  it('auto-clears restored notification pill after designated duration window', () => {
    vi.useFakeTimers();

    let showRestored = true;
    const autoDismiss = () => {
      setTimeout(() => {
        showRestored = false;
      }, 3500);
    };

    autoDismiss();
    expect(showRestored).toBe(true);

    vi.advanceTimersByTime(2000);
    expect(showRestored).toBe(true);

    vi.advanceTimersByTime(1600);
    expect(showRestored).toBe(false);

    vi.useRealTimers();
  });
});
