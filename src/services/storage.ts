import { Goal, LearningLog, BlockerRecord, TeamMember, SprintMilestone, DailyReflection, AIProvider, ExecutionTrajectoryItem, TrajectoryRecord } from '../types/goal';
import {
  INITIAL_TEAM_MEMBERS,
  INITIAL_LEARNING_LOGS,
  INITIAL_BLOCKERS,
} from './mockData';
import { indexedDbStore, STORES } from './indexedDbStore';

export type RoadmapWorkspaceTab = 'dag' | 'velocity' | 'journal';
export type FocusSegment = 'active' | 'completed' | 'backlog';
export type DagViewMode = 'dag' | 'stream';

export interface WhatIfDraft {
  goalId: string;
  milestones: SprintMilestone[];
  updatedAt: number;
}

export const STORAGE_KEYS = {
  GOALS: 'tracer_goals_v1',
  ACTIVE_GOAL_ID: 'tracer_active_goal_id_v1',
  LEARNING_LOGS: 'tracer_learning_logs_v1',
  BLOCKERS: 'tracer_blockers_v1',
  TEAM_MEMBERS: 'tracer_team_members_v1',
  API_KEY: 'tracer_gemini_api_key_v1',
  AI_PROVIDER: 'tracer_ai_provider_v1',
  DEEPSEEK_API_KEY: 'tracer_deepseek_api_key_v1',
  OPENAI_API_KEY: 'tracer_openai_api_key_v1',
  ANTHROPIC_API_KEY: 'tracer_anthropic_api_key_v1',
  CUSTOM_API_KEY: 'tracer_custom_api_key_v1',
  AI_MODEL: 'tracer_ai_model_v1',
  CUSTOM_API_BASE_URL: 'tracer_custom_api_base_url_v1',
  EXECUTION_TRAJECTORY: 'tracer_execution_trajectory_v1',
  FRAME_VIEW: 'tracer_frame_view_v1',
  PRIVACY_MODE: 'tracer_privacy_mode_v1',
  SOUND_VOLUME: 'tracer_volume_v1',
  SOUND_MUTED: 'tracer_muted_v1',
  HAPTICS_ENABLED: 'tracer_haptics_enabled_v1',
  ROADMAP_WORKSPACE_TAB: 'tracer_roadmap_workspace_tab_v1',
  FOCUS_SEGMENT: 'tracer_focus_segment_v1',
  DAG_VIEW_MODE: 'tracer_dag_view_mode_v1',
  WHATIF_SIMULATION_DRAFT: 'tracer_whatif_draft_v1',
  DAILY_REFLECTIONS: 'tracer_daily_reflections_v1',
};

// Legacy keys for migration
const LEGACY_STORAGE_KEYS = [
  'tracer_active_goal',
  'tracer_goals',
  'tracer_learning_logs',
  'tracer_blockers',
];

const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      } catch {
        return memoryStore.get(key) || null;
      }
    }
    return memoryStore.get(key) || null;
  },
  setItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        // Quota exceeded or private mode restriction: fall back to memoryStore
        console.warn('[safeStorage] localStorage.setItem failed, falling back to memoryStore:', err);
      }
    }
    memoryStore.set(key, value);
  },
  removeItem(key: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    memoryStore.delete(key);
  },
  clear(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
    }
    memoryStore.clear();
  },
  getMemoryStoreSize(): number {
    return memoryStore.size;
  },
};

