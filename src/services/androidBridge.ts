import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

export type HapticFeedbackType =
  | 'tick'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'tabSwitch'
  | 'stepper'
  | 'complete'
  | 'checkmark'
  | 'success'
  | 'warning'
  | 'error'
  | 'notification'
  | 'impact';

export interface AndroidBackButtonRouter {
  hasOpenModal: () => boolean;
  closeTopModal: () => void;
  getActiveTab: () => string;
  setActiveTab: (tab: any) => void;
  exitApp?: () => void;
}

export interface AndroidShareOptions {
  title: string;
  text: string;
  url?: string;
  dialogTitle?: string;
}

export interface BackButtonInterceptorEntry {
  id: string;
  priority: number;
  handler: () => boolean;
  registeredAt: number;
}

export class AndroidBridge {
  private static backButtonListenerHandle: PluginListenerHandle | null = null;
  private static modalStack: Array<{ id: string; onClose: () => void }> = [];
  private static interceptors: BackButtonInterceptorEntry[] = [];

  public static clearModals(): void {
    AndroidBridge.modalStack = [];
  }

  public static clearInterceptors(): void {
    AndroidBridge.interceptors = [];
    AndroidBridge.clearModals();
  }

  /**
   * Centralized LIFO modal registry.
   * Registers an open modal and returns an unregister cleanup function.
   */
  public static pushModal(id: string, onClose: () => void): () => void {
    AndroidBridge.modalStack = AndroidBridge.modalStack.filter(m => m.id !== id);
    AndroidBridge.modalStack.push({ id, onClose });

    return () => {
      AndroidBridge.modalStack = AndroidBridge.modalStack.filter(m => m.id !== id);
    };
  }

  /**
   * Checks if any modal is currently registered in the centralized stack.
   */
  public static hasOpenModals(): boolean {
    return AndroidBridge.modalStack.length > 0;
  }

  /**
   * Pops the topmost modal in LIFO order, executes its onClose callback,
   * triggers tactile haptic tick, and returns true.
   * Returns false if modal stack is empty.
   */
  public static closeTopModal(): boolean {
    const top = AndroidBridge.modalStack.pop();
    if (top) {
      AndroidBridge.hapticTick();
      try {
        top.onClose();
      } catch {
        // Fallback gracefully on modal close error
      }
      return true;
    }
    return false;
  }

  /**
   * Registers a hardware back button interceptor.
   * Interceptors execute in descending priority order (higher priority runs first).
   * Equal priority interceptors execute in LIFO order (most recently registered first).
   * If an interceptor returns true, the back press is consumed.
   * Returns an unregister cleanup function.
   */
  public static registerBackButtonInterceptor(
    id: string,
    handler: () => boolean,
    priority: number = 0
  ): () => void {
    AndroidBridge.interceptors = AndroidBridge.interceptors.filter(i => i.id !== id);
    AndroidBridge.interceptors.push({ id, priority, handler, registeredAt: Date.now() });
    AndroidBridge.interceptors.sort((a, b) => b.priority - a.priority || b.registeredAt - a.registeredAt);

    return () => {
      AndroidBridge.interceptors = AndroidBridge.interceptors.filter(i => i.id !== id);
    };
  }

  /**
   * Executes registered back button interceptors.
   * Returns true if any interceptor consumed the event.
   */
  public static executeInterceptors(): boolean {
    for (const item of [...AndroidBridge.interceptors]) {
      try {
        if (item.handler()) {
          AndroidBridge.hapticTick();
          return true;
        }
      } catch {
        // Fallback gracefully on interceptor error
      }
    }
    return false;
  }

