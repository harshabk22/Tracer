/**
 * Lean AI Engine for Tracer.
 * Provides 3-beat fast goal decomposition, 4-blocker recovery strategies,
 * and optional live Gemini intelligence without CPM or Roman numerals.
 */
import {
  Goal,
  GoalCategory,
  CurrentLevel,
  DeadlineFlexibility,
  SprintMilestone,
  MicroMove,
  BlockerTaxonomy,
  AssistantContext,
  AssistantResponse,
  AssistantExecutableAction,
  AssistantChatMessage,
  SocraticIntakeResponse,
  AIProvider,
} from '../types/goal';

export interface DecomposeParams {
  title: string;
  category?: GoalCategory;
  weeklyCapacityHours: number;
  currentLevel: CurrentLevel;
  deadlineFlexibility: DeadlineFlexibility;
  apiKey?: string;
  aiProvider?: AIProvider;
  provider?: AIProvider;
  deepSeekApiKey?: string;
  openAIApiKey?: string;
  anthropicApiKey?: string;
  customApiKey?: string;
  modelName?: string;
  customBaseUrl?: string;
  targetDays?: number; // 1 (Today), 7 (Week), 30 (Month), 90 (Quarter), 180 (6 Months)
  dailyMinutes?: number; // Daily commitment in minutes (e.g. 15, 30, 60, 120)
  userVelocityFactor?: number; // Personal learning model velocity factor (e.g. 0.75 or 1.2)
}

