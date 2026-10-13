import React from 'react';
import { Target, Plus, Check, Clock, Calendar, ChevronRight } from 'lucide-react';
import { useGoal } from '../../context/GoalContext';
import { ModalSheet } from '../common/ModalSheet';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface GoalSwitcherSheetProps {
  onClose: () => void;
  onOpenNewObjective?: () => void;
}

export const GoalSwitcherSheet: React.FC<GoalSwitcherSheetProps> = ({
  onClose,
  onOpenNewObjective,
}) => {
  const { goals, activeGoal, setActiveGoalId, setActiveTab } = useGoal();

  const handleSelectGoal = (id: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    setActiveGoalId(id);
    onClose();
  };

  const handleCreateNew = () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    onClose();
    if (onOpenNewObjective) {
      onOpenNewObjective();
    } else {
      setActiveTab('intake');
    }
  };

  return (
    <ModalSheet
      onClose={onClose}
      title="Switch Objective"
      subtitle="Select active mission flight plan"
      icon={Target}
      iconBgColor="bg-terracotta/15 text-terracotta border border-terracotta/30"
      maxWidth="max-w-md"
      maxHeight="max-h-[85vh]"
      footer={
        <button
          type="button"
          onClick={handleCreateNew}
          className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-terracotta hover:bg-terracotta/90 text-white font-semibold text-xs flex items-center justify-center gap-2 m3-press shadow-surface transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Create New Objective</span>
        </button>
      }
    >
      <div className="space-y-3 py-1 select-none">
        {goals.length === 0 ? (
          <div className="p-6 rounded-2xl bg-bone-900/60 border border-white/[0.08] text-center space-y-2">
            <Target className="w-8 h-8 text-terracotta/60 mx-auto" />
            <p className="text-sm font-semibold text-bone-200">No Objectives Found</p>
            <p className="text-xs text-bone-400">
              Create your first flight plan to start tracking autonomous milestones and micro-moves.
            </p>
          </div>
        ) : (
          goals.map((goal) => {
            const isActive = activeGoal?.id === goal.id;
            const moves = goal.microMoves || [];
            const totalMoves = moves.length;
            const completedMoves = moves.filter((m) => m.status === 'completed').length;
            const progressPct = totalMoves > 0 ? Math.round((completedMoves / totalMoves) * 100) : 0;
            const targetDate = goal.vision?.targetDate || 'Flexible';

            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => handleSelectGoal(goal.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all m3-press flex items-start justify-between gap-3 min-h-[56px] ${
                  isActive
                    ? 'bg-terracotta/10 border-terracotta/40 shadow-sm'
                    : 'bg-bone-900/80 hover:bg-bone-800/80 border-white/[0.08] hover:border-white/15'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-terracotta text-white'
                          : 'bg-white/[0.06] text-bone-400 border border-white/[0.08]'
                      }`}
                    >
                      {goal.category}
                    </span>
                    <span className="text-[10px] font-mono text-bone-400">
                      {goal.currentLevel}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-bone-100 leading-snug truncate">
                    {goal.title}
                  </h4>

                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-bone-400">
                    <span className="flex items-center gap-1 text-sage font-medium">
                      <Clock className="w-3 h-3" />
                      <span>{progressPct}% done</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{targetDate}</span>
                    </span>
                    <span>•</span>
                    <span>{totalMoves} tasks</span>
                  </div>
                </div>

                <div className="flex items-center self-center shrink-0">
                  {isActive ? (
                    <div className="w-7 h-7 rounded-full bg-terracotta text-white flex items-center justify-center shadow-sm">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-bone-500">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </ModalSheet>
  );
};
