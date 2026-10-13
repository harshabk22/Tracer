import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, CheckCircle, TrendingUp, Clock, Compass, Calendar } from 'lucide-react';
import { useGoal } from '../../context/GoalContext';
import { ModalSheet } from '../common/ModalSheet';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface FlightTelemetrySheetProps {
  onClose: () => void;
  onOpenRebalance?: () => void;
  onOpenAssistant?: () => void;
}

export const FlightTelemetrySheet: React.FC<FlightTelemetrySheetProps> = ({
  onClose,
  onOpenRebalance,
  onOpenAssistant,
}) => {
  const { activeGoal, cpmReport } = useGoal();

  const isSlip = cpmReport && (cpmReport.status === 'critical_slip' || cpmReport.slippageDays > 0);
  const statusLabel = !cpmReport
    ? 'Ready'
    : cpmReport.status === 'critical_slip'
    ? 'Critical Slip'
    : cpmReport.slippageDays > 0
    ? 'Moderate Slip'
    : 'On Track';

  const statusColor = !cpmReport || cpmReport.status === 'on_track'
    ? 'text-sage bg-sage/15 border-sage/30'
    : cpmReport.status === 'critical_slip'
    ? 'text-rust bg-rust/15 border-rust/30'
    : 'text-amber bg-amber/15 border-amber/30';

  const criticalMilestones = (activeGoal?.milestones || []).filter(
    m => m.isCriticalPath || (cpmReport?.criticalPathMilestoneIds || []).includes(m.id)
  );

  return (
    <ModalSheet
      onClose={onClose}
      title="Flight Telemetry & Health"
      subtitle="Predictive schedule physics & critical path analysis"
      icon={Activity}
      iconBgColor="bg-terracotta/15 text-terracotta border border-terracotta/30"
      maxWidth="max-w-md"
      maxHeight="max-h-[88vh]"
      footer={
        <div className="space-y-2">
          {isSlip && onOpenRebalance && (
            <button
              type="button"
              onClick={() => {
                soundManager.playTick();
                androidBridge.triggerHaptic('medium');
                onClose();
                onOpenRebalance();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-amber/20 hover:bg-amber/30 text-amber border border-amber/40 font-semibold text-xs flex items-center justify-center gap-2 m3-press transition-colors"
            >
              <span>⚡ Open Schedule Rebalance</span>
            </button>
          )}

          {onOpenAssistant && (
            <button
              type="button"
              onClick={() => {
                soundManager.playTick();
                androidBridge.triggerHaptic('light');
                onClose();
                onOpenAssistant();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-bone-800 hover:bg-bone-700 text-bone-200 border border-white/10 font-semibold text-xs flex items-center justify-center gap-2 m3-press transition-colors"
            >
              <Compass className="w-4 h-4 text-terracotta" />
              <span>Consult AI Flight Co-Pilot</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 py-1 select-none">
        {/* Status Capsule Card */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] shadow-surface space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-wider text-bone-400 uppercase">
              Schedule Health
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusColor}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span>{statusLabel}</span>
            </span>
          </div>

          <p className="text-xs text-bone-300 leading-relaxed">
            {cpmReport?.impactDescription || 'All milestones and deliverables are within the planned float envelope. Momentum is compounding.'}
          </p>
        </div>

        {/* 3 Physics Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Velocity Factor */}
          <div className="p-3 rounded-2xl bg-bone-900/70 border border-white/[0.08] text-center">
            <TrendingUp className="w-4 h-4 text-terracotta mx-auto mb-1.5" />
            <span className="text-[10px] font-mono uppercase text-bone-400 block font-semibold">
              Velocity (Vf)
            </span>
            <span className="text-base font-bold font-mono text-bone-100 mt-0.5 block">
              {(activeGoal?.velocityFactor || 1.0).toFixed(1)}x
            </span>
          </div>

          {/* Float Days */}
          <div className="p-3 rounded-2xl bg-bone-900/70 border border-white/[0.08] text-center">
            <Clock className="w-4 h-4 text-sage mx-auto mb-1.5" />
            <span className="text-[10px] font-mono uppercase text-bone-400 block font-semibold">
              Buffer Float
            </span>
            <span className="text-base font-bold font-mono text-bone-100 mt-0.5 block">
              +{cpmReport?.remainingFloatDays ?? activeGoal?.totalFloatBufferDays ?? 0}d
            </span>
          </div>

          {/* Critical Milestones */}
          <div className="p-3 rounded-2xl bg-bone-900/70 border border-white/[0.08] text-center">
            <AlertTriangle className="w-4 h-4 text-amber mx-auto mb-1.5" />
            <span className="text-[10px] font-mono uppercase text-bone-400 block font-semibold">
              Critical Path
            </span>
            <span className="text-base font-bold font-mono text-bone-100 mt-0.5 block">
              {criticalMilestones.length}
            </span>
          </div>
        </div>

        {/* Critical Path Milestones List */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] shadow-surface space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-bone-200">Critical Path Sequence</h4>
            <span className="text-[10px] font-mono text-bone-400">Zero-Float Milestones</span>
          </div>

          {criticalMilestones.length === 0 ? (
            <p className="text-xs text-bone-400 italic py-1">
              No milestones currently bottlenecking the completion deadline.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              {criticalMilestones.map((m) => {
                const isDone = m.status === 'completed';
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-bone-800/60 border border-white/[0.06] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      {isDone ? (
                        <CheckCircle className="w-4 h-4 text-sage shrink-0" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-amber shrink-0" />
                      )}
                      <span className={`truncate font-medium ${isDone ? 'line-through text-bone-400' : 'text-bone-100'}`}>
                        {m.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-bone-400 shrink-0">
                      <Calendar className="w-3 h-3 text-bone-500" />
                      <span>{m.targetDate}</span>
                    </div>
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
