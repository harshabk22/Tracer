import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { focusSessionEngine } from '../focusSessionEngine';
import { soundManager } from '../sound';
import { notificationEngine } from '../notificationEngine';
import { MicroMove } from '../../types/goal';

describe('Tracer Tactile Deep Work Focus Session Stopwatch Engine (`focusSessionEngine.ts`)', () => {
  const mockMove: MicroMove = {
    id: 'focus-test-move-1',
    goalId: 'goal-1',
    milestoneId: 'ms-1',
    title: 'Architect Discrete State Machine',
    description: 'Unit testing focus session HUD engine',
    estimatedMinutes: 25,
    actualMinutes: 0,
    status: 'todo',
    dateScheduled: '2026-09-12',
    isCriticalPath: true,
    isPrivate: false,
    order: 1,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    focusSessionEngine.cancelSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    focusSessionEngine.cancelSession();
    vi.useRealTimers();
  });

  describe('Session Lifecycle & Timekeeping', () => {
    it('initializes in an inactive idle state by default', () => {
      const state = focusSessionEngine.getState();
      expect(state.isActive).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.move).toBeNull();
      expect(state.elapsedSeconds).toBe(0);
    });

    it('starts a deep work focus session with specified or default target duration', () => {
      const state = focusSessionEngine.startSession(mockMove, 30);

      expect(state.isActive).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.move?.id).toBe('focus-test-move-1');
      expect(state.targetSeconds).toBe(1800); // 30m * 60s
      expect(state.remainingSeconds).toBe(1800);
      expect(state.progressPct).toBe(0);
    });

    it('accurately advances elapsed seconds over time', () => {
      focusSessionEngine.startSession(mockMove, 20);

      // Advance by 5 minutes (300s)
      vi.advanceTimersByTime(300000);

      const state = focusSessionEngine.getState();
      expect(state.elapsedSeconds).toBe(300);
      expect(state.remainingSeconds).toBe(900); // 1200 - 300
      expect(state.progressPct).toBe(25); // 300 / 1200 = 25%
    });

    it('pauses and resumes without leaking time during pause intervals', () => {
      focusSessionEngine.startSession(mockMove, 10);

      // Run 60s
      vi.advanceTimersByTime(60000);
      expect(focusSessionEngine.getState().elapsedSeconds).toBe(60);

      // Pause for 120s
      focusSessionEngine.pauseSession();
      expect(focusSessionEngine.getState().isPaused).toBe(true);

      vi.advanceTimersByTime(120000);
      // Elapsed seconds should still be exactly 60
      expect(focusSessionEngine.getState().elapsedSeconds).toBe(60);

      // Resume and run 30s
      focusSessionEngine.resumeSession();
      expect(focusSessionEngine.getState().isPaused).toBe(false);

      vi.advanceTimersByTime(30000);
      expect(focusSessionEngine.getState().elapsedSeconds).toBe(90);
    });

    it('extends buffer by +5 minutes (300 seconds) on demand', () => {
      focusSessionEngine.startSession(mockMove, 15);
      expect(focusSessionEngine.getState().targetSeconds).toBe(900);

      focusSessionEngine.extendBuffer(5);
      expect(focusSessionEngine.getState().targetSeconds).toBe(1200);

      focusSessionEngine.extendBuffer(5);
      expect(focusSessionEngine.getState().targetSeconds).toBe(1500);
    });

    it('finishes session and records actual recorded minutes accurately', () => {
      focusSessionEngine.startSession(mockMove, 25);

      // Work for 14 minutes and 40 seconds (880s -> rounds to 15m)
      vi.advanceTimersByTime(880000);

      const finishResult = focusSessionEngine.finishAndComplete('Completed ahead of deadline');

      expect(finishResult).not.toBeNull();
      expect(finishResult?.moveId).toBe('focus-test-move-1');
      expect(finishResult?.actualMinutes).toBe(15);

      // Verify engine resets to idle
      expect(focusSessionEngine.getState().isActive).toBe(false);
    });

    it('cancels session cleanly without recording completed deliverables', () => {
      focusSessionEngine.startSession(mockMove, 25);
      vi.advanceTimersByTime(600000);

      focusSessionEngine.cancelSession();
      expect(focusSessionEngine.getState().isActive).toBe(false);
      expect(focusSessionEngine.getState().move).toBeNull();
    });
  });

  describe('Ambient Focus Drone & Audio Synthesis', () => {
    it('toggles ambient focus drone and synchronizes with soundManager', () => {
      const startSpy = vi.spyOn(soundManager, 'startFocusDrone').mockImplementation(() => {});
      const stopSpy = vi.spyOn(soundManager, 'stopFocusDrone').mockImplementation(() => {});

      focusSessionEngine.startSession(mockMove, 20);

      const active = focusSessionEngine.toggleDrone();
      expect(active).toBe(true);
      expect(focusSessionEngine.getState().droneActive).toBe(true);
      expect(startSpy).toHaveBeenCalled();

      const deactivated = focusSessionEngine.toggleDrone();
      expect(deactivated).toBe(false);
      expect(focusSessionEngine.getState().droneActive).toBe(false);
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Reactive State Subscriptions', () => {
    it('notifies subscribers upon session start, pause, resume, and completion', () => {
      const listener = vi.fn();
      const unsubscribe = focusSessionEngine.subscribe(listener);

      expect(listener).toHaveBeenCalled();

      focusSessionEngine.startSession(mockMove, 10);
      expect(listener).toHaveBeenCalled();

      focusSessionEngine.pauseSession();
      expect(listener).toHaveBeenCalled();

      focusSessionEngine.resumeSession();
      expect(listener).toHaveBeenCalled();

      focusSessionEngine.finishAndComplete();
      expect(listener).toHaveBeenCalled();

      unsubscribe();
      const callCount = listener.mock.calls.length;
      focusSessionEngine.startSession(mockMove, 5);
      expect(listener.mock.calls.length).toBe(callCount);
    });
  });

  describe('Native AlarmManager Notifications Wiring', () => {
    it('schedules exact notification on start and cancels on pause/finish/cancel', () => {
      const scheduleSpy = vi.spyOn(notificationEngine, 'scheduleFocusSessionCompletion').mockResolvedValue(999901);
      const cancelSpy = vi.spyOn(notificationEngine, 'cancelSessionNotification').mockResolvedValue();

      focusSessionEngine.startSession(mockMove, 25);
      expect(scheduleSpy).toHaveBeenCalledWith('Architect Discrete State Machine', 1500);

      focusSessionEngine.pauseSession();
      expect(cancelSpy).toHaveBeenCalled();

      focusSessionEngine.resumeSession();
      expect(scheduleSpy).toHaveBeenCalled();

      focusSessionEngine.finishAndComplete();
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('cancels scheduled notification when session is explicitly canceled', () => {
      const cancelSpy = vi.spyOn(notificationEngine, 'cancelSessionNotification').mockResolvedValue();
      focusSessionEngine.startSession(mockMove, 15);
      focusSessionEngine.cancelSession();
      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
