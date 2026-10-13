import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface BatonHandoverBannerProps {
  notice: {
    unblockedTitle: string;
    assigneeName: string;
    count: number;
  };
  onDismiss: () => void;
}

export const BatonHandoverBanner: React.FC<BatonHandoverBannerProps> = ({
  notice,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      role="status"
      aria-live="polite"
      className="mx-4 mb-3 p-3.5 bg-charcoal-surface/95 border border-sage/40 rounded-2xl shadow-xl shadow-black/40 backdrop-blur-md flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-sage/15 border border-sage/30 flex items-center justify-center shrink-0 text-sage">
          <Zap className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sage font-semibold">
              Baton Handed
            </span>
            {notice.count > 1 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sage/20 text-sage">
                +{notice.count - 1} more
              </span>
            )}
          </div>
          <p className="text-xs text-bone-200 font-medium truncate mt-0.5">
            <span className="text-white font-semibold">"{notice.unblockedTitle}"</span> is now ready for{' '}
            <span className="text-sage font-semibold">{notice.assigneeName}</span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          soundManager.playTick();
          androidBridge.triggerHaptic('light');
          onDismiss();
        }}
        className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center text-bone-400 hover:text-white hover:bg-bone-800/60 m3-press transition-colors shrink-0"
        aria-label="Dismiss Baton Notice"
      >
        <X className="w-5 h-5" />
      </button>
    </motion.div>
  );
};