export function cleanTitle(raw: string): string {
  return raw.replace(/^(?:M\d+[:.-]?|\b(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\b[:.-]?|Phase \d+[:.-]?)\s*/i, '').trim();
}

export function detectCategory(title: string): GoalCategory {
  const lower = title.toLowerCase();
  if (lower.includes('run') || lower.includes('marathon') || lower.includes('workout') || lower.includes('gym') || lower.includes('weight') || lower.includes('fitness') || lower.includes('diet') || lower.includes('train')) {
    return 'fitness';
  }
  if (lower.includes('saas') || lower.includes('mvp') || lower.includes('startup') || lower.includes('launch') || lower.includes('revenue') || lower.includes('sales') || lower.includes('business')) {
    return 'business';
  }
  if (lower.includes('study') || lower.includes('learn') || lower.includes('exam') || lower.includes('course') || lower.includes('read') || lower.includes('language')) {
    return 'study';
  }
  if (
    lower.includes('code') ||
    lower.includes('app') ||
    lower.includes('api') ||
    lower.includes('software') ||
    lower.includes('backend') ||
    lower.includes('python') ||
    lower.includes('react') ||
    lower.includes('rust') ||
    lower.includes('raft') ||
    lower.includes('engine') ||
    lower.includes('distributed') ||
    lower.includes('system') ||
    lower.includes('database') ||
    lower.includes('kubernetes')
  ) {
    return 'technical';
  }
  return 'personal';
}

export async function decomposeGoal(params: DecomposeParams): Promise<Goal> {
  const hasKey = Boolean(
    (params.apiKey && params.apiKey.trim().length > 10) ||
    (params.deepSeekApiKey && params.deepSeekApiKey.trim().length > 5) ||
    (params.openAIApiKey && params.openAIApiKey.trim().length > 5) ||
    (params.anthropicApiKey && params.anthropicApiKey.trim().length > 5) ||
    (params.customApiKey && params.customApiKey.trim().length > 2) ||
    (params.customBaseUrl && params.customBaseUrl.trim().length > 5)
  );

  if (hasKey) {
    try {
      const liveResult = await callLiveDecompositionAPI(params);
      if (liveResult) return liveResult;
    } catch (err) {
      console.warn('[AIEngine] Live AI decomposition failed, falling back to local decomposition:', err);
    }
  }

  return generateHeuristicDecomposition(params);
}

export function generateHeuristicDecomposition(params: DecomposeParams): Goal {
  const {
    title,
    weeklyCapacityHours,
    currentLevel,
    deadlineFlexibility,
    targetDays,
    dailyMinutes: paramDailyMinutes,
    userVelocityFactor,
  } = params;
  const category = params.category || detectCategory(title);

  const levelFactor = currentLevel === 'Beginner' ? 1.3 : currentLevel === 'Intermediate' ? 1.0 : 0.8;
  const velocityMultiplier = userVelocityFactor && userVelocityFactor > 0 ? 1 / userVelocityFactor : 1.0;
  const rawDailyMinutes = paramDailyMinutes ?? Math.max(15, Math.round((Math.max(1, weeklyCapacityHours) * 60) / 7));
  const dailyMinutes = Math.max(10, Math.round(rawDailyMinutes * velocityMultiplier));

  let totalDays: number;
  let totalWeeks: number;
  let totalEstimatedHours: number;

  if (targetDays !== undefined && targetDays > 0) {
    totalDays = targetDays;
    totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    totalEstimatedHours = Math.max(1, Math.round((totalDays * dailyMinutes) / 60));
  } else {
    let baseHours = 40;
    if (category === 'fitness') baseHours = 36;
    if (category === 'business') baseHours = 60;
    if (category === 'study') baseHours = 45;
    if (category === 'technical') baseHours = 50;

    totalEstimatedHours = Math.round(baseHours * levelFactor * velocityMultiplier);
    totalWeeks = Math.max(2, Math.ceil(totalEstimatedHours / Math.max(2, weeklyCapacityHours)));
    totalDays = totalWeeks * 7;
  }

  const today = new Date();
  const targetDateObj = new Date();
  targetDateObj.setDate(today.getDate() + totalDays);
  const targetDateStr = targetDateObj.toISOString().split('T')[0];

  const goalId = 'goal-' + Date.now().toString(36);

  const milestones = buildMilestones(goalId, title, category, totalDays);
  const microMoves = buildMicroMoves(
    goalId,
    milestones[0]?.id || `${goalId}-ms-1`,
    title,
    category,
    totalDays,
    dailyMinutes,
    velocityMultiplier
  );

  let totalFloatBufferDays = 6;
  if (totalDays === 1) {
    totalFloatBufferDays = 0;
  } else if (totalDays <= 7) {
    totalFloatBufferDays = 1;
  } else if (totalDays <= 30) {
    totalFloatBufferDays = 3;
  } else {
    totalFloatBufferDays = Math.max(4, Math.round(totalDays * 0.08));
  }

  let horizonLabel = `${totalWeeks}-week`;
  if (totalDays === 1) horizonLabel = 'single-day';
  else if (totalDays < 7) horizonLabel = `${totalDays}-day`;

  return {
    id: goalId,
    title: cleanTitle(title),
    category,
    weeklyCapacityHours,
    currentLevel,
    deadlineFlexibility,
    createdAt: today.toISOString().split('T')[0],
    active: true,
    velocityFactor: userVelocityFactor || 1.0,
    totalFloatBufferDays,
    consumedFloatDays: 0,
    status: 'on_track',
    generationSource: 'heuristic',
    vision: {
      coreOutcome: `Complete ${cleanTitle(title)} within a focused ${horizonLabel} timeline.`,
      targetDate: targetDateStr,
      totalEstimatedHours,
      successMetrics: [
        'Complete all roadmap milestones on schedule',
        'Consistently hit daily micro-moves',
      ],
    },
    milestones,
    microMoves,
  };
}

function buildMilestones(
  goalId: string,
  title: string,
  category: GoalCategory,
  totalDays: number
): SprintMilestone[] {
  const today = new Date();

  // 1-Day Horizon: Single focused objective milestone
  if (totalDays === 1) {
    return [
      {
        id: `${goalId}-ms-1`,
        goalId,
        order: 1,
        title: `Single-Day Execution: ${cleanTitle(title)}`,
        description: 'Focus single-day execution to achieve core deliverable.',
        targetDate: today.toISOString().split('T')[0],
        owner: 'You',
        floatConsumed: 0,
        isCriticalPath: true,
        status: 'in_progress',
        bufferFloatDays: 0,
      },
    ];
  }

  // 7-Day Horizon: Mid-week checkpoint and final delivery
  if (totalDays <= 7) {
    const midDay = new Date(today);
    midDay.setDate(today.getDate() + Math.max(1, Math.floor(totalDays / 2)));
    const endDay = new Date(today);
    endDay.setDate(today.getDate() + totalDays);

    return [
      {
        id: `${goalId}-ms-1`,
        goalId,
        order: 1,
        title: 'Mid-Sprint Checkpoint & Foundation',
        description: 'Establish initial progress, validate assumptions, and remove early blockers.',
        targetDate: midDay.toISOString().split('T')[0],
        owner: 'You',
        floatConsumed: 0,
        isCriticalPath: true,
        status: 'in_progress',
        bufferFloatDays: 1,
      },
      {
        id: `${goalId}-ms-2`,
        goalId,
        order: 2,
        title: 'Sprint Wrap & Delivery Review',
        description: 'Finalize output, stress test deliverables, and consolidate achievements.',
        targetDate: endDay.toISOString().split('T')[0],
        owner: 'You',
        floatConsumed: 0,
        isCriticalPath: true,
        status: 'pending',
        bufferFloatDays: 1,
      },
    ];
  }

  let specs: { title: string; desc: string; owner: string }[] = [];

  const cleaned = cleanTitle(title);
  // Extended Horizon (>= 120 Days / Multi-Month)
  if (totalDays >= 120) {
    specs = [
      { title: `${cleaned}: Architecture & Technical Spec`, desc: 'Audit current state, establish baseline metrics, and set up tooling.', owner: 'You' },
      { title: `${cleaned}: Core Implementation`, desc: 'Build initial high-leverage primitives and validate core loop.', owner: 'You' },
      { title: `${cleaned}: Subsystem Expansion`, desc: 'Extend functional coverage and integrate secondary capabilities.', owner: 'You' },
      { title: `${cleaned}: Hardening & Stress Testing`, desc: 'Benchmark endurance, eliminate regressions, and optimize bottlenecks.', owner: 'You' },
      { title: `${cleaned}: Pre-Flight Integration`, desc: 'Run end-to-end simulations and peer review in authentic environment.', owner: 'Team' },
      { title: `${cleaned}: Final Delivery & Review`, desc: 'Execute primary launch, document learnings, and institutionalize gains.', owner: 'You' },
    ];
  } else if (category === 'fitness') {
    specs = [
      { title: `${cleaned}: Aerobic Base & Form`, desc: 'Build steady aerobic capacity and establish baseline pace.', owner: 'You' },
      { title: `${cleaned}: Intervals & Threshold Work`, desc: 'Introduce threshold intervals and stride drills.', owner: 'You' },
      { title: `${cleaned}: Peak Volume & Recovery`, desc: 'Simulate target distance, hydration and recovery.', owner: 'You' },
      { title: `${cleaned}: Tapering & Target Event`, desc: 'Downscale volume, optimize nutrition and rest.', owner: 'You' },
    ];
  } else if (category === 'business') {
    specs = [
      { title: `${cleaned}: Validation & Spec`, desc: 'Customer interviews and high-fidelity prototype locked.', owner: 'You' },
      { title: `${cleaned}: Core Product Pipeline`, desc: 'Build core workflow, checkout and onboarding funnel.', owner: 'You' },
      { title: `${cleaned}: Beta Cohort Launch`, desc: 'Invite initial users, track activation and retention.', owner: 'Team' },
      { title: `${cleaned}: Distribution & Scale`, desc: 'Public launch and continuous distribution loop.', owner: 'You' },
    ];
  } else if (category === 'study' || category === 'technical') {
    specs = [
      { title: `${cleaned}: Primitives & Setup`, desc: 'Deep dive into fundamental theory and architecture.', owner: 'You' },
      { title: `${cleaned}: Core Implementation`, desc: 'Build hands-on prototypes and test edge cases.', owner: 'You' },
      { title: `${cleaned}: Benchmarking & Testing`, desc: 'Audit performance and failure recovery.', owner: 'You' },
      { title: `${cleaned}: Capstone Delivery`, desc: 'Deliver production release or capstone project.', owner: 'You' },
    ];
  } else {
    specs = [
      { title: `${cleaned}: Core Setup & Routine`, desc: 'Establish daily triggers and early consistency.', owner: 'You' },
      { title: `${cleaned}: Deliberate Practice`, desc: 'Engage in deliberate repetitions and real application.', owner: 'You' },
      { title: `${cleaned}: Integration Checkpoint`, desc: 'Test under authentic conditions with feedback.', owner: 'You' },
      { title: `${cleaned}: Mastery & Autonomous Flow`, desc: 'Solidify automaticity and setup long-term routine.', owner: 'You' },
    ];
  }

  const daysPerMs = Math.max(7, Math.floor(totalDays / specs.length));

  return specs.map((spec, i) => {
    const md = new Date(today);
    if (i === specs.length - 1) {
      md.setDate(today.getDate() + totalDays);
    } else {
      md.setDate(today.getDate() + (i + 1) * daysPerMs);
    }
    return {
      id: `${goalId}-ms-${i + 1}`,
      goalId,
      order: i + 1,
      title: spec.title,
      description: spec.desc,
      targetDate: md.toISOString().split('T')[0],
      owner: spec.owner,
      floatConsumed: 0,
      isCriticalPath: i === 0,
      status: i === 0 ? 'in_progress' : 'pending',
      bufferFloatDays: 2,
    };
  });
}

function buildMicroMoves(
  goalId: string,
  milestoneId: string,
  goalTitle: string,
  category: GoalCategory,
  totalDays: number,
  dailyMinutes: number,
  velocityMultiplier: number = 1.0
): MicroMove[] {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1-Day Horizon: 2 focused micro-moves scheduled for today
  if (totalDays === 1) {
    const part1 = Math.min(60, Math.max(10, Math.round(dailyMinutes * 0.6)));
    const part2 = Math.min(60, Math.max(10, dailyMinutes - part1 || 15));
    return [
      {
        id: `${goalId}-mm-1`,
        milestoneId,
        goalId,
        title: `Primary Focus Sprint: ${cleanTitle(goalTitle)}`,
        description: 'Execute deep work session on highest priority deliverable.',
        estimatedMinutes: part1,
        dateScheduled: todayStr,
        status: 'todo',
        isCriticalPath: true,
        isPrivate: false,
        order: 1,
      },
      {
        id: `${goalId}-mm-2`,
        milestoneId,
        goalId,
        title: 'Review, Polish & Validate Deliverable',
        description: 'Inspect output, verify against success criteria, and close out.',
        estimatedMinutes: part2,
        dateScheduled: todayStr,
        status: 'todo',
        isCriticalPath: true,
        isPrivate: false,
        order: 2,
      },
    ];
  }

  // 7-Day Horizon: 3 micro-moves spread sequentially across upcoming days
  if (totalDays <= 7) {
    const moveMinutes = Math.min(60, Math.max(10, dailyMinutes));
    const dayMoves = [
      { title: `Core Kickoff: ${cleanTitle(goalTitle)}`, desc: 'Outline structure and execute first high-impact action.', dayOffset: 0 },
      { title: 'Deliberate Iteration & Expansion', desc: 'Advance primary deliverable through focused execution block.', dayOffset: 1 },
      { title: 'Synthesis & Review Checkpoint', desc: 'Evaluate progress against milestones and polish work.', dayOffset: 2 },
    ];
    return dayMoves.map((m, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + m.dayOffset);
      return {
        id: `${goalId}-mm-${i + 1}`,
        milestoneId,
        goalId,
        title: m.title,
        description: m.desc,
        estimatedMinutes: moveMinutes,
        dateScheduled: d.toISOString().split('T')[0],
        status: 'todo',
        isCriticalPath: i === 0,
        isPrivate: false,
        order: i + 1,
      };
    });
  }

  let titles: { title: string; desc: string; minutes: number }[] = [];

  if (category === 'fitness') {
    titles = [
      { title: 'Baseline 20-minute easy aerobic session', desc: 'Keep heart rate in zone 2 without stopping.', minutes: 20 },
      { title: 'Log cadence metrics and dynamic stretch sequence', desc: 'Record resting HR, stride pace, and hip mobility.', minutes: 15 },
      { title: 'Core stabilization and recovery walk', desc: 'Plank variations and light mobility walk.', minutes: 15 },
    ];
  } else if (category === 'business') {
    titles = [
      { title: 'Define value proposition and ICP draft', desc: 'Write 1-page summary of core customer and pitch.', minutes: 25 },
      { title: 'Setup landing page wireframe or distribution channel', desc: 'Prepare outreach or waitlist collection.', minutes: 30 },
      { title: 'Conduct initial customer discovery interview', desc: 'Validate top assumptions directly with target users.', minutes: 30 },
    ];
  } else if (category === 'study' || category === 'technical') {
    titles = [
      { title: 'Read core documentation and architecture setup', desc: 'Review API contracts and setup local environment.', minutes: 25 },
      { title: 'Write minimal viable prototype test case', desc: 'Implement first functional integration test.', minutes: 30 },
      { title: 'Refactor prototype and document key insights', desc: 'Clean code and record architectural notes.', minutes: 20 },
    ];
  } else {
    titles = [
      { title: 'Clarify day-1 trigger and micro-routine', desc: 'Design the immediate physical cue to start.', minutes: 15 },
      { title: 'Execute first 20-minute deliberate practice session', desc: 'Focus strictly on highest leverage sub-skill.', minutes: 20 },
      { title: 'Log friction and calibrate next move', desc: 'Capture what felt difficult and adjust tomorrow.', minutes: 15 },
    ];
  }

  return titles.map((t, i) => ({
    id: `${goalId}-mm-${i + 1}`,
    milestoneId,
    goalId,
    title: t.title,
    description: t.desc,
    estimatedMinutes: Math.min(60, Math.max(10, Math.round(t.minutes * velocityMultiplier))),
    dateScheduled: todayStr,
    status: 'todo',
    isCriticalPath: i === 0,
    isPrivate: false,
    order: i + 1,
  }));
}

