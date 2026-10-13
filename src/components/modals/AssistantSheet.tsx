import React, { useState, useRef, useEffect } from 'react';
import { ModalSheet } from '../common/ModalSheet';
import { useGoal } from '../../context/GoalContext';
import { AssistantResponse, AssistantExecutableAction, AssistantChatMessage } from '../../types/goal';
import { Compass, Send, Check, Zap, Undo2, X, Shield } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { storage } from '../../services/storage';

interface AssistantSheetProps {
  onClose: () => void;
}

export const AssistantSheet: React.FC<AssistantSheetProps> = ({ onClose }) => {
  const { chatWithTracerAssistant, applyAssistantAction, activeGoal, undo } = useGoal();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello! I am your execution assistant for "${activeGoal?.title || 'your objective'}". How can I help you adjust your schedule or unblock today?`,
      clarificationOptions: ['I am stuck on my task', 'Please rebalance my dates', 'Review my current pace'],
      timestamp: Date.now(),
    },
  ]);
  const [appliedActionIds, setAppliedActionIds] = useState<Set<string>>(new Set());
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(new Set());
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = async (queryText?: string) => {
    const text = (queryText || inputQuery).trim();
    if (!text || isThinking) return;

    soundManager.playTick();
    androidBridge.triggerHaptic('medium');

    const userMsg: AssistantChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!queryText) setInputQuery('');
    setIsThinking(true);

    try {
      const resp: AssistantResponse = await chatWithTracerAssistant(text, updatedMessages);
      const assistantMsg: AssistantChatMessage = {
        id: `a-${Date.now()}`,
        role: 'model',
        text: resp.reply,
        action: resp.suggestedAction,
        clarificationOptions: resp.clarificationOptions,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      soundManager.playCompleteChime();
      androidBridge.triggerHaptic('light');
    } catch (err: any) {
      const isKeyError = err?.message?.toLowerCase().includes('key') || err?.message?.toLowerCase().includes('auth');
      const errText = isKeyError
        ? 'Gemini AI service unavailable. Please check your Gemini API key in Settings (⚙️) or Tracer will use local heuristic guidance.'
        : 'AI assistant is temporarily offline. Operating with local schedule heuristics.';

      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: errText,
          clarificationOptions: ['I am stuck on my task', 'Please rebalance my dates'],
          timestamp: Date.now(),
        },
      ]);
      soundManager.playBlockerThud();
      androidBridge.triggerHaptic('error');
    } finally {
      setIsThinking(false);
    }
  };

  const handleExecuteAction = (msgId: string, action: AssistantExecutableAction) => {
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('success');
    applyAssistantAction(action);
    setAppliedActionIds(prev => new Set(prev).add(msgId));

    storage.recordTrajectory({
      id: `traj-${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      source: 'user',
      action: action.type,
      description: action.label,
      status: 'approved',
      diffSummary: action.description,
    });
  };

  const handleDismissAction = (msgId: string, action: AssistantExecutableAction) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    setDismissedActionIds(prev => new Set(prev).add(msgId));

    storage.recordTrajectory({
      id: `traj-${Date.now()}`,
      timestamp: Date.now(),
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      source: 'user',
      action: action.type,
      description: action.label,
      status: 'rejected',
      diffSummary: `Dismissed proposal: ${action.description}`,
    });
  };

  const handleUndoAction = (msgId: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    undo();
    setAppliedActionIds(prev => {
      const next = new Set(prev);
      next.delete(msgId);
      return next;
    });
  };

  const quickChips = [
    { label: 'Unblock Task', query: 'I am stuck and hitting resistance on my task. Help unblock me.' },
    { label: 'Rebalance Dates', query: 'Please rebalance my milestone dates and pace.' },
    { label: 'Review Pace', query: 'Review my current pace and identify bottlenecks.' },
  ];

  return (
    <ModalSheet
      onClose={onClose}
      title="Execution Assistant"
      subtitle="Pacing advisor & schedule rebalancer"
      icon={Compass}
      iconBgColor="bg-terracotta/15 text-terracotta border border-terracotta/30"
      maxHeight="max-h-[85vh]"
    >
      <div className="flex flex-col h-[65vh] select-none text-xs">
        {/* Quick Action Chips */}
        <div className="flex items-center gap-2 pb-2.5 overflow-x-auto shrink-0 border-b border-white/[0.08]">
          {quickChips.map(chip => (
            <button
              key={chip.label}
              onClick={() => handleSend(chip.query)}
              disabled={isThinking}
              className="min-h-[48px] px-3.5 rounded-xl bg-bone-800/80 hover:bg-bone-700 text-bone-200 border border-white/10 font-medium whitespace-nowrap m3-press transition-colors disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-terracotta text-white rounded-br-sm'
                    : 'bg-bone-900/90 border border-white/[0.08] text-bone-200 rounded-bl-sm shadow-surface'
                }`}
              >
                {msg.text}
              </div>

              {/* Socratic / Follow-up Clarification Chips */}
              {msg.role === 'model' && msg.clarificationOptions && msg.clarificationOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[88%]">
                  {msg.clarificationOptions.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => handleSend(opt)}
                      disabled={isThinking}
                      className="min-h-[48px] px-3 py-1.5 rounded-xl bg-terracotta/10 hover:bg-terracotta/20 border border-terracotta/30 text-terracotta text-xs font-semibold m3-press transition-colors text-left flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <span>💬</span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Action Card */}
              {msg.action && (
                <div className="mt-2 w-[88%] bg-[#090A0D]/95 border border-white/15 rounded-2xl p-4 shadow-surface">
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-terracotta font-bold">
                      <Compass className="w-3.5 h-3.5" /> Proposed Action
                    </div>
                    {(() => {
                      switch (msg.action.type) {
                        case 'add_task':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sage/20 text-sage border border-sage/30">
                              + ADD TASK
                            </span>
                          );
                        case 'complete_task':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sage/20 text-sage border border-sage/30">
                              ✓ MARK DONE
                            </span>
                          );
                        case 'prune_task':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rust/20 text-rust border border-rust/30">
                              ✕ PRUNE
                            </span>
                          );
                        case 'prioritize_task':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-terracotta/20 text-terracotta border border-terracotta/30">
                              ★ PROMOTE TO FOCUS
                            </span>
                          );
                        case 'split_task':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-terracotta/20 text-terracotta border border-terracotta/30">
                              ✂ SPLIT (15m/15m)
                            </span>
                          );
                        case 'reschedule_task':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber/20 text-amber border border-amber/30">
                              📅 RESCHEDULE
                            </span>
                          );
                        case 'rebalance_dates':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber/20 text-amber border border-amber/30">
                              ⚡ REBALANCE ROADMAP
                            </span>
                          );
                        default:
                          return null;
                      }
                    })()}
                  </div>
                  <h4 className="text-xs font-semibold text-bone-100 mt-1">{msg.action.label}</h4>
                  <p className="text-[11px] text-bone-300 mt-0.5 leading-snug">{msg.action.description}</p>

                  {/* HITL Action Approval Deck */}
                  {appliedActionIds.has(msg.id) ? (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 min-h-[48px] px-3 rounded-xl bg-sage/20 text-sage border border-sage/30 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Adjustment Applied</span>
                      </div>
                      <button
                        onClick={() => handleUndoAction(msg.id)}
                        className="min-h-[48px] px-3.5 rounded-xl bg-bone-800 hover:bg-bone-700 text-bone-200 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 m3-press"
                        aria-label="Undo action"
                      >
                        <Undo2 className="w-4 h-4 text-amber" />
                        <span>Undo</span>
                      </button>
                    </div>
                  ) : dismissedActionIds.has(msg.id) ? (
                    <div className="mt-3 min-h-[48px] px-3 rounded-xl bg-bone-800/60 text-bone-400 border border-white/[0.06] text-xs font-medium flex items-center justify-center gap-1.5">
                      <X className="w-4 h-4 text-rust" />
                      <span>Action Proposal Dismissed</span>
                    </div>
                  ) : (
                    <div className="mt-3 pt-2.5 border-t border-white/[0.08] space-y-2">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-bone-400 uppercase tracking-wider">
                        <Shield className="w-3 h-3 text-sage" />
                        <span>Human Verification Required</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExecuteAction(msg.id, msg.action!)}
                          className="flex-1 min-h-[56px] px-4 rounded-2xl bg-[#4E8752] hover:bg-[#437546] text-[#F7F6F2] font-bold text-xs flex items-center justify-center gap-2 m3-press shadow-surface transition-colors"
                        >
                          <Check className="w-5 h-5 stroke-[2.5]" />
                          <span>Approve & Apply</span>
                        </button>
                        <button
                          onClick={() => handleDismissAction(msg.id, msg.action!)}
                          className="min-h-[48px] px-4 rounded-2xl bg-bone-800 hover:bg-bone-700 text-bone-300 hover:text-bone-100 border border-white/10 font-semibold text-xs flex items-center justify-center gap-1.5 m3-press transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {isThinking && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-terracotta/10 border border-terracotta/25 text-terracotta text-xs font-mono animate-pulse w-fit max-w-[90%] shadow-surface">
              <span className="w-2 h-2 rounded-full bg-terracotta animate-ping shrink-0" />
              <span>Tracer is analyzing your history & pace with Gemini 3.6...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="pt-2 border-t border-white/[0.08] flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            onFocus={() => {
              setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 300);
            }}
            placeholder="Ask a question or request a schedule change..."
            className="flex-1 min-h-[48px] px-3.5 rounded-xl bg-bone-800 border border-white/10 text-bone-100 placeholder:text-bone-500 focus:outline-none focus:border-terracotta text-xs"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isThinking}
            className="min-h-[48px] min-w-[48px] rounded-xl bg-terracotta hover:bg-terracotta-hover text-white flex items-center justify-center m3-press disabled:opacity-40 transition-colors"
            aria-label="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </ModalSheet>
  );
};
