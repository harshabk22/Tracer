import { describe, it, expect, vi } from 'vitest';
import {
  decomposeGoal,
  getRecoverySuggestion,
  askSocraticClarification,
  getAgentAdvice,
  chatWithTracerAssistant,
  extractJsonSubstring,
  testAIConnection,
  testConnection,
  callOpenAICompatibleMultiTurn,
  conductSocraticIntake,
} from '../aiEngine';

describe('AI Decomposition & Blocker Engine', () => {
  it('decomposes a business goal into 3 tiers with critical path milestones and micro-moves', async () => {
    const goal = await decomposeGoal({
      title: 'Launch SaaS MVP in 30 Days',
      weeklyCapacityHours: 15,
      currentLevel: 'Intermediate',
      deadlineFlexibility: 'Hard Deadline',
    });

    expect(goal.category).toBe('business');
    expect(goal.vision.coreOutcome).toBeDefined();
    expect(goal.milestones.length).toBeGreaterThanOrEqual(3);
    expect(goal.microMoves.length).toBeGreaterThanOrEqual(3);

    // Micro moves must be <= 45 mins
    goal.microMoves.forEach(mm => {
      expect(mm.estimatedMinutes).toBeLessThanOrEqual(45);
    });

    // Milestone should have buffer float days
    goal.milestones.forEach(m => {
      expect(m.bufferFloatDays).toBeGreaterThan(0);
    });
  });

  it('decomposes a fitness goal into structured milestones', async () => {
    const goal = await decomposeGoal({
      title: 'Run a Half Marathon in 12 Weeks',
      weeklyCapacityHours: 8,
      currentLevel: 'Beginner',
      deadlineFlexibility: 'Moderate Elastic',
    });

    expect(goal.category).toBe('fitness');
    expect(goal.milestones.some(m => m.title.toLowerCase().includes('aerobic') || m.title.toLowerCase().includes('cadence'))).toBe(true);
  });

  it('decomposes a single-day (1-day / today) horizon goal with 0 buffer float and today-scheduled moves', async () => {
    const goal = await decomposeGoal({
      title: 'Draft Annual Strategy Deck',
      weeklyCapacityHours: 10,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Hard Deadline',
      targetDays: 1,
      dailyMinutes: 60,
    });

    expect(goal.milestones).toHaveLength(1);
    expect(goal.milestones[0].bufferFloatDays).toBe(0);
    expect(goal.totalFloatBufferDays).toBe(0);
    expect(goal.microMoves).toHaveLength(2);
    expect(goal.microMoves[0].dateScheduled).toBe(new Date().toISOString().split('T')[0]);
    expect(goal.microMoves[1].dateScheduled).toBe(new Date().toISOString().split('T')[0]);
    expect(goal.vision.coreOutcome).toContain('single-day');
    expect(goal.vision.totalEstimatedHours).toBe(1);
  });

  it('decomposes a 7-day (week) horizon goal into 2 milestones and sequential moves', async () => {
    const goal = await decomposeGoal({
      title: 'Ship Authentication Microservice',
      weeklyCapacityHours: 14,
      currentLevel: 'Intermediate',
      deadlineFlexibility: 'Moderate Elastic',
      targetDays: 7,
      dailyMinutes: 45,
    });

    expect(goal.milestones).toHaveLength(2);
    expect(goal.milestones[0].title).toContain('Mid-Sprint');
    expect(goal.milestones[1].title).toContain('Sprint Wrap');
    expect(goal.microMoves).toHaveLength(3);
    // Micro moves should be spaced across upcoming days
    const today = new Date().toISOString().split('T')[0];
    expect(goal.microMoves[0].dateScheduled).toBe(today);
  });

  it('decomposes an extended 180-day (6 months) horizon goal into 6 phased milestones', async () => {
    const goal = await decomposeGoal({
      title: 'Build Distributed Raft Consensus Engine',
      weeklyCapacityHours: 20,
      currentLevel: 'Advanced',
      deadlineFlexibility: 'Flexible',
      targetDays: 180,
      dailyMinutes: 90,
    });

    expect(goal.milestones).toHaveLength(6);
    expect(goal.milestones[0].title).toContain('Architecture & Technical Spec');
    expect(goal.milestones[5].title).toContain('Final Delivery');
    expect(goal.totalFloatBufferDays).toBeGreaterThanOrEqual(14);
    expect(goal.vision.totalEstimatedHours).toBe(Math.round((180 * 90) / 60));
  });

  it('adaptively scales estimated minutes inversely by userVelocityFactor', async () => {
    // Slower velocity: 0.75x -> scale should be ~1.33x (30 / 0.75 = 40)
    const slowGoal = await decomposeGoal({
      title: 'Deep Architecture Refactor',
      weeklyCapacityHours: 10,
      currentLevel: 'Intermediate',
      deadlineFlexibility: 'Moderate Elastic',
      targetDays: 7,
      dailyMinutes: 30,
      userVelocityFactor: 0.75,
    });

    expect(slowGoal.velocityFactor).toBe(0.75);
    slowGoal.microMoves.forEach((mm) => {
      expect(mm.estimatedMinutes).toBeGreaterThanOrEqual(35);
    });

    // Faster velocity: 1.5x -> scale should be ~0.67x (30 / 1.5 = 20)
    const fastGoal = await decomposeGoal({
      title: 'Deep Architecture Refactor',
      weeklyCapacityHours: 10,
      currentLevel: 'Intermediate',
      deadlineFlexibility: 'Moderate Elastic',
      targetDays: 7,
      dailyMinutes: 30,
      userVelocityFactor: 1.5,
    });

    expect(fastGoal.velocityFactor).toBe(1.5);
    fastGoal.microMoves.forEach((mm) => {
      expect(mm.estimatedMinutes).toBeLessThanOrEqual(25);
    });
  });

  it('generates specific recovery suggestions across the 4-blocker taxonomy', () => {
    const timeCrunch = getRecoverySuggestion('Time Crunch', 'Write documentation');
    expect(timeCrunch.actionLabel).toContain('15m Micro-Sprint');

    const skillGap = getRecoverySuggestion('Skill Gap', 'Setup Kubernetes cluster');
    expect(skillGap.actionLabel).toContain('Primer');

    const energyDepletion = getRecoverySuggestion('Energy Depletion', 'Run 5 miles');
    expect(energyDepletion.actionLabel).toContain('Micro-Nudge');

    const externalDep = getRecoverySuggestion('External Dependency', 'Wait for security review');
    expect(externalDep.actionLabel).toContain('Async Ping');
  });

  it('formulates 2 Socratic clarifying questions and suggested roadmap phases', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                questions: ['What is your target completion date?', 'How many hours weekly?'],
                preliminaryPhases: ['Phase 1: Setup', 'Phase 2: Build', 'Phase 3: Ship'],
              })
            }]
          }
        }]
      })
    } as any);

    const socratic = await askSocraticClarification('Learn Rust and build an async HTTP server', 'test-key');
    expect(socratic.questions.length).toBe(2);
    expect(socratic.preliminaryPhases.length).toBe(3);
    globalThis.fetch = origFetch;
  });

  it('provides on-demand agent coaching advice for active goals', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'Break down the task into a 15-minute micro-sprint.' }]
          }
        }]
      })
    } as any);

    const advice = await getAgentAdvice(
      'I only have 15 minutes today, what should I do?',
      { goalTitle: 'Learn Rust', currentMilestone: 'Syntax Foundations' },
      'test-key'
    );
    expect(advice).toContain('15-minute');
    globalThis.fetch = origFetch;
  });

  it('strips markdown code fences from Gemini JSON responses', async () => {
    const origFetch = globalThis.fetch;
    const rawWithFences = '```json\n{\n  "questions": ["Q1", "Q2"],\n  "preliminaryPhases": ["P1", "P2", "P3"]\n}\n```';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: rawWithFences }]
          }
        }]
      })
    } as any);

    const result = await askSocraticClarification('Build a custom compiler', 'valid-api-key-12345');
    expect(result.questions).toEqual(['Q1', 'Q2']);
    expect(result.preliminaryPhases).toEqual(['P1', 'P2', 'P3']);
    globalThis.fetch = origFetch;
  });

  describe('Tracer Assistant Conversational Engine & Executable Actions', () => {
    it('diagnoses overwhelm and generates an executable split_task action', async () => {
      const response = await chatWithTracerAssistant(
        'I feel completely stuck and overwhelmed by this work',
        {
          goalTitle: 'Build Autonomous Compiler',
          activeMilestoneTitle: 'Lexer & Parser',
          todayMoves: ['Implement recursive descent grammar parsing'],
          velocityFactor: 0.75, // Optimism bias detected
          recentBlockers: [{ taxonomy: 'Time Crunch', details: 'Meeting ran over' }],
        }
      );

      expect(response.reply).toContain('splitting');
      expect(response.suggestedAction).toBeDefined();
      expect(response.suggestedAction?.type).toBe('split_task');
      expect(response.suggestedAction?.payload?.splitParts).toHaveLength(2);
      expect(response.memoryInsight).toContain('optimism bias');
    });

    it('generates an executable rebalance_dates action when falling behind', async () => {
      const response = await chatWithTracerAssistant(
        'I am falling behind my deadline due to blockers',
        {
          goalTitle: 'Launch Mobile App',
          isOverdue: true,
          daysRemaining: -2,
        }
      );

      expect(response.reply).toContain('rebalancing');
      expect(response.suggestedAction).toBeDefined();
      expect(response.suggestedAction?.type).toBe('rebalance_dates');
      expect(response.suggestedAction?.payload?.daysOffset).toBe(3);
    });

    it('generates an executable reschedule_task action when deferring to tomorrow', async () => {
      const response = await chatWithTracerAssistant(
        'Need to push today tasks to tomorrow',
        {
          goalTitle: 'Fitness Regimen',
          todayMoves: ['Morning 5k Tempo Run'],
        }
      );

      expect(response.reply).toContain('deferral');
      expect(response.suggestedAction).toBeDefined();
      expect(response.suggestedAction?.type).toBe('reschedule_task');
      expect(response.suggestedAction?.payload?.newDate).toBeDefined();
    });

    it('synthesizes memory insights from recent evening reflections', async () => {
      const response = await chatWithTracerAssistant(
        'What should I prioritize right now?',
        {
          goalTitle: 'Deep Study',
          recentReflections: [
            { date: '2026-09-12', mood: 'friction', note: 'Exhausted by afternoon' },
            { date: '2026-09-11', mood: 'smooth' },
          ],
        }
      );

      expect(response.memoryInsight).toContain('Recent reflection logged resistance');
      expect(response.memoryInsight).toContain('friction');
    });

    it('executes live Gemini assistant call and parses structured suggestedAction when apiKey is provided', async () => {
      const origFetch = globalThis.fetch;
      const liveAssistantResponse = {
        reply: 'I recommend splitting your immediate task to regain executive momentum.',
        suggestedAction: {
          type: 'split_task',
          label: 'Split into 15m Sprints',
          description: 'Atomic chunking',
          payload: { splitParts: [{ title: 'Part 1', minutes: 15 }, { title: 'Part 2', minutes: 15 }] },
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: JSON.stringify(liveAssistantResponse) }] }
          }]
        })
      } as any);

      const response = await chatWithTracerAssistant(
        'Stuck on current deliverable',
        {
          goalTitle: 'Live AI Goal',
          learningRemarks: ['"Previous Task": ran out of time'],
          velocityFactor: 0.8,
        },
        'valid-live-api-key-test'
      );

      expect(response.reply).toContain('splitting');
      expect(response.suggestedAction?.type).toBe('split_task');
      expect(response.suggestedAction?.payload?.splitParts).toHaveLength(2);
      globalThis.fetch = origFetch;
    });

    it('performs live Gemini goal decomposition tagging output with gemini_live', async () => {
      const origFetch = globalThis.fetch;
      const mockLiveGoal = {
        vision: { coreOutcome: 'Deliver live product', targetDays: 7, totalEstimatedHours: 10, successMetrics: ['Metric 1'] },
        milestones: [
          { title: 'Phase 1: Setup', description: 'Setup environment', daysFromNow: 3, owner: 'You' },
          { title: 'Phase 2: Launch', description: 'Launch to public', daysFromNow: 7, owner: 'You' },
        ],
        microMoves: [
          { title: 'Initialize project skeleton', description: 'Setup repo', estimatedMinutes: 30 },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: JSON.stringify(mockLiveGoal) }] }
          }]
        })
      } as any);

      const goal = await decomposeGoal({
        title: 'Launch Live Agentic Product',
        weeklyCapacityHours: 15,
        currentLevel: 'Advanced',
        deadlineFlexibility: 'Hard Deadline',
        apiKey: 'test-api-key-12345',
        targetDays: 7,
        dailyMinutes: 45,
        userVelocityFactor: 0.75,
      });

      expect(goal.generationSource).toBe('gemini_live');
      expect(goal.milestones).toHaveLength(2);
      expect(goal.microMoves).toHaveLength(1);
      // Scaled inversely by velocity factor (0.75 -> 30 / 0.75 = 40)
      expect(goal.microMoves[0].estimatedMinutes).toBe(40);
      globalThis.fetch = origFetch;
    });

    it('extracts JSON cleanly even when Gemini includes preamble commentary or markdown fences', () => {
      const conversationalOutput = `Here is your requested roadmap JSON:\n\`\`\`json\n{\n  "reply": "Stay focused on core execution."\n}\n\`\`\`\nLet me know if you need any adjustments!`;
      const extracted = extractJsonSubstring(conversationalOutput);
      expect(extracted).toBe('{\n  "reply": "Stay focused on core execution."\n}');
      expect(JSON.parse(extracted).reply).toBe('Stay focused on core execution.');
    });

    it('handles plain JSON and empty text safely in extractJsonSubstring', () => {
      expect(extractJsonSubstring('')).toBe('');
      expect(extractJsonSubstring('{"ok": true}')).toBe('{"ok": true}');
    });

    it('generates an executable add_task action from natural language', async () => {
      const response = await chatWithTracerAssistant('add task: Write integration documentation', {
        goalTitle: 'Launch Mobile Product',
        todayMoves: ['Review PRs'],
      });

      expect(response.suggestedAction?.type).toBe('add_task');
      expect(response.suggestedAction?.payload?.title).toBe('Write integration documentation');
    });

    it('generates an executable complete_task action when requested', async () => {
      const response = await chatWithTracerAssistant('I am done with this task', {
        goalTitle: 'Launch Mobile Product',
        todayMoves: ['Write documentation'],
      });

      expect(response.suggestedAction?.type).toBe('complete_task');
      expect(response.suggestedAction?.label).toContain('Complete');
    });

    it('generates an executable prune_task action for scope reduction', async () => {
      const response = await chatWithTracerAssistant('prune this non-critical item', {
        goalTitle: 'Launch Mobile Product',
        todayMoves: ['Minor cosmetic fix'],
      });

      expect(response.suggestedAction?.type).toBe('prune_task');
      expect(response.suggestedAction?.label).toContain('Prune');
    });

    it('generates an executable prioritize_task action to bump task to position 1', async () => {
      const response = await chatWithTracerAssistant('prioritize this task first today', {
        goalTitle: 'Launch Mobile Product',
        todayMoves: ['Core Database Fix'],
      });

      expect(response.suggestedAction?.type).toBe('prioritize_task');
      expect(response.suggestedAction?.label).toContain('Prioritize');
    });
  });

  describe('Multi-Provider AI Connection Testing', () => {
    it('returns error when API key is empty', async () => {
      const res = await testConnection('gemini', '');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();

      const dsRes = await testConnection('deepseek', '   ');
      expect(dsRes.success).toBe(false);
      expect(dsRes.error).toBeDefined();
    });

    it('reports failure gracefully when fetch rejects or times out', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network unreachable'));
      const res = await testConnection('deepseek', 'sk-test-key');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Network unreachable');
      fetchSpy.mockRestore();
    });

    it('reports success and calculates latency on 200 OK for DeepSeek', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Pong' } }] }),
      } as any);

      const res = await testConnection('deepseek', 'sk-valid-key');
      expect(res.success).toBe(true);
      expect(typeof res.latencyMs).toBe('number');
      expect(res.error).toBeUndefined();
      fetchSpy.mockRestore();
    });

    it('reports success and calculates latency on 200 OK for Gemini', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'Pong' }] } }] }),
      } as any);

      const res = await testConnection('gemini', 'valid-gemini-key');
      expect(res.success).toBe(true);
      expect(typeof res.latencyMs).toBe('number');
      expect(res.error).toBeUndefined();
      fetchSpy.mockRestore();
    });

    it('handles offline state in testConnection with immediate zero-latency feedback', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const res = await testConnection('gemini', 'any-key');
      expect(res.success).toBe(false);
      expect(res.error).toContain('offline');

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    it('switches to Local Offline Mode in chatWithTracerAssistant when navigator is offline', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const res = await chatWithTracerAssistant('I need help prioritizing my tasks', {
        goalTitle: 'Launch Production App',
        todayMoves: ['Fix database query', 'Setup push notifications'],
      }, 'fake-key-that-wont-be-called');

      expect(res.memoryInsight).toContain('Local Offline Mode');
      expect(res.reply).toBeDefined();

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    it('reports success and latency on 200 OK for OpenAI provider', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Pong' } }] }),
      } as any);

      const res = await testConnection('openai', 'sk-openai-key-test');
      expect(res.success).toBe(true);
      expect(typeof res.latencyMs).toBe('number');
      expect(res.error).toBeUndefined();
      fetchSpy.mockRestore();
    });

    it('reports success for custom/Ollama endpoint with configurable base URL and model', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Pong' } }] }),
      } as any);

      const res = await testConnection('custom', '', 'http://127.0.0.1:11434/v1', 'mistral');
      expect(res.success).toBe(true);
      expect(typeof res.latencyMs).toBe('number');
      fetchSpy.mockRestore();
    });

    it('reports success and latency on 200 OK for Anthropic Claude provider', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
        expect(url).toBe('https://api.anthropic.com/v1/messages');
        expect((init as any)?.headers?.['x-api-key']).toBe('sk-ant-test-key');
        expect((init as any)?.headers?.['anthropic-version']).toBe('2023-06-01');
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: [{ text: 'Pong' }] }),
        } as any;
      });

      const res = await testConnection('anthropic', 'sk-ant-test-key');
      expect(res.success).toBe(true);
      expect(typeof res.latencyMs).toBe('number');
      expect(res.message).toContain('Anthropic');
      fetchSpy.mockRestore();
    });
  });

  describe('Universal OpenAI-Compatible Multi-Turn & Socratic Intake', () => {
    it('calls OpenAI-compatible endpoint, formats messages, and scrubs reasoning tokens', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
        expect(url).toBe('https://api.openai.com/v1/chat/completions');
        const parsed = JSON.parse((init as any).body);
        expect(parsed.model).toBe('gpt-4o');
        expect(parsed.messages).toHaveLength(2);
        expect(parsed.messages[0].role).toBe('system');
        expect(parsed.messages[1].role).toBe('user');

        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '<think>Analyzing deep dependencies...</think>Here is the roadmap answer.',
                },
              },
            ],
          }),
        } as any;
      });

      const response = await callOpenAICompatibleMultiTurn(
        'sk-openai-test-key',
        [{ role: 'user', parts: [{ text: 'How to scale architecture?' }] }],
        {
          systemInstruction: 'You are an architect.',
          model: 'gpt-4o',
          baseUrl: 'https://api.openai.com/v1',
        }
      );

      expect(response).toBe('Here is the roadmap answer.');
      expect(response).not.toContain('<think>');
      fetchSpy.mockRestore();
    });

    it('conducts Socratic intake and returns structured clarifying questions for underspecified goals', async () => {
      const origFetch = globalThis.fetch;
      const socraticResponse = {
        status: 'clarifying',
        message: 'Let us define your scope before structuring milestones.',
        questions: [
          {
            id: 'q1',
            question: 'What is your weekly time budget?',
            options: ['5 hrs/week', '10 hrs/week', '20+ hrs/week'],
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(socraticResponse) }],
              },
            },
          ],
        }),
      } as any);

      const result = await conductSocraticIntake({
        intent: 'Build a robot',
        apiKey: 'test-gemini-key-12345',
        history: [],
      });

      expect(result.status).toBe('clarifying');
      expect(result.questions).toBeDefined();
      expect(result.questions?.length).toBe(1);
      expect(result.questions?.[0].options).toHaveLength(3);
      globalThis.fetch = origFetch;
    });

    it('synthesizes goal directly when directSynthesis is enabled', async () => {
      const result = await conductSocraticIntake({
        intent: 'Prepare for Marathon in 16 weeks daily 45 min',
        directSynthesis: true,
      });

      expect(result.status).toBe('ready');
      expect(result.goal).toBeDefined();
      expect(result.goal?.title).toContain('Marathon');
      expect(result.goal?.milestones.length).toBeGreaterThan(0);
    });
  });
});