export function getRecoverySuggestion(
  taxonomy: BlockerTaxonomy,
  taskTitle: string
): { suggestion: string; actionLabel: string } {
  switch (taxonomy) {
    case 'Time Crunch':
      return {
        suggestion: `Split "${taskTitle}" into a 15-minute micro-sprint right now.`,
        actionLabel: '15m Micro-Sprint',
      };
    case 'Skill Gap':
      return {
        suggestion: `Break down "${taskTitle}" into a 3-step starter draft to get unstuck.`,
        actionLabel: 'Starter Primer Draft',
      };
    case 'Energy Depletion':
      return {
        suggestion: `Downscale "${taskTitle}" to a 5-minute low-energy micro-move.`,
        actionLabel: '5m Micro-Nudge',
      };
    case 'External Dependency':
      return {
        suggestion: `Send an async update ping for "${taskTitle}" and advance parallel move.`,
        actionLabel: 'Async Ping & Pivot',
      };
  }
}

export function extractJsonSubstring(text: string): string {
  if (!text) return '';
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : cleaned;
}

const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];

export async function callGeminiMultiTurn(
  apiKey: string,
  contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  systemInstruction?: string,
  jsonMode = false
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const body: any = {
        contents,
      };
      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }
      if (jsonMode) {
        body.generationConfig = { responseMimeType: 'application/json' };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return jsonMode ? extractJsonSubstring(text) : text;
        }
      }

      // If rate limited or server error, apply exponential backoff before trying next model
      if ((response.status === 429 || response.status >= 500) && i < GEMINI_MODELS.length - 1) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, i)));
      }
    } catch {
      if (i < GEMINI_MODELS.length - 1) {
        await new Promise((r) => setTimeout(r, 150 * (i + 1)));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return null;
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  jsonMode = false,
  systemInstruction?: string
): Promise<string | null> {
  return callGeminiMultiTurn(
    apiKey,
    [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction,
    jsonMode
  );
}

export interface OpenAICompatibleOptions {
  baseUrl?: string;
  model?: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export async function callOpenAICompatibleMultiTurn(
  apiKey: string,
  contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  options?: OpenAICompatibleOptions
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  const rawBaseUrl = (options?.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const endpoint = rawBaseUrl.endsWith('/chat/completions') ? rawBaseUrl : `${rawBaseUrl}/chat/completions`;
  const model = options?.model?.trim() || 'gpt-4o';
  const timeoutMs = options?.timeoutMs || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    for (const item of contents) {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.parts[0]?.text || '',
      });
    }

    const body: any = {
      model,
      messages,
      temperature: 0.7,
    };
    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      let text = data?.choices?.[0]?.message?.content;
      if (text) {
        // Strip out reasoning tokens like DeepSeek-R1 <think>...</think> if present
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return options?.jsonMode ? extractJsonSubstring(text) : text;
      }
    }
  } catch (err) {
    console.warn('[callOpenAICompatibleMultiTurn] API call error:', err);
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

export async function callAnthropicMultiTurn(
  apiKey: string,
  contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  baseUrl?: string,
  modelName?: string,
  systemInstruction?: string,
  jsonMode = false
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const item of contents) {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.parts[0]?.text || '',
      });
    }

    const rawBaseUrl = (baseUrl?.trim() || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    const endpoint = rawBaseUrl.endsWith('/messages') ? rawBaseUrl : `${rawBaseUrl}/messages`;
    const model = modelName?.trim() || 'claude-3-7-sonnet-20250219';

    const body: any = {
      model,
      max_tokens: 4096,
      messages,
    };
    if (systemInstruction) {
      body.system = systemInstruction;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.content?.[0]?.text;
      if (text) {
        return jsonMode ? extractJsonSubstring(text) : text;
      }
    }
  } catch (err) {
    console.warn('[callAnthropicMultiTurn] API call error:', err);
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

export async function callDeepSeekMultiTurn(
  apiKey: string,
  contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  systemInstruction?: string,
  jsonMode = false
): Promise<string | null> {
  return callOpenAICompatibleMultiTurn(apiKey, contents, {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    systemInstruction,
    jsonMode,
  });
}

export interface UnifiedAICallOptions {
  provider?: AIProvider;
  geminiApiKey?: string;
  deepSeekApiKey?: string;
  openAIApiKey?: string;
  anthropicApiKey?: string;
  customApiKey?: string;
  customBaseUrl?: string;
  modelName?: string;
  systemInstruction?: string;
  jsonMode?: boolean;
}

export async function callAIMultiTurn(
  contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  options: UnifiedAICallOptions
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }
  const {
    provider = 'gemini',
    geminiApiKey,
    deepSeekApiKey,
    openAIApiKey,
    anthropicApiKey,
    customApiKey,
    customBaseUrl,
    modelName,
    systemInstruction,
    jsonMode = false,
  } = options;

  if (provider === 'deepseek' && deepSeekApiKey && deepSeekApiKey.trim().length > 5) {
    const res = await callDeepSeekMultiTurn(deepSeekApiKey.trim(), contents, systemInstruction, jsonMode);
    if (res) return res;
  }

  if (provider === 'openai' && openAIApiKey && openAIApiKey.trim().length > 5) {
    const res = await callOpenAICompatibleMultiTurn(openAIApiKey.trim(), contents, {
      baseUrl: customBaseUrl || 'https://api.openai.com/v1',
      model: modelName || 'gpt-4o',
      systemInstruction,
      jsonMode,
    });
    if (res) return res;
  }

  if (provider === 'anthropic' && anthropicApiKey && anthropicApiKey.trim().length > 5) {
    const res = await callAnthropicMultiTurn(anthropicApiKey.trim(), contents, customBaseUrl, modelName, systemInstruction, jsonMode);
    if (res) return res;
  }

  if (provider === 'custom') {
    const key = customApiKey?.trim() || openAIApiKey?.trim() || 'local';
    const res = await callOpenAICompatibleMultiTurn(key, contents, {
      baseUrl: customBaseUrl || 'http://localhost:11434/v1',
      model: modelName || 'llama3.3',
      systemInstruction,
      jsonMode,
    });
    if (res) return res;
  }

  // Fallback or primary Gemini call
  if (geminiApiKey && geminiApiKey.trim().length > 10) {
    const res = await callGeminiMultiTurn(geminiApiKey.trim(), contents, systemInstruction, jsonMode);
    if (res) return res;
  }

  // Secondary cross-provider attempts if primary failed
  if (provider !== 'deepseek' && deepSeekApiKey && deepSeekApiKey.trim().length > 5) {
    return callDeepSeekMultiTurn(deepSeekApiKey.trim(), contents, systemInstruction, jsonMode);
  }
  if (provider !== 'openai' && openAIApiKey && openAIApiKey.trim().length > 5) {
    return callOpenAICompatibleMultiTurn(openAIApiKey.trim(), contents, {
      baseUrl: customBaseUrl || 'https://api.openai.com/v1',
      model: modelName || 'gpt-4o',
      systemInstruction,
      jsonMode,
    });
  }

  return null;
}

