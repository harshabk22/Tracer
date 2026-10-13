import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { useDeviceStatus } from '../../hooks/useDeviceStatus';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

export interface OfflineStatusBannerProps {
  className?: string;
  forceState?: 'offline' | 'restored' | null; // For testing and visual preview
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  className = '',
  forceState = null,
}) => {
  const { isOnline, vaultStats } = useDeviceStatus();
  const [showRestored, setShowRestored] = useState(false);
  const prevOnlineRef = useRef<boolean>(isOnline);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    // Detect reconnection edge (false -> true)
    if (!prevOnlineRef.current && isOnline) {
      soundManager.playCompleteChime();
      androidBridge.triggerHaptic('success');
      setShowRestored(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
    }

    prevOnlineRef.current = isOnline;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOnline]);

  const activeState = forceState !== null ? forceState : (!isOnline ? 'offline' : showRestored ? 'restored' : null);

  return (
    <div
      className={`absolute top-14 left-0 right-0 z-40 pointer-events-none flex justify-center px-4 ${className}`}
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {activeState === 'offline' && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="pointer-events-auto px-4 py-2 rounded-full bg-obsidian-surface/95 border border-amber/40 shadow-executive backdrop-blur-2xl flex items-center space-x-2 text-amber text-xs font-mono font-medium max-w-[94%] sm:max-w-md select-none"
            role="status"
          >
            <div className="w-2 h-2 rounded-full bg-amber animate-ping flex-shrink-0" />
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0 text-amber" />
            <span className="truncate">Offline Mode — Changes Queued Locally</span>
            {vaultStats && vaultStats.pendingSyncCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber/15 text-[10px] text-amber font-semibold border border-amber/30 flex-shrink-0">
                {vaultStats.pendingSyncCount} queued
              </span>
            )}
          </motion.div>
        )}

        {activeState === 'restored' && (
          <motion.div
            key="restored-banner"
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="pointer-events-auto px-4 py-2 rounded-full bg-obsidian-surface/95 border border-sage/40 shadow-executive backdrop-blur-2xl flex items-center space-x-2 text-sage text-xs font-mono font-medium max-w-[94%] sm:max-w-md select-none"
            role="status"
          >
            <div className="w-2 h-2 rounded-full bg-sage flex-shrink-0" />
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-sage" />
            <span className="truncate">Connection Restored — Vault Synced</span>
            {vaultStats && vaultStats.pendingSyncCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-sage/15 text-[10px] text-sage font-semibold border border-sage/30 flex-shrink-0 flex items-center space-x-1">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-sage" />
                <span>draining</span>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
