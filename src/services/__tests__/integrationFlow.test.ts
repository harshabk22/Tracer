import { describe, it, expect } from 'vitest';
import { decomposeGoal, getRecoverySuggestion } from '../aiEngine';
import { computeScheduleMetrics, sequenceMilestones } from '../scheduleEngine';
import { collaborationEngine } from '../collaborationEngine';
import { exportEngine } from '../exportEngine';
import { Goal, MicroMove } from '../../types/goal';

describe('Tracer Autonomous Goal Engine - Full Lifecycle Integration', () => {
  it('executes full lifecycle: intake -> edit -> progress -> blocker recovery -> share', async () => {
    // 1. 3-Beat Fast Goal Intake & Decomposition
    const decomposed = await decomposeGoal({
      title: 'Build Distributed Raft Consensus Engine in Rust',
      weeklyCapacityHours: 15,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Hard Deadline',
    });

    expect(decomposed.category).toBe('technical');
    expect(decomposed.vision.coreOutcome).toBeDefined();
    expect(decomposed.milestones.length).toBeGreaterThanOrEqual(3);
    expect(decomposed.microMoves.length).toBeGreaterThanOrEqual(3);

    // Micro-moves are capped <= 45m
    decomposed.microMoves.forEach((mm) => {
      expect(mm.estimatedMinutes).toBeLessThanOrEqual(45);
    });

    // 2. Schedule sequencing & metrics
    const sequenced = sequenceMilestones(decomposed.milestones, '2026-10-01', 7);
    expect(sequenced[0].order).toBe(1);
    expect(sequenced[0].targetDate).toBe('2026-10-08');

    decomposed.milestones = sequenced;
    const scheduleMetrics = computeScheduleMetrics(decomposed);
    expect(scheduleMetrics.totalMilestones).toBe(decomposed.milestones.length);
    expect(scheduleMetrics.completedMilestones).toBe(0);
    expect(scheduleMetrics.activeMilestoneIndex).toBe(0);

    // 3. Complete first milestone
    decomposed.milestones[0].status = 'completed';
    const updatedMetrics = computeScheduleMetrics(decomposed);
    expect(updatedMetrics.completedMilestones).toBe(1);
    expect(updatedMetrics.activeMilestoneIndex).toBe(1);

    // 4. 4-Blocker AI Recovery Strategy
    const recovery = getRecoverySuggestion('Time Crunch', 'Implement Raft log compaction');
    expect(recovery.actionLabel).toContain('15m');
    expect(recovery.suggestion).toContain('15-minute');

    // 5. Collaboration Flight Plan Export & Briefing
    const jsonFlightPlan = collaborationEngine.exportFlightPlanJson(decomposed);
    const parsed = JSON.parse(jsonFlightPlan);
    expect(parsed.version).toBe('tracer.v2');
    expect(parsed.title).toBe(decomposed.title);

    const briefing = exportEngine.generateMarkdownBriefing(decomposed, false);
    expect(briefing).toContain('# 🎯 Tracer Roadmap:');
    expect(briefing).toContain('## 🏁 Milestones');
  });
});
