import { Goal, TeamMember, LearningLog, BlockerRecord } from '../types/goal';

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [];

export const PRESET_GOALS = [
  {
    title: 'Launch SaaS MVP in 30 Days',
    category: 'business' as const,
    weeklyCapacityHours: 15,
    currentLevel: 'Intermediate' as const,
    deadlineFlexibility: 'Hard Deadline' as const,
  },
  {
    title: 'Run a Half Marathon in 12 Weeks',
    category: 'fitness' as const,
    weeklyCapacityHours: 8,
    currentLevel: 'Beginner' as const,
    deadlineFlexibility: 'Moderate Elastic' as const,
  },
  {
    title: 'Master System Design & Distributed Systems',
    category: 'study' as const,
    weeklyCapacityHours: 10,
    currentLevel: 'Intermediate' as const,
    deadlineFlexibility: 'Flexible' as const,
  },
  {
    title: 'Conversational Spanish for Madrid Journey',
    category: 'personal' as const,
    weeklyCapacityHours: 6,
    currentLevel: 'Beginner' as const,
    deadlineFlexibility: 'Moderate Elastic' as const,
  },
];

const today = new Date().toISOString().split('T')[0];
const datePlusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const DEFAULT_GOAL: Goal = {
  id: 'goal-initial',
  title: 'Achieve Primary Objective',
  category: 'personal',
  weeklyCapacityHours: 10,
  currentLevel: 'Intermediate',
  deadlineFlexibility: 'Moderate Elastic',
  createdAt: today,
  active: true,
  velocityFactor: 1.0,
  totalFloatBufferDays: 6,
  consumedFloatDays: 0,
  status: 'on_track',
  vision: {
    coreOutcome: 'Complete all critical path milestones and establish sustained momentum.',
    targetDate: datePlusDays(30),
    totalEstimatedHours: 30,
    successMetrics: [
      'Complete milestone phases on schedule',
      'Maintain steady execution pacing',
    ],
  },
  milestones: [
    {
      id: 'ms-1',
      goalId: 'goal-initial',
      order: 1,
      title: 'Baseline & Core Foundations',
      description: 'Set up key requirements and complete primary setup tasks.',
      targetDate: datePlusDays(10),
      owner: 'You (Goal Owner)',
      bufferFloatDays: 2,
      floatConsumed: 0,
      isCriticalPath: true,
      dependencies: [],
      status: 'in_progress',
    },
    {
      id: 'ms-2',
      goalId: 'goal-initial',
      order: 2,
      title: 'Core Build & Iteration',
      description: 'Execute deep focused work on key deliverables.',
      targetDate: datePlusDays(20),
      owner: 'You (Goal Owner)',
      bufferFloatDays: 2,
      floatConsumed: 0,
      isCriticalPath: true,
      dependencies: ['ms-1'],
      status: 'pending',
    },
    {
      id: 'ms-3',
      goalId: 'goal-initial',
      order: 3,
      title: 'Validation & Completion',
      description: 'Finalize and verify outcomes against target vision.',
      targetDate: datePlusDays(30),
      owner: 'You (Goal Owner)',
      bufferFloatDays: 2,
      floatConsumed: 0,
      isCriticalPath: true,
      dependencies: ['ms-2'],
      status: 'pending',
    },
  ],
  microMoves: [
    {
      id: 'mm-1',
      milestoneId: 'ms-1',
      goalId: 'goal-initial',
      title: 'Complete 30-min deliberate focus block',
      description: 'Execute uninterrupted deep work on the initial setup.',
      estimatedMinutes: 30,
      dateScheduled: today,
      isCriticalPath: true,
      status: 'todo',
      isPrivate: true,
      order: 1,
    },
    {
      id: 'mm-2',
      milestoneId: 'ms-1',
      goalId: 'goal-initial',
      title: 'Review action items and synthesize takeaways',
      description: 'Consolidate next steps and prepare tomorrow plan.',
      estimatedMinutes: 20,
      dateScheduled: today,
      isCriticalPath: false,
      status: 'todo',
      isPrivate: true,
      order: 2,
    },
  ],
};

export const INITIAL_LEARNING_LOGS: LearningLog[] = [];

export const INITIAL_BLOCKERS: BlockerRecord[] = [];