export function sanitizeGoal(raw: any): Goal | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.title) return null;
  const milestones = Array.isArray(raw.milestones)
    ? raw.milestones
        .filter((m: any) => m && typeof m === 'object')
        .map((m: any, idx: number) => ({
        id: String(m.id || `ms-${Date.now()}-${idx}`),
        goalId: String(m.goalId || raw.id),
        order: typeof m.order === 'number' ? m.order : idx + 1,
        title: String(m.title || `Phase ${idx + 1}`),
        description: String(m.description || ''),
        targetDate: String(m.targetDate || new Date().toISOString().split('T')[0]),
        owner: String(m.owner || 'You'),
        ownerAvatar: m.ownerAvatar ? String(m.ownerAvatar) : undefined,
        bufferFloatDays: typeof m.bufferFloatDays === 'number' ? m.bufferFloatDays : 2,
        floatConsumed: typeof m.floatConsumed === 'number' ? m.floatConsumed : 0,
        isCriticalPath: Boolean(m.isCriticalPath),
        dependencies: Array.isArray(m.dependencies) ? m.dependencies.map(String) : [],
        status: m.status || 'pending',
        isScopePruned: Boolean(m.isScopePruned),
      }))
    : [];

  const microMoves = Array.isArray(raw.microMoves)
    ? raw.microMoves
        .filter((mv: any) => mv && typeof mv === 'object')
        .map((mv: any, idx: number) => ({
        id: String(mv.id || `mv-${Date.now()}-${idx}`),
        milestoneId: String(mv.milestoneId || (milestones[0]?.id || '')),
        goalId: String(mv.goalId || raw.id),
        title: String(mv.title || `Action Item ${idx + 1}`),
        description: String(mv.description || ''),
        estimatedMinutes: typeof mv.estimatedMinutes === 'number' ? mv.estimatedMinutes : 25,
        actualMinutes: typeof mv.actualMinutes === 'number' ? mv.actualMinutes : undefined,
        dateScheduled: String(mv.dateScheduled || new Date().toISOString().split('T')[0]),
        isCriticalPath: Boolean(mv.isCriticalPath),
        isPruned: Boolean(mv.isPruned),
        status: mv.status || 'todo',
        completedAt: mv.completedAt ? String(mv.completedAt) : undefined,
        learningRemark: mv.learningRemark ? String(mv.learningRemark) : undefined,
        blockerReason: mv.blockerReason,
        blockerRecoveryAction: mv.blockerRecoveryAction,
        isPrivate: Boolean(mv.isPrivate),
        order: typeof mv.order === 'number' ? mv.order : idx + 1,
      }))
    : [];

  return {
    id: String(raw.id),
    title: String(raw.title),
    category: raw.category || 'technical',
    vision: {
      coreOutcome: String(raw.vision?.coreOutcome || raw.title),
      targetDate: String(raw.vision?.targetDate || new Date().toISOString().split('T')[0]),
      totalEstimatedHours: typeof raw.vision?.totalEstimatedHours === 'number' ? raw.vision.totalEstimatedHours : 40,
      successMetrics: Array.isArray(raw.vision?.successMetrics) ? raw.vision.successMetrics.map(String) : [],
    },
    weeklyCapacityHours: typeof raw.weeklyCapacityHours === 'number' ? raw.weeklyCapacityHours : 10,
    currentLevel: raw.currentLevel || 'Intermediate',
    deadlineFlexibility: raw.deadlineFlexibility || 'Moderate Elastic',
    createdAt: String(raw.createdAt || new Date().toISOString()),
    active: raw.active !== undefined ? Boolean(raw.active) : true,
    velocityFactor: typeof raw.velocityFactor === 'number' ? raw.velocityFactor : 1.0,
    totalFloatBufferDays: typeof raw.totalFloatBufferDays === 'number' ? raw.totalFloatBufferDays : 8,
    consumedFloatDays: typeof raw.consumedFloatDays === 'number' ? raw.consumedFloatDays : 0,
    status: raw.status || 'on_track',
    isTeamGoal: Boolean(raw.isTeamGoal),
    joinCode: raw.joinCode ? String(raw.joinCode) : undefined,
    milestones,
    microMoves,
  };
}

