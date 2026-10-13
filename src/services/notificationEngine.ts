/**
 * Lean Android Notification Engine for Tracer.
 * Uses @capacitor/local-notifications via Android AlarmManager with Web Notification fallback.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { androidBridge } from './androidBridge';
import { soundManager } from './sound';

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  id?: number;
  scheduleAt?: Date;
}

class NotificationEngine {
  private lastSentTimestamps = new Map<string, number>();
  private readonly THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 min throttle for duplicate alerts

  private scheduledNotificationIds = new Set<number>();

  public isSupported(): boolean {
    if (Capacitor.isNativePlatform()) return true;
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'default';
  }

  public async requestPermission(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        if (granted) {
          androidBridge.triggerHaptic('notification');
          soundManager.playCompleteChime();
        }
        return granted;
      }

      if (typeof window !== 'undefined' && 'Notification' in window) {
        const res = await window.Notification.requestPermission();
        const granted = res === 'granted';
        if (granted) {
          androidBridge.triggerHaptic('notification');
          soundManager.playCompleteChime();
        }
        return granted;
      }
    } catch (e) {
      console.warn('[NotificationEngine] Permission request failed:', e);
    }
    return false;
  }

  public async notify(payload: NotificationPayload): Promise<boolean> {
    const key = payload.tag || payload.title;
    const now = Date.now();
    if (this.lastSentTimestamps.has(key) && now - (this.lastSentTimestamps.get(key) || 0) < this.THROTTLE_WINDOW_MS) {
      return false;
    }
    this.lastSentTimestamps.set(key, now);

    const notificationId = payload.id || Math.floor(Math.random() * 1000000) + 1;

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notificationId,
              title: payload.title,
              body: payload.body,
              schedule: payload.scheduleAt ? { at: payload.scheduleAt, allowWhileIdle: true } : undefined,
              sound: undefined,
              smallIcon: 'ic_launcher',
            },
          ],
        });
        return true;
      } catch (err) {
        console.warn('[NotificationEngine] Capacitor LocalNotification error:', err);
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        new window.Notification(payload.title, {
          body: payload.body,
          tag: payload.tag,
        });
        return true;
      } catch (e) {
        console.warn('[NotificationEngine] Web Notification error:', e);
      }
    }

    return false;
  }

  public async notifyFocusBriefing(firstMoveTitle: string, estimatedMinutes: number, scheduleAt8Am = false): Promise<boolean> {
    if (scheduleAt8Am) {
      return this.scheduleMorningBriefing(firstMoveTitle, estimatedMinutes);
    }
    androidBridge.triggerHaptic('notification');
    soundManager.playTick();
    return this.notify({
      title: '⚡ Next Immediate Action',
      body: `Ready: "${firstMoveTitle}" (${estimatedMinutes}m). Tap to focus.`,
      tag: 'daily_briefing',
    });
  }

  public async scheduleFocusSessionCompletion(moveTitle: string, targetSeconds: number): Promise<number | null> {
    const notificationId = 999901;
    const scheduleAt = new Date(Date.now() + targetSeconds * 1000);

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notificationId,
              title: 'Focus Session Complete',
              body: `Completed "${moveTitle}". Time to record your reflections.`,
              schedule: { at: scheduleAt, allowWhileIdle: true },
              smallIcon: 'ic_launcher',
            },
          ],
        });
        this.scheduledNotificationIds.add(notificationId);
        return notificationId;
      } catch (err) {
        console.warn('[NotificationEngine] scheduleFocusSessionCompletion error:', err);
      }
    }
    return null;
  }

  public async scheduleReminder(
    title: string,
    body: string,
    scheduleAt: Date,
    id?: number
  ): Promise<number | null> {
    if (scheduleAt.getTime() <= Date.now()) {
      const ok = await this.notify({ title, body, id });
      return ok ? (id || 1) : null;
    }

    const notificationId = id || Math.floor(Math.random() * 900000) + 100000;

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notificationId,
              title,
              body,
              schedule: { at: scheduleAt, allowWhileIdle: true },
              smallIcon: 'ic_launcher',
            },
          ],
        });
        this.scheduledNotificationIds.add(notificationId);
        return notificationId;
      } catch (err) {
        console.warn('[NotificationEngine] scheduleReminder failed:', err);
        return null;
      }
    }

    // Web / Timer fallback: schedule timer if within 24 hours
    const delayMs = scheduleAt.getTime() - Date.now();
    if (delayMs > 0 && delayMs < 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        this.notify({ title, body, id: notificationId });
        this.scheduledNotificationIds.delete(notificationId);
      }, delayMs);
    }
    this.scheduledNotificationIds.add(notificationId);
    return notificationId;
  }

  public async cancelReminder(id: number): Promise<void> {
    this.scheduledNotificationIds.delete(id);
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id }] });
      } catch (err) {
        console.warn('[NotificationEngine] cancelReminder error:', err);
      }
    }
  }

  public async cancelAllReminders(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        const ids = Array.from(this.scheduledNotificationIds);
        if (ids.length > 0) {
          await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
        }
      } catch (err) {
        console.warn('[NotificationEngine] cancelAllReminders error:', err);
      }
    }
    this.scheduledNotificationIds.clear();
  }

  public getScheduledNotificationIds(): number[] {
    return Array.from(this.scheduledNotificationIds);
  }

  public async cancelSessionNotification(id: number = 999901): Promise<void> {
    this.scheduledNotificationIds.delete(id);
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id }],
        });
      } catch (err) {
        console.warn('[NotificationEngine] cancelSessionNotification error:', err);
      }
    }
  }

  public async scheduleMorningBriefing(firstMoveTitle: string, estimatedMinutes: number): Promise<boolean> {
    const notificationId = 888801;
    const next8am = new Date();
    next8am.setHours(8, 0, 0, 0);
    if (next8am.getTime() <= Date.now()) {
      next8am.setDate(next8am.getDate() + 1);
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notificationId,
              title: '⚡ Focus Session Briefing',
              body: `Ready: "${firstMoveTitle}" (${estimatedMinutes}m). Tap to focus.`,
              schedule: { at: next8am, allowWhileIdle: true, every: 'day' },
              smallIcon: 'ic_launcher',
            },
          ],
        });
        this.scheduledNotificationIds.add(notificationId);
        return true;
      } catch (err) {
        console.warn('[NotificationEngine] scheduleMorningBriefing error:', err);
      }
    }
    return false;
  }

  public async notifySlippage(milestoneTitle: string, daysSlipped: number): Promise<boolean> {
    androidBridge.triggerHaptic('warning');
    soundManager.playBlockerThud();
    return this.notify({
      title: '⚠️ Schedule Alert',
      body: `"${milestoneTitle}" is ${daysSlipped}d behind schedule.`,
      tag: `slip_${milestoneTitle}`,
    });
  }

  public async notifyBufferWarning(milestoneTitle: string, remainingFloatDays: number): Promise<boolean> {
    androidBridge.triggerHaptic('warning');
    return this.notify({
      title: '⚠️ Float Buffer Depleted',
      body: `"${milestoneTitle}" has only ${remainingFloatDays}d remaining.`,
      tag: `buffer_${milestoneTitle}`,
    });
  }
}

export const notificationEngine = new NotificationEngine();