export async function testAIConnection(
  provider: AIProvider,
  apiKey: string,
  customBaseUrl?: string,
  customModel?: string
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { success: false, message: 'Device is offline (airplane mode or no internet connection)' };
  }
  if (provider !== 'custom' && (!apiKey || !apiKey.trim())) {
    return { success: false, message: 'API key cannot be empty' };
  }
  const start = Date.now();
  try {
    if (provider === 'deepseek') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { success: true, message: `Connected (DeepSeek V3 200 OK • ${latencyMs}ms)`, latencyMs };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, message: errorData.error?.message || `HTTP ${res.status}: ${res.statusText}` };
      }
    } else if (provider === 'openai' || provider === 'custom') {
      const defaultUrl = provider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434/v1';
      const defaultModel = provider === 'openai' ? 'gpt-4o' : 'llama3.3';
      const rawBaseUrl = (customBaseUrl?.trim() || defaultUrl).replace(/\/+$/, '');
      const endpoint = rawBaseUrl.endsWith('/chat/completions') ? rawBaseUrl : `${rawBaseUrl}/chat/completions`;
      const model = customModel?.trim() || defaultModel;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      if (res.ok) {
        const label = provider === 'openai' ? `OpenAI (${model})` : `Custom (${model})`;
        return { success: true, message: `Connected (${label} 200 OK • ${latencyMs}ms)`, latencyMs };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, message: errorData.error?.message || `HTTP ${res.status}: ${res.statusText}` };
      }
    } else if (provider === 'anthropic') {
      const baseUrl = (customBaseUrl && customBaseUrl.trim()) ? customBaseUrl.trim().replace(/\/+$/, '') : 'https://api.anthropic.com/v1';
      const model = customModel?.trim() || 'claude-3-7-sonnet-20250219';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Ping' }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { success: true, message: `Connected (Anthropic ${model} 200 OK • ${latencyMs}ms)`, latencyMs };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, message: errorData.error?.message || `HTTP ${res.status}: ${res.statusText}` };
      }
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping' }] }] }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      if (res.ok) {
        return { success: true, message: `Connected (Gemini 3.6 Flash 200 OK • ${latencyMs}ms)`, latencyMs };
      } else {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, message: errorData.error?.message || `HTTP ${res.status}: ${res.statusText}` };
      }
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection timed out' };
  }
}

