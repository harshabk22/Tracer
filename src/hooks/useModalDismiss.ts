import { useEffect, useRef } from 'react';
import { AndroidBridge } from '../services/androidBridge';
import { soundManager } from '../services/sound';

/**
 * Custom hook to provide native-like Android & iOS modal dismiss interactions:
 * 1. Registers with native AndroidBridge hardware back button interceptor.
 * 2. Intercepts Android hardware back button / edge swipe gesture via History API & popstate.
 * 3. Intercepts desktop Escape key.
 * 4. Locks body scrolling while modal/sheet is active.
 * 5. Uses stable refs so inline onClose props don't cause infinite remount cycles.
 */
export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Register with centralized native AndroidBridge modal stack (LIFO)
    const modalKey = `modal_${Math.random().toString(36).substring(2, 9)}`;
    const unregisterModal = AndroidBridge.pushModal(modalKey, () => {
      soundManager.playTick();
      onCloseRef.current();
    });

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Intercept desktop Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundManager.playTick();
        AndroidBridge.hapticTick();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Safely intercept Android hardware back button / edge swipe via popstate
    let didPush = false;
    let isDismissedByPop = false;

    const handlePopState = () => {
      isDismissedByPop = true;
      soundManager.playTick();
      AndroidBridge.hapticTick();
      onCloseRef.current();
    };

    // Delay history manipulation past React 18/19 StrictMode mount-unmount simulation
    const timer = setTimeout(() => {
      try {
        const modalKey = 'modal_' + Math.random().toString(36).substring(2, 9);
        window.history.pushState({ tracerModal: modalKey }, '');
        didPush = true;
        window.addEventListener('popstate', handlePopState);
      } catch {
        // Fallback for restricted iframes / history limits
      }
    }, 50);

    return () => {
      unregisterModal();
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);

      // If closed via UI (X button / backdrop) rather than browser back button, pop history
      if (didPush && !isDismissedByPop && window.history.state?.tracerModal) {
        try {
          window.history.back();
        } catch {
          // Ignored
        }
      }
    };
  }, [isOpen]);
}
