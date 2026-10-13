export type GoalCategory = 'personal' | 'fitness' | 'study' | 'business' | 'technical' | 'creative';

export type AIProvider = 'gemini' | 'deepseek' | 'openai' | 'anthropic' | 'custom';

export type CurrentLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type DeadlineFlexibility = 'Hard Deadline' | 'Moderate Elastic' | 'Flexible';

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'at_risk' | 'delayed';

export type MicroMoveStatus = 'todo' | 'in_progress' | 'completed' | 'missed' | 'blocked';

export type BlockerTaxonomy = 'Time Crunch' | 'Skill Gap' | 'Energy Depletion' | 'External Dependency';

export type RecoveryForkOption = 'accept_slip' | 'compress_float' | 'prune_scope';

export type CompletionSource = 'focus_timer' | 'reflection_modal' | 'quick_check' | 'assistant';

export interface MicroMove {
  id: string;
  milestoneId: string;
  goalId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  dateScheduled: string; // YYYY-MM-DD
  isCriticalPath?: boolean;
  isPruned?: boolean;
  status: MicroMoveStatus;
  completedAt?: string;
  learningRemark?: string;
  blockerReason?: BlockerTaxonomy;
  blockerRecoveryAction?: string;
  isPrivate: boolean; // Zero-knowledge personal note
  order: number;
  completionSource?: CompletionSource;
  assigneeId?: string; // TeamMember ID or "user"
  assigneeName?: string; // Display name
  dependencies?: string[]; // Array of MicroMove IDs that must be completed first
  parallelTrack?: string; // e.g. "Architecture", "Design", "Execution"
}

export interface SprintMilestone {
  id: string;
  goalId: string;
  order: number;
  title: string;
  description: string;
  targetDate: string; // YYYY-MM-DD
  owner?: string; // e.g. "You", "Elena", "Marcus"
  ownerAvatar?: string;
  handoverNote?: string;
  bufferFloatDays?: number; // elastic float
  floatConsumed?: number;
  isCriticalPath?: boolean;
  dependencies?: string[]; // Milestone IDs
  status: MilestoneStatus;
  isScopePruned?: boolean;
}

export interface GoalVision {
  coreOutcome: string;
  targetDate: string;
  totalEstimatedHours?: number;
  successMetrics?: string[];
}

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  vision: GoalVision;
  weeklyCapacityHours: number; // 5, 10, 15, 20+
  currentLevel: CurrentLevel;
  deadlineFlexibility: DeadlineFlexibility;
  createdAt: string;
  active: boolean;
  velocityFactor: number; // Vf (default 1.0)
  totalFloatBufferDays?: number;
  consumedFloatDays?: number;
  status: 'on_track' | 'slipping' | 'blocked' | 'recovered' | 'completed';
  isTeamGoal?: boolean;
  joinCode?: string;
  targetDays?: number;
  dailyMinutes?: number;
  generationSource?: 'gemini_live' | 'deepseek_live' | 'openai_live' | 'anthropic_live' | 'custom_live' | 'heuristic';
  milestones: SprintMilestone[];
  microMoves: MicroMove[];
}

export interface DailyReflection {
  date: string; // YYYY-MM-DD
  mood: 'smooth' | 'friction' | 'hard';
  note?: string;
  timestamp?: number;
}

export interface LearningLog {
  id: string;
  goalId: string;
  microMoveId: string;
  microMoveTitle: string;
  timestamp: string;
  estimatedMinutes: number;
  actualMinutes: number;
  ratio: number; // estimated / actual
  note: string;
  source?: CompletionSource;
}

export interface BlockerRecord {
  id: string;
  goalId: string;
  microMoveId: string;
  microMoveTitle: string;
  timestamp: string;
  taxonomy: BlockerTaxonomy;
  details: string;
  aiRecoverySuggestion: string;
  mitigated: boolean;
  appliedAction?: string;
}

export interface PersonalLearningModel {
  velocityFactor: number;
  totalCompletedMoves: number;
  totalActualMinutes: number;
  totalEstimatedMinutes: number;
  estimationAccuracy: number; // percentage (0-100)
  currentStreak: number;
  bestStreak: number;
  learningRemarksCount: number;
}

export interface SharedMilestoneContract {
  id: string;
  title: string;
  targetDate: string;
  status: MilestoneStatus;
  owner?: string;
  order: number;
}