export async function testConnection(
  provider: AIProvider,
  key: string,
  customBaseUrl?: string,
  customModel?: string
): Promise<{ success: boolean; latencyMs?: number; error?: string; message?: string }> {
  const res = await testAIConnection(provider, key, customBaseUrl, customModel);
  return {
    success: res.success,
    latencyMs: res.latencyMs,
    error: res.success ? undefined : res.message,
    message: res.message,
  };
}

async function callLiveDecompositionAPI(params: DecomposeParams): Promise<Goal | null> {
  const horizonNote = params.targetDays ? `Target Horizon: ${params.targetDays} days` : `Weekly Hours: ${params.weeklyCapacityHours}`;
  const commitmentNote = params.dailyMinutes ? `Daily Commitment: ${params.dailyMinutes} minutes/day` : `Weekly Capacity: ${params.weeklyCapacityHours} hours/week`;
  const velocityNote = params.userVelocityFactor ? `User Historical Velocity Factor: ${params.userVelocityFactor}x (if < 1.0, scale estimated task durations inversely)` : '';

  const prompt = `Decompose this goal into a clean roadmap for an ambitious executive:
Goal: "${params.title}"
${horizonNote}
${commitmentNote}
${velocityNote}
Level: ${params.currentLevel}
Flexibility: ${params.deadlineFlexibility}

Return a clean JSON object without Roman numerals:
{
  "vision": { "coreOutcome": "string", "targetDays": number, "totalEstimatedHours": number, "successMetrics": ["string"] },
  "milestones": [
    { "title": "string", "description": "string", "daysFromNow": number, "owner": "string" }
  ],
  "microMoves": [
    { "title": "string", "description": "string", "estimatedMinutes": number }
  ]
}`;

  const rawText = await callAIMultiTurn(
    [{ role: 'user', parts: [{ text: prompt }] }],
    {
      provider: params.provider,
      geminiApiKey: params.apiKey,
      deepSeekApiKey: params.deepSeekApiKey,
      openAIApiKey: params.openAIApiKey,
      anthropicApiKey: params.anthropicApiKey,
      customApiKey: params.customApiKey,
      modelName: params.modelName,
      customBaseUrl: params.customBaseUrl,
      jsonMode: true,
      systemInstruction: 'You are an expert executive goal decomposition engine. Return only valid JSON.',
    }
  );
  if (!rawText) return null;

  try {
    const parsed = JSON.parse(rawText);
    const goalId = 'goal-' + Date.now().toString(36);
    const today = new Date();
    const totalDays = params.targetDays || parsed.vision?.targetDays || 30;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + totalDays);

    const rawMilestones = parsed.milestones || [];
    const daysPerMs = Math.max(1, Math.floor(totalDays / Math.max(1, rawMilestones.length)));

    const milestones: SprintMilestone[] = rawMilestones.map((m: any, i: number) => {
      const md = new Date(today);
      if (totalDays === 1) {
        md.setDate(today.getDate());
      } else if (i === rawMilestones.length - 1) {
        md.setDate(today.getDate() + totalDays);
      } else {
        const offset = m.daysFromNow ? Math.min(totalDays, m.daysFromNow) : (i + 1) * daysPerMs;
        md.setDate(today.getDate() + offset);
      }
      return {
        id: `${goalId}-ms-${i + 1}`,
        goalId,
        order: i + 1,
        title: cleanTitle(m.title),
        description: m.description || '',
        targetDate: md.toISOString().split('T')[0],
        owner: m.owner || 'You',
        bufferFloatDays: totalDays === 1 ? 0 : 2,
        floatConsumed: 0,
        status: i === 0 ? 'in_progress' : 'pending',
      };
    });

    const velocityMultiplier = params.userVelocityFactor && params.userVelocityFactor > 0 ? 1 / params.userVelocityFactor : 1.0;
    const rawMicroMoves = parsed.microMoves || [];
    const microMoves: MicroMove[] = rawMicroMoves.slice(0, 5).map((mm: any, i: number) => {
      const d = new Date(today);
      if (totalDays > 1 && totalDays <= 7) {
        d.setDate(today.getDate() + Math.min(i, totalDays - 1));
      }
      const rawMinutes = mm.estimatedMinutes || (params.dailyMinutes ? Math.round(params.dailyMinutes / 2) : 25);
      const scaledMinutes = Math.min(60, Math.max(10, Math.round(rawMinutes * velocityMultiplier)));

      return {
        id: `${goalId}-mm-${i + 1}`,
        milestoneId: milestones[0]?.id || `${goalId}-ms-1`,
        goalId,
        title: mm.title,
        description: mm.description || '',
        estimatedMinutes: scaledMinutes,
        dateScheduled: d.toISOString().split('T')[0],
        status: 'todo',
        isPrivate: false,
        order: i + 1,
      };
    });

    return {
      id: goalId,
      title: cleanTitle(params.title),
      category: params.category || detectCategory(params.title),
      weeklyCapacityHours: params.weeklyCapacityHours,
      currentLevel: params.currentLevel,
      deadlineFlexibility: params.deadlineFlexibility,
      createdAt: today.toISOString().split('T')[0],
      active: true,
      velocityFactor: params.userVelocityFactor || 1.0,
      status: 'on_track',
      generationSource:
        params.provider === 'deepseek' ? 'deepseek_live'
        : params.provider === 'openai' ? 'openai_live'
        : params.provider === 'anthropic' ? 'anthropic_live'
        : params.provider === 'custom' ? 'custom_live'
        : 'gemini_live',
      targetDays: totalDays,
      dailyMinutes: params.dailyMinutes,
      vision: {
        coreOutcome: parsed.vision?.coreOutcome || params.title,
        targetDate: targetDate.toISOString().split('T')[0],
        totalEstimatedHours: parsed.vision?.totalEstimatedHours || Math.max(1, Math.round((totalDays * (params.dailyMinutes || 30)) / 60)),
        successMetrics: parsed.vision?.successMetrics || ['Complete milestones on schedule'],
      },
      milestones,
      microMoves,
    };
  } catch (e) {
    console.error('[AIEngine] Failed to parse live Gemini response:', e);
    return null;
  }
}

