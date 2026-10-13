import { describe, it, expect } from 'vitest';
import { exportEngine } from '../exportEngine';
import { collaborationEngine } from '../collaborationEngine';
import { Goal } from '../../types/goal';

describe('Export & Collaboration Engine', () => {
  const mockGoal: Goal = {
    id: 'goal-export-1',
    title: 'Scale Distributed System',
    category: 'technical',
    weeklyCapacityHours: 15,
    currentLevel: 'Advanced',
    deadlineFlexibility: 'Hard Deadline',
    createdAt: '2026-09-01',
    active: true,
    velocityFactor: 1.2,
    status: 'on_track',
    vision: {
      coreOutcome: 'Zero-latency system execution',
      targetDate: '2026-10-31',
      totalEstimatedHours: 60,
      successMetrics: ['Complete all milestones on schedule'],
    },
    milestones: [
      {
        id: 'ms-exp-1',
        goalId: 'goal-export-1',
        order: 1,
        title: 'Architecture Audit',
        description: 'Audit baseline latency bottlenecks.',
        targetDate: '2026-09-15',
        owner: 'You',
        status: 'completed',
      },
      {
        id: 'ms-exp-2',
        goalId: 'goal-export-1',
        order: 2,
        title: 'Telemetry Mesh',
        description: 'Deploy real-time mesh instrumentation.',
        targetDate: '2026-09-30',
        owner: 'Marcus',
        status: 'in_progress',
      },
    ],
    microMoves: [
      {
        id: 'mm-exp-1',
        milestoneId: 'ms-exp-1',
        goalId: 'goal-export-1',
        title: 'Validate Export Engine',
        description: 'Run unit test suite against export outputs.',
        estimatedMinutes: 30,
        actualMinutes: 25,
        dateScheduled: '2026-09-02',
        status: 'completed',
        isPrivate: true,
        order: 1,
      },
    ],
  };

  it('generates a clean Markdown briefing with overview and milestones', () => {
    const md = exportEngine.generateMarkdownBriefing(mockGoal, false);

    expect(md).toContain('# 🎯 Tracer Roadmap: Scale Distributed System');
    expect(md).toContain('## 📋 Overview');
    expect(md).toContain('Zero-latency system execution');
    expect(md).toContain('## 🏁 Milestones');
    expect(md).toContain('Architecture Audit');
    expect(md).toContain('Telemetry Mesh');
    expect(md).toContain('## ⚡ Immediate Micro-Moves');
    expect(md).toContain('Validate Export Engine');
  });

  it('scrubs micro-moves when private mode is active', () => {
    const mdPrivate = exportEngine.generateMarkdownBriefing(mockGoal, true);
    expect(mdPrivate).not.toContain('## ⚡ Immediate Micro-Moves');
  });

  it('generates sanitized JSON export with whitelisted fields only', () => {
    const jsonStr = exportEngine.generateJsonExport(mockGoal);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe('tracer.v2');
    expect(parsed.title).toBe('Scale Distributed System');
    expect(parsed.milestones).toHaveLength(2);
    expect(parsed.milestones[0].title).toBe('Architecture Audit');
    expect(parsed.milestones[0].owner).toBe('You');
  });

  it('generates a well-formatted CSV spreadsheet with milestones', () => {
    const csv = exportEngine.generateCsvExport(mockGoal);
    expect(csv).toContain('Milestone,Target Date,Owner,Status');
    expect(csv).toContain('"Architecture Audit","2026-09-15","You","completed"');
    expect(csv).toContain('"Telemetry Mesh","2026-09-30","Marcus","in_progress"');
  });

  describe('Collaboration Flight Plan Import/Export', () => {
    it('successfully sanitizes, exports, and imports flight plans', () => {
      const exportedJson = collaborationEngine.exportFlightPlanJson(mockGoal);
      const imported = collaborationEngine.importFlightPlanJson(exportedJson);

      expect(imported).not.toBeNull();
      expect(imported?.title).toBe(mockGoal.title);
      expect(imported?.milestones).toHaveLength(2);
      expect(imported?.milestones[0].title).toBe('Architecture Audit');
    });

    it('rejects corrupt or invalid JSON gracefully', () => {
      expect(collaborationEngine.importFlightPlanJson('')).toBeNull();
      expect(collaborationEngine.importFlightPlanJson('{badJson')).toBeNull();
      expect(collaborationEngine.importFlightPlanJson('{"version": 1}')).toBeNull();
    });
  });
});