export interface SharedGoalFlightPlan {
  version: string;
  exportedAt: string;
  title: string;
  category: GoalCategory;
  targetDate: string;
  milestones: SharedMilestoneContract[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isCurrentUser: boolean;
}

export type UndoActionType =
  | 'complete_move'
  | 'delete_move'
  | 'delete_milestone'
  | 'reorder_milestones'
  | 'what_if_commit'
  | 'add_move'
  | 'prune_move'
  | 'prioritize_move'
  | 'assistant_action';

export interface UndoItem {
  id: string;
  type: UndoActionType;
  description: string;
  timestamp: number;
}

export interface StreakDaySummary {
  date: string; // YYYY-MM-DD
  count: number;
  minutes: number;
}

export interface StreakMetrics {
  currentStreak: number;
  bestStreak: number;
  activeToday: boolean;
  totalCompletedMoves: number;
  streakHistory: StreakDaySummary[];
}

export type AutoLockInterval = 'immediate' | '1m' | '5m' | '15m' | 'on_background';

export interface VaultSecurityState {
  isShieldEnabled: boolean;
  isUnlocked: boolean;
  hasPlatformAuthenticator: boolean;
  lockTimeRemainingSec: number;
  autoLockInterval: AutoLockInterval;
  lastUnlockedAt: number | null;
  method: 'biometric' | 'pin' | 'none';
}

export type ParallelRebalanceFork = 'absorb_float' | 'parallel_split' | 'prune_scope';

export interface ParallelRebalanceProposal {
  id: string;
  fork: ParallelRebalanceFork;
  title: string;
  badge: string;
  description: string;
  impactSummary: string;
  diffPreview: {
    metric: string;
    before: string;
    after: string;
  };
  actions: {
    reassigns?: { moveId: string; toAssigneeId: string; toAssigneeName: string }[];
    floatExtensionDays?: number;
    prunedMoveIds?: string[];
  };
}

// Lightweight compatibility stubs for UI transitions
export interface CPMSlippageReport {
  slippageDays: number;
  remainingFloatDays: number;
  consumedFloatDays: number;
  criticalPathMilestoneIds: string[];
  status: 'on_track' | 'warning' | 'critical_slip';
  impactDescription: string;
}

export interface VelocityTrendMetrics {
  currentVf: number;
  rollingVf: number;
  historicalVf: number;
  accelerationFactor: number;
  trend: 'accelerating' | 'steady' | 'decelerating';
  estimatedHoursRemaining: number;
  projectedCompletionDate: string;
  confidenceScore: number;
  sampleCount: number;
}

export type AssistantActionType =
  | 'split_task'
  | 'reschedule_task'
  | 'rebalance_dates'
  | 'add_task'
  | 'complete_task'
  | 'prune_task'
  | 'prioritize_task'
  | 'none';

export interface AssistantExecutableAction {
  type: AssistantActionType;
  label: string;
  description: string;
  payload?: {
    moveId?: string;
    milestoneId?: string;
    newDate?: string;
    title?: string;
    estimatedMinutes?: number;
    dateScheduled?: string;
    splitParts?: { title: string; minutes: number }[];
    daysOffset?: number;
  };
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  action?: AssistantExecutableAction;
  clarificationOptions?: string[];
  timestamp: number;
}

export interface SocraticIntakeResponse {
  status: 'clarifying' | 'ready';
  message: string;
  questions?: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
  plan?: Goal;
  goal?: Goal;
}

export interface AssistantResponse {
  reply: string;
  suggestedAction?: AssistantExecutableAction;
  memoryInsight?: string;
  clarificationOptions?: string[];
}

export interface AssistantContext {
  goalTitle: string;
  activeMilestoneTitle?: string;
  todayMoves?: string[];
  daysRemaining?: number;
  isOverdue?: boolean;
  velocityFactor?: number;
  recentBlockers?: { taxonomy: string; details: string }[];
  failureRate?: number;
  completedMovesCount?: number;
  learningRemarks?: string[];
  recentReflections?: { date: string; mood: string; note?: string }[];
}

export interface NegotiationDialogueTurn {
  senderId: string;
  senderName: string;
  role: string;
  avatar: string;
  message: string;
  timestamp: string;
  suggestedReassignment?: {
    milestoneId: string;
    milestoneTitle: string;
    toOwner: string;
  };
}

export interface NegotiationResult {
  dialogue: NegotiationDialogueTurn[];
  proposedMilestones: SprintMilestone[];
  summary: string;
}

export interface ExecutionTrajectoryItem {
  id: string;
  timestamp: number;
  date?: string; // YYYY-MM-DD HH:mm:ss
  source?: 'user' | 'agent' | 'system';
  action: string;
  description?: string;
  status?: 'proposed' | 'approved' | 'rejected' | 'applied';
  diffSummary?: string;
  metadata?: Record<string, any>;
  actionType?: string;
  payload?: any;
  trigger?: string;
  actor?: 'agent' | 'user';
  summary?: string;
  type?: string;
  details?: string;
}

export interface AIConfiguration {
  provider: AIProvider;
  modelName?: string;
  apiKey?: string;
  customBaseUrl?: string;
}

export type TrajectoryRecord = ExecutionTrajectoryItem;

