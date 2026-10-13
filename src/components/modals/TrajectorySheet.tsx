import React, { useState } from 'react';
import { ModalSheet } from '../common/ModalSheet';
import { useGoal } from '../../context/GoalContext';
import { History, CheckCircle2, XCircle, Clock, Trash2, ShieldCheck } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { TrajectoryRecord } from '../../types/goal';
import { storage } from '../../services/storage';

interface TrajectorySheetProps {
  onClose: () => void;
}

export const TrajectorySheet: React.FC<TrajectorySheetProps> = ({ onClose }) => {
  const { trajectoryLedger } = useGoal();
  const [items, setItems] = useState<TrajectoryRecord[]>(() => trajectoryLedger || storage.getTrajectoryLedger());

  const handleApprove = (id: string) => {
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('success');
    const updated = items.map(item => item.id === id ? { ...item, status: 'approved' as const } : item);
    setItems(updated);
    storage.saveTrajectory(updated as any);
  };

  const handleReject = (id: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    const updated = items.map(item => item.id === id ? { ...item, status: 'rejected' as const } : item);
    setItems(updated);
    storage.saveTrajectory(updated as any);
  };

  const handleClear = () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    setItems([]);
    storage.saveTrajectory([]);
  };

  const getStatusBadge = (status?: TrajectoryRecord['status']) => {
    switch (status) {
      case 'applied':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sage/15 text-sage border border-sage/20">
            <CheckCircle2 className="w-2.5 h-2.5" /> Applied
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-terracotta/15 text-terracotta border border-terracotta/20">
            <CheckCircle2 className="w-2.5 h-2.5" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rust/15 text-rust border border-rust/20">
            <XCircle className="w-2.5 h-2.5" /> Rejected
          </span>
        );
      case 'proposed':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <Clock className="w-2.5 h-2.5" /> Proposed
          </span>
        );
    }
  };

  return (
    <ModalSheet
      onClose={onClose}
      title="Execution Trajectory"
      subtitle="Human-in-the-Loop Decision Ledger"
      icon={History}
    >
      <div className="space-y-4 py-2 select-none text-xs">
        {/* Sanctuary & Governance Header */}
        <div className="bg-bone-900/90 border border-sage/30 rounded-xl p-3 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-sage shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-bone-100">Zero Autonomous Drift</p>
            <p className="text-bone-400 mt-0.5 leading-relaxed">
              Every agent adjustment requires explicit human confirmation before mutating your goal roadmap.
            </p>
          </div>
        </div>

        {/* Ledger Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-bone-400 uppercase tracking-wider px-1">
            <span>Audit Trail ({items.length})</span>
            {items.length > 0 && (
              <button
                onClick={handleClear}
                className="text-rust hover:text-rust/80 flex items-center gap-1 text-[11px] font-medium min-h-[48px] px-2 m3-press focus-visible:outline-none"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Ledger
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-8 text-center text-bone-400 bg-bone-900/40 rounded-xl border border-white/[0.04]">
              <History className="w-8 h-8 mx-auto text-bone-500 mb-2 opacity-60" />
              <p className="text-xs">No autonomous trajectory events logged yet.</p>
              <p className="text-[11px] text-bone-500 mt-0.5">
                Suggested splits, date rebalances, and scope adjustments will appear here for your review.
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {items.map((item: TrajectoryRecord) => {
                const actionLabel = item.action || 'adjustment';
                const displayText = item.description || item.summary || item.details || '';
                const timeStr = typeof item.timestamp === 'number'
                  ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : item.timestamp;

                return (
                  <div
                    key={item.id}
                    className="bg-bone-900/70 border border-white/[0.08] rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-bone-200 capitalize">
                          {actionLabel.replace('_', ' ')}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <span className="text-[10px] text-bone-500 font-mono">
                        {timeStr}
                      </span>
                    </div>

                    {displayText && (
                      <p className="text-bone-300 text-[11px] leading-relaxed">
                        {displayText}
                      </p>
                    )}

                    {item.status === 'proposed' && (
                      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="flex-1 min-h-[48px] rounded-lg bg-sage/20 hover:bg-sage/30 text-sage font-semibold flex items-center justify-center gap-1.5 m3-press focus-visible:ring-2 focus-visible:ring-sage focus-visible:outline-none"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Apply
                        </button>
                        <button
                          onClick={() => handleReject(item.id)}
                          className="flex-1 min-h-[48px] rounded-lg bg-rust/20 hover:bg-rust/30 text-rust font-semibold flex items-center justify-center gap-1.5 m3-press focus-visible:ring-2 focus-visible:ring-rust focus-visible:outline-none"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
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
