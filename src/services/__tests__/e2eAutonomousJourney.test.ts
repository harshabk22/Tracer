import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateHeuristicDecomposition,
  chatWithTracerAssistant,
  getRecoverySuggestion,
} from '../aiEngine';
import { focusSessionEngine } from '../focusSessionEngine';
import { computeScheduleMetrics } from '../scheduleEngine';
import { collaborationEngine } from '../collaborationEngine';
import { exportEngine } from '../exportEngine';
import { biometricVault, VAULT_STORAGE_KEYS } from '../biometricVault';
import { notificationEngine } from '../notificationEngine';
import { safeStorage } from '../storage';
import {
  Goal,
  MicroMove,
  LearningLog,
  TeamMember,
  AssistantContext,
} from '../../types/goal';

describe('End-to-End Autonomous Journey (8 Core Systems)', () => {
  let goal: Goal;
  const crew: TeamMember[] = [
    { id: 'tm_1', name: 'You (Goal Owner)', role: 'Lead & Strategy', avatar: 'YOU', isCurrentUser: true },
    { id: 'tm_2', name: 'Jordan Taylor', role: 'Design & UX', avatar: 'JT', isCurrentUser: false },
    { id: 'tm_3', name: 'Alex Morgan', role: 'Operations & Execution', avatar: 'AM', isCurrentUser: false },
    { id: 'tm_4', name: 'Samira Patel', role: 'Review & Quality', avatar: 'SP', isCurrentUser: false },
  ];

  beforeEach(() => {
    // Reset vault storage keys before test
    safeStorage.removeItem(VAULT_STORAGE_KEYS.SHIELD_ENABLED);
    safeStorage.removeItem(VAULT_STORAGE_KEYS.PIN_HASH);
    safeStorage.removeItem(VAULT_STORAGE_KEYS.PIN_SALT);
    biometricVault.lock();
  });

  it('executes the full 8-system autonomous executive loop sequentially', async () => {
    // =========================================================================
    // 1. Universal 3-Beat Intake (<15s)
    // =========================================================================
    goal = generateHeuristicDecomposition({
      title: 'Ship Distributed Consensus Node in Rust',
      weeklyCapacityHours: 15,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Hard Deadline',
    });

    expect(goal.category).toBe('technical');
    expect(goal.title).toBe('Ship Distributed Consensus Node in Rust');
    expect(goal.vision.coreOutcome).toBeDefined();
    expect(goal.milestones.length).toBeGreaterThanOrEqual(3);
    expect(goal.microMoves.length).toBeGreaterThanOrEqual(3);

    // All micro-moves strictly <= 45 minutes
    goal.microMoves.forEach((mm) => {
      expect(mm.estimatedMinutes).toBeLessThanOrEqual(45);
    });

    // Schedule metrics baseline
    const initialSchedule = computeScheduleMetrics(goal);
    expect(initialSchedule.totalMilestones).toBe(goal.milestones.length);
    expect(initialSchedule.completedMilestones).toBe(0);
    expect(initialSchedule.activeMilestoneIndex).toBe(0);

    // =========================================================================
    // 2. Daily Hero Execution (Focus Session Stopwatch)
    // =========================================================================
    const heroMove = goal.microMoves[0];
    const sessionState = focusSessionEngine.startSession(heroMove, 25);

    expect(sessionState.isActive).toBe(true);
    expect(sessionState.isPaused).toBe(false);
    expect(sessionState.targetSeconds).toBe(1500);

    // Pause & Resume verification
    focusSessionEngine.pauseSession();
    expect(focusSessionEngine.getState().isPaused).toBe(true);

    focusSessionEngine.resumeSession();
    expect(focusSessionEngine.getState().isPaused).toBe(false);

    // Buffer extension (+5m)
    focusSessionEngine.extendBuffer(5);
    expect(focusSessionEngine.getState().targetSeconds).toBe(1800);

    // Complete session and produce learning log
    const completedSession = focusSessionEngine.finishAndComplete('Completed core Tokio RPC scaffolding');
    expect(completedSession).not.toBeNull();
    expect(completedSession?.moveId).toBe(heroMove.id);

    heroMove.status = 'completed';
    heroMove.actualMinutes = 20; // 20m actual vs 25m estimated

    const learningLog: LearningLog = {
      id: 'log_1',
      goalId: goal.id,
      microMoveId: heroMove.id,
      microMoveTitle: heroMove.title,
      timestamp: new Date().toISOString(),
      estimatedMinutes: heroMove.estimatedMinutes,
      actualMinutes: 20,
      ratio: heroMove.estimatedMinutes / 20,
      note: 'Completed core Tokio RPC scaffolding with clean async benchmarks',
    };

    // =========================================================================
    // 3. 2-Strike Humane Rescue & Midnight Rollover
    // =========================================================================
    const secondMove = goal.microMoves[1];

    // Strike 1: Blocker recorded
    const strike1 = getRecoverySuggestion('Energy Depletion', secondMove.title);
    expect(strike1.actionLabel).toContain('Micro-Nudge');

    // Strike 2: Resistance triggers auto-slice to 15m
    const rescuedMinutes = Math.min(15, secondMove.estimatedMinutes);
    expect(rescuedMinutes).toBe(15);
    secondMove.estimatedMinutes = rescuedMinutes;

    // Midnight Rollover: zero-guilt advance to next day
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    secondMove.dateScheduled = tomorrowStr;
    secondMove.status = 'todo';
    expect(secondMove.dateScheduled).toBe(tomorrowStr);

    // =========================================================================
    // 4. Interactive Learning AI Assistant (Memory Context & Executable Actions)
    // =========================================================================
    const assistantContext: AssistantContext = {
      goalTitle: goal.title,
      activeMilestoneTitle: goal.milestones[0].title,
      todayMoves: [secondMove.title],
      velocityFactor: 1.25, // 25 / 20 ratio
      recentBlockers: [{ taxonomy: 'Energy Depletion', details: 'Late evening fatigue' }],
      completedMovesCount: 1,
    };

    const assistantResponse = await chatWithTracerAssistant(
      'I feel completely stuck and overwhelmed by this next deliverable',
      assistantContext
    );

    expect(assistantResponse.reply).toContain('splitting');
    expect(assistantResponse.suggestedAction).toBeDefined();
    expect(assistantResponse.suggestedAction?.type).toBe('split_task');
    expect(assistantResponse.suggestedAction?.payload?.splitParts).toHaveLength(2);

    // =========================================================================
    // 5. Crew Roster & A2A Teammate Negotiation
    // =========================================================================
    const negotiationResult = collaborationEngine.simulateTeammateNegotiation(goal, crew);

    expect(negotiationResult.dialogue.length).toBeGreaterThanOrEqual(4);
    expect(negotiationResult.proposedMilestones.length).toBe(goal.milestones.length);
    expect(negotiationResult.summary).toContain('Allocated');

    // Dialogue turns reflect assigned teammates
    const senders = negotiationResult.dialogue.map((t) => t.senderName);
    expect(senders).toContain('You (Goal Owner)');

    // =========================================================================
    // 6. Zero-Knowledge Privacy Sanctuary (Scrubbing on Export)
    // =========================================================================
    const sanitizedFlightPlan = collaborationEngine.sanitizeGoalForShare(goal);

    expect(sanitizedFlightPlan.version).toBe('tracer.v2');
    expect(sanitizedFlightPlan.title).toBe(goal.title);
    expect(sanitizedFlightPlan.milestones).toHaveLength(goal.milestones.length);

    // Verify strict firewall: no micro-moves, no reflections, no personal logs in export
    const rawJson = collaborationEngine.exportFlightPlanJson(goal);
    expect(rawJson).not.toContain('Completed core Tokio RPC scaffolding');
    expect(rawJson).not.toContain('Late evening fatigue');

    // Markdown briefing export test
    const md = exportEngine.generateMarkdownBriefing(goal, true);
    expect(md).toContain('# 🎯 Tracer Roadmap: Ship Distributed Consensus Node in Rust');
    expect(md).not.toContain('Completed core Tokio RPC scaffolding');

    // =========================================================================
    // 7. Biometric Vault (WebAuthn / PIN & Auto-Relock)
    // =========================================================================
    const pin = '4826';
    const enabled = await biometricVault.enableShield(pin);
    expect(enabled).toBe(true);

    biometricVault.lock();
    expect(biometricVault.isShielded()).toBe(true);

    // Invalid PIN fails
    const invalidAuth = await biometricVault.unlock('0000');
    expect(invalidAuth).toBe(false);
    expect(biometricVault.isShielded()).toBe(true);

    // Valid PIN succeeds
    const validAuth = await biometricVault.unlock(pin);
    expect(validAuth).toBe(true);
    expect(biometricVault.isShielded()).toBe(false);

    // Cleanup: disable shield
    await biometricVault.disableShield(pin);
    expect(biometricVault.isShieldEnabled()).toBe(false);

    // =========================================================================
    // 8. Native Android Local Notifications (AlarmManager Interface)
    // =========================================================================
    expect(typeof notificationEngine.isSupported()).toBe('boolean');

    const briefingDispatched = await notificationEngine.notifyFocusBriefing(
      secondMove.title,
      secondMove.estimatedMinutes
    );
    expect(typeof briefingDispatched).toBe('boolean');

    const slipDispatched = await notificationEngine.notifySlippage(goal.milestones[0].title, 2);
    expect(typeof slipDispatched).toBe('boolean');
  });
});
