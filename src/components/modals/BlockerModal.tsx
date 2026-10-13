import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MicroMove, BlockerTaxonomy } from '../../types/goal';
import { getRecoverySuggestion } from '../../services/aiEngine';
import { ModalSheet } from '../common/ModalSheet';
import {
  AlertOctagon,
  Clock,
  BookOpen,
  BatteryLow,
  Share2,
  ArrowRight,
  ArrowUpRight,
  GitFork,
} from 'lucide-react';
import { soundManager } from '../../services/sound';

interface BlockerModalProps {
  move: MicroMove;
  onClose: () => void;
  onLogBlocker: (moveId: string, taxonomy: BlockerTaxonomy, details: string) => void;
  onOpenRecovery?: () => void;
}

export const BlockerModal: React.FC<BlockerModalProps> = ({ move, onClose, onLogBlocker, onOpenRecovery }) => {
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<BlockerTaxonomy>('Time Crunch');
  const [details, setDetails] = useState<string>('');

  const taxonomies: {
    id: BlockerTaxonomy;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    desc: string;
  }[] = [
    {
      id: 'Time Crunch',
      label: 'Time Crunch',
      icon: Clock,
      color: 'text-amber bg-amber-900/20 border-amber/40',
      desc: 'Calendar overloaded or unexpected urgent interruptions.',
    },
    {
      id: 'Skill Gap',
      label: 'Skill Gap',
      icon: BookOpen,
      color: 'text-terracotta bg-terracotta-900/20 border-terracotta/40',
      desc: 'Uncertain how to start, unfamiliar tools or domain.',
    },
    {
      id: 'Energy Depletion',
      label: 'Energy Depletion',
      icon: BatteryLow,
      color: 'text-bone-300 bg-obsidian-highlight border-obsidian-border',
      desc: 'Cognitive fatigue, low willpower, high resistance.',
    },
    {
      id: 'External Dependency',
      label: 'External Dependency',
      icon: Share2,
      color: 'text-rust bg-rust/20 border-rust/40',
      desc: 'Blocked waiting on API key, team review, or partner.',
    },
  ];

  const currentRecovery = getRecoverySuggestion(selectedTaxonomy, move.title);

  const handleLogAndRebalance = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playBlockerThud();
    onLogBlocker(move.id, selectedTaxonomy, details || `Stuck due to ${selectedTaxonomy}`);
    onClose();
    if (onOpenRecovery) {
      onOpenRecovery();
    }
  };

  const handleLogOnly = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playBlockerThud();
    onLogBlocker(move.id, selectedTaxonomy, details || `Stuck due to ${selectedTaxonomy}`);
    onClose();
  };

  return (
    <ModalSheet
      onClose={onClose}
      title="Log Obstacle"
      subtitle="Select the primary friction to adapt schedule"
      icon={AlertOctagon}
      iconBgColor="bg-rust/15 text-rust border border-rust/30"
      maxWidth="max-w-md"
    >
      {/* Task Title preview */}
      <div className="p-3.5 rounded-xl bg-obsidian-elevated border border-obsidian-border text-xs shadow-specular-subtle">
          <span className="text-bone-400 block text-[10px] uppercase tracking-widest font-semibold">
            Affected Move:
          </span>
          <p className="font-medium text-bone-100 truncate mt-0.5">{move.title}</p>
        </div>

        <form onSubmit={handleLogAndRebalance} className="space-y-4">
          {/* 4 Taxonomy Options */}
          <div className="grid grid-cols-2 gap-2">
            {taxonomies.map(item => {
              const Icon = item.icon;
              const isSelected = selectedTaxonomy === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    soundManager.playTick();
                    setSelectedTaxonomy(item.id);
                  }}
                  className={`min-h-[64px] p-3 rounded-xl border text-left flex flex-col space-y-1 transition-all m3-press shadow-specular-subtle ${
                    isSelected
                      ? `${item.color} ring-1 ring-white/20`
                      : 'bg-obsidian-elevated border-obsidian-border text-bone-400 hover:text-bone-100'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-bone-400 line-clamp-2 leading-tight">
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Recovery Suggestion Box */}
          <div className="p-3.5 rounded-xl bg-obsidian-elevated border border-obsidian-border flex flex-col space-y-1 shadow-specular-subtle">
            <div className="flex items-center space-x-1 text-terracotta text-xs font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Recommended Strategy:</span>
            </div>
            <p className="text-[11px] text-bone-200 leading-relaxed">
              {currentRecovery.suggestion}
            </p>
          </div>

          {/* Optional Details Input */}
          <div>
            <label className="text-[11px] font-semibold text-bone-300 block mb-1">
              Notes (Stored locally):
            </label>
            <input
              type="text"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="e.g. Encountered unexpected dependency issue..."
              aria-label="Obstacle Notes"
              className="w-full rounded-xl bg-obsidian-elevated border border-obsidian-border p-2.5 text-xs text-bone-100 placeholder-bone-500 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/40 transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleLogAndRebalance}
              className="w-full min-h-[48px] rounded-xl bg-terracotta hover:bg-terracotta/90 text-white text-xs font-semibold shadow-md transition-all m3-press flex items-center justify-center space-x-2 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
            >
              <GitFork className="w-4 h-4 text-white" />
              <span>Log Obstacle & Rebalance Timeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleLogOnly}
              className="w-full min-h-[48px] rounded-xl bg-obsidian-elevated hover:bg-obsidian-highlight text-bone-200 hover:text-bone-100 text-xs font-medium border border-obsidian-border transition-all m3-press flex items-center justify-center space-x-1.5 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-amber" />
              <span>Log Obstacle Only</span>
            </motion.button>
          </div>
        </form>
    </ModalSheet>
  );
};
