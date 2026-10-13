import React from 'react';
import { useGoal } from '../../context/GoalContext';
import { Sliders, ChevronDown, Lock, ShieldCheck, Compass } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { useDeviceStatus } from '../../hooks/useDeviceStatus';
import { useVaultSecurity } from '../../hooks/useVaultSecurity';

interface TopStatusPillProps {
  onOpenRecovery?: () => void;
  onOpenReplan?: () => void;
  onOpenSettings?: () => void;
  onOpenAssistant?: () => void;
  onOpenGoalSwitcher?: () => void;
  onOpenTelemetry?: () => void;
  onOpenAuthModal?: (options?: { actionType?: 'unlock' | 'destructive' | 'setup'; title?: string }) => void;
}

export const TopStatusPill: React.FC<TopStatusPillProps> = ({
  onOpenRecovery,
  onOpenReplan,
  onOpenSettings,
  onOpenAssistant,
  onOpenGoalSwitcher,
  onOpenTelemetry,
  onOpenAuthModal,
}) => {
  const { activeGoal, cpmReport } = useGoal();
  const { isOnline } = useDeviceStatus();
  const { isShieldEnabled, isShielded } = useVaultSecurity();

  const isSlip = cpmReport && (cpmReport.status === 'critical_slip' || cpmReport.slippageDays > 0);

  return (
    <header className="w-full bg-obsidian-canvas/90 backdrop-blur-2xl border-b border-obsidian-border px-4 py-2 flex items-center justify-between flex-shrink-0 z-30 pt-safe select-none">
      {/* Left: Brand & Goal Selector (Unconstrained, Legible) */}
      <div className="flex items-center space-x-2.5 flex-1 min-w-0 mr-2">
        <button
          onClick={() => {
            soundManager.playTick();
            androidBridge.triggerHaptic('selection');
            if (onOpenGoalSwitcher) {
              onOpenGoalSwitcher();
            } else {
              onOpenSettings?.();
            }
          }}
          className="flex items-center space-x-2 text-left group min-h-[48px] min-w-0 max-w-full -my-1 m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none rounded-xl px-1.5"
          title="Switch Active Objective"
          aria-label="Switch Goal"
        >
          <div className="w-2 h-2 rounded-full bg-terracotta flex-shrink-0" />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[10px] font-mono font-bold tracking-widest text-bone-400 uppercase">
              TRACER
            </span>
            <div className="flex items-center space-x-1 min-w-0">
              <span className="text-xs font-semibold text-bone-100 truncate tracking-tight group-hover:text-white transition-colors">
                {activeGoal ? activeGoal.title : 'No Active Objective'}
              </span>
              <ChevronDown className="w-3 h-3 text-bone-400 group-hover:text-bone-100 transition-colors flex-shrink-0" />
            </div>
          </div>
        </button>
      </div>

      {/* Right: Telemetry & Settings (Strictly TWO 48dp Touch Targets) */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        {/* Target 1: Unified Status Capsule */}
        <button
          type="button"
          onClick={() => {
            soundManager.playTick();
            androidBridge.triggerHaptic('light');
            if (onOpenTelemetry) {
              onOpenTelemetry();
            } else if (isSlip) {
              if (onOpenReplan) {
                onOpenReplan();
              } else {
                onOpenRecovery?.();
              }
            } else {
              onOpenRecovery?.();
            }
          }}
          className={`min-h-[48px] px-3.5 py-2 rounded-full border flex items-center space-x-1.5 text-[11px] font-medium m3-press transition-all shadow-specular-subtle focus-visible:ring-2 focus-visible:outline-none ${
            !isOnline
              ? 'bg-amber/15 border-amber/30 text-amber focus-visible:ring-amber'
              : isSlip
              ? 'bg-rust/15 border-rust/30 text-rust focus-visible:ring-rust'
              : 'bg-sage/15 border-sage/30 text-sage focus-visible:ring-sage'
          }`}
          title={
            !isOnline
              ? 'Offline Flight Ready'
              : isShieldEnabled && isShielded
              ? 'Cryptographic Vault Shielded — Tap to Authenticate'
              : isSlip
              ? `Schedule is ${cpmReport?.slippageDays}d behind — tap to adjust`
              : 'Schedule on track — tap for recovery & metrics'
          }
          aria-label="Flight Status"
        >
          {!isOnline ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse shrink-0" />
              <span className="font-mono text-[10px] tracking-tight font-semibold">Offline</span>
            </>
          ) : isSlip ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rust animate-pulse shrink-0" />
              <span className="font-semibold">{cpmReport?.slippageDays}d Behind</span>
            </>
          ) : activeGoal ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
              <span className="font-semibold">On Track</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-bone-400 shrink-0" />
              <span className="text-bone-300">Ready</span>
            </>
          )}

          {/* Biometric Shield Icon inside Unified Pill */}
          {isShieldEnabled && (
            <span className="flex items-center pl-1 border-l border-current/25 shrink-0">
              {isShielded ? (
                <Lock className="w-3 h-3 text-terracotta animate-pulse" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-sage" />
              )}
            </span>
          )}
        </button>

        {/* Target 2: Dedicated 48x48dp AI Assistant Button */}
        <button
          type="button"
          onClick={() => {
            soundManager.playTick();
            androidBridge.triggerHaptic('light');
            onOpenAssistant?.();
          }}
          className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-bone-900/60 hover:bg-bone-800 border border-white/10 text-terracotta hover:text-terracotta/80 flex items-center justify-center transition-colors m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none shrink-0"
          title="AI Flight Assistant"
          aria-label="AI Flight Assistant"
        >
          <Compass className="w-4 h-4 text-terracotta" />
        </button>

        {/* Target 3: Dedicated 48x48dp Settings Button */}
        <button
          type="button"
          onClick={() => {
            soundManager.playTick();
            androidBridge.triggerHaptic('selection');
            onOpenSettings?.();
          }}
          className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-bone-900/60 hover:bg-bone-800 border border-white/10 text-bone-300 hover:text-bone-100 flex items-center justify-center transition-colors m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none shrink-0"
          title="App Settings & Objectives"
          aria-label="Settings"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
