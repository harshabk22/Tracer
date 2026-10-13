import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AndroidBridge, AndroidBackButtonRouter } from '../androidBridge';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(),
  },
}));

describe('Android Native Platform Bridge & Hardware Routing', () => {
  let routerMock: AndroidBackButtonRouter;
  let modalOpen: boolean;
  let activeTab: string;
  let exitCalled: boolean;
  let modalClosed: boolean;

  beforeEach(() => {
    AndroidBridge.clearInterceptors();
    modalOpen = false;
    activeTab = 'focus';
    exitCalled = false;
    modalClosed = false;

    routerMock = {
      hasOpenModal: () => modalOpen,
      closeTopModal: () => {
        modalClosed = true;
      },
      getActiveTab: () => activeTab,
      setActiveTab: (tab: string) => {
        activeTab = tab;
      },
      exitApp: () => {
        exitCalled = true;
      },
    };
  });

  it('priority 1: closes active modal or drawer first when back is pressed', () => {
    modalOpen = true;
    activeTab = 'learning';

    const result = AndroidBridge.handleBackPress(routerMock);

    expect(result).toBe('closed_modal');
    expect(modalClosed).toBe(true);
    // Tab should remain unchanged
    expect(activeTab).toBe('learning');
    expect(exitCalled).toBe(false);
  });

  it('priority 2: navigates back to Today Focus tab when on secondary screens', () => {
    modalOpen = false;
    activeTab = 'team';

    const result = AndroidBridge.handleBackPress(routerMock);

    expect(result).toBe('navigated_focus');
    expect(activeTab).toBe('focus');
    expect(modalClosed).toBe(false);
    expect(exitCalled).toBe(false);
  });

  it('priority 2b: navigates from intake to focus', () => {
    modalOpen = false;
    activeTab = 'intake';

    const result = AndroidBridge.handleBackPress(routerMock);

    expect(result).toBe('navigated_focus');
    expect(activeTab).toBe('focus');
    expect(exitCalled).toBe(false);
  });

  it('priority 3: exits application when already on Focus screen with no modals', () => {
    modalOpen = false;
    activeTab = 'focus';

    const result = AndroidBridge.handleBackPress(routerMock);

    expect(result).toBe('exited_app');
    expect(exitCalled).toBe(true);
    expect(modalClosed).toBe(false);
  });

  it('executes haptic triggers safely without throwing in any environment', async () => {
    await expect(AndroidBridge.hapticTick()).resolves.not.toThrow();
    await expect(AndroidBridge.hapticSuccess()).resolves.not.toThrow();
    await expect(AndroidBridge.hapticWarning()).resolves.not.toThrow();
    await expect(AndroidBridge.triggerHaptic('heavy')).resolves.not.toThrow();
  });

  it('invokes native Capacitor Share.share when running on native platform', async () => {
    const isNativeSpy = vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.mocked(Share.share).mockResolvedValueOnce({} as any);

    const success = await AndroidBridge.shareContent({
      title: 'Native Share Title',
      text: 'Native Share Body',
      dialogTitle: 'Select Share Target',
    });

    expect(success).toBe(true);
    expect(Share.share).toHaveBeenCalledWith({
      title: 'Native Share Title',
      text: 'Native Share Body',
      url: undefined,
      dialogTitle: 'Select Share Target',
    });

    isNativeSpy.mockRestore();
  });

  it('handles native share sheet via navigator.share when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'share', {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const success = await AndroidBridge.shareContent({
      title: 'Sprint Briefing',
      text: 'Execution telemetry notes',
    });

    expect(success).toBe(true);
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sprint Briefing',
        text: 'Execution telemetry notes',
      })
    );
  });

  it('gracefully handles user cancellation (AbortError) in native share sheet', async () => {
    const abortErr = new Error('User dismissed share dialog');
    abortErr.name = 'AbortError';
    const shareMock = vi.fn().mockRejectedValue(abortErr);
    Object.defineProperty(globalThis.navigator, 'share', {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const success = await AndroidBridge.shareContent({
      title: 'Sprint Briefing',
      text: 'Execution telemetry notes',
    });

    expect(success).toBe(false);
  });

  it('falls back to clipboard copy when native share is unavailable', async () => {
    // Remove navigator.share
    Object.defineProperty(globalThis.navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const success = await AndroidBridge.shareContent({
      title: 'Sprint Briefing',
      text: 'Telemetry content',
    });

    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Sprint Briefing\n\nTelemetry content');
  });

  it('passes title, text, and optional url to native share intent for team invite', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'share', {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const success = await AndroidBridge.shareContent({
      title: 'Join Tracer Flight Plan: Run a Half Marathon',
      text: 'Join our flight crew on Tracer with join code: TRAC-88',
      url: 'https://tracer.app/#join',
    });

    expect(success).toBe(true);
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Join Tracer Flight Plan: Run a Half Marathon',
      text: 'Join our flight crew on Tracer with join code: TRAC-88',
      url: 'https://tracer.app/#join',
    });
  });

  it('returns false when clipboard fallback fails to write', async () => {
    Object.defineProperty(globalThis.navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard blocked'));
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const success = await AndroidBridge.shareContent({
      title: 'Sprint Briefing',
      text: 'Telemetry content',
    });

    expect(success).toBe(false);
  });

  it('reports platform booleans accurately', () => {
    expect(typeof AndroidBridge.isNative).toBe('boolean');
    expect(typeof AndroidBridge.isAndroid).toBe('boolean');
  });

  describe('Deep Multi-Tier Navigation Sequences & Leak Resistance', () => {
    it('executes a full 4-tier drill-down dismiss sequence: Nested Modal -> Parent Modal -> Secondary Tab -> App Exit', () => {
      // Simulate multi-tier state:
      // User is on 'learning' tab (Roadmap)
      // Opens SettingsModal (modalStack: ['settings'])
      // Opens QrCodeModal inside Settings (modalStack: ['settings', 'qr'])
      const modalStack: string[] = ['settings', 'qr'];
      let currentTab = 'learning';
      let appExited = false;

      const deepRouter: AndroidBackButtonRouter = {
        hasOpenModal: () => modalStack.length > 0,
        closeTopModal: () => {
          modalStack.pop();
        },
        getActiveTab: () => currentTab,
        setActiveTab: (tab: string) => {
          currentTab = tab;
        },
        exitApp: () => {
          appExited = true;
        },
      };

      // Press 1: Discharges top-most nested modal ('qr')
      const press1 = AndroidBridge.handleBackPress(deepRouter);
      expect(press1).toBe('closed_modal');
      expect(modalStack).toEqual(['settings']);
      expect(currentTab).toBe('learning');
      expect(appExited).toBe(false);

      // Press 2: Discharges remaining parent modal ('settings')
      const press2 = AndroidBridge.handleBackPress(deepRouter);
      expect(press2).toBe('closed_modal');
      expect(modalStack).toEqual([]);
      expect(currentTab).toBe('learning');
      expect(appExited).toBe(false);

      // Press 3: All modals closed, secondary tab ('learning') navigates back to 'focus'
      const press3 = AndroidBridge.handleBackPress(deepRouter);
      expect(press3).toBe('navigated_focus');
      expect(currentTab).toBe('focus');
      expect(appExited).toBe(false);

      // Press 4: On 'focus' tab with 0 modals open triggers exitApp
      const press4 = AndroidBridge.handleBackPress(deepRouter);
      expect(press4).toBe('exited_app');
      expect(appExited).toBe(true);
    });

    it('navigates sequentially from Team Screen with open Drawer to Today Focus and Exit', () => {
      let modalOpen = true;
      let activeTab = 'team';
      let exited = false;

      const teamRouter: AndroidBackButtonRouter = {
        hasOpenModal: () => modalOpen,
        closeTopModal: () => {
          modalOpen = false;
        },
        getActiveTab: () => activeTab,
        setActiveTab: (tab: string) => {
          activeTab = tab;
        },
        exitApp: () => {
          exited = true;
        },
      };

      // Press 1: Dismiss milestone drawer
      expect(AndroidBridge.handleBackPress(teamRouter)).toBe('closed_modal');
      expect(modalOpen).toBe(false);
      expect(activeTab).toBe('team');

      // Press 2: Return to focus
      expect(AndroidBridge.handleBackPress(teamRouter)).toBe('navigated_focus');
      expect(activeTab).toBe('focus');

      // Press 3: Exit app
      expect(AndroidBridge.handleBackPress(teamRouter)).toBe('exited_app');
      expect(exited).toBe(true);
    });

    it('attaches and cleanly detaches back button listener without memory leaks', async () => {
      const cleanup = await AndroidBridge.initHardwareBackButton(() => true);
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });

    it('executes registered back button interceptor with priority and halts propagation', () => {
      let whatIfClosed = false;
      const unregister = AndroidBridge.registerBackButtonInterceptor('whatif_test', () => {
        whatIfClosed = true;
        return true;
      }, 40);

      const result = AndroidBridge.handleBackPress(routerMock);

      expect(result).toBe('interceptor_handled');
      expect(whatIfClosed).toBe(true);
      expect(modalClosed).toBe(false);
      expect(exitCalled).toBe(false);

      unregister();
    });

    it('respects interceptor priority ordering (higher priority runs first)', () => {
      const executionOrder: string[] = [];

      const unregisterLow = AndroidBridge.registerBackButtonInterceptor('low_prio', () => {
        executionOrder.push('low');
        return false; // don't halt, let next run
      }, 10);

      const unregisterHigh = AndroidBridge.registerBackButtonInterceptor('high_prio', () => {
        executionOrder.push('high');
        return false;
      }, 50);

      AndroidBridge.handleBackPress(routerMock);

      expect(executionOrder).toEqual(['high', 'low']);

      unregisterLow();
      unregisterHigh();
    });

    it('unregisters back button interceptor cleanly when component unmounts', () => {
      let interceptorCalled = false;
      const unregister = AndroidBridge.registerBackButtonInterceptor('temp', () => {
        interceptorCalled = true;
        return true;
      });

      // Unregister immediately
      unregister();

      // Should bypass interceptor and close modal
      modalOpen = true;
      const result = AndroidBridge.handleBackPress(routerMock);

      expect(interceptorCalled).toBe(false);
      expect(result).toBe('closed_modal');
      expect(modalClosed).toBe(true);
    });

    it('handles Today segmented view back press and returns to active commitments before exiting', () => {
      let currentSegment: 'active' | 'completed' | 'backlog' = 'backlog';

      // Register Today segmented view interceptor
      const unregister = AndroidBridge.registerBackButtonInterceptor('today_segment', () => {
        if (currentSegment !== 'active') {
          currentSegment = 'active';
          return true;
        }
        return false;
      }, 15);

      // Back press 1: returns to active segment
      const press1 = AndroidBridge.handleBackPress(routerMock);
      expect(press1).toBe('interceptor_handled');
      expect(currentSegment).toBe('active');

      // Back press 2: on active segment with no modals -> exits app
      const press2 = AndroidBridge.handleBackPress(routerMock);
      expect(press2).toBe('exited_app');
      expect(exitCalled).toBe(true);

      unregister();
    });

    it('manages centralized LIFO modal stack and closes modals in reverse order', () => {
      const closedOrder: string[] = [];
      const unregister1 = AndroidBridge.pushModal('modal_bottom', () => {
        closedOrder.push('modal_bottom');
      });
      const unregister2 = AndroidBridge.pushModal('modal_top', () => {
        closedOrder.push('modal_top');
      });

      expect(AndroidBridge.hasOpenModals()).toBe(true);

      // Back press 1 should pop modal_top first (LIFO)
      const press1 = AndroidBridge.handleBackPress(routerMock);
      expect(press1).toBe('closed_modal');
      expect(closedOrder).toEqual(['modal_top']);
      expect(AndroidBridge.hasOpenModals()).toBe(true);

      // Back press 2 should pop modal_bottom
      const press2 = AndroidBridge.handleBackPress(routerMock);
      expect(press2).toBe('closed_modal');
      expect(closedOrder).toEqual(['modal_top', 'modal_bottom']);
      expect(AndroidBridge.hasOpenModals()).toBe(false);

      unregister1();
      unregister2();
    });

    it('allows clean unregistration of modals before back button is pressed', () => {
      const unregister = AndroidBridge.pushModal('temp_modal', () => {});
      expect(AndroidBridge.hasOpenModals()).toBe(true);

      unregister();
      expect(AndroidBridge.hasOpenModals()).toBe(false);
    });

    it('clears modal stack via clearModals and clearInterceptors', () => {
      AndroidBridge.pushModal('leak_modal', () => {});
      expect(AndroidBridge.hasOpenModals()).toBe(true);

      AndroidBridge.clearInterceptors();
      expect(AndroidBridge.hasOpenModals()).toBe(false);
    });
  });
});