export async function askSocraticClarification(
  goalText: string,
  apiKey?: string
): Promise<{ questions: string[]; preliminaryPhases: string[] }> {
  if (apiKey) {
    const prompt = `You are a calm, expert goal navigator. The user states: "${goalText}".
Formulate 2 high-impact Socratic clarifying questions and 3 preliminary milestone phases.
Respond ONLY with valid JSON in this exact structure:
{
  "questions": ["string", "string"],
  "preliminaryPhases": ["string", "string", "string"]
}`;
    const raw = await callGemini(apiKey, prompt, true);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.questions) && Array.isArray(parsed.preliminaryPhases)) {
          return {
            questions: parsed.questions.slice(0, 2),
            preliminaryPhases: parsed.preliminaryPhases.slice(0, 3),
          };
        }
      } catch {}
    }
  }

  return {
    questions: [
      `What is your target weekly time budget for "${cleanTitle(goalText).slice(0, 30)}"?`,
      `What is the primary blocker or bottleneck you might encounter?`,
    ],
    preliminaryPhases: [
      'Foundations & Setup',
      'Core Implementation & Iteration',
      'Testing & Completion',
    ],
  };
}

export async function getAgentAdvice(
  userQuery: string,
  context: {
    goalTitle: string;
    currentMilestone?: string;
    todayMoves?: string[];
  },
  apiKey?: string
): Promise<string> {
  return `Focus on completing your active micro-move for "${context.goalTitle}". Even a 15-minute dedicated sprint breaks through inertia and keeps momentum high.`;
}

export interface AssistantOptions {
  openAIApiKey?: string;
  anthropicApiKey?: string;
  customApiKey?: string;
  modelName?: string;
  customBaseUrl?: string;
}

