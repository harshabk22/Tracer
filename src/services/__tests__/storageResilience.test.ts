import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage, safeStorage, sanitizeGoal, STORAGE_KEYS } from '../storage';
import { indexedDbStore, STORES } from '../indexedDbStore';
import { DEFAULT_GOAL } from '../mockData';

// Mock localStorage if running in headless Node environment
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

describe('Storage Resilience & Industrial Stress Testing', () => {
  beforeEach(() => {
    storage.resetAll();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('QuotaExceeded & Fallback Memory Resilience', () => {
    it('catches QuotaExceededError in localStorage and survives seamlessly via memoryStore', () => {
      // Simulate quota exceeded exception
      const originalSetItem = localStorage.setItem;
      let quotaFailures = 0;

      vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        quotaFailures++;
        const err = new Error('QuotaExceededError: DOM Exception 22');
        err.name = 'QuotaExceededError';
        throw err;
      });

      const oversizedGoal = {
        ...DEFAULT_GOAL,
        id: 'oversized-goal-quota-test',
        title: 'Huge Flight Data Object',
      };

      // Writing must NOT throw to the caller
      expect(() => {
        storage.saveGoals([oversizedGoal]);
      }).not.toThrow();

      expect(quotaFailures).toBeGreaterThan(0);

      // Retrieving must still return the saved data through the fallback store
      const retrieved = storage.getGoals();
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe('oversized-goal-quota-test');
      expect(retrieved[0].title).toBe('Huge Flight Data Object');

      // Verify safeStorage direct behavior
      safeStorage.setItem('test_quota_key', 'test_value');
      expect(safeStorage.getItem('test_quota_key')).toBe('test_value');
    });

    it('survives rapid-fire sequential mutations without corruption', () => {
      for (let i = 0; i < 50; i++) {
        const goal = {
          ...DEFAULT_GOAL,
          id: `stress-goal-${i}`,
          title: `Mission Target Iteration ${i}`,
        };
        storage.saveGoals([goal]);
      }

      const finalGoals = storage.getGoals();
      expect(finalGoals).toHaveLength(1);
      expect(finalGoals[0].id).toBe('stress-goal-49');
      expect(finalGoals[0].title).toBe('Mission Target Iteration 49');
    });
  });

  describe('Schema Sanitization & Corruption Heuristics', () => {
    it('recovers gracefully from completely invalid raw payloads', () => {
      expect(sanitizeGoal(null)).toBeNull();
      expect(sanitizeGoal(undefined)).toBeNull();
      expect(sanitizeGoal(12345)).toBeNull();
      expect(sanitizeGoal('corrupted string')).toBeNull();
      expect(sanitizeGoal({})).toBeNull();
      expect(sanitizeGoal({ id: 'missing-title' })).toBeNull();
      expect(sanitizeGoal({ title: 'missing-id' })).toBeNull();
    });

    it('self-heals broken milestone references, missing float budgets, and null dependencies', () => {
      const corruptPayload = {
        id: 'corrupt-ms-goal',
        title: 'Healed Schedule Goal',
        milestones: [
          {
            id: 'm1',
            title: 'Unchecked Milestone',
            bufferFloatDays: 'not-a-number',
            dependencies: null,
          },
          null, // corrupted null entry in array
          {
            title: 'Milestone Missing ID',
          },
        ],
        microMoves: [
          {
            title: 'Move Missing ID',
            estimatedMinutes: 'invalid',
          },
        ],
      };

      const healed = sanitizeGoal(corruptPayload);
      expect(healed).not.toBeNull();
      if (!healed) return;

      expect(healed.id).toBe('corrupt-ms-goal');
      expect(healed.title).toBe('Healed Schedule Goal');
      expect(healed.milestones).toHaveLength(2); // 2 valid objects after null filtering
      expect(healed.milestones[0].bufferFloatDays).toBe(2); // fallback default
      expect(healed.milestones[0].dependencies).toEqual([]);
      expect(healed.microMoves[0].estimatedMinutes).toBe(25); // fallback default
    });
  });

  describe('Settings & Volume Clamping', () => {
    it('clamps sound volume strictly to [0.0, 1.0] range', () => {
      storage.saveSoundVolume(-0.5);
      expect(storage.getSoundVolume()).toBe(0);

      storage.saveSoundVolume(1.85);
      expect(storage.getSoundVolume()).toBe(1);

      storage.saveSoundVolume(0.42);
      expect(storage.getSoundVolume()).toBe(0.42);

      // Corrupted storage value
      localStorage.setItem(STORAGE_KEYS.SOUND_VOLUME, 'not-a-number');
      expect(storage.getSoundVolume()).toBe(0.8); // fallback default
    });

    it('handles sound mute state toggle and persistence', () => {
      expect(storage.getSoundMuted()).toBe(false);
      storage.saveSoundMuted(true);
      expect(storage.getSoundMuted()).toBe(true);
      storage.saveSoundMuted(false);
      expect(storage.getSoundMuted()).toBe(false);
    });

    it('preserves and clears API key safely without whitespace leaks', () => {
      storage.saveApiKey('  AIzaSyTestKey123  ');
      expect(storage.getApiKey()).toBe('AIzaSyTestKey123');

      storage.saveApiKey('');
      expect(storage.getApiKey()).toBe('');
    });
  });

  describe('Legacy Storage Key Migration', () => {
    it('migrates legacy tracer_active_goal into tracer_goals_v1 during hydrateFromIndexedDb', async () => {
      const legacyGoal = {
        ...DEFAULT_GOAL,
        id: 'legacy-migrated-01',
        title: 'Legacy Flight Target',
      };

      localStorage.setItem('tracer_active_goal', JSON.stringify(legacyGoal));
      expect(localStorage.getItem(STORAGE_KEYS.GOALS)).toBeNull();

      const result = await storage.hydrateFromIndexedDb();
      expect(result.goalCount).toBeGreaterThanOrEqual(1);

      const loadedGoals = storage.getGoals();
      expect(loadedGoals.some((g) => g.id === 'legacy-migrated-01')).toBe(true);
    });
  });

  describe('Vault Snapshot Export / Import Interface', () => {
    it('exports a valid structured snapshot with version and timestamps', async () => {
      const snapshot = await storage.exportFullVaultSnapshot();
      expect(snapshot).toHaveProperty('version');
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('stores');
      expect(snapshot.stores).toHaveProperty('goals');
    });

    it('handles import of structured snapshot without throwing errors', async () => {
      const mockSnapshot = {
        version: 1,
        timestamp: new Date().toISOString(),
        stores: {
          goals: [{ ...DEFAULT_GOAL, id: 'imported-vault-goal' }],
          learning_logs: [],
          blockers: [],
          team_members: [],
          kv_settings: [],
        },
      };

      await expect(storage.importFullVaultSnapshot(mockSnapshot)).resolves.not.toThrow();
    });
  });
});
