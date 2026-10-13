import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useGoal } from '../../context/GoalContext';
import { Goal } from '../../types/goal';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { feedback } from '../../services/feedback';
import { Check, Clock, Calendar, Compass, Target, Layers, Trash2, Sparkles } from 'lucide-react';

interface HorizonOption {
  id: string;
  label: string;
  days: number;
}

interface CommitmentOption {
  id: string;
  label: string;
  mins: number;
}

const HORIZON_OPTIONS: HorizonOption[] = [
  { id: '1d', label: 'Today (1d)', days: 1 },
  { id: '7d', label: '1 Week (7d)', days: 7 },
  { id: '30d', label: '1 Month (30d)', days: 30 },
  { id: '90d', label: '3 Months (90d)', days: 90 },
  { id: '180d', label: '6 Months (180d)', days: 180 },
  { id: 'custom', label: 'Custom', days: -1 },
];

const TIME_SPENDING_OPTIONS: CommitmentOption[] = [
  { id: '15m', label: '15m / day', mins: 15 },
  { id: '30m', label: '30m / day', mins: 30 },
  { id: '1h', label: '1h / day', mins: 60 },
  { id: '2h', label: '2h / day', mins: 120 },
  { id: '4h', label: '4h / day', mins: 240 },
];

const PIVOT_CHIPS = [
  { id: 'Fast', label: 'Fast Track' },
  { id: 'Steady', label: 'Steady Pace' },
  { id: 'Deep', label: 'Deep Focus' },
];

const SUGGESTIONS = [
  'Launch Android MVP',
  'Run 10km Marathon',
  'Master Rust Systems',
  'Deep Work Sprint',
];