export async function chatWithTracerAssistant(
  userQuery: string,
  context: AssistantContext,
  apiKey?: string,
  history?: AssistantChatMessage[],
  provider?: AIProvider,
  deepSeekApiKey?: string,
  options?: AssistantOptions
): Promise<AssistantResponse> {
  const queryLower = userQuery.toLowerCase();

  // 1. Synthesize Memory Insights
  let memoryInsight = '';
  if (context.velocityFactor !== undefined && context.velocityFactor < 0.9) {
    memoryInsight = `Execution pacing indicates optimism bias (Vf: ${context.velocityFactor}x). Actual task time exceeds initial estimates by ~${Math.round((1 / Math.max(0.1, context.velocityFactor) - 1) * 100)}%.`;
  } else if (context.recentReflections && context.recentReflections.some(r => r.mood === 'friction' || r.mood === 'hard')) {
    const lastFriction = context.recentReflections.find(r => r.mood === 'friction' || r.mood === 'hard');
    memoryInsight = `Recent reflection logged resistance (${lastFriction?.mood} on ${lastFriction?.date}). Low-activation sprints advised today.`;
  } else if (context.recentBlockers && context.recentBlockers.length > 0) {
    const topTaxonomy = context.recentBlockers[0].taxonomy;
    memoryInsight = `Primary friction pattern observed: "${topTaxonomy}". Safeguarding daily capacity recommended.`;
  } else if (context.isOverdue) {
    memoryInsight = `Roadmap timeline is currently slipped past nominal deadline. Buffer rebalancing advised.`;
  }

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline) {
    memoryInsight = memoryInsight
      ? `${memoryInsight} • [Local Offline Mode]`
      : 'Local Offline Mode active. Instant heuristic execution guidance.';
  }

  const hasGemini = Boolean(apiKey && apiKey.trim().length > 10);
  const hasDeepSeek = Boolean(deepSeekApiKey && deepSeekApiKey.trim().length > 5);
  const hasOpenAI = Boolean(options?.openAIApiKey && options.openAIApiKey.trim().length > 5);
  const hasAnthropic = Boolean(options?.anthropicApiKey && options.anthropicApiKey.trim().length > 5);
  const hasCustom = Boolean(options?.customBaseUrl || (options?.customApiKey && options.customApiKey.trim().length > 2));
  const hasAnyLiveAI = hasGemini || hasDeepSeek || hasOpenAI || hasAnthropic || hasCustom;

  // 2. Try Live AI API if key available and online (DeepSeek, OpenAI, Anthropic, Gemini, Custom)
  if (!isOffline && hasAnyLiveAI) {
    const formattedHistory = history && history.length > 0
      ? `\nRecent Dialogue:\n` + history.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')
      : '';

    const systemPrompt = `You are Tracer Assistant, a calm, disciplined executive goal navigator.
Context:
- Goal: "${context.goalTitle}"
- Active Milestone: "${context.activeMilestoneTitle || 'Active Phase'}"
- Active Tasks: ${JSON.stringify(context.todayMoves || [])}
- Velocity Factor (Pacing): ${context.velocityFactor || 1.0}x
- Days Remaining: ${context.daysRemaining ?? 'On track'}
- Overdue: ${context.isOverdue ? 'YES' : 'NO'}
- Memory Insight: "${memoryInsight}"
- Recent Evening Reflections: ${JSON.stringify(context.recentReflections || [])}
- Historical Remarks & Lessons: ${JSON.stringify(context.learningRemarks || [])}
- Recent Blockers: ${JSON.stringify(context.recentBlockers || [])}
${formattedHistory}

User Query: "${userQuery}"

Provide a concise, direct coaching reply (2-3 sentences max).
Return ONLY valid JSON with this exact schema:
{
  "reply": "string",
  "clarificationOptions": ["string", "string"],
  "suggestedAction": {
    "type": "split_task" | "reschedule_task" | "rebalance_dates" | "add_task" | "complete_task" | "prune_task" | "prioritize_task",
    "label": "string",
    "description": "string",
    "payload": {
      "title": "string",
      "estimatedMinutes": 25,
      "dateScheduled": "YYYY-MM-DD"
    }
  }
}`;

    const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
    }
    const last = contents[contents.length - 1];
    if (!last || last.role !== 'user' || last.parts[0].text !== userQuery) {
      contents.push({
        role: 'user',
        parts: [{ text: userQuery }],
      });
    }

    const raw = await callAIMultiTurn(contents, {
      provider,
      geminiApiKey: apiKey,
      deepSeekApiKey,
      openAIApiKey: options?.openAIApiKey,
      anthropicApiKey: options?.anthropicApiKey,
      customApiKey: options?.customApiKey,
      modelName: options?.modelName,
      customBaseUrl: options?.customBaseUrl,
      systemInstruction: systemPrompt,
      jsonMode: true,
    });
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.reply === 'string') {
          let suggestedAction: AssistantExecutableAction | undefined;
          if (parsed.suggestedAction && parsed.suggestedAction.type) {
            suggestedAction = {
              type: parsed.suggestedAction.type,
              label: parsed.suggestedAction.label || 'Apply Suggested Action',
              description: parsed.suggestedAction.description || 'Execute adjustment in roadmap',
              payload: parsed.suggestedAction.payload,
            };
          } else if (parsed.actionType && parsed.actionType !== 'none') {
            suggestedAction = {
              type: parsed.actionType,
              label: parsed.actionLabel || 'Apply Suggested Action',
              description: parsed.actionDescription || 'Execute adjustment in roadmap',
              payload: parsed.actionPayload || parsed.payload,
            };
          }
          const clarificationOptions = Array.isArray(parsed.clarificationOptions)
            ? parsed.clarificationOptions.map(String).slice(0, 4)
            : undefined;

          return {
            reply: parsed.reply,
            suggestedAction,
            clarificationOptions,
            memoryInsight: memoryInsight || undefined,
          };
        }
      } catch (err) {
        console.warn('[chatWithTracerAssistant] Live Gemini error, falling back to heuristic:', err);
      }
    }
  }

  // 3. High-Leverage Deterministic Diagnostics & Action Generation
  if (
    queryLower.includes('stuck') ||
    queryLower.includes('overwhelmed') ||
    queryLower.includes('too hard') ||
    queryLower.includes('split') ||
    queryLower.includes('break down') ||
    queryLower.includes('can\'t focus')
  ) {
    const targetMoveTitle = context.todayMoves?.[0] || 'Active Micro-Move';
    return {
      reply: `Inertia occurs when task scope is underspecified. I recommend splitting "${targetMoveTitle}" into two 15-minute micro-sprints right now.`,
      clarificationOptions: ['Split into two 15m sprints', 'Push to tomorrow', 'Keep single focus block'],
      suggestedAction: {
        type: 'split_task',
        label: 'Split into Two 15m Sprints',
        description: `Carve "${targetMoveTitle}" into atomic Part A & Part B micro-moves.`,
        payload: {
          splitParts: [
            { title: `${targetMoveTitle} (Part 1: Draft & Setup)`, minutes: 15 },
            { title: `${targetMoveTitle} (Part 2: Execution & Polish)`, minutes: 15 },
          ],
        },
      },
      memoryInsight: memoryInsight || 'Micro-chunking to sub-20m eliminates activation friction.',
    };
  }

  if (
    queryLower.includes('behind') ||
    queryLower.includes('late') ||
    queryLower.includes('slip') ||
    queryLower.includes('rebalance') ||
    queryLower.includes('deadline')
  ) {
    return {
      reply: `Schedule slippage happens. Protect your psychology by rebalancing downstream milestone dates by +3 days to restore clean float buffer.`,
      clarificationOptions: ['Rebalance dates (+3d)', 'Extend buffer (+7d)', 'Review critical path'],
      suggestedAction: {
        type: 'rebalance_dates',
        label: 'Rebalance Target Dates (+3d)',
        description: 'Extend pending milestones by 3 calendar days to absorb schedule pressure.',
        payload: { daysOffset: 3 },
      },
      memoryInsight: memoryInsight || 'Buffer resets prevent panic compounding.',
    };
  }

  if (
    queryLower.includes('tomorrow') ||
    queryLower.includes('reschedule') ||
    queryLower.includes('push') ||
    queryLower.includes('skip today')
  ) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    return {
      reply: `Clean deferral is better than guilty avoidance. Pushing today's micro-moves to tomorrow resets your focus baseline.`,
      clarificationOptions: ['Reschedule to Tomorrow', 'Move to Monday', 'Attempt 10m sprint now'],
      suggestedAction: {
        type: 'reschedule_task',
        label: 'Reschedule to Tomorrow',
        description: `Move current action items to ${tomorrowStr}.`,
        payload: { newDate: tomorrowStr },
      },
      memoryInsight: memoryInsight || undefined,
    };
  }

  if (
    queryLower.includes('add task') ||
    queryLower.includes('new task') ||
    queryLower.includes('create task') ||
    queryLower.includes('add move') ||
    queryLower.startsWith('add ')
  ) {
    const rawTitle = userQuery.replace(/^(?:please\s+)?(?:add\s+(?:a\s+)?(?:task|move)?\s*:?\s*|create\s+(?:a\s+)?(?:task|move)?\s*:?\s*)/i, '').trim();
    const taskTitle = rawTitle || 'Targeted Micro-Move';
    return {
      reply: `Adding "${taskTitle}" to your active sprint focus. Micro-actions build compound velocity.`,
      clarificationOptions: ['Add as 15m sprint', 'Add as 30m block', 'Review roadmap'],
      suggestedAction: {
        type: 'add_task',
        label: `Add "${taskTitle.slice(0, 24)}"`,
        description: `Add micro-move to active milestone.`,
        payload: {
          title: taskTitle,
          estimatedMinutes: 25,
        },
      },
      memoryInsight: memoryInsight || undefined,
    };
  }

  if (
    queryLower.includes('done') ||
    queryLower.includes('complete') ||
    queryLower.includes('finish') ||
    queryLower.includes('check off')
  ) {
    const targetMoveTitle = context.todayMoves?.[0] || 'Active Micro-Move';
    return {
      reply: `Marking "${targetMoveTitle}" as complete. Excellent execution discipline.`,
      clarificationOptions: ['Review roadmap progress', 'Take 5m rest break', 'Promote next task'],
      suggestedAction: {
        type: 'complete_task',
        label: `Complete "${targetMoveTitle.slice(0, 24)}"`,
        description: `Record completion and celebrate progress.`,
      },
      memoryInsight: memoryInsight || undefined,
    };
  }

  if (
    queryLower.includes('prune') ||
    queryLower.includes('delete task') ||
    queryLower.includes('remove task') ||
    queryLower.includes('drop task') ||
    queryLower.includes('eliminate')
  ) {
    const targetMoveTitle = context.todayMoves?.[0] || 'Active Micro-Move';
    return {
      reply: `Pruning "${targetMoveTitle}" frees cognitive bandwidth for what truly moves the needle.`,
      clarificationOptions: ['Prune from checklist', 'Downscale to 5m nudge', 'Keep task for now'],
      suggestedAction: {
        type: 'prune_task',
        label: `Prune "${targetMoveTitle.slice(0, 24)}"`,
        description: `Prune micro-move from focus checklist.`,
      },
      memoryInsight: memoryInsight || 'Ruthless pruning protects high-leverage outcomes.',
    };
  }

  if (
    queryLower.includes('prioritize') ||
    queryLower.includes('top priority') ||
    queryLower.includes('focus on')
  ) {
    const targetMoveTitle = context.todayMoves?.[0] || 'Active Micro-Move';
    return {
      reply: `Setting "${targetMoveTitle}" to top priority at the front of your sprint checklist.`,
      clarificationOptions: ['Start timer now', 'Break into smaller steps', 'Keep existing order'],
      suggestedAction: {
        type: 'prioritize_task',
        label: `Prioritize "${targetMoveTitle.slice(0, 24)}"`,
        description: `Move micro-move to position 1 in today's focus queue.`,
      },
      memoryInsight: memoryInsight || 'Singular focus creates breakthrough momentum.',
    };
  }

  return {
    reply: `Stay locked on "${context.activeMilestoneTitle || context.goalTitle}". Execute the immediate next micro-move for 15 minutes to generate momentum.`,
    clarificationOptions: ['I feel stuck on this', 'Please rebalance my dates', 'Add a new micro-move'],
    memoryInsight: memoryInsight || undefined,
  };
}

