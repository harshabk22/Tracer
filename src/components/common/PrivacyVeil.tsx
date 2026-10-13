import React from 'react';
import { motion } from 'framer-motion';
import { Lock, KeyRound, Shield } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface PrivacyVeilProps {
  isShielded: boolean;
  onUnlockRequest: () => void;
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export const PrivacyVeil: React.FC<PrivacyVeilProps> = ({
  isShielded,
  onUnlockRequest,
  children,
  label = 'Private Executive Reflection',
  className = '',
}) => {
  if (!isShielded) {
    return <>{children}</>;
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {/* Content blurred underneath */}
      <div className="filter blur-[6px] select-none opacity-30 pointer-events-none transition-all">
        {children}
      </div>

      {/* Frosted Glass Veil Overlay */}
      <motion.button
        type="button"
        onClick={() => {
          soundManager.playTick();
          androidBridge.triggerHaptic('light');
          onUnlockRequest();
        }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="absolute inset-0 z-10 w-full h-full backdrop-blur-md bg-obsidian-canvas/75 border border-white/10 rounded-xl flex items-center justify-center p-2 text-left m3-press group cursor-pointer"
        title="Encrypted Note — Click to Unshield"
      >
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-obsidian-elevated/90 border border-white/10 text-bone-300 group-hover:text-bone-100 group-hover:border-white/20 transition-all shadow-specular-subtle">
          <Lock className="w-3 h-3 text-bone-300 group-hover:text-white transition-colors" />
          <span className="text-[11px] font-medium tracking-tight text-bone-300 group-hover:text-bone-100">
            {label}
          </span>
          <span className="text-[10px] font-mono text-bone-400 bg-white/[0.06] px-1.5 py-0.5 rounded-md border border-white/10">
            Tap to Unshield
          </span>
        </div>
      </motion.button>
    </div>
  );
};
