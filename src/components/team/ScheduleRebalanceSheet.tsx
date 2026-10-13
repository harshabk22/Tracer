import React, { useState } from 'react';
import { ModalSheet } from '../common/ModalSheet';
import { ParallelRebalanceProposal, ParallelRebalanceFork } from '../../types/goal';
import { Sparkles, Shield, Split, Scissors, Check, ArrowRight } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface ScheduleRebalanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  proposals: ParallelRebalanceProposal[];
  onApply: (proposal: ParallelRebalanceProposal) => void;
}

export const ScheduleRebalanceSheet: React.FC<ScheduleRebalanceSheetProps> = ({
  isOpen,
  onClose,
  proposals,
  onApply,
}) => {
  const [selectedFork, setSelectedFork] = useState<ParallelRebalanceFork>(
    proposals[0]?.fork || 'absorb_float'
  );

  if (!isOpen) return null;

  const currentProposal = proposals.find((p) => p.fork === selectedFork) || proposals[0];

  const handleSelectFork = (fork: ParallelRebalanceFork) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    setSelectedFork(fork);
  };

  const handleApply = () => {
    if (!currentProposal) return;
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('success');
    onApply(currentProposal);
    onClose();
  };

  const getForkIcon = (fork: ParallelRebalanceFork) => {
    switch (fork) {
      case 'absorb_float':
        return Shield;
      case 'parallel_split':
        return Split;
      case 'prune_scope':
        return Scissors;
      default:
        return Sparkles;
    }
  };

  return (
    <ModalSheet
      onClose={onClose}
      title="AI Schedule Rebalance"
      subtitle="Autonomous 3-fork capacity & dependency optimizer"
      icon={Sparkles}
      iconBgColor="bg-terracotta/20 border border-terracotta/40 text-terracotta"
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-4 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        {/* Fork Selector Tabs (3 Options) */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-charcoal-canvas rounded-2xl border border-white/[0.06]">
          {proposals.map((prop) => {
            const isSelected = selectedFork === prop.fork;
            const Icon = getForkIcon(prop.fork);

            return (
              <button
                key={prop.id}
                type="button"
                onClick={() => handleSelectFork(prop.fork)}
                aria-pressed={isSelected}
                className={`min-h-[48px] py-2 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all m3-press ${
                  isSelected
                    ? 'bg-terracotta text-white shadow-md shadow-terracotta/30 font-semibold'
                    : 'text-bone-400 hover:text-bone-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[11px] leading-tight text-center truncate max-w-full">
                  {prop.title.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Proposal Deep Dive Card */}
        {currentProposal && (
          <div className="bg-charcoal-surface border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-base font-bold text-bone-100 tracking-tight">
                {currentProposal.title}
              </h3>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-terracotta/20 text-terracotta border border-terracotta/40">
                {currentProposal.badge}
              </span>
            </div>

            <p className="text-xs text-bone-300 leading-relaxed">
              {currentProposal.description}
            </p>

            {/* Impact Diff Preview */}
            <div className="bg-charcoal-canvas border border-white/[0.04] rounded-xl p-3 flex flex-col gap-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-bone-400">
                {currentProposal.diffPreview.metric}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-bone-500 line-through">
                  {currentProposal.diffPreview.before}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-terracotta shrink-0" />
                <span className="text-sage font-semibold">
                  {currentProposal.diffPreview.after}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-bone-400 italic">
              💡 {currentProposal.impactSummary}
            </div>
          </div>
        )}

        {/* 1-Tap Action Commit Button (Strict 48dp Minimum Touch Target) */}
        <button
          type="button"
          onClick={handleApply}
          className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-terracotta hover:bg-terracotta-hover active:bg-terracotta/90 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-terracotta/30 m3-press transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>Apply Rebalance</span>
        </button>
      </div>
    </ModalSheet>
  );
};
