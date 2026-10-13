import React, { useState } from 'react';
import { SprintMilestone, MicroMove, TeamMember } from '../../types/goal';
import { ModalSheet } from '../common/ModalSheet';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { Calendar, User, Clock, CheckCircle2, Layers } from 'lucide-react';

interface MilestoneDetailSheetProps {
  milestone: SprintMilestone;
  microMoves: MicroMove[];
  teamMembers: TeamMember[];
  onClose: () => void;
  onUpdateMilestone: (updated: SprintMilestone) => void;
}

export const MilestoneDetailSheet: React.FC<MilestoneDetailSheetProps> = ({
  milestone,
  microMoves,
  teamMembers,
  onClose,
  onUpdateMilestone,
}) => {
  // Normalize owner: map 'You' or 'You (Goal Owner)' to 'You (Owner)'
  const normalizeOwner = (owner?: string) => {
    if (!owner || owner === 'You' || owner === 'You (Goal Owner)' || owner === 'You (Owner)') {
      return 'You (Owner)';
    }
    return owner;
  };

  const [targetDate, setTargetDate] = useState(milestone.targetDate);
  const [currentOwner, setCurrentOwner] = useState(() => normalizeOwner(milestone.owner));

  // Available crew options: Deduplicate 'You' and 'You (Goal Owner)' into a single 'You (Owner)' option
  const crewOptions = Array.from(
    new Set([
      'You (Owner)',
      ...teamMembers
        .filter(m => !m.isCurrentUser && m.name !== 'You' && m.name !== 'You (Goal Owner)' && m.name !== 'You (Owner)')
        .map(m => m.name)
    ])
  );

  const handleAdjustDays = (deltaDays: number) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    const d = new Date(targetDate.includes('T') ? targetDate : `${targetDate}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    const nextDate = d.toISOString().split('T')[0];
    setTargetDate(nextDate);
    onUpdateMilestone({ ...milestone, targetDate: nextDate });
  };

  const handleDateChange = (newDate: string) => {
    setTargetDate(newDate);
    if (newDate) {
      soundManager.playTick();
      androidBridge.triggerHaptic('light');
      onUpdateMilestone({ ...milestone, targetDate: newDate });
    }
  };

  const handleOwnerChange = (newOwner: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    setCurrentOwner(newOwner);
    onUpdateMilestone({ ...milestone, owner: newOwner });
  };

  const movesForMilestone = microMoves.filter(m => m.milestoneId === milestone.id);
  const completedCount = movesForMilestone.filter(m => m.status === 'completed').length;

  return (
    <ModalSheet
      onClose={onClose}
      title={milestone.title}
      subtitle={`Phase ${milestone.order} • ${milestone.bufferFloatDays ?? 0}d buffer`}
      icon={Layers}
      iconBgColor="bg-terracotta/15 text-terracotta border border-terracotta/30"
      maxHeight="max-h-[85vh]"
    >
      <div className="space-y-4 py-2 select-none text-xs">
        {/* Milestone Description */}
        {milestone.description && (
          <div className="p-3.5 rounded-2xl bg-bone-900/80 border border-white/[0.08] text-bone-200 leading-relaxed">
            {milestone.description}
          </div>
        )}

        {/* Target Date Section */}
        <div className="p-3.5 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-2.5 shadow-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-bone-100">
              <Calendar className="w-3.5 h-3.5 text-terracotta" />
              <span>Target Delivery Date</span>
            </div>
            <input
              type="date"
              value={targetDate}
              onChange={e => handleDateChange(e.target.value)}
              className="min-h-[48px] px-3 rounded-xl bg-bone-800 border border-white/10 text-bone-100 font-mono text-xs focus:outline-none focus:border-terracotta"
              aria-label="Edit Milestone Target Date"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAdjustDays(1)}
              className="flex-1 min-h-[48px] rounded-xl bg-bone-800/80 hover:bg-bone-700/80 border border-white/[0.06] text-bone-300 font-medium text-xs flex items-center justify-center m3-press"
            >
              +1 Day
            </button>
            <button
              type="button"
              onClick={() => handleAdjustDays(3)}
              className="flex-1 min-h-[48px] rounded-xl bg-bone-800/80 hover:bg-bone-700/80 border border-white/[0.06] text-bone-300 font-medium text-xs flex items-center justify-center m3-press"
            >
              +3 Days
            </button>
            <button
              type="button"
              onClick={() => handleAdjustDays(7)}
              className="flex-1 min-h-[48px] rounded-xl bg-bone-800/80 hover:bg-bone-700/80 border border-white/[0.06] text-bone-300 font-medium text-xs flex items-center justify-center m3-press"
            >
              +1 Week
            </button>
          </div>
        </div>

        {/* 1-Tap Owner Handover */}
        <div className="p-3.5 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-2.5 shadow-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-bone-100">
              <User className="w-3.5 h-3.5 text-amber" />
              <span>Milestone Owner</span>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/30 font-semibold">
              Current: {currentOwner}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {crewOptions.map(name => {
              const isSelected = currentOwner === name;
              return (
                <button
                  type="button"
                  key={name}
                  onClick={() => handleOwnerChange(name)}
                  className={`min-h-[48px] px-3.5 rounded-xl text-xs font-medium border m3-press transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber/20 text-amber border-amber/40 font-semibold shadow-sm'
                      : 'bg-bone-800 text-bone-300 border-white/10 hover:bg-bone-700'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>{name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Linked Micro-Moves */}
        <div className="p-3.5 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-2 shadow-surface">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-bone-100">Associated Deliverables</span>
            <span className="text-[11px] font-mono text-bone-400">
              {completedCount}/{movesForMilestone.length} Done
            </span>
          </div>

          {movesForMilestone.length === 0 ? (
            <p className="text-xs text-bone-500 italic py-1">No micro-moves assigned to this phase.</p>
          ) : (
            <div className="space-y-1.5 pt-1">
              {movesForMilestone.map(m => {
                const isMoveDone = m.status === 'completed';
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-bone-800/60 border border-white/[0.06] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      {isMoveDone ? (
                        <CheckCircle2 className="w-4 h-4 text-sage shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-bone-400 shrink-0" />
                      )}
                      <span className={`truncate ${isMoveDone ? 'line-through text-bone-400' : 'text-bone-200'}`}>
                        {m.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-bone-400 shrink-0">{m.estimatedMinutes}m</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalSheet>
  );
};
