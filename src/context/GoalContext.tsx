import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Goal,
  MicroMove,
  SprintMilestone,
  DailyReflection,
  LearningLog,
  BlockerRecord,
  TeamMember,
  BlockerTaxonomy,
  UndoItem,
  StreakMetrics,
  VaultSecurityState,
  AutoLockInterval,
  CPMSlippageReport,
  PersonalLearningModel,
  AssistantExecutableAction,
  AssistantResponse,
  AssistantChatMessage,
  NegotiationResult,
  CompletionSource,
  SocraticIntakeResponse,
  TrajectoryRecord,
  ExecutionTrajectoryItem,
  AIProvider,
  ParallelRebalanceProposal,
  ParallelRebalanceFork,
} from '../types/goal';
import { storage } from '../services/storage';
import { biometricVault } from '../services/biometricVault';
import { soundManager } from '../services/sound';
import { androidBridge } from '../services/androidBridge';
import { exportEngine } from '../services/exportEngine';
import { notificationEngine } from '../services/notificationEngine';
import { collaborationEngine } from '../services/collaborationEngine';
import {
  computeScheduleMetrics,
  computePersonalLearningModel,
  ScheduleMetrics,
  resolveMoveUnlocks,
  applyParallelRebalance,
  generateParallelRebalanceProposals,
  computeParallelTrackMetrics,
  ParallelTrackMetrics,
} from '../services/scheduleEngine';
import {
  getRecoverySuggestion,
  chatWithTracerAssistant as callChatAssistant,
  generateHeuristicDecomposition,
  decomposeGoal,
  conductSocraticIntake as runSocraticIntake,
  testConnection,
  DecomposeParams,
} from '../services/aiEngine';

export type AppTab = 'focus' | 'roadmap' | 'team' | 'intake';

interface GoalContextType {
  goals: Goal[];
  activeGoal: Goal | null;
  activeTab: AppTab;
  scheduleMetrics: ScheduleMetrics;
  learningModel: PersonalLearningModel;
  streak: StreakMetrics;
  learningLogs: LearningLog[];
  blockers: BlockerRecord[];
  teamMembers: TeamMember[];
  isAsymmetricPrivateMode: boolean;
  soundMuted: boolean;
  soundVolume: number;
  vaultState: VaultSecurityState;
  lastUndoAction: UndoItem | null;
  canUndo: boolean;
  cpmReport: CPMSlippageReport;
  isFrameView: boolean;
  dailyReflection: string | null;
  dailyReflections: DailyReflection[];
  logDailyReflection: (mood: 'smooth' | 'friction' | 'hard' | string, note?: string) => void;
  victoryBurstTrigger: number;
  triggerVictoryBurst: () => void;

  // Actions
  setActiveTab: (tab: AppTab) => void;
  setActiveGoalId: (id: string) => void;
  createGoal: (goal: Goal) => void;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (goalId: string) => void;
  decomposeNewGoal: (params: Omit<DecomposeParams, 'userVelocityFactor'>) => Promise<Goal>;
  conductSocraticIntake: (
    intent: string,
    history?: Array<{ role: 'user' | 'model'; text: string }>,
    directSynthesis?: boolean
  ) => Promise<SocraticIntakeResponse>;

  // Milestones
  addMilestone: (milestone: Omit<SprintMilestone, 'id'>) => void;
  updateMilestone: (milestone: SprintMilestone) => void;
  deleteMilestone: (milestoneId: string) => void;
  completeMilestone: (milestoneId: string) => void;
  reassignMilestone: (milestoneId: string, newOwner: string, handoverNote?: string) => void;

  // MicroMoves
  addMicroMove: (move: Omit<MicroMove, 'id'>) => void;
  updateMicroMove: (move: MicroMove) => void;
  deleteMicroMove: (moveId: string) => void;
  completeMicroMove: (moveId: string, actualMinutes?: number, note?: string, source?: CompletionSource) => void;
  undoCompleteMicroMove: (moveId: string) => void;
  markMicroMoveMissed: (moveId: string, taxonomy: BlockerTaxonomy, details: string) => void;
  updateMoveNote: (moveId: string, note: string) => void;
  adjustMoveDuration: (moveId: string, deltaMinutes: number) => void;
  swapMicroMoves: (moveIdA: string, moveIdB: string) => void;
  promoteToFocus: (moveId: string, replaceMoveId?: string) => void;

  // Team & Collaboration
  addTeamMember: (member: Omit<TeamMember, 'id'>) => void;
  deleteTeamMember: (memberId: string) => void;
  joinTeamPlan: (code: string) => boolean;
  exportFlightPlanMarkdown: () => Promise<string>;
  shareFlightPlan: () => Promise<void>;
  exportFlightPlanJson: () => string;
  importFlightPlanJson: (jsonStr: string) => boolean;
  importSharedFlightPlan: (jsonStr: string) => boolean;
  executeTeammateNegotiation: () => NegotiationResult;
  applyTeammateNegotiation: (result: NegotiationResult) => void;

  // Parallel Tasks & Team Schedule
  batonHandoverNotice: { unblockedTitle: string; assigneeName: string; count: number } | null;
  dismissBatonHandoverNotice: () => void;
  reassignMicroMove: (moveId: string, toAssigneeId: string, toAssigneeName: string) => void;
  applyParallelRebalanceProposal: (proposal: ParallelRebalanceProposal) => void;
  getParallelRebalanceProposals: () => ParallelRebalanceProposal[];
  parallelMetrics: ParallelTrackMetrics;

  // Assistant Chat & Executable Actions
  chatWithTracerAssistant: (query: string, history?: AssistantChatMessage[]) => Promise<AssistantResponse>;
  applyAssistantAction: (action: AssistantExecutableAction) => void;

  // Settings & Security
  apiKey: string;
  aiProvider: AIProvider;
  deepSeekApiKey: string;
  openAIApiKey: string;
  anthropicApiKey: string;
  customApiKey: string;
  customBaseUrl: string;
  aiModelName: string;
  trajectory: ExecutionTrajectoryItem[];
  trajectoryLedger: TrajectoryRecord[];
  setApiKey: (key: string) => void;
  setAiProvider: (provider: AIProvider) => void;
  setDeepSeekApiKey: (key: string) => void;
  setOpenAIApiKey: (key: string) => void;
  setAnthropicApiKey: (key: string) => void;
  setCustomApiKey: (key: string) => void;
  setCustomBaseUrl: (url: string) => void;
  setAiModelName: (model: string) => void;
  recordTrajectory: (record: TrajectoryRecord) => void;
  recordTrajectoryItem: (item: Omit<ExecutionTrajectoryItem, 'id' | 'timestamp' | 'date'>) => void;
  approveTrajectoryAction: (id: string) => Promise<void>;
  rejectTrajectoryAction: (id: string) => Promise<void>;
  clearTrajectory: () => void;
  purgeAllData: () => void;
  purgeAllAgentData: () => void;
  testConnection: (
    provider: AIProvider,
    key: string,
    customBaseUrl?: string,
    customModel?: string
  ) => Promise<{ success: boolean; latencyMs?: number; error?: string; message?: string }>;
  setAsymmetricPrivateMode: (enabled: boolean) => void;
  setSoundMuted: (muted: boolean) => void;
  setSoundVolume: (volume: number) => void;
  unlockVault: (pin?: string) => Promise<boolean>;
  lockVault: () => void;
  setShieldEnabled: (enabled: boolean, pin?: string) => Promise<boolean>;
  setAutoLockInterval: (interval: AutoLockInterval) => void;
  toggleFrameView: () => void;