export interface SocraticIntakeTurn {
  role: 'user' | 'model';
  text: string;
}

export interface SocraticIntakeParams {
  intent: string;
  history?: SocraticIntakeTurn[];
  apiKey?: string;
  provider?: AIProvider;
  deepSeekApiKey?: string;
  openAIApiKey?: string;
  anthropicApiKey?: string;
  customApiKey?: string;
  modelName?: string;
  customBaseUrl?: string;
  directSynthesis?: boolean;
}

export async function conductSocraticIntake(
  params: SocraticIntakeParams
): Promise<SocraticIntakeResponse> {
  const {
    intent,
    history = [],
    apiKey,
    provider,
    deepSeekApiKey,
    openAIApiKey,
    anthropicApiKey,
    customApiKey,
    modelName,
    customBaseUrl,
    directSynthesis,
  } = params;

  // 1. Direct Synthesis or already clarified (allow up to 4 iterative turns if user keeps answering)
  const isDetailed =
    directSynthesis ||
    history.length >= 8 ||
    intent.length > 90 ||
    /\b(?:in \d+ days|daily \d+ min|beginner|intermediate|advanced|\d+ hours|\d+ weeks)\b/i.test(intent);

  const hasGemini = Boolean(apiKey && apiKey.trim().length > 10);
  const hasDeepSeek = Boolean(deepSeekApiKey && deepSeekApiKey.trim().length > 5);
  const hasOpenAI = Boolean(openAIApiKey && openAIApiKey.trim().length > 5);
  const hasAnthropic = Boolean(anthropicApiKey && anthropicApiKey.trim().length > 5);
  const hasCustom = Boolean(customBaseUrl || (customApiKey && customApiKey.trim().length > 2));
  const hasAnyLiveAI = hasGemini || hasDeepSeek || hasOpenAI || hasAnthropic || hasCustom;

  if (!isDetailed && hasAnyLiveAI) {
    const systemPrompt = `You are Tracer Socratic Intake, an elite executive architect.
The user wants to accomplish this goal: "${intent}".
Determine whether this goal requires scope, timeline, daily commitment, or technical level clarification.
If it is underspecified or vague, return 1-2 sharp clarifying questions with 3 concise options each.
Return ONLY valid JSON with this schema:
{
  "status": "clarifying",
  "message": "A sharp, encouraging 1-sentence prompt.",
  "questions": [
    {
      "id": "q1",
      "question": "What is your target timeframe and daily commitment?",
      "options": ["30 min/day (4 weeks)", "60 min/day (8 weeks)", "Weekend sprints (3 months)"]
    },
    {
      "id": "q2",
      "question": "What is your current level or starting point?",
      "options": ["Complete Beginner", "Intermediate Practitioner", "Advanced / Refining"]
    }
  ]
}

If the goal is sufficiently specified, return ONLY:
{
  "status": "ready",
  "message": "Synthesizing your bespoke roadmap now..."
}`;

    const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
    for (const h of history) {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: `Goal intent: "${intent}"` }],
    });

    const raw = await callAIMultiTurn(contents, {
      provider,
      geminiApiKey: apiKey,
      deepSeekApiKey,
      openAIApiKey,
      anthropicApiKey,
      customApiKey,
      modelName,
      customBaseUrl,
      systemInstruction: systemPrompt,
      jsonMode: true,
    });
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.status === 'clarifying' && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return {
            status: 'clarifying',
            message: parsed.message || 'Let us calibrate your execution plan:',
            questions: parsed.questions,
          };
        }
      } catch (err) {
        console.warn('[conductSocraticIntake] Gemini parsing failed, falling back:', err);
      }
    }
  }

  // Fallback heuristic questions if underspecified
  if (!isDetailed) {
    const category = detectCategory(intent);
    let questions: Array<{ id: string; question: string; options: string[] }> = [];

    if (category === 'fitness') {
      questions = [
        {
          id: 'timeline_commitment',
          question: 'What is your target timeframe and weekly rhythm?',
          options: ['4 weeks (3-4 days/wk)', '8 weeks (4-5 days/wk)', '12 weeks (Structured periodization)'],
        },
        {
          id: 'baseline_level',
          question: 'What is your current fitness baseline?',
          options: ['Beginner (Rebuilding aerobic base)', 'Intermediate (Regular training)', 'Advanced (Targeting peak performance)'],
        },
      ];
    } else if (category === 'technical') {
      questions = [
        {
          id: 'deliverable_scope',
          question: 'What is the primary deliverable scope?',
          options: ['Production MVP / Service', 'Core Algorithm / Spec Prototype', 'Comprehensive Deep Mastery'],
        },
        {
          id: 'daily_capacity',
          question: 'What is your daily focused execution capacity?',
          options: ['30 min daily sprint', '60 min deep work block', '2+ hours intensive build'],
        },
      ];
    } else if (category === 'business') {
      questions = [
        {
          id: 'business_stage',
          question: 'What stage is this initiative currently in?',
          options: ['Problem validation & interviews', 'Building & launching MVP', 'Scaling revenue & growth'],
        },
        {
          id: 'target_deadline',
          question: 'What is your target launch horizon?',
          options: ['14-Day Sprint', '30-Day Launch', '90-Day Quarter Goal'],
        },
      ];
    } else {
      questions = [
        {
          id: 'time_commitment',
          question: 'What is your preferred daily commitment?',
          options: ['25 min daily micro-sprint', '45 min focused block', '90 min deep immersion'],
        },
        {
          id: 'target_horizon',
          question: 'What is your desired achievement timeline?',
          options: ['2-week rapid sprint', '30-day foundation', '90-day mastery cycle'],
        },
      ];
    }

    return {
      status: 'clarifying',
      message: `To tailor a high-velocity roadmap for "${cleanTitle(intent)}", let us calibrate two key dimensions:`,
      questions,
    };
  }

  // 2. Synthesize Bespoke Roadmap
  const answersText = history
    .filter((h) => h.role === 'user')
    .map((h) => h.text)
    .join('. ');
  const combinedTitle = answersText ? `${intent} (${answersText.slice(0, 100)})` : intent;

  const plan = await decomposeGoal({
    title: intent,
    apiKey,
    provider,
    deepSeekApiKey,
    weeklyCapacityHours: 10,
    currentLevel: /beginner/i.test(combinedTitle) ? 'Beginner' : /advanced/i.test(combinedTitle) ? 'Advanced' : 'Intermediate',
    deadlineFlexibility: 'Moderate Elastic',
  });

  return {
    status: 'ready',
    message: `Synthesized bespoke roadmap for "${plan.title}" across ${plan.milestones.length} milestones.`,
    plan,
    goal: plan,
  };
}
