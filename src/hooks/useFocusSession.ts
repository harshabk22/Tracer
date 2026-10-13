import { useState, useEffect } from 'react';
import { focusSessionEngine, FocusSessionState } from '../services/focusSessionEngine';
import { MicroMove } from '../types/goal';

export function useFocusSession() {
  const [sessionState, setSessionState] = useState<FocusSessionState>(() => focusSessionEngine.getState());

  useEffect(() => {
    const unsubscribe = focusSessionEngine.subscribe((nextState) => {
      setSessionState(nextState);
    });
    return unsubscribe;
  }, []);

  const formatClock = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    ...sessionState,
    formattedRemaining: formatClock(sessionState.remainingSeconds),
    formattedElapsed: formatClock(sessionState.elapsedSeconds),
    formattedOvertime: formatClock(sessionState.overtimeSeconds),
    startSession: (move: MicroMove, minutes?: number) => focusSessionEngine.startSession(move, minutes),
    pauseSession: () => focusSessionEngine.pauseSession(),
    resumeSession: () => focusSessionEngine.resumeSession(),
    extendBuffer: (minutes?: number) => focusSessionEngine.extendBuffer(minutes),
    toggleDrone: () => focusSessionEngine.toggleDrone(),
    finishAndComplete: (note?: string) => focusSessionEngine.finishAndComplete(note),
    cancelSession: () => focusSessionEngine.cancelSession(),
  };
}