export const IntakeScreen: React.FC = () => {
  const { createGoal, setActiveTab, decomposeNewGoal, conductSocraticIntake } = useGoal();
  const [intent, setIntent] = useState('');
  const [selectedHorizon, setSelectedHorizon] = useState<string>('30d');
  const [customDays, setCustomDays] = useState<number>(45);
  const [dailyMinutes, setDailyMinutes] = useState<number>(60);
  const [selectedPivot, setSelectedPivot] = useState<string>('Steady');
  const [previewPlan, setPreviewPlan] = useState<Goal | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Socratic Calibration State
  const [socraticQuestions, setSocraticQuestions] = useState<Array<{ id: string; question: string; options: string[] }> | null>(null);
  const [socraticMessage, setSocraticMessage] = useState<string>('');
  const [socraticAnswers, setSocraticAnswers] = useState<Record<string, string>>({});
  const [_isCalibrating, setIsCalibrating] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const generationSeqRef = useRef<number>(0);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Smooth auto-scroll to preview on synthesis completion
  useEffect(() => {
    if (previewPlan && !isGenerating) {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [previewPlan, isGenerating]);

  const getEffectiveDays = (horizonId: string, customVal: number): number => {
    if (horizonId === 'custom') return Math.min(365, Math.max(1, customVal));
    const match = HORIZON_OPTIONS.find(h => h.id === horizonId);
    return match && match.days > 0 ? match.days : 30;
  };

  const executeGeneration = useCallback(
    async (text: string, horizonId: string, customVal: number, mins: number, pivot: string) => {
      if (!text.trim()) {
        setPreviewPlan(null);
        setIsGenerating(false);
        return;
      }
      const seq = ++generationSeqRef.current;
      setIsGenerating(true);

      const days = getEffectiveDays(horizonId, customVal);
      const weeklyHours = Math.max(1, Math.round((mins * 7) / 60));

      try {
        const plan = await decomposeNewGoal({
          title: text.trim(),
          weeklyCapacityHours: pivot === 'Fast' ? Math.round(weeklyHours * 1.5) : weeklyHours,
          currentLevel: pivot === 'Deep' ? 'Advanced' : 'Intermediate',
          deadlineFlexibility: pivot === 'Fast' ? 'Hard Deadline' : 'Flexible',
          targetDays: days,
          dailyMinutes: mins,
        });

        // Ignore if a newer request was triggered while in-flight
        if (seq !== generationSeqRef.current) return;

        setPreviewPlan(plan);
        androidBridge.triggerHaptic('light');
      } catch (err) {
        console.warn('[IntakeScreen] Async decomposition failed:', err);
      } finally {
        if (seq === generationSeqRef.current) {
          setIsGenerating(false);
        }
      }
    },
    [decomposeNewGoal]
  );

  const handleGenerate = (
    text: string,
    horizonId: string,
    customVal: number,
    mins: number,
    pivot: string,
    debounceMs: number = 0
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!text.trim()) {
      setPreviewPlan(null);
      setIsGenerating(false);
      return;
    }

    if (debounceMs > 0) {
      setIsGenerating(true);
      debounceTimerRef.current = setTimeout(() => {
        executeGeneration(text, horizonId, customVal, mins, pivot);
      }, debounceMs);
    } else {
      executeGeneration(text, horizonId, customVal, mins, pivot);
    }
  };

  const handleCheckSocratic = useCallback(
    async (text: string) => {
      if (!text.trim() || text.trim().length < 3) {
        setSocraticQuestions(null);
        return;
      }
      setIsCalibrating(true);
      try {
        const resp = await conductSocraticIntake(text.trim());
        if (resp.status === 'clarifying' && resp.questions && resp.questions.length > 0) {
          setSocraticQuestions(resp.questions);
          setSocraticMessage(resp.message);
          soundManager.playTick();
          androidBridge.triggerHaptic('light');
        } else if (resp.plan) {
          setPreviewPlan(resp.plan);
          setSocraticQuestions(null);
        }
      } catch {
        // fallback smoothly
      } finally {
        setIsCalibrating(false);
      }
    },
    [conductSocraticIntake]
  );

  const handleAnswerOption = (questionId: string, option: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    const updated = { ...socraticAnswers, [questionId]: option };
    setSocraticAnswers(updated);
    const answersText = Object.values(updated).join(', ');
    const enriched = `${intent} (${answersText})`;
    handleGenerate(enriched, selectedHorizon, customDays, dailyMinutes, selectedPivot, 0);
  };

  const handleSkipSocratic = () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    setSocraticQuestions(null);
    executeGeneration(intent, selectedHorizon, customDays, dailyMinutes, selectedPivot);
  };

  const handleSelectHorizon = (horizonId: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    setSelectedHorizon(horizonId);
    handleGenerate(intent, horizonId, customDays, dailyMinutes, selectedPivot, 0);
  };

  const handleSelectTimeSpending = (mins: number) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    setDailyMinutes(mins);
    handleGenerate(intent, selectedHorizon, customDays, mins, selectedPivot, 0);
  };

  const handleSelectPivot = (pivotId: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    setSelectedPivot(pivotId);
    handleGenerate(intent, selectedHorizon, customDays, dailyMinutes, pivotId, 0);
  };

  const handleApproveAndImplement = async () => {
    if (!previewPlan || isSubmitting) return;
    setIsSubmitting(true);
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('success');
    try {
      await createGoal(previewPlan);
      setActiveTab('focus');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePreviewMove = (moveIndex: number) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    setPreviewPlan(prev => {
      if (!prev) return null;
      const updated = prev.microMoves.filter((_, idx) => idx !== moveIndex);
      return { ...prev, microMoves: updated };
    });
  };

  const computedCustomDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (customDays || 1));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  })();

  const allocatedTodayMinutes = (previewPlan?.microMoves || []).reduce((acc, m) => acc + (m.estimatedMinutes || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 pb-32 select-none">
      {/* Step 1: Goal Definition */}
      <div className="bg-bone-900/80 border border-white/[0.08] rounded-3xl p-4 mb-3 shadow-surface">
        <div className="flex items-center gap-1.5 text-terracotta text-xs font-mono font-bold uppercase tracking-wider mb-2">
          <Target className="w-3.5 h-3.5" /> 1. What is your goal?
        </div>
        <h2 className="text-sm font-bold text-bone-100 mb-2">What do you want to accomplish?</h2>
        <input
          type="text"
          value={intent}
          autoFocus
          enterKeyHint="next"
          onFocus={e => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (intent.trim().length >= 2) {
                handleGenerate(intent, selectedHorizon, customDays, dailyMinutes, selectedPivot, 0);
              }
            }
          }}
          onChange={e => {
            const val = e.target.value;
            setIntent(val);
            if (val.trim().length >= 2) {
              handleGenerate(val, selectedHorizon, customDays, dailyMinutes, selectedPivot, 400);
            } else {
              if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
              setPreviewPlan(null);
              setIsGenerating(false);
            }
          }}
          placeholder="e.g. Launch Android MVP, Run 10k, Master Rust"
          className="w-full min-h-[52px] px-4 rounded-2xl bg-bone-800 border border-white/10 text-bone-100 text-sm placeholder:text-bone-500 focus:outline-none focus:border-terracotta"
        />

        {/* Socratic Calibration Trigger & Immediate Bypass Deck */}
        {intent && !socraticQuestions && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleCheckSocratic(intent)}
              className="flex-1 min-h-[48px] px-3.5 py-2 rounded-xl bg-terracotta/15 hover:bg-terracotta/25 border border-terracotta/30 text-terracotta text-xs font-semibold flex items-center justify-center gap-1.5 m3-press transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Ask Clarifying Questions</span>
            </button>
            <button
              type="button"
              onClick={handleSkipSocratic}
              className="min-h-[48px] px-4 py-2 rounded-xl bg-terracotta hover:bg-terracotta-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 m3-press shadow-surface transition-colors"
            >
              <span>⚡ Synthesize Plan Now</span>
            </button>
          </div>
        )}

        {/* Socratic Clarification Card */}
        {socraticQuestions && socraticQuestions.length > 0 && (
          <div className="mt-3 p-3.5 rounded-2xl bg-terracotta/10 border border-terracotta/25 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-terracotta">
                <Sparkles className="w-4 h-4" />
                <span>Socratic Calibration</span>
              </div>
              <button
                type="button"
                onClick={handleSkipSocratic}
                className="min-h-[48px] px-3.5 py-1.5 rounded-xl bg-terracotta/20 hover:bg-terracotta/30 border border-terracotta/40 text-terracotta text-xs font-bold flex items-center gap-1.5 m3-press transition-colors shrink-0"
              >
                <span>⚡ Synthesize Plan Now</span>
              </button>
            </div>
            {socraticMessage && (
              <p className="text-xs text-bone-300 leading-snug">{socraticMessage}</p>
            )}
            <div className="space-y-2.5">
              {socraticQuestions.map(q => (
                <div key={q.id} className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-bone-200">{q.question}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map(opt => {
                      const isSelected = socraticAnswers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleAnswerOption(q.id, opt)}
                          className={`min-h-[48px] px-3 py-1.5 rounded-xl text-xs font-medium border m3-press transition-all ${
                            isSelected
                              ? 'bg-terracotta text-white border-terracotta shadow-sm'
                              : 'bg-bone-800/90 text-bone-300 border-white/10 hover:bg-bone-700'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick suggestions if input is empty */}
        {!intent && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('selection');
                  setIntent(s);
                  handleGenerate(s, selectedHorizon, customDays, dailyMinutes, selectedPivot, 0);
                }}
                className="min-h-[48px] px-3 py-1.5 rounded-xl bg-bone-800/80 hover:bg-bone-700/80 border border-white/[0.06] text-bone-300 text-xs font-medium m3-press"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Timeframe Horizon */}
      <div className="bg-bone-900/80 border border-white/[0.08] rounded-3xl p-4 mb-3 shadow-surface">
        <div className="flex items-center gap-1.5 text-terracotta text-xs font-mono font-bold uppercase tracking-wider mb-2">
          <Calendar className="w-3.5 h-3.5" /> 2. Choose your timeframe
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {HORIZON_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => handleSelectHorizon(opt.id)}
              className={`min-h-[48px] px-2.5 py-2 rounded-xl text-xs font-semibold m3-press transition-colors border flex items-center justify-center text-center ${
                selectedHorizon === opt.id
                  ? 'bg-terracotta text-white border-terracotta shadow-surface'
                  : 'bg-bone-800 text-bone-300 border-white/10 hover:bg-bone-700/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {selectedHorizon === 'custom' && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-bone-300">Custom Target (Days):</label>
              <input
                type="number"
                inputMode="numeric"
                enterKeyHint="done"
                min={1}
                max={365}
                value={customDays}
                aria-label="Custom target days"
                onFocus={e => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                onChange={e => {
                  const val = Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 1));
                  setCustomDays(val);
                  handleGenerate(intent, 'custom', val, dailyMinutes, selectedPivot, 0);
                }}
                className="w-20 min-h-[48px] px-3 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
              />
            </div>
            <span className="text-xs font-mono text-terracotta bg-terracotta/10 px-2.5 py-1.5 rounded-lg border border-terracotta/20 font-semibold">
              Target: {computedCustomDate}
            </span>
          </div>
        )}
      </div>

      {/* Step 3: Daily Time Spending */}
      <div className="bg-bone-900/80 border border-white/[0.08] rounded-3xl p-4 mb-3 shadow-surface">
        <div className="flex items-center gap-1.5 text-terracotta text-xs font-mono font-bold uppercase tracking-wider mb-2">
          <Clock className="w-3.5 h-3.5" /> 3. Daily commitment
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {TIME_SPENDING_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => handleSelectTimeSpending(opt.mins)}
              className={`min-h-[48px] px-2 py-2 rounded-xl text-xs font-semibold m3-press transition-colors border flex items-center justify-center text-center ${
                dailyMinutes === opt.mins
                  ? 'bg-terracotta text-white border-terracotta shadow-surface'
                  : 'bg-bone-800 text-bone-300 border-white/10 hover:bg-bone-700/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Organic Terracotta Live Synthesis Beacon */}
      {isGenerating && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-terracotta/15 border border-terracotta/30 text-terracotta text-xs font-mono mb-3 animate-pulse shadow-surface">
          <span className="w-2 h-2 rounded-full bg-terracotta animate-ping shrink-0" />
          <span>Gemini 3.6 Flash synthesizing tailored milestones...</span>
        </div>
      )}

      {/* Skeleton Shimmer when waiting without prior plan */}
      {isGenerating && !previewPlan && (
        <div className="bg-bone-900/80 border border-white/[0.08] rounded-3xl p-4 mb-4 animate-pulse space-y-3 shadow-surface">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-bone-800 rounded-md" />
            <div className="h-5 w-24 bg-bone-800 rounded-full" />
          </div>
          <div className="h-10 w-full bg-bone-800 rounded-xl" />
          <div className="h-24 w-full bg-bone-800 rounded-2xl" />
          <div className="h-20 w-full bg-bone-800 rounded-2xl" />
          <div className="h-12 w-full bg-bone-800 rounded-2xl" />
        </div>
      )}

      {/* Step 4: Interactive Plan Preview */}
      {previewPlan && (
        <div
          ref={previewRef}
          className={`bg-bone-900/95 border border-terracotta/30 rounded-3xl p-4 mb-4 shadow-surface transition-opacity duration-200 ${isGenerating ? 'opacity-70' : 'opacity-100'}`}
        >
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-terracotta text-xs font-mono font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" /> 4. Review your plan
            </div>
            <div className="flex items-center gap-1.5">
              {previewPlan.generationSource === 'deepseek_live' ? (
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-terracotta/20 text-terracotta border border-terracotta/40 font-bold flex items-center gap-1">
                  <span>🐋 DeepSeek-V3 Live Agent</span>
                </span>
              ) : previewPlan.generationSource === 'gemini_live' ? (
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-terracotta/20 text-terracotta border border-terracotta/40 font-bold flex items-center gap-1">
                  <span>✨ Gemini-3.6 Live Agent</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-sage/15 text-sage border border-sage/30 font-medium flex items-center gap-1">
                  <span>⚡ Offline Deterministic Plan</span>
                </span>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bone-800 text-bone-300 border border-white/10">
                Target: {previewPlan.vision.targetDate}
              </span>
            </div>
          </div>

          {/* 1-Tap Pacing Chips */}
          <div className="flex items-center gap-2 mb-4">
            {PIVOT_CHIPS.map(chip => (
              <button
                key={chip.id}
                onClick={() => handleSelectPivot(chip.id)}
                className={`min-h-[48px] flex-1 px-2 py-2 rounded-xl text-xs font-medium m3-press border ${
                  selectedPivot === chip.id
                    ? 'bg-terracotta/20 text-terracotta border-terracotta/40 font-semibold'
                    : 'bg-bone-800 text-bone-400 border-white/10'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Targets of the Day */}
          <div className="p-3 rounded-2xl bg-bone-800/80 border border-white/[0.08] mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-bone-100">
                <Target className="w-3.5 h-3.5 text-sage" />
                <span>Targets of the Day</span>
              </div>
              <span className="text-[11px] font-mono text-sage font-semibold bg-sage/10 px-2 py-0.5 rounded-md border border-sage/20">
                Today: {previewPlan.microMoves.length} tasks • {allocatedTodayMinutes}m allocated
              </span>
            </div>

            {previewPlan.microMoves.length === 0 ? (
              <div className="p-4 rounded-xl bg-bone-900/60 border border-white/[0.06] text-center text-bone-400 text-xs">
                <p className="font-semibold text-bone-300">All micro-moves removed.</p>
                <p className="text-[11px] text-bone-500 mt-1">Adjust parameters above to generate fresh tasks before approving.</p>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                {previewPlan.microMoves.map((move, idx) => (
                  <div
                    key={move.id || idx}
                    className="p-2.5 rounded-xl bg-bone-900/90 border border-white/[0.06] flex items-start justify-between gap-2"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-md bg-terracotta/20 text-terracotta text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-bone-200 leading-snug truncate">{move.title}</p>
                        {move.description && (
                          <p className="text-[11px] text-bone-400 mt-0.5 line-clamp-1">{move.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-white/[0.05] text-amber border border-white/10 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {move.estimatedMinutes}m
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePreviewMove(idx)}
                        className="w-11 h-11 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-bone-400 hover:text-rust hover:bg-rust/10 m3-press transition-colors"
                        title="Remove task"
                        aria-label={`Remove task ${move.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Target Schedule / Roadmap */}
          <div className="p-3 rounded-2xl bg-bone-800/80 border border-white/[0.08] mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-bone-100">
                <Layers className="w-3.5 h-3.5 text-terracotta" />
                <span>Target Schedule & Roadmap</span>
              </div>
              <span className="text-[11px] font-mono text-bone-400">
                {previewPlan.milestones.length} Milestone Phases
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              {previewPlan.milestones.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className="p-2.5 rounded-xl bg-bone-900/90 border border-white/[0.06] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-bone-500 font-mono text-[11px] font-bold">P{idx + 1}</span>
                    <span className="text-bone-200 font-medium truncate">{m.title}</span>
                  </div>
                  <span className="text-bone-400 font-mono text-[11px] shrink-0">{m.targetDate}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleApproveAndImplement}
            disabled={previewPlan.microMoves.length === 0 || isGenerating || isSubmitting}
            className="w-full min-h-[56px] rounded-2xl bg-terracotta hover:bg-terracotta-hover text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 m3-press shadow-surface transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>Approve & Implement Plan</span>
          </button>
        </div>
      )}
    </div>
  );
};