export const storage = {
  _safeStorage: safeStorage,

  getGoals(): Goal[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.GOALS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map(sanitizeGoal).filter((g): g is Goal => g !== null);
          return sanitized;
        }
      }
    } catch (e) {
      console.error('Failed reading goals from localStorage, falling back to empty', e);
    }
    return [];
  },

  saveGoals(goals: Goal[]): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    } catch (e) {
      console.error('Failed saving goals to safeStorage', e);
    }

    // Parallel asynchronous durability write to IndexedDB
    indexedDbStore.putBatch(STORES.GOALS, goals).catch((err) => {
      console.debug('[storage] IndexedDB saveGoals background write:', err);
    });
  },

  getActiveGoalId(): string | null {
    return safeStorage.getItem(STORAGE_KEYS.ACTIVE_GOAL_ID) || null;
  },

  saveActiveGoalId(id: string): void {
    safeStorage.setItem(STORAGE_KEYS.ACTIVE_GOAL_ID, id);
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.ACTIVE_GOAL_ID,
      value: id,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getLearningLogs(): LearningLog[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.LEARNING_LOGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed reading learning logs', e);
    }
    return INITIAL_LEARNING_LOGS;
  },

  saveLearningLogs(logs: LearningLog[]): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.LEARNING_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed saving learning logs', e);
    }

    indexedDbStore.putBatch(STORES.LEARNING_LOGS, logs).catch((err) => {
      console.debug('[storage] IndexedDB saveLearningLogs write:', err);
    });
  },

  getBlockers(): BlockerRecord[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.BLOCKERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed reading blockers', e);
    }
    return INITIAL_BLOCKERS;
  },

  saveBlockers(blockers: BlockerRecord[]): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.BLOCKERS, JSON.stringify(blockers));
    } catch (e) {
      console.error('Failed saving blockers', e);
    }

    indexedDbStore.putBatch(STORES.BLOCKERS, blockers).catch((err) => {
      console.debug('[storage] IndexedDB saveBlockers write:', err);
    });
  },

  getTeamMembers(): TeamMember[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.TEAM_MEMBERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed reading team members', e);
    }
    return [];
  },

  saveTeamMembers(members: TeamMember[]): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.TEAM_MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.error('Failed saving team members', e);
    }

    indexedDbStore.putBatch(STORES.TEAM_MEMBERS, members).catch((err) => {
      console.debug('[storage] IndexedDB saveTeamMembers write:', err);
    });
  },

  getApiKey(): string {
    const saved = safeStorage.getItem(STORAGE_KEYS.API_KEY);
    if (saved && saved.trim()) return saved.trim();
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  },

  saveApiKey(key: string): void {
    safeStorage.setItem(STORAGE_KEYS.API_KEY, key);
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.API_KEY,
      value: key,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getAiProvider(): AIProvider {
    const saved = safeStorage.getItem(STORAGE_KEYS.AI_PROVIDER);
    const valid: AIProvider[] = ['gemini', 'deepseek', 'openai', 'anthropic', 'custom'];
    return valid.includes(saved as AIProvider) ? (saved as AIProvider) : 'gemini';
  },

  saveAiProvider(provider: AIProvider): void {
    safeStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.AI_PROVIDER,
      value: provider,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getDeepSeekApiKey(): string {
    const saved = safeStorage.getItem(STORAGE_KEYS.DEEPSEEK_API_KEY);
    if (saved && saved.trim()) return saved.trim();
    return (import.meta as any).env?.VITE_DEEPSEEK_API_KEY || '';
  },

  saveDeepSeekApiKey(key: string): void {
    safeStorage.setItem(STORAGE_KEYS.DEEPSEEK_API_KEY, key);
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.DEEPSEEK_API_KEY,
      value: key,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getOpenAIApiKey(): string {
    const saved = safeStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY);
    if (saved && saved.trim()) return saved.trim();
    return (import.meta as any).env?.VITE_OPENAI_API_KEY || '';
  },

  saveOpenAIApiKey(key: string): void {
    safeStorage.setItem(STORAGE_KEYS.OPENAI_API_KEY, key);
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.OPENAI_API_KEY,
      value: key,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getAnthropicApiKey(): string {
    const saved = safeStorage.getItem(STORAGE_KEYS.ANTHROPIC_API_KEY);
    if (saved && saved.trim()) return saved.trim();
    return (import.meta as any).env?.VITE_ANTHROPIC_API_KEY || '';
  },

  saveAnthropicApiKey(key: string): void {
    safeStorage.setItem(STORAGE_KEYS.ANTHROPIC_API_KEY, key);
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.ANTHROPIC_API_KEY,
      value: key,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getCustomApiKey(): string {
    const saved = safeStorage.getItem(STORAGE_KEYS.CUSTOM_API_KEY);
    if (saved && saved.trim()) return saved.trim();
    return (import.meta as any).env?.VITE_CUSTOM_API_KEY || '';
  },

  saveCustomApiKey(key: string): void {
    safeStorage.setItem(STORAGE_KEYS.CUSTOM_API_KEY, key);
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.CUSTOM_API_KEY,
      value: key,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getAiModel(provider?: AIProvider): string {
    const saved = safeStorage.getItem(STORAGE_KEYS.AI_MODEL);
    if (saved && saved.trim()) return saved.trim();

    const activeProvider = provider || this.getAiProvider();
    if (activeProvider === 'deepseek') return 'deepseek-chat';
    if (activeProvider === 'openai') return 'gpt-4o';
    if (activeProvider === 'custom') return 'llama3.3';
    return 'gemini-3.6-flash';
  },

  saveAiModel(model: string): void {
    safeStorage.setItem(STORAGE_KEYS.AI_MODEL, model.trim());
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.AI_MODEL,
      value: model.trim(),
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getAiModelName(provider?: AIProvider): string {
    return this.getAiModel(provider);
  },

  saveAiModelName(model: string): void {
    this.saveAiModel(model);
  },

  getCustomApiBaseUrl(provider?: AIProvider): string {
    const saved = safeStorage.getItem(STORAGE_KEYS.CUSTOM_API_BASE_URL);
    if (saved && saved.trim()) return saved.trim();

    const activeProvider = provider || this.getAiProvider();
    if (activeProvider === 'deepseek') return 'https://api.deepseek.com';
    if (activeProvider === 'openai') return 'https://api.openai.com/v1';
    if (activeProvider === 'custom') return 'http://localhost:11434/v1';
    return '';
  },

  saveCustomApiBaseUrl(url: string): void {
    safeStorage.setItem(STORAGE_KEYS.CUSTOM_API_BASE_URL, url.trim());
    indexedDbStore.put(STORES.KV_SETTINGS, {
      key: STORAGE_KEYS.CUSTOM_API_BASE_URL,
      value: url.trim(),
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  },

  getAiBaseUrl(provider?: AIProvider): string {
    return this.getCustomApiBaseUrl(provider);
  },

  saveAiBaseUrl(url: string): void {
    this.saveCustomApiBaseUrl(url);
  },

  getTrajectoryLedger(): TrajectoryRecord[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.EXECUTION_TRAJECTORY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed reading trajectory ledger', e);
    }
    return [];
  },

  recordTrajectory(record: TrajectoryRecord): void {
    try {
      const current = this.getTrajectoryLedger();
      const updated = [...current, record].slice(-50);
      safeStorage.setItem(STORAGE_KEYS.EXECUTION_TRAJECTORY, JSON.stringify(updated));
      indexedDbStore.put(STORES.KV_SETTINGS, {
        key: STORAGE_KEYS.EXECUTION_TRAJECTORY,
        value: updated,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    } catch (e) {
      console.error('Failed recording trajectory', e);
    }
  },

  getTrajectory(): ExecutionTrajectoryItem[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.EXECUTION_TRAJECTORY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed reading execution trajectory', e);
    }
    return [];
  },

  saveTrajectory(items: ExecutionTrajectoryItem[]): void {
    try {
      // Bound trajectory to last 50 entries to keep O(1) storage footprint
      const bounded = items.slice(-50);
      safeStorage.setItem(STORAGE_KEYS.EXECUTION_TRAJECTORY, JSON.stringify(bounded));
    } catch (e) {
      console.error('Failed saving trajectory', e);
    }
  },

  appendTrajectory(item: ExecutionTrajectoryItem): void {
    const current = this.getTrajectory();
    this.saveTrajectory([...current, item]);
  },

  clearTrajectory(): void {
    safeStorage.removeItem(STORAGE_KEYS.EXECUTION_TRAJECTORY);
  },

  purgeAllData(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch (e) {
        console.error('Failed clearing localStorage', e);
      }
    }
    memoryStore.clear();

    Object.values(STORAGE_KEYS).forEach((key) => {
      safeStorage.removeItem(key);
    });

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      safeStorage.removeItem(legacyKey);
    }

    indexedDbStore.wipeDatabase().catch((err) => {
      console.debug('[storage] IndexedDB wipeDatabase error:', err);
    });
  },

  purgeAllAgentData(): void {
    this.purgeAllData();
  },

  getFrameView(): boolean {
    const val = safeStorage.getItem(STORAGE_KEYS.FRAME_VIEW);
    return val !== null ? val === 'true' : true;
  },

  saveFrameView(enabled: boolean): void {
    safeStorage.setItem(STORAGE_KEYS.FRAME_VIEW, String(enabled));
  },

  getPrivacyMode(): boolean {
    const val = safeStorage.getItem(STORAGE_KEYS.PRIVACY_MODE);
    return val !== null ? val === 'true' : false;
  },

  savePrivacyMode(enabled: boolean): void {
    safeStorage.setItem(STORAGE_KEYS.PRIVACY_MODE, String(enabled));
  },

  getSoundVolume(): number {
    const val = safeStorage.getItem(STORAGE_KEYS.SOUND_VOLUME);
    if (val !== null) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    }
    return 0.8;
  },

  saveSoundVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    safeStorage.setItem(STORAGE_KEYS.SOUND_VOLUME, String(clamped));
  },

  getSoundMuted(): boolean {
    const val = safeStorage.getItem(STORAGE_KEYS.SOUND_MUTED);
    return val !== null ? val === 'true' : false;
  },

  saveSoundMuted(muted: boolean): void {
    safeStorage.setItem(STORAGE_KEYS.SOUND_MUTED, String(muted));
  },

  getHapticsEnabled(): boolean {
    const val = safeStorage.getItem(STORAGE_KEYS.HAPTICS_ENABLED);
    return val !== null ? val === 'true' : true;
  },

  saveHapticsEnabled(enabled: boolean): void {
    safeStorage.setItem(STORAGE_KEYS.HAPTICS_ENABLED, String(enabled));
  },

  getRoadmapWorkspaceTab(): RoadmapWorkspaceTab {
    try {
      const val = safeStorage.getItem(STORAGE_KEYS.ROADMAP_WORKSPACE_TAB);
      if (val === 'dag' || val === 'velocity' || val === 'journal') {
        return val;
      }
    } catch {
      // ignore
    }
    return 'dag';
  },

  saveRoadmapWorkspaceTab(tab: RoadmapWorkspaceTab): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.ROADMAP_WORKSPACE_TAB, tab);
    } catch {
      // ignore
    }
  },

  getFocusSegment(): FocusSegment {
    try {
      const val = safeStorage.getItem(STORAGE_KEYS.FOCUS_SEGMENT);
      if (val === 'active' || val === 'completed' || val === 'backlog') {
        return val;
      }
    } catch {
      // ignore
    }
    return 'active';
  },

  saveFocusSegment(segment: FocusSegment): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.FOCUS_SEGMENT, segment);
    } catch {
      // ignore
    }
  },

  getDagViewMode(): DagViewMode {
    try {
      const val = safeStorage.getItem(STORAGE_KEYS.DAG_VIEW_MODE);
      if (val === 'dag' || val === 'stream') {
        return val;
      }
    } catch {
      // ignore
    }
    return 'dag';
  },

  saveDagViewMode(mode: DagViewMode): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.DAG_VIEW_MODE, mode);
    } catch {
      // ignore
    }
  },

  getWhatIfDraft(goalId: string): SprintMilestone[] | null {
    if (!goalId) return null;
    try {
      const raw = safeStorage.getItem(STORAGE_KEYS.WHATIF_SIMULATION_DRAFT);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.goalId === goalId &&
        Array.isArray(parsed.milestones) &&
        parsed.milestones.length > 0
      ) {
        return parsed.milestones;
      }
    } catch {
      safeStorage.removeItem(STORAGE_KEYS.WHATIF_SIMULATION_DRAFT);
    }
    return null;
  },

  saveWhatIfDraft(goalId: string, milestones: SprintMilestone[]): void {
    if (!goalId || !Array.isArray(milestones)) return;
    try {
      const payload: WhatIfDraft = {
        goalId,
        milestones,
        updatedAt: Date.now(),
      };
      safeStorage.setItem(STORAGE_KEYS.WHATIF_SIMULATION_DRAFT, JSON.stringify(payload));
    } catch (e) {
      console.warn('[storage] Failed saving What-If draft:', e);
    }
  },

  clearWhatIfDraft(): void {
    try {
      safeStorage.removeItem(STORAGE_KEYS.WHATIF_SIMULATION_DRAFT);
    } catch {
      // ignore
    }
  },

  getDailyReflections(): DailyReflection[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.DAILY_REFLECTIONS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  getDailyReflection(dateStr: string): string | null {
    const reflections = this.getDailyReflections();
    const found = reflections.find((r) => r.date === dateStr);
    return found ? found.mood : null;
  },

  saveDailyReflection(
    reflectionOrDate: { date: string; mood: 'smooth' | 'friction' | 'hard'; note?: string; timestamp?: number } | string,
    moodStr?: string
  ): void {
    let normalized: DailyReflection;
    if (typeof reflectionOrDate === 'string') {
      normalized = {
        date: reflectionOrDate,
        mood: (moodStr as any) || 'smooth',
        timestamp: Date.now(),
      };
    } else {
      normalized = {
        ...reflectionOrDate,
        timestamp: reflectionOrDate.timestamp || Date.now(),
      };
    }
    if (!normalized.date) return;
    const reflections = this.getDailyReflections();
    const filtered = reflections.filter((r) => r.date !== normalized.date);
    const updated = [normalized, ...filtered];
    safeStorage.setItem(STORAGE_KEYS.DAILY_REFLECTIONS, JSON.stringify(updated));
  },

  deleteDailyReflection(dateStr: string): void {
    if (!dateStr) return;
    const reflections = this.getDailyReflections();
    const filtered = reflections.filter((r) => r.date !== dateStr);
    safeStorage.setItem(STORAGE_KEYS.DAILY_REFLECTIONS, JSON.stringify(filtered));
  },

  /**
   * Hydrate from IndexedDB vault, performing seamless backward migration if legacy keys exist.
   */
  async hydrateFromIndexedDb(): Promise<{
    hydrated: boolean;
    source: 'indexedDb' | 'localStorage' | 'default';
    goalCount: number;
  }> {
    // 1. Check legacy localStorage keys and migrate
    try {
      const legacyGoal = safeStorage.getItem('tracer_active_goal');
      if (legacyGoal && !safeStorage.getItem(STORAGE_KEYS.GOALS)) {
        const parsedLegacy = JSON.parse(legacyGoal);
        const sanitized = sanitizeGoal(parsedLegacy);
        if (sanitized) {
          this.saveGoals([sanitized]);
        }
      }
    } catch {
      // ignore
    }

    if (!indexedDbStore.isAvailable()) {
      const goals = this.getGoals();
      return { hydrated: false, source: 'localStorage', goalCount: goals.length };
    }

    try {
      const idbGoals = await indexedDbStore.getAll<Goal>(STORES.GOALS);
      if (idbGoals && idbGoals.length > 0) {
        const sanitized = idbGoals.map(sanitizeGoal).filter((g): g is Goal => g !== null);
        if (sanitized.length > 0) {
          safeStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(sanitized));
          return { hydrated: true, source: 'indexedDb', goalCount: sanitized.length };
        }
      }

      // If IndexedDB was uninitialized, seed it from safeStorage
      const currentGoals = this.getGoals();
      await indexedDbStore.putBatch(STORES.GOALS, currentGoals);
      await indexedDbStore.putBatch(STORES.LEARNING_LOGS, this.getLearningLogs());
      await indexedDbStore.putBatch(STORES.BLOCKERS, this.getBlockers());
      await indexedDbStore.putBatch(STORES.TEAM_MEMBERS, this.getTeamMembers());

      return { hydrated: true, source: 'localStorage', goalCount: currentGoals.length };
    } catch (e) {
      console.warn('[storage] Hydration error, falling back to localStorage:', e);
      return { hydrated: false, source: 'localStorage', goalCount: this.getGoals().length };
    }
  },

  async exportFullVaultSnapshot(): Promise<Record<string, any>> {
    return indexedDbStore.exportVaultSnapshot();
  },

  async importFullVaultSnapshot(snapshot: any): Promise<void> {
    await indexedDbStore.importVaultSnapshot(snapshot);
    await this.hydrateFromIndexedDb();
  },

  resetAll(): void {
    safeStorage.removeItem(STORAGE_KEYS.GOALS);
    safeStorage.removeItem(STORAGE_KEYS.ACTIVE_GOAL_ID);
    safeStorage.removeItem(STORAGE_KEYS.LEARNING_LOGS);
    safeStorage.removeItem(STORAGE_KEYS.BLOCKERS);
    safeStorage.removeItem(STORAGE_KEYS.TEAM_MEMBERS);
    safeStorage.removeItem(STORAGE_KEYS.PRIVACY_MODE);
    safeStorage.removeItem(STORAGE_KEYS.SOUND_VOLUME);
    safeStorage.removeItem(STORAGE_KEYS.SOUND_MUTED);
    safeStorage.removeItem(STORAGE_KEYS.ROADMAP_WORKSPACE_TAB);
    safeStorage.removeItem(STORAGE_KEYS.FOCUS_SEGMENT);
    safeStorage.removeItem(STORAGE_KEYS.DAG_VIEW_MODE);
    safeStorage.removeItem(STORAGE_KEYS.WHATIF_SIMULATION_DRAFT);
    safeStorage.removeItem(STORAGE_KEYS.DAILY_REFLECTIONS);
    safeStorage.removeItem(STORAGE_KEYS.AI_PROVIDER);
    safeStorage.removeItem(STORAGE_KEYS.DEEPSEEK_API_KEY);

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      safeStorage.removeItem(legacyKey);
    }

    indexedDbStore.wipeDatabase().catch((err) => {
      console.debug('[storage] IndexedDB wipeDatabase error:', err);
    });
  },
};
