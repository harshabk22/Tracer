import { describe, it, expect } from 'vitest';
import { toCalendarUtcMidnight, computeScheduleMetrics, sequenceMilestones } from '../scheduleEngine';
import { notificationEngine } from '../notificationEngine';

describe('Schedule Engine Calendar Normalization & Midnight Rollover', () => {
  const msInDay = 86400000;

  it('normalizes dates cleanly to UTC midnight without time-of-day jitter', () => {
    const fromYMD = toCalendarUtcMidnight('2026-10-15');
    const fromISO = toCalendarUtcMidnight('2026-10-15T23:59:59.999Z');
    const fromTimestamp = toCalendarUtcMidnight(Date.UTC(2026, 9, 15, 14, 30, 0));

    expect(fromYMD).toBe(Date.UTC(2026, 9, 15));
    expect(fromISO).toBe(Date.UTC(2026, 9, 15));
    expect(fromTimestamp).toBe(Date.UTC(2026, 9, 15));
  });

  it('calculates exact 1-day step across month and year rollover boundaries', () => {
    // Dec 31 to Jan 1
    const dec31 = toCalendarUtcMidnight('2026-12-31');
    const jan01 = toCalendarUtcMidnight('2027-01-01');
    const diffDays = Math.round((jan01 - dec31) / msInDay);
    expect(diffDays).toBe(1);

    // Jan 31 to Feb 1
    const jan31 = toCalendarUtcMidnight('2027-01-31');
    const feb01 = toCalendarUtcMidnight('2027-02-01');
    expect(Math.round((feb01 - jan31) / msInDay)).toBe(1);
  });

  it('correctly distinguishes leap years (2028 vs 2027) in late February rollover', () => {
    // 2027: Non-leap year (Feb has 28 days) -> Feb 28 to Mar 1 is 1 day
    const feb28_2027 = toCalendarUtcMidnight('2027-02-28');
    const mar01_2027 = toCalendarUtcMidnight('2027-03-01');
    expect(Math.round((mar01_2027 - feb28_2027) / msInDay)).toBe(1);

    // 2028: Leap year (Feb has 29 days) -> Feb 28 to Mar 1 is 2 days
    const feb28_2028 = toCalendarUtcMidnight('2028-02-28');
    const mar01_2028 = toCalendarUtcMidnight('2028-03-01');
    expect(Math.round((mar01_2028 - feb28_2028) / msInDay)).toBe(2);
  });

  it('sequences milestones accurately across year boundaries', () => {
    const dummyMilestones = [
      { id: 'm1', goalId: 'g1', order: 1, title: 'Phase 1', description: '', targetDate: '', status: 'pending' as const },
      { id: 'm2', goalId: 'g1', order: 2, title: 'Phase 2', description: '', targetDate: '', status: 'pending' as const },
    ];

    // Starting on Dec 25 with 7-day interval
    const sequenced = sequenceMilestones(dummyMilestones, '2026-12-25', 7);
    expect(sequenced[0].targetDate).toBe('2027-01-01');
    expect(sequenced[1].targetDate).toBe('2027-01-08');
  });

  it('computes schedule metrics without throwing for null or empty goals', () => {
    const metrics = computeScheduleMetrics(null);
    expect(metrics.totalMilestones).toBe(0);
    expect(metrics.progressPercentage).toBe(0);
    expect(metrics.isOverdue).toBe(false);
  });
});

describe('NotificationEngine Reminders & Tracking', () => {
  it('schedules and cancels reminders cleanly', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000);
    const reminderId = await notificationEngine.scheduleReminder(
      'Deep Work Sprint',
      'Begin next scheduled micro-move',
      futureDate,
      777001
    );

    expect(reminderId).toBe(777001);
    expect(notificationEngine.getScheduledNotificationIds()).toContain(777001);

    await notificationEngine.cancelReminder(777001);
    expect(notificationEngine.getScheduledNotificationIds()).not.toContain(777001);
  });

  it('handles past schedule timestamps safely without throwing', async () => {
    const pastDate = new Date(Date.now() - 5000);
    const result = await notificationEngine.scheduleReminder(
      'Past Event',
      'This was in the past',
      pastDate,
      777002
    );

    expect(result === null || typeof result === 'number').toBe(true);
  });

  it('cancels all active reminders when requested', async () => {
    const future1 = new Date(Date.now() + 10000);
    const future2 = new Date(Date.now() + 20000);

    await notificationEngine.scheduleReminder('Task A', 'Desc A', future1, 888001);
    await notificationEngine.scheduleReminder('Task B', 'Desc B', future2, 888002);

    expect(notificationEngine.getScheduledNotificationIds()).toContain(888001);
    expect(notificationEngine.getScheduledNotificationIds()).toContain(888002);

    await notificationEngine.cancelAllReminders();
    expect(notificationEngine.getScheduledNotificationIds()).toHaveLength(0);
  });
});