  public static get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public static get isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  /**
   * Initializes native Android flagship edge-to-edge system bars and transparent overlays.
   */
  public static async initStatusBar(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#090A0D' });
      }
    } catch {
      // Browser fallback
    }
  }

  /**
   * Wires the native Android hardware/gesture back button listener.
   * If onBack callback returns true, the event was handled internally.
   * If not handled and canGoBack is true, calls window.history.back().
   */
  public static async initHardwareBackButton(onBack: () => boolean): Promise<() => void> {
    if (!Capacitor.isNativePlatform()) {
      return () => {};
    }

    try {
      if (AndroidBridge.backButtonListenerHandle) {
        await AndroidBridge.backButtonListenerHandle.remove();
        AndroidBridge.backButtonListenerHandle = null;
      }

      AndroidBridge.backButtonListenerHandle = await CapApp.addListener('backButton', ({ canGoBack }) => {
        // 1. Check registered component-level interceptors (drawers, subviews, local sheets)
        if (AndroidBridge.executeInterceptors()) {
          return;
        }

        // 2. Check top-level app router (global modals & navigation)
        const handled = onBack();
        if (!handled) {
          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp().catch(() => {});
          }
        }
      });

      return () => {
        if (AndroidBridge.backButtonListenerHandle) {
          AndroidBridge.backButtonListenerHandle.remove();
          AndroidBridge.backButtonListenerHandle = null;
        }
      };
    } catch {
      return () => {};
    }
  }

  /**
   * Evaluates the hierarchical Android back button priority logic:
   * 0. If any registered interceptor (What-If drawer, sub-view segment, etc.) consumes it -> return 'interceptor_handled'.
   * 1. If any modal is open -> close it.
   * 2. If on tab 2/3/4 -> navigate to Tab 1 (Today's Focus).
   * 3. If on Tab 1 -> exit app.
   */
  public static handleBackPress(router: AndroidBackButtonRouter): 'interceptor_handled' | 'closed_modal' | 'navigated_focus' | 'exited_app' {
    AndroidBridge.hapticTick();

    if (AndroidBridge.executeInterceptors()) {
      return 'interceptor_handled';
    }

    if (AndroidBridge.hasOpenModals()) {
      AndroidBridge.closeTopModal();
      return 'closed_modal';
    }

    if (router.hasOpenModal()) {
      router.closeTopModal();
      return 'closed_modal';
    }

    if (router.getActiveTab() !== 'focus') {
      router.setActiveTab('focus');
      return 'navigated_focus';
    }

    if (router.exitApp) {
      router.exitApp();
    } else {
      CapApp.exitApp().catch(() => {});
    }
    return 'exited_app';
  }

  /**
   * Android tactile haptics: subtle tick (12ms)
   */
  public static async hapticTick(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch {}
  }

  /**
   * Android tactile haptics: tab switch micro-tick (8ms)
   */
  public static async hapticTabSwitch(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {}
  }

  /**
   * Android tactile haptics: stepper increment/decrement (12ms)
   */
  public static async hapticStepper(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch {}
  }

  /**
   * Android tactile haptics: completion checkmark confirmation ([15, 10, 15]ms)
   */
  public static async hapticCheckmark(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([15, 10, 15]);
      }
    } catch {}
  }

  /**
   * Android tactile haptics: success chime / task completion
   */
  public static async hapticSuccess(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([25, 20, 25]);
      }
    } catch {}
  }

  /**
   * Android tactile haptics: warning / friction alert
   */
  public static async hapticWarning(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
    } catch {}
  }

  /**
   * Android tactile haptics: general trigger
   */
  public static async triggerHaptic(type: HapticFeedbackType = 'light'): Promise<void> {
    switch (type) {
      case 'selection':
      case 'tabSwitch':
        return AndroidBridge.hapticTabSwitch();
      case 'stepper':
        return AndroidBridge.hapticStepper();
      case 'checkmark':
        return AndroidBridge.hapticCheckmark();
      case 'tick':
      case 'light':
        return AndroidBridge.hapticTick();
      case 'complete':
      case 'success':
      case 'notification':
        return AndroidBridge.hapticSuccess();
      case 'warning':
      case 'error':
        return AndroidBridge.hapticWarning();
      case 'impact':
      case 'medium':
        try {
          if (Capacitor.isNativePlatform()) {
            await Haptics.impact({ style: ImpactStyle.Medium });
          } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(25);
          }
        } catch {}
        break;
      case 'heavy':
        try {
          if (Capacitor.isNativePlatform()) {
            await Haptics.impact({ style: ImpactStyle.Heavy });
          } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(45);
          }
        } catch {}
        break;
    }
  }

  /**
   * Native Android Share Sheet intent
   */
  public static async shareContent(options: AndroidShareOptions): Promise<boolean> {
    AndroidBridge.hapticTick();

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: options.title,
          text: options.text,
          url: options.url,
          dialogTitle: options.dialogTitle || 'Share via Tracer',
        });
        return true;
      } catch (err: any) {
        if (err?.message?.includes('canceled') || err?.name === 'AbortError') return false;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: options.title,
          text: options.text,
          url: options.url,
        });
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
      }
    }

    // Fallback: clipboard copy
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${options.title}\n\n${options.text}`);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Android Native Share Sheet for Executive Flight Briefing
   * Invokes Android share intent targeting Slack, Gmail, Google Drive, or Android Messages
   */
  public static async shareBriefing(title: string, markdown: string): Promise<boolean> {
    return this.shareContent({
      title: `Tracer Briefing: ${title}`,
      text: markdown,
      dialogTitle: 'Share Executive Briefing via Android',
    });
  }
}

export const androidBridge = AndroidBridge;