  // Undo
  undo: () => void;
  dismissUndo: () => void;
}

const GoalContext = createContext<GoalContextType | null>(null);

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [goals, setGoals] = useState<Goal[]>(() => storage.getGoals());
  const [activeGoalId, setActiveGoalIdState] = useState<string>(() => storage.getActiveGoalId() || '');
  const [activeTab, setActiveTabState] = useState<AppTab>('focus');
  const [learningLogs, setLearningLogs] = useState<LearningLog[]>(() => storage.getLearningLogs());
  const [blockers, setBlockers] = useState<BlockerRecord[]>(() => storage.getBlockers());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => storage.getTeamMembers());
  const [apiKey, setApiKeyState] = useState<string>(() => storage.getApiKey() || '');
  const [isAsymmetricPrivateMode, setPrivateModeState] = useState<boolean>(() => storage.getPrivacyMode());
  const [soundMuted, setSoundMutedState] = useState<boolean>(() => storage.getSoundMuted());
  const [soundVolume, setSoundVolumeState] = useState<number>(() => storage.getSoundVolume());
  const [isFrameView, setIsFrameView] = useState<boolean>(() => storage.getFrameView());
  const [aiProvider, setAiProviderState] = useState<AIProvider>(() => storage.getAiProvider());
  const [deepSeekApiKey, setDeepSeekApiKeyState] = useState<string>(() => storage.getDeepSeekApiKey());
  const [openAIApiKey, setOpenAIApiKeyState] = useState<string>(() => storage.getOpenAIApiKey());
  const [customApiKey, setCustomApiKeyState] = useState<string>(() => storage.getCustomApiKey());
  const [anthropicApiKey, setAnthropicApiKeyState] = useState<string>(() => storage.getAnthropicApiKey());
  const [customBaseUrl, setCustomBaseUrlState] = useState<string>(() => storage.getCustomApiBaseUrl());
  const [aiModelName, setAiModelNameState] = useState<string>(() => storage.getAiModel());
  const [trajectory, setTrajectoryState] = useState<ExecutionTrajectoryItem[]>(() => storage.getTrajectory());
  const [trajectoryLedger, setTrajectoryLedgerState] = useState<TrajectoryRecord[]>(() => storage.getTrajectoryLedger());
  const [batonHandoverNotice, setBatonHandoverNotice] = useState<{
    unblockedTitle: string;
    assigneeName: string;
    count: number;
  } | null>(null);

  const [victoryBurstTrigger, setVictoryBurstTrigger] = useState<number>(0);

  const triggerVictoryBurst = useCallback(() => {
    setVictoryBurstTrigger((prev) => prev + 1);
  }, []);

  const dismissBatonHandoverNotice = useCallback(() => {
    setBatonHandoverNotice(null);
  }, []);

  const setAiProvider = useCallback((provider: AIProvider) => {
    setAiProviderState(provider);
    storage.saveAiProvider(provider);
    androidBridge.triggerHaptic('selection');
  }, []);

  const setDeepSeekApiKey = useCallback((key: string) => {
    setDeepSeekApiKeyState(key);
    storage.saveDeepSeekApiKey(key);
  }, []);

  const setOpenAIApiKey = useCallback((key: string) => {
    setOpenAIApiKeyState(key);
    storage.saveOpenAIApiKey(key);
  }, []);

  const setAnthropicApiKey = useCallback((key: string) => {
    setAnthropicApiKeyState(key);
    storage.saveAnthropicApiKey(key);
  }, []);

  const setCustomApiKey = useCallback((key: string) => {
    setCustomApiKeyState(key);
    storage.saveCustomApiKey(key);
  }, []);

  const setCustomBaseUrl = useCallback((url: string) => {
    setCustomBaseUrlState(url);
    storage.saveCustomApiBaseUrl(url);
  }, []);

  const setAiModelName = useCallback((model: string) => {
    setAiModelNameState(model);
    storage.saveAiModel(model);
  }, []);

  const recordTrajectory = useCallback((record: TrajectoryRecord) => {
    storage.recordTrajectory(record);
    setTrajectoryLedgerState(storage.getTrajectoryLedger());
  }, []);

  const recordTrajectoryItem = useCallback((item: Omit<ExecutionTrajectoryItem, 'id' | 'timestamp' | 'date'>) => {
    const record: ExecutionTrajectoryItem = {
      ...item,
      id: `traj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      source: item.source || 'agent',
      status: item.status || 'proposed',
    };
    storage.appendTrajectory(record);
    setTrajectoryState(storage.getTrajectory());
  }, []);

  const clearTrajectory = useCallback(() => {
    storage.clearTrajectory();
    setTrajectoryState([]);
    androidBridge.triggerHaptic('light');
  }, []);

  const purgeAllData = useCallback(() => {
    storage.purgeAllData();
    setGoals([]);
    setActiveGoalIdState('');
    setLearningLogs([]);
    setBlockers([]);
    setTeamMembers([]);
    setTrajectoryState([]);
    setTrajectoryLedgerState([]);
    androidBridge.triggerHaptic('warning');
  }, []);

  const purgeAllAgentData = useCallback(() => {
    storage.purgeAllAgentData();
    setGoals([]);
    setActiveGoalIdState('');
    setLearningLogs([]);
    setBlockers([]);
    setTeamMembers([]);
    setTrajectoryState([]);
    setTrajectoryLedgerState([]);
    androidBridge.triggerHaptic('warning');
    soundManager.playBlockerThud();
  }, []);

  const [vaultState, setVaultState] = useState<VaultSecurityState>(() => biometricVault.getState());
  const [lastUndoAction, setLastUndoAction] = useState<UndoItem | null>(null);
  const [previousGoalSnapshot, setPreviousGoalSnapshot] = useState<Goal | null>(null);

  const todayDateStr = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  const [dailyReflection, setDailyReflection] = useState<string | null>(() => storage.getDailyReflection(todayDateStr));
  const [dailyReflections, setDailyReflections] = useState<DailyReflection[]>(() => storage.getDailyReflections());

  const logDailyReflection = useCallback((mood: 'smooth' | 'friction' | 'hard' | string, note?: string) => {
    if (!mood) {
      setDailyReflection(null);
      storage.deleteDailyReflection(todayDateStr);
      setDailyReflections(storage.getDailyReflections());
      return;
    }

    const normalized = mood.toLowerCase();
    let validMood: 'smooth' | 'friction' | 'hard' = 'smooth';
    if (normalized.includes('friction') || normalized.includes('🟡')) {
      validMood = 'friction';
    } else if (normalized.includes('hard') || normalized.includes('🔴')) {
      validMood = 'hard';
    } else {
      validMood = 'smooth';
    }

    storage.saveDailyReflection({
      date: todayDateStr,
      mood: validMood,
      note,
    });
    setDailyReflection(validMood);
    setDailyReflections(storage.getDailyReflections());
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('success');
  }, [todayDateStr]);

  // Subscribe to biometric vault changes
  useEffect(() => {
    const unsubscribe = biometricVault.subscribe((newState) => {
      setVaultState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Sync state to storage
  useEffect(() => {
    storage.saveGoals(goals);
  }, [goals]);

  useEffect(() => {
    if (activeGoalId) {
      storage.saveActiveGoalId(activeGoalId);
    }
  }, [activeGoalId]);

  useEffect(() => {
    storage.saveLearningLogs(learningLogs);
  }, [learningLogs]);

  useEffect(() => {
    storage.saveBlockers(blockers);
  }, [blockers]);

  useEffect(() => {
    storage.saveTeamMembers(teamMembers);
  }, [teamMembers]);

  // Active goal resolution
  const activeGoal = useMemo(() => {
    if (!goals.length) return null;
    const found = goals.find((g) => g.id === activeGoalId);
    return found || goals[0] || null;
  }, [goals, activeGoalId]);

  // Schedule metrics computation
  const scheduleMetrics = useMemo<ScheduleMetrics>(() => {
    return computeScheduleMetrics(activeGoal);
  }, [activeGoal]);

  // Overdue detection & slippage alert effect
  useEffect(() => {
    if (scheduleMetrics.isOverdue && scheduleMetrics.activeMilestone) {
      notificationEngine.notifySlippage(
        scheduleMetrics.activeMilestone.title,
        Math.max(1, Math.abs(scheduleMetrics.daysRemaining))
      );
    }
  }, [scheduleMetrics.isOverdue, scheduleMetrics.activeMilestone?.title, scheduleMetrics.daysRemaining]);

  // Streak metrics computation
  const streak = useMemo<StreakMetrics>(() => {
    if (learningLogs.length === 0) {
      return { currentStreak: 0, bestStreak: 0, activeToday: false, totalCompletedMoves: 0, streakHistory: [] };
    }
    const dateMap = new Map<string, { count: number; minutes: number }>();
    for (const log of learningLogs) {
      const d = log.timestamp ? log.timestamp.split('T')[0] : '';
      if (!d) continue;
      const cur = dateMap.get(d) || { count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += log.actualMinutes || log.estimatedMinutes || 0;
      dateMap.set(d, cur);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const activeToday = dateMap.has(todayStr);
    const sortedDates = Array.from(dateMap.keys()).sort();

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const ds of sortedDates) {
      const curr = new Date(ds);
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curr.getTime() - prevDate.getTime()) / 86400000);
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      prevDate = curr;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    }

    if (sortedDates.length > 0) {
      const lastDate = sortedDates[sortedDates.length - 1];
      const diff = Math.round((new Date(todayStr).getTime() - new Date(lastDate).getTime()) / 86400000);
      if (diff <= 1) {
        currentStreak = tempStreak;
      }
    }

    const streakHistory = sortedDates.map((date) => ({
      date,
      count: dateMap.get(date)!.count,
      minutes: dateMap.get(date)!.minutes,
    }));

    return {
      currentStreak,
      bestStreak,
      activeToday,
      totalCompletedMoves: learningLogs.length,
      streakHistory,
    };
  }, [learningLogs]);

  // Personal Learning Model with Anti-Faking Winsorization & Confidence Weighting
  const learningModel = useMemo<PersonalLearningModel>(() => {
    return computePersonalLearningModel(learningLogs, streak);
  }, [learningLogs, streak]);

  // Compatibility stub for cpmReport
  const cpmReport = useMemo<CPMSlippageReport>(() => {
    return {
      slippageDays: scheduleMetrics.isOverdue ? Math.abs(scheduleMetrics.daysRemaining) : 0,
      remainingFloatDays: Math.max(0, scheduleMetrics.daysRemaining),
      consumedFloatDays: scheduleMetrics.elapsedDays,
      criticalPathMilestoneIds: scheduleMetrics.activeMilestone ? [scheduleMetrics.activeMilestone.id] : [],
      status: scheduleMetrics.isOverdue ? 'critical_slip' : 'on_track',
      impactDescription: scheduleMetrics.isOverdue
        ? `Timeline is slipping by ${Math.abs(scheduleMetrics.daysRemaining)} days.`
        : 'Execution is progressing on schedule.',
    };
  }, [scheduleMetrics]);

  // Setters
  const setActiveTab = useCallback((tab: AppTab) => {
    androidBridge.triggerHaptic('selection');
    setActiveTabState(tab);
  }, []);

  const setActiveGoalId = useCallback((id: string) => {
    androidBridge.triggerHaptic('light');
    setActiveGoalIdState(id);
  }, []);

  const scheduleGoalBriefing = useCallback((goal: Goal) => {
    const activeMoves = (goal.microMoves || []).filter((m) => m.status === 'todo');
    if (activeMoves.length > 0) {
      notificationEngine.notifyFocusBriefing(
        activeMoves[0].title,
        activeMoves[0].estimatedMinutes || 25,
        true // Schedule recurring 8:00 AM briefing via AlarmManager
      );
    }
  }, []);

  const createGoal = useCallback((goal: Goal) => {
    androidBridge.triggerHaptic('medium');
    soundManager.playTick();
    setGoals((prev) => [goal, ...prev.filter((g) => g.id !== goal.id)]);
    setActiveGoalIdState(goal.id);
    setActiveTabState('focus');
    scheduleGoalBriefing(goal);
  }, [scheduleGoalBriefing]);

  const updateGoal = useCallback((updated: Goal) => {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    scheduleGoalBriefing(updated);
  }, [scheduleGoalBriefing]);

  const decomposeNewGoal = useCallback(
    async (params: Omit<DecomposeParams, 'userVelocityFactor'>): Promise<Goal> => {
      const effectiveKey = params.apiKey || storage.getApiKey() || apiKey;
      const effectiveDeepSeekKey = params.deepSeekApiKey || storage.getDeepSeekApiKey() || deepSeekApiKey;
      const effectiveProvider = params.provider || storage.getAiProvider() || aiProvider;
      return decomposeGoal({
        ...params,
        apiKey: effectiveKey,
        deepSeekApiKey: effectiveDeepSeekKey,
        provider: effectiveProvider,
        openAIApiKey: params.openAIApiKey || storage.getOpenAIApiKey() || openAIApiKey,
        anthropicApiKey: params.anthropicApiKey || storage.getAnthropicApiKey() || anthropicApiKey,
        customApiKey: params.customApiKey || storage.getCustomApiKey() || customApiKey,
        modelName: params.modelName || storage.getAiModel() || aiModelName,
        customBaseUrl: params.customBaseUrl || storage.getCustomApiBaseUrl() || customBaseUrl,
        userVelocityFactor: learningModel.velocityFactor,
      });
    },
    [apiKey, deepSeekApiKey, aiProvider, openAIApiKey, anthropicApiKey, customApiKey, aiModelName, customBaseUrl, learningModel.velocityFactor]
  );

  const conductSocraticIntake = useCallback(
    async (
      intent: string,
      history?: Array<{ role: 'user' | 'model'; text: string }>,
      directSynthesis?: boolean
    ): Promise<SocraticIntakeResponse> => {
      const effectiveKey = storage.getApiKey() || apiKey;
      const effectiveDeepSeekKey = storage.getDeepSeekApiKey() || deepSeekApiKey;
      const effectiveProvider = storage.getAiProvider() || aiProvider;
      return runSocraticIntake({
        intent,
        history,
        apiKey: effectiveKey,
        deepSeekApiKey: effectiveDeepSeekKey,
        provider: effectiveProvider,
        openAIApiKey: storage.getOpenAIApiKey() || openAIApiKey,
        anthropicApiKey: storage.getAnthropicApiKey() || anthropicApiKey,
        customApiKey: storage.getCustomApiKey() || customApiKey,
        modelName: storage.getAiModel() || aiModelName,
        customBaseUrl: storage.getCustomApiBaseUrl() || customBaseUrl,
        directSynthesis,
      });
    },
    [apiKey, deepSeekApiKey, aiProvider, openAIApiKey, anthropicApiKey, customApiKey, aiModelName, customBaseUrl]
  );

  const deleteGoal = useCallback((goalId: string) => {
    androidBridge.triggerHaptic('warning');
    setGoals((prev) => {
      const filtered = prev.filter((g) => g.id !== goalId);
      if (activeGoalId === goalId) {
        setActiveGoalIdState(filtered.length > 0 ? filtered[0].id : '');
      }
      return filtered;
    });
  }, [activeGoalId]);

  // Snapshot before modifying active goal for single-step undo
  const saveSnapshot = useCallback(() => {
    if (activeGoal) {
      setPreviousGoalSnapshot(JSON.parse(JSON.stringify(activeGoal)));
    }
  }, [activeGoal]);

  // Milestone operations
  const addMilestone = useCallback((milestone: Omit<SprintMilestone, 'id'>) => {
    if (!activeGoal) return;
    saveSnapshot();
    const newId = `ms_${Date.now()}`;
    const newMilestone: SprintMilestone = { ...milestone, id: newId };
    const updated = {
      ...activeGoal,
      milestones: [...(activeGoal.milestones || []), newMilestone],
    };
    updateGoal(updated);
    androidBridge.triggerHaptic('light');
  }, [activeGoal, saveSnapshot, updateGoal]);

  const updateMilestone = useCallback((milestone: SprintMilestone) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updated = {
      ...activeGoal,
      milestones: (activeGoal.milestones || []).map((m) => (m.id === milestone.id ? milestone : m)),
    };
    updateGoal(updated);
  }, [activeGoal, saveSnapshot, updateGoal]);

  const deleteMilestone = useCallback((milestoneId: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updated = {
      ...activeGoal,
      milestones: (activeGoal.milestones || []).filter((m) => m.id !== milestoneId),
    };
    updateGoal(updated);
    setLastUndoAction({
      id: `undo_${Date.now()}`,
      type: 'delete_milestone',
      description: 'Milestone removed',
      timestamp: Date.now(),
    });
  }, [activeGoal, saveSnapshot, updateGoal]);

  const completeMilestone = useCallback((milestoneId: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updated = {
      ...activeGoal,
      milestones: (activeGoal.milestones || []).map((m) =>
        m.id === milestoneId ? { ...m, status: 'completed' as const } : m
      ),
    };
    updateGoal(updated);
    triggerVictoryBurst();
    androidBridge.triggerHaptic('complete');
    soundManager.playCompleteChime();
  }, [activeGoal, saveSnapshot, updateGoal, triggerVictoryBurst]);

  const reassignMilestone = useCallback((milestoneId: string, newOwner: string, handoverNote?: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updated = {
      ...activeGoal,
      milestones: (activeGoal.milestones || []).map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              owner: newOwner,
              handoverNote: handoverNote || m.handoverNote,
              description: handoverNote
                ? (m.description ? `${m.description}\n[Handover]: ${handoverNote}` : `[Handover]: ${handoverNote}`)
                : m.description,
            }
          : m
      ),
    };
    updateGoal(updated);
    androidBridge.triggerHaptic('medium');
    soundManager.playTick();
  }, [activeGoal, saveSnapshot, updateGoal]);

  // MicroMove operations
  const addMicroMove = useCallback((move: Omit<MicroMove, 'id'>) => {
    if (!activeGoal) return;
    saveSnapshot();
    const newId = `mm_${Date.now()}`;
    const newMove: MicroMove = { ...move, id: newId };
    const updated = {
      ...activeGoal,
      microMoves: [...(activeGoal.microMoves || []), newMove],
    };
    updateGoal(updated);
    androidBridge.triggerHaptic('light');
  }, [activeGoal, saveSnapshot, updateGoal]);

  const updateMicroMove = useCallback((move: MicroMove) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updated = {
      ...activeGoal,
      microMoves: (activeGoal.microMoves || []).map((m) => (m.id === move.id ? move : m)),
    };
    updateGoal(updated);
  }, [activeGoal, saveSnapshot, updateGoal]);

  const deleteMicroMove = useCallback((moveId: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updated = {
      ...activeGoal,
      microMoves: (activeGoal.microMoves || []).filter((m) => m.id !== moveId),
    };
    updateGoal(updated);
    setLastUndoAction({
      id: `undo_${Date.now()}`,
      type: 'delete_move',
      description: 'Micro-move deleted',
      timestamp: Date.now(),
    });
  }, [activeGoal, saveSnapshot, updateGoal]);

  const completeMicroMove = useCallback((
    moveId: string,
    actualMinutes?: number,
    note?: string,
    source?: CompletionSource
  ) => {
    if (!activeGoal) return;
    saveSnapshot();
    const targetMove = (activeGoal.microMoves || []).find((m) => m.id === moveId);
    if (!targetMove) return;

    const resolvedSource: CompletionSource =
      source || (actualMinutes !== undefined ? 'reflection_modal' : 'quick_check');
    const completedTime = new Date().toISOString();
    const minutes = actualMinutes !== undefined ? actualMinutes : targetMove.estimatedMinutes;

    const updatedMoves = (activeGoal.microMoves || []).map((m) =>
      m.id === moveId
        ? {
            ...m,
            status: 'completed' as const,
            actualMinutes: minutes,
            completedAt: completedTime,
            learningRemark: note || m.learningRemark,
            completionSource: resolvedSource,
          }
        : m
    );

    // Resolve downstream dependencies
    const { moves: resolvedMoves, newlyUnblockedIds } = resolveMoveUnlocks(updatedMoves);

    const updatedGoal = { ...activeGoal, microMoves: resolvedMoves };
    updateGoal(updatedGoal);

    // Record Learning Log
    const newLog: LearningLog = {
      id: `log_${Date.now()}`,
      goalId: activeGoal.id,
      microMoveId: targetMove.id,
      microMoveTitle: targetMove.title,
      timestamp: completedTime,
      estimatedMinutes: targetMove.estimatedMinutes,
      actualMinutes: minutes,
      ratio: targetMove.estimatedMinutes / Math.max(1, minutes),
      note: note || '',
      source: resolvedSource,
    };
    setLearningLogs((prev) => [newLog, ...prev]);

    // Baton Handover notice if downstream tasks unlocked
    if (newlyUnblockedIds.length > 0) {
      const unlockedMoves = resolvedMoves.filter((m) => newlyUnblockedIds.includes(m.id));
      const firstUnlocked = unlockedMoves[0];
      setBatonHandoverNotice({
        unblockedTitle: firstUnlocked.title,
        assigneeName: firstUnlocked.assigneeName || 'Teammate',
        count: newlyUnblockedIds.length,
      });
      androidBridge.triggerHaptic('success');
      soundManager.playCompleteChime();
    } else {
      androidBridge.triggerHaptic('complete');
      soundManager.playCompleteChime();
    }

    // Goal Conquest Check
    const isGoalConquered = resolvedMoves.length > 0 && resolvedMoves.every(m => m.status === 'completed');
    if (isGoalConquered) {
      triggerVictoryBurst();
    }

    setLastUndoAction({
      id: `undo_${Date.now()}`,
      type: 'complete_move',
      description: `Completed: ${targetMove.title}`,
      timestamp: Date.now(),
    });
  }, [activeGoal, saveSnapshot, updateGoal, triggerVictoryBurst]);

  const undoCompleteMicroMove = useCallback((moveId: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updatedMoves = (activeGoal.microMoves || []).map((m) =>
      m.id === moveId
        ? { ...m, status: 'todo' as const, completedAt: undefined }
        : m
    );
    updateGoal({ ...activeGoal, microMoves: updatedMoves });
    setLearningLogs((prev) => prev.filter((l) => l.microMoveId !== moveId));
    androidBridge.triggerHaptic('light');
  }, [activeGoal, saveSnapshot, updateGoal]);

  const markMicroMoveMissed = useCallback((moveId: string, taxonomy: BlockerTaxonomy, details: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const targetMove = (activeGoal.microMoves || []).find((m) => m.id === moveId);
    if (!targetMove) return;

    const suggestion = getRecoverySuggestion(taxonomy, targetMove.title);

    const updatedMoves = (activeGoal.microMoves || []).map((m) =>
      m.id === moveId
        ? {
            ...m,
            status: 'missed' as const,
            blockerReason: taxonomy,
            blockerRecoveryAction: suggestion.actionLabel,
          }
        : m
    );

    updateGoal({ ...activeGoal, microMoves: updatedMoves });

    const newBlocker: BlockerRecord = {
      id: `blk_${Date.now()}`,
      goalId: activeGoal.id,
      microMoveId: targetMove.id,
      microMoveTitle: targetMove.title,
      timestamp: new Date().toISOString(),
      taxonomy,
      details,
      aiRecoverySuggestion: suggestion.suggestion,
      mitigated: false,
      appliedAction: suggestion.actionLabel,
    };

    setBlockers((prev) => [newBlocker, ...prev]);
    androidBridge.triggerHaptic('warning');
    soundManager.playBlockerThud();
    notificationEngine.notifySlippage(targetMove.title, 1);
  }, [activeGoal, saveSnapshot, updateGoal]);

  const updateMoveNote = useCallback((moveId: string, note: string) => {
    if (!activeGoal) return;
    const updated = {
      ...activeGoal,
      microMoves: (activeGoal.microMoves || []).map((m) =>
        m.id === moveId ? { ...m, learningRemark: note } : m
      ),
    };
    updateGoal(updated);
  }, [activeGoal, updateGoal]);

  const adjustMoveDuration = useCallback((moveId: string, deltaMinutes: number) => {
    if (!activeGoal) return;
    const updated = {
      ...activeGoal,
      microMoves: (activeGoal.microMoves || []).map((m) =>
        m.id === moveId
          ? { ...m, estimatedMinutes: Math.max(5, Math.min(180, m.estimatedMinutes + deltaMinutes)) }
          : m
      ),
    };
    updateGoal(updated);
    androidBridge.triggerHaptic('light');
  }, [activeGoal, updateGoal]);

  const swapMicroMoves = useCallback((moveIdA: string, moveIdB: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const moves = [...(activeGoal.microMoves || [])];
    const idxA = moves.findIndex((m) => m.id === moveIdA);
    const idxB = moves.findIndex((m) => m.id === moveIdB);
    if (idxA === -1 || idxB === -1) return;

    const tempOrder = moves[idxA].order;
    moves[idxA].order = moves[idxB].order;
    moves[idxB].order = tempOrder;

    const temp = moves[idxA];
    moves[idxA] = moves[idxB];
    moves[idxB] = temp;

    updateGoal({ ...activeGoal, microMoves: moves });
    androidBridge.triggerHaptic('light');
  }, [activeGoal, saveSnapshot, updateGoal]);

  const promoteToFocus = useCallback((moveId: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const today = new Date().toISOString().split('T')[0];
    const target = (activeGoal.microMoves || []).find((m) => m.id === moveId);
    if (!target) return;

    const remaining = (activeGoal.microMoves || []).filter((m) => m.id !== moveId);
    const updated = {
      ...activeGoal,
      microMoves: [{ ...target, dateScheduled: today, status: 'todo' as const }, ...remaining],
    };
    updateGoal(updated);
    androidBridge.triggerHaptic('medium');
    soundManager.playTick();
  }, [activeGoal, saveSnapshot, updateGoal]);

  // Collaboration & A2A Negotiation
  const addTeamMember = useCallback((member: Omit<TeamMember, 'id'>) => {
    const newMember: TeamMember = {
      ...member,
      id: `tm_${Date.now()}`,
    };
    setTeamMembers((prev) => [...prev, newMember]);
    androidBridge.triggerHaptic('light');
  }, []);

  const deleteTeamMember = useCallback((memberId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    androidBridge.triggerHaptic('light');
  }, []);

  const joinTeamPlan = useCallback((code: string): boolean => {
    androidBridge.triggerHaptic('medium');
    return Boolean(code.trim());
  }, []);

  const exportFlightPlanMarkdown = useCallback(async (): Promise<string> => {
    if (!activeGoal) return '';
    return exportEngine.generateMarkdownBriefing(activeGoal, isAsymmetricPrivateMode);
  }, [activeGoal, isAsymmetricPrivateMode]);

  const shareFlightPlan = useCallback(async (): Promise<void> => {
    if (!activeGoal) return;
    androidBridge.triggerHaptic('medium');
    await collaborationEngine.shareFlightPlan(activeGoal);
  }, [activeGoal]);

  const exportFlightPlanJson = useCallback((): string => {
    if (!activeGoal) return '{}';
    return collaborationEngine.exportFlightPlanJson(activeGoal);
  }, [activeGoal]);

  const importFlightPlanJson = useCallback((jsonStr: string): boolean => {
    const plan = collaborationEngine.importFlightPlanJson(jsonStr);
    if (!plan) return false;

    const newGoal: Goal = {
      id: `goal_${Date.now()}`,
      title: plan.title,
      category: plan.category,
      createdAt: new Date().toISOString().split('T')[0],
      active: true,
      velocityFactor: 1.0,
      status: 'on_track',
      weeklyCapacityHours: 10,
      currentLevel: 'Intermediate',
      deadlineFlexibility: 'Moderate Elastic',
      vision: {
        coreOutcome: plan.title,
        targetDate: plan.targetDate,
      },
      milestones: plan.milestones.map((m) => ({
        id: m.id,
        goalId: `goal_${Date.now()}`,
        order: m.order,
        title: m.title,
        description: '',
        targetDate: m.targetDate,
        owner: m.owner || 'You',
        status: m.status,
      })),
      microMoves: [],
    };

    createGoal(newGoal);
    return true;
  }, [createGoal]);

  const importSharedFlightPlan = importFlightPlanJson;

  const executeTeammateNegotiation = useCallback((): NegotiationResult => {
    if (!activeGoal) {
      return { dialogue: [], proposedMilestones: [], summary: 'No active goal' };
    }
    return collaborationEngine.simulateTeammateNegotiation(activeGoal, teamMembers);
  }, [activeGoal, teamMembers]);

  const applyTeammateNegotiation = useCallback((result: NegotiationResult) => {
    if (!activeGoal || !result.proposedMilestones.length) return;
    saveSnapshot();
    updateGoal({
      ...activeGoal,
      isTeamGoal: true,
      milestones: result.proposedMilestones,
    });
    androidBridge.triggerHaptic('complete');
    soundManager.playCompleteChime();
  }, [activeGoal, saveSnapshot, updateGoal]);

  // Parallel Tasks & Team Schedule Rebalance
  const parallelMetrics = useMemo(() => {
    if (!activeGoal) {
      return computeParallelTrackMetrics([], teamMembers);
    }
    return computeParallelTrackMetrics(activeGoal.microMoves || [], teamMembers);
  }, [activeGoal, teamMembers]);

  const getParallelRebalanceProposals = useCallback((): ParallelRebalanceProposal[] => {
    if (!activeGoal) return [];
    return generateParallelRebalanceProposals(activeGoal, teamMembers);
  }, [activeGoal, teamMembers]);

  const applyParallelRebalanceProposal = useCallback((proposal: ParallelRebalanceProposal) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updated = applyParallelRebalance(activeGoal, proposal);
    updateGoal(updated);
    androidBridge.triggerHaptic('success');
    soundManager.playCompleteChime();
    setLastUndoAction({
      id: `undo_${Date.now()}`,
      type: 'what_if_commit',
      description: `Applied Schedule Rebalance: ${proposal.title}`,
      timestamp: Date.now(),
    });
  }, [activeGoal, saveSnapshot, updateGoal]);

  const reassignMicroMove = useCallback((moveId: string, toAssigneeId: string, toAssigneeName: string) => {
    if (!activeGoal) return;
    saveSnapshot();
    const updatedMoves = (activeGoal.microMoves || []).map((m) =>
      m.id === moveId ? { ...m, assigneeId: toAssigneeId, assigneeName: toAssigneeName } : m
    );
    updateGoal({ ...activeGoal, microMoves: updatedMoves });
    androidBridge.triggerHaptic('selection');
  }, [activeGoal, saveSnapshot, updateGoal]);

  // Assistant Chat & Executable Actions
  const chatWithTracerAssistant = useCallback(async (query: string, history?: AssistantChatMessage[]): Promise<AssistantResponse> => {
    const todayStr = new Date().toISOString().split('T')[0];
    const allPendingMoves = (activeGoal?.microMoves || [])
      .filter((m) => !m.isPruned && m.status === 'todo' && (!m.dateScheduled || m.dateScheduled <= todayStr))
      .map((m) => m.title);

    // O(1) Cognitive Context Windowing: Top 5 moves + overflow count prevents context bleed
    const overflowCount = Math.max(0, allPendingMoves.length - 5);
    const pendingMoves = allPendingMoves.slice(0, 5);
    if (overflowCount > 0) {
      pendingMoves.push(`(+${overflowCount} more pending in backlog)`);
    }

    const effectiveApiKey = storage.getApiKey() || apiKey;
    const effectiveDeepSeekKey = storage.getDeepSeekApiKey() || deepSeekApiKey;
    const effectiveProvider = storage.getAiProvider() || aiProvider;

    const learningRemarks = learningLogs
      .filter((l) => l.note && l.note.trim())
      .slice(0, 5)
      .map((l) => `"${l.microMoveTitle}": ${l.note}`);

    const context = {
      goalTitle: activeGoal?.title || 'Current Goal',
      activeMilestoneTitle: scheduleMetrics.activeMilestone?.title,
      todayMoves: pendingMoves,
      daysRemaining: scheduleMetrics.daysRemaining,
      isOverdue: scheduleMetrics.isOverdue,
      velocityFactor: learningModel.velocityFactor,
      recentBlockers: blockers.slice(0, 3).map((b) => ({ taxonomy: b.taxonomy, details: b.details })),
      completedMovesCount: learningModel.totalCompletedMoves,
      learningRemarks,
      recentReflections: dailyReflections.slice(0, 5).map((r) => ({
        date: r.date,
        mood: r.mood,
        note: r.note,
      })),
    };

    const options = {
      openAIApiKey: storage.getOpenAIApiKey() || openAIApiKey,
      anthropicApiKey: storage.getAnthropicApiKey() || anthropicApiKey,
      customApiKey: storage.getCustomApiKey() || customApiKey,
      modelName: storage.getAiModel() || aiModelName,
      customBaseUrl: storage.getCustomApiBaseUrl() || customBaseUrl,
    };

    const res = await callChatAssistant(query, context, effectiveApiKey, history, effectiveProvider, effectiveDeepSeekKey, options);
    if (res?.suggestedAction && res.suggestedAction.type !== 'none') {
      recordTrajectoryItem({
        action: res.suggestedAction.label,
        actionType: res.suggestedAction.type,
        description: res.suggestedAction.description,
        payload: res.suggestedAction.payload,
        status: 'proposed',
        source: 'agent',
      });
    }
    return res;
  }, [
    activeGoal,
    scheduleMetrics,
    learningModel,
    blockers,
    learningLogs,
    dailyReflections,
    apiKey,
    deepSeekApiKey,
    aiProvider,
    openAIApiKey,
    anthropicApiKey,
    customApiKey,
    aiModelName,
    customBaseUrl,
    recordTrajectoryItem,
  ]);

  const applyAssistantAction = useCallback((action: AssistantExecutableAction) => {
    if (!activeGoal) return;
    saveSnapshot();

    if (action.type === 'split_task') {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetMoveId = action.payload?.moveId || activeGoal.microMoves.find((m) => m.status === 'todo')?.id;
      const targetMove = activeGoal.microMoves.find((m) => m.id === targetMoveId);
      if (!targetMove) return;

      const parts = action.payload?.splitParts || [
        { title: `${targetMove.title} (Part 1)`, minutes: 15 },
        { title: `${targetMove.title} (Part 2)`, minutes: 15 },
      ];

      const newMoves: MicroMove[] = parts.map((p, idx) => ({
        id: `mm_split_${Date.now()}_${idx}`,
        milestoneId: targetMove.milestoneId,
        goalId: activeGoal.id,
        title: p.title,
        description: targetMove.description,
        estimatedMinutes: p.minutes,
        dateScheduled: todayStr,
        status: 'todo' as const,
        isPrivate: targetMove.isPrivate,
        order: targetMove.order + idx,
      }));

      const remaining = activeGoal.microMoves.filter((m) => m.id !== targetMove.id);
      updateGoal({
        ...activeGoal,
        microMoves: [...newMoves, ...remaining],
      });
      setLastUndoAction({
        id: `undo_${Date.now()}`,
        type: 'assistant_action',
        description: `Split: ${targetMove.title}`,
        timestamp: Date.now(),
      });
      androidBridge.triggerHaptic('medium');
      soundManager.playTick();
    } else if (action.type === 'reschedule_task') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const newDate = action.payload?.newDate || tomorrow.toISOString().split('T')[0];

      const updated = {
        ...activeGoal,
        microMoves: (activeGoal.microMoves || []).map((m) =>
          m.status === 'todo' ? { ...m, dateScheduled: newDate } : m
        ),
      };
      updateGoal(updated);
      setLastUndoAction({
        id: `undo_${Date.now()}`,
        type: 'assistant_action',
        description: `Rescheduled to ${newDate}`,
        timestamp: Date.now(),
      });
      androidBridge.triggerHaptic('light');
    } else if (action.type === 'rebalance_dates') {
      const offsetDays = action.payload?.daysOffset ?? 3;
      const updatedMilestones = (activeGoal.milestones || []).map((m) => {
        if (m.status === 'completed') return m;
        const curDate = new Date(m.targetDate || new Date());
        curDate.setDate(curDate.getDate() + offsetDays);
        return {
          ...m,
          targetDate: curDate.toISOString().split('T')[0],
        };
      });

      updateGoal({
        ...activeGoal,
        milestones: updatedMilestones,
      });
      setLastUndoAction({
        id: `undo_${Date.now()}`,
        type: 'assistant_action',
        description: `Rebalanced milestones (+${offsetDays}d)`,
        timestamp: Date.now(),
      });
      androidBridge.triggerHaptic('medium');
    } else if (action.type === 'add_task') {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetMilestoneId =
        action.payload?.milestoneId ||
        scheduleMetrics.activeMilestone?.id ||
        activeGoal.milestones?.[0]?.id ||
        'ms-1';

      const newMove: MicroMove = {
        id: `mm_ast_${Date.now()}`,
        milestoneId: targetMilestoneId,
        goalId: activeGoal.id,
        title: action.payload?.title || 'Actionable Micro-Move',
        description: action.description || 'Generated via Tracer Assistant',
        estimatedMinutes: action.payload?.estimatedMinutes || 25,
        dateScheduled: action.payload?.dateScheduled || todayStr,
        status: 'todo' as const,
        isPrivate: false,
        order: (activeGoal.microMoves || []).length + 1,
      };

      updateGoal({
        ...activeGoal,
        microMoves: [...(activeGoal.microMoves || []), newMove],
      });
      setLastUndoAction({
        id: `undo_${Date.now()}`,
        type: 'add_move',
        description: `Added: ${newMove.title}`,
        timestamp: Date.now(),
      });
      androidBridge.triggerHaptic('medium');
      soundManager.playTick();
    } else if (action.type === 'complete_task') {
      const targetMove = action.payload?.moveId
        ? (activeGoal.microMoves || []).find((m) => m.id === action.payload?.moveId)
        : (activeGoal.microMoves || []).find((m) => m.status === 'todo');

      if (!targetMove) return;

      const completedTime = new Date().toISOString();
      const minutes = action.payload?.estimatedMinutes || targetMove.actualMinutes || targetMove.estimatedMinutes;

      const updatedMoves = (activeGoal.microMoves || []).map((m) =>
        m.id === targetMove.id
          ? {
              ...m,
              status: 'completed' as const,
              actualMinutes: minutes,
              completedAt: completedTime,
              learningRemark: 'Completed via Tracer Assistant',
              completionSource: 'assistant' as const,
            }
          : m
      );

      updateGoal({ ...activeGoal, microMoves: updatedMoves });

      const newLog: LearningLog = {
        id: `log_${Date.now()}`,
        goalId: activeGoal.id,
        microMoveId: targetMove.id,
        microMoveTitle: targetMove.title,
        timestamp: completedTime,
        estimatedMinutes: targetMove.estimatedMinutes,
        actualMinutes: minutes,
        ratio: targetMove.estimatedMinutes / Math.max(1, minutes),
        note: 'Completed via Assistant action',
        source: 'assistant' as const,
      };
      setLearningLogs((prev) => [newLog, ...prev]);

      setLastUndoAction({
        id: `undo_${Date.now()}`,
        type: 'complete_move',
        description: `Completed: ${targetMove.title}`,
        timestamp: Date.now(),
      });
      androidBridge.triggerHaptic('complete');
      soundManager.playCompleteChime();
    } else if (action.type === 'prune_task') {
      const targetMoveId =
        action.payload?.moveId ||
        (activeGoal.microMoves || []).find((m) => m.status === 'todo')?.id;

      if (!targetMoveId) return;

      const targetMove = (activeGoal.microMoves || []).find((m) => m.id === targetMoveId);
      const updatedMoves = (activeGoal.microMoves || []).map((m) =>
        m.id === targetMoveId ? { ...m, isPruned: true, status: 'missed' as const } : m
      );

      updateGoal({
        ...activeGoal,
        microMoves: updatedMoves,
      });
      setLastUndoAction({
        id: `undo_${Date.now()}`,
        type: 'prune_move',
        description: `Pruned: ${targetMove?.title || 'Micro-Move'}`,
        timestamp: Date.now(),
      });
      androidBridge.triggerHaptic('warning');
      soundManager.playBlockerThud();
    } else if (action.type === 'prioritize_task') {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetMoveId =
        action.payload?.moveId ||
        (activeGoal.microMoves || []).find((m) => m.status === 'todo')?.id;

      if (!targetMoveId) return;

      const target = (activeGoal.microMoves || []).find((m) => m.id === targetMoveId);
      if (!target) return;

      const remaining = (activeGoal.microMoves || []).filter((m) => m.id !== targetMoveId);
      const updated = {
        ...activeGoal,
        microMoves: [{ ...target, dateScheduled: todayStr, order: 1, status: 'todo' as const }, ...remaining],
      };

      updateGoal(updated);
      setLastUndoAction({
        id: `undo_${Date.now()}`,
        type: 'prioritize_move',
        description: `Prioritized: ${target.title}`,
        timestamp: Date.now(),
      });
      androidBridge.triggerHaptic('medium');
      soundManager.playTick();
    }
  }, [activeGoal, saveSnapshot, updateGoal, scheduleMetrics]);

  const approveTrajectoryAction = useCallback(async (id: string) => {
    const current = storage.getTrajectory();
    const target = current.find((t) => t.id === id);
    if (!target) return;

    if (target.actionType && target.actionType !== 'none') {
      applyAssistantAction({
        type: target.actionType as any,
        label: target.action || 'Applied Trajectory Action',
        description: target.description || '',
        payload: target.payload,
      });
    }

    const updated = current.map((t) =>
      t.id === id ? { ...t, status: 'applied' as const } : t
    );
    storage.saveTrajectory(updated);
    setTrajectoryState(updated);
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('success');
  }, [applyAssistantAction]);

  const rejectTrajectoryAction = useCallback(async (id: string) => {
    const current = storage.getTrajectory();
    const updated = current.map((t) =>
      t.id === id ? { ...t, status: 'rejected' as const } : t
    );
    storage.saveTrajectory(updated);
    setTrajectoryState(updated);
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
  }, []);

  // Settings & Acoustics
  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    storage.saveApiKey(key);
  }, []);

  const setAsymmetricPrivateMode = useCallback((enabled: boolean) => {
    setPrivateModeState(enabled);
    storage.savePrivacyMode(enabled);
    androidBridge.triggerHaptic('light');
  }, []);

  const setSoundMuted = useCallback((muted: boolean) => {
    setSoundMutedState(muted);
    storage.saveSoundMuted(muted);
    soundManager.setMuted(muted);
  }, []);

  const setSoundVolume = useCallback((vol: number) => {
    setSoundVolumeState(vol);
    storage.saveSoundVolume(vol);
    soundManager.setVolume(vol);
  }, []);

  const toggleFrameView = useCallback(() => {
    setIsFrameView((prev) => {
      const next = !prev;
      storage.saveFrameView(next);
      return next;
    });
  }, []);

  // Vault
  const unlockVault = useCallback(async (pin?: string): Promise<boolean> => {
    const success = await biometricVault.unlock(pin);
    if (success) {
      setVaultState(biometricVault.getState());
      androidBridge.triggerHaptic('complete');
    }
    return success;
  }, []);

  const lockVault = useCallback(() => {
    biometricVault.lock();
    setVaultState(biometricVault.getState());
  }, []);

  const setShieldEnabled = useCallback(async (enabled: boolean, pin?: string): Promise<boolean> => {
    let success = false;
    if (enabled && pin) {
      success = await biometricVault.enableShield(pin);
    } else if (!enabled && pin) {
      success = await biometricVault.disableShield(pin);
    }
    setVaultState(biometricVault.getState());
    return success;
  }, []);

  const setAutoLockInterval = useCallback((interval: AutoLockInterval) => {
    biometricVault.setAutoLockInterval(interval);
    setVaultState(biometricVault.getState());
  }, []);

  // Single-Step Undo
  const undo = useCallback(() => {
    if (previousGoalSnapshot) {
      updateGoal(previousGoalSnapshot);
      setPreviousGoalSnapshot(null);
      setLastUndoAction(null);
      androidBridge.triggerHaptic('medium');
      soundManager.playTick();
    }
  }, [previousGoalSnapshot, updateGoal]);

  const dismissUndo = useCallback(() => {
    setLastUndoAction(null);
    setPreviousGoalSnapshot(null);
  }, []);

  const canUndo = Boolean(previousGoalSnapshot && lastUndoAction);

  return (
    <GoalContext.Provider
      value={{
        goals,
        activeGoal,
        activeTab,
        scheduleMetrics,
        learningModel,
        streak,
        learningLogs,
        blockers,
        teamMembers,
        isAsymmetricPrivateMode,
        soundMuted,
        soundVolume,
        vaultState,
        lastUndoAction,
        canUndo,
        cpmReport,
        isFrameView,
        dailyReflection,
        dailyReflections,
        logDailyReflection,
        setActiveTab,
        setActiveGoalId,
        createGoal,
        updateGoal,
        deleteGoal,
        decomposeNewGoal,
        conductSocraticIntake,
        addMilestone,
        updateMilestone,
        deleteMilestone,
        completeMilestone,
        reassignMilestone,
        addMicroMove,
        updateMicroMove,
        deleteMicroMove,
        completeMicroMove,
        undoCompleteMicroMove,
        markMicroMoveMissed,
        updateMoveNote,
        adjustMoveDuration,
        swapMicroMoves,
        promoteToFocus,
        addTeamMember,
        deleteTeamMember,
        joinTeamPlan,
        exportFlightPlanMarkdown,
        shareFlightPlan,
        exportFlightPlanJson,
        importFlightPlanJson,
        importSharedFlightPlan,
        executeTeammateNegotiation,
        applyTeammateNegotiation,
        batonHandoverNotice,
        dismissBatonHandoverNotice,
        reassignMicroMove,
        applyParallelRebalanceProposal,
        getParallelRebalanceProposals,
        parallelMetrics,
        chatWithTracerAssistant,
        applyAssistantAction,
        apiKey,
        aiProvider,
        deepSeekApiKey,
        openAIApiKey,
        anthropicApiKey,
        customApiKey,
        customBaseUrl,
        aiModelName,
        trajectory,
        trajectoryLedger,
        setApiKey,
        setAiProvider,
        setDeepSeekApiKey,
        setOpenAIApiKey,
        setAnthropicApiKey,
        setCustomApiKey,
        setCustomBaseUrl,
        setAiModelName,
        recordTrajectory,
        recordTrajectoryItem,
        approveTrajectoryAction,
        rejectTrajectoryAction,
        clearTrajectory,
        purgeAllData,
        purgeAllAgentData,
        testConnection,
        setAsymmetricPrivateMode,
        setSoundMuted,
        setSoundVolume,
        unlockVault,
        lockVault,
        setShieldEnabled,
        setAutoLockInterval,
        toggleFrameView,
        undo,
        dismissUndo,
        victoryBurstTrigger,
        triggerVictoryBurst,
      }}
    >
      {children}
    </GoalContext.Provider>
  );
};

export const useGoal = () => {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoal must be used within a GoalProvider');
  }
  return context;
};
