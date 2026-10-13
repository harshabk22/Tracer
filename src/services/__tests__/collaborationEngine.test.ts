import { describe, it, expect } from 'vitest';
import { collaborationEngine } from '../collaborationEngine';
import { Goal, TeamMember } from '../../types/goal';

describe('CollaborationEngine & Zero-Knowledge A2A Negotiation', () => {
  const mockGoal: Goal = {
    id: 'goal-collaboration-1',
    title: 'Ship Flagship Tracer Android App',
    category: 'business',
    status: 'on_track',
    weeklyCapacityHours: 15,
    currentLevel: 'Intermediate',
    deadlineFlexibility: 'Moderate Elastic',
    active: true,
    velocityFactor: 1.0,
    createdAt: '2026-09-01T00:00:00Z',
    vision: {
      coreOutcome: 'Deploy to Android Play Store',
      targetDate: '2026-10-15',
    },
    milestones: [
      {
        id: 'ms-1',
        goalId: 'goal-collaboration-1',
        title: 'Design UI Wireframes and Theme Tokens',
        description: 'Complete mobile design mockups and design tokens',
        targetDate: '2026-09-10',
        order: 1,
        status: 'pending',
        owner: 'You',
        isScopePruned: false,
        bufferFloatDays: 2,
      },
      {
        id: 'ms-2',
        goalId: 'goal-collaboration-1',
        title: 'Build Backend Engine and Database Storage',
        description: 'Implement core database and business logic engine',
        targetDate: '2026-09-25',
        order: 2,
        status: 'pending',
        owner: 'You',
        isScopePruned: false,
        bufferFloatDays: 3,
      },
      {
        id: 'ms-3',
        goalId: 'goal-collaboration-1',
        title: 'QA Review and Device Benchmark Testing',
        description: 'End to end manual testing and benchmark profiling',
        targetDate: '2026-10-10',
        order: 3,
        status: 'pending',
        owner: 'You',
        isScopePruned: false,
        bufferFloatDays: 2,
      },
    ],
    microMoves: [
      {
        id: 'mm-secret-1',
        goalId: 'goal-collaboration-1',
        milestoneId: 'ms-1',
        title: 'Private task: Personal procrastination journal reflection',
        description: 'Private reflections',
        dateScheduled: '2026-09-02',
        estimatedMinutes: 15,
        status: 'todo',
        isPrivate: true,
        order: 1,
      },
    ],
  };

  const mockTeam: TeamMember[] = [
    { id: 'tm_lead', name: 'Lead Coordinator', role: 'Lead Architect', avatar: '👑', isCurrentUser: true },
    { id: 'tm_ux', name: 'Jordan Spec', role: 'Design & UX', avatar: '🎨', isCurrentUser: false },
    { id: 'tm_eng', name: 'Alex Core', role: 'Backend & Data', avatar: '⚙️', isCurrentUser: false },
    { id: 'tm_qa', name: 'Samira Review', role: 'QA & Review', avatar: '🔍', isCurrentUser: false },
  ];

  it('sanitizes goals to strictly public milestone contracts (Zero-Knowledge Privacy Firewall)', () => {
    const flightPlan = collaborationEngine.sanitizeGoalForShare(mockGoal);

    expect(flightPlan.title).toBe('Ship Flagship Tracer Android App');
    expect(flightPlan.milestones).toHaveLength(3);

    // Private microMoves and reflections must NOT leak
    expect((flightPlan as any).microMoves).toBeUndefined();
    expect((flightPlan as any).learningLogs).toBeUndefined();
    expect((flightPlan as any).blockers).toBeUndefined();

    // Milestones only contain public contract fields
    flightPlan.milestones.forEach((m) => {
      expect(m.id).toBeDefined();
      expect(m.title).toBeDefined();
      expect(m.targetDate).toBeDefined();
      expect(m.status).toBeDefined();
      expect(m.owner).toBeDefined();
      expect((m as any).bufferFloatDays).toBeUndefined();
    });
  });

  it('exports and imports flight plans cleanly via JSON', () => {
    const jsonStr = collaborationEngine.exportFlightPlanJson(mockGoal);
    const reimported = collaborationEngine.importFlightPlanJson(jsonStr);

    expect(reimported).not.toBeNull();
    expect(reimported?.title).toBe(mockGoal.title);
    expect(reimported?.milestones).toHaveLength(3);
    expect(reimported?.milestones[0].title).toBe(mockGoal.milestones[0].title);
  });

  it('rejects invalid or corrupted flight plan JSON gracefully', () => {
    expect(collaborationEngine.importFlightPlanJson('bad json')).toBeNull();
    expect(collaborationEngine.importFlightPlanJson('{}')).toBeNull();
    expect(collaborationEngine.importFlightPlanJson('{"title": 123}')).toBeNull();
    expect(collaborationEngine.importFlightPlanJson('{"title": "   ", "milestones": [{ "title": "m1" }] }')).toBeNull();
    expect(collaborationEngine.importFlightPlanJson('{"title": "Valid", "milestones": [] }')).toBeNull();
  });

  it('sanitizes and defends against adversarial payloads and category injection', () => {
    const adversarialPayload = JSON.stringify({
      title: '  Adversarial Payload  ',
      category: '__proto___malicious_category',
      milestones: [
        {
          id: 'ms-adversarial',
          title: 'Exploit Buffer Overflow',
          status: 'corrupted_status',
          owner: 'Hacker',
        },
      ],
    });

    const sanitized = collaborationEngine.importFlightPlanJson(adversarialPayload);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.title).toBe('Adversarial Payload');
    expect(sanitized?.category).toBe('personal'); // Safely whitelisted!
    expect(sanitized?.milestones[0].status).toBe('pending'); // Safely defaulted!
  });

  it('caps oversized milestones array to 50 items to prevent memory exhaustion', () => {
    const oversizedMilestones = Array.from({ length: 100 }, (_, i) => ({
      id: `ms-${i}`,
      title: `Milestone ${i}`,
    }));
    const payload = JSON.stringify({
      title: 'High Load Roadmap',
      milestones: oversizedMilestones,
    });

    const result = collaborationEngine.importFlightPlanJson(payload);
    expect(result).not.toBeNull();
    expect(result?.milestones).toHaveLength(50);
  });

  it('simulates autonomous A2A teammate negotiation with role-based allocation', () => {
    const result = collaborationEngine.simulateTeammateNegotiation(mockGoal, mockTeam);

    expect(result.dialogue.length).toBeGreaterThanOrEqual(4);
    expect(result.summary).toContain('Allocated 3 milestones across 4 teammates');

    // Verify role-based delegation
    const designTurn = result.dialogue.find((t) => t.suggestedReassignment?.milestoneTitle.includes('Design'));
    expect(designTurn?.senderName).toBe('Jordan Spec');

    const backendTurn = result.dialogue.find((t) => t.suggestedReassignment?.milestoneTitle.includes('Backend'));
    expect(backendTurn?.senderName).toBe('Alex Core');

    const qaTurn = result.dialogue.find((t) => t.suggestedReassignment?.milestoneTitle.includes('QA'));
    expect(qaTurn?.senderName).toBe('Samira Review');

    // Verify proposed milestones reflect the reassignments
    const ms1 = result.proposedMilestones.find((m) => m.id === 'ms-1');
    expect(ms1?.owner).toBe('Jordan Spec');

    const ms2 = result.proposedMilestones.find((m) => m.id === 'ms-2');
    expect(ms2?.owner).toBe('Alex Core');

    const ms3 = result.proposedMilestones.find((m) => m.id === 'ms-3');
    expect(ms3?.owner).toBe('Samira Review');
  });

  it('falls back to default crew if no teammates are configured', () => {
    const result = collaborationEngine.simulateTeammateNegotiation(mockGoal, []);
    expect(result.dialogue.length).toBeGreaterThan(0);
    expect(result.proposedMilestones.length).toBe(3);
  });

  it('generates distinct domain-specific fallback archetypes for each category', () => {
    const fitnessArchetypes = collaborationEngine.getFallbackArchetypes('fitness');
    expect(fitnessArchetypes.some((m) => m.role.includes('Coach') || m.role.includes('Athlete'))).toBe(true);

    const studyArchetypes = collaborationEngine.getFallbackArchetypes('study');
    expect(studyArchetypes.some((m) => m.role.includes('Advisor') || m.role.includes('Scholar'))).toBe(true);

    const businessArchetypes = collaborationEngine.getFallbackArchetypes('business');
    expect(businessArchetypes.some((m) => m.role.includes('Strategist') || m.role.includes('Founder'))).toBe(true);

    const creativeArchetypes = collaborationEngine.getFallbackArchetypes('creative');
    expect(creativeArchetypes.some((m) => m.name.includes('Director') || m.role.includes('Creative'))).toBe(true);

    const technicalArchetypes = collaborationEngine.getFallbackArchetypes('technical');
    expect(technicalArchetypes.some((m) => m.role.includes('Architect') || m.role.includes('Engineer'))).toBe(true);

    const defaultArchetypes = collaborationEngine.getFallbackArchetypes('unknown_category');
    expect(defaultArchetypes.some((m) => m.role.includes('Strategist') || m.role.includes('Lead'))).toBe(true);
  });

  it('prioritizes user-defined teammates over fallback archetypes in negotiation', () => {
    const customTeammates: TeamMember[] = [
      { id: 'custom-1', name: 'Custom Alice', role: 'Chief Strategist', avatar: '🚀', isCurrentUser: false },
      { id: 'custom-2', name: 'Custom Bob', role: 'Core Delivery', avatar: '⚡', isCurrentUser: false },
    ];

    const result = collaborationEngine.simulateTeammateNegotiation(mockGoal, customTeammates);
    const speakerNames = result.dialogue.map((d) => d.senderName);
    expect(speakerNames.includes('Custom Alice') || speakerNames.includes('Custom Bob')).toBe(true);
  });
});
