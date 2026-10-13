import React, { useState } from 'react';
import { ModalSheet } from '../common/ModalSheet';
import { useGoal } from '../../context/GoalContext';
import { Users, Share2, ShieldCheck, Lock, Copy, Check } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface TeamSheetProps {
  onClose: () => void;
}

export const TeamSheet: React.FC<TeamSheetProps> = ({ onClose }) => {
  const { activeGoal, shareFlightPlan, exportFlightPlanMarkdown } = useGoal();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    if (shareFlightPlan) {
      await shareFlightPlan();
    }
  };

  const handleCopy = async () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    if (exportFlightPlanMarkdown) {
      const md = await exportFlightPlanMarkdown();
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const milestones = activeGoal?.milestones || [];

  return (
    <ModalSheet
      onClose={onClose}
      title="Crew & Flight Plan"
      subtitle="Privacy-first collaboration"
      icon={Users}
    >
      <div className="space-y-4 py-2 select-none">
        {/* Privacy Sanctuary Notice */}
        <div className="bg-bone-900/90 border border-sage/30 rounded-xl p-3.5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-sage shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-bone-100">Zero-Knowledge Sanctuary</p>
            <p className="text-bone-400 mt-0.5 leading-relaxed">
              Only high-level milestones are shared. All personal notes, reflections, blockers, and micro-moves stay encrypted on your device.
            </p>
          </div>
        </div>

        {/* Milestones Sharing Payload List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-bone-400 uppercase tracking-wider px-1">
            <span>Milestones Payload</span>
            <span>Sanitization</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {milestones.map((m, idx) => (
              <div
                key={m.id}
                className="bg-bone-900/60 border border-white/[0.08] rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-bone-400">M{idx + 1}</span>
                    <h4 className="text-sm font-medium text-bone-100 truncate">{m.title}</h4>
                  </div>
                  <span className="text-[11px] text-bone-400">Due: {m.targetDate}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-terracotta/15 text-terracotta border border-terracotta/20">
                    Shared: {m.owner || 'You'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.06] text-bone-400 border border-white/10 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Sanctuary
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-bone-800 hover:bg-bone-700 text-bone-100 border border-white/10 flex items-center justify-center gap-2 text-xs font-semibold m3-press transition-colors focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
          >
            {copied ? <Check className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy Brief'}</span>
          </button>

          <button
            onClick={handleShare}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-terracotta hover:bg-terracotta-hover text-white font-semibold text-xs flex items-center justify-center gap-2 m3-press shadow-surface transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Sheet</span>
          </button>
        </div>
      </div>
    </ModalSheet>
  );
};
