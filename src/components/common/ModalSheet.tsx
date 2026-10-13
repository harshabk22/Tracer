import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, PanInfo } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { useModalDismiss } from '../../hooks/useModalDismiss';

export interface ModalSheetProps {
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  iconColor?: string;
  children: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-md', 'max-w-xl'
  maxHeight?: string; // e.g. 'max-h-[90vh]'
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  showDragHandle?: boolean;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

export const ModalSheet: React.FC<ModalSheetProps> = ({
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-obsidian-elevated border border-obsidian-border text-terracotta',
  children,
  maxWidth = 'max-w-md',
  maxHeight = 'max-h-[90vh]',
  headerRight,
  footer,
  showDragHandle = true,
  className = '',
}) => {
  // Global dismiss hook (Esc key & popstate)
  useModalDismiss(true, onClose);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus trap lifecycle & capturing-phase keyboard containment
  useEffect(() => {
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    // Function to reliably focus the initial element
    const focusInitialTarget = () => {
      if (!dialogRef.current) return;
      const autoFocusEl = dialogRef.current.querySelector<HTMLElement>('[autofocus]');
      if (autoFocusEl && typeof autoFocusEl.focus === 'function') {
        autoFocusEl.focus();
        return;
      }
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.current.focus();
      }
    };

    // Immediate attempt + requestAnimationFrame + small fallback timer
    focusInitialTarget();
    const rafId = requestAnimationFrame(focusInitialTarget);
    const timer = setTimeout(focusInitialTarget, 30);

    // Impenetrable focus trap: capture phase listener on window intercepts Tab before default routing
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (!dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

      if (focusableElements.length === 0) {
        e.preventDefault();
        e.stopPropagation();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        // Shift + Tab: Wrap from first to last, or bring back inside if outside
        if (activeEl === firstElement || !dialogRef.current.contains(activeEl)) {
          e.preventDefault();
          e.stopPropagation();
          lastElement.focus();
        }
      } else {
        // Tab: Wrap from last to first, or bring back inside if outside
        if (activeEl === lastElement || !dialogRef.current.contains(activeEl)) {
          e.preventDefault();
          e.stopPropagation();
          firstElement.focus();
        }
      }
    };

    // Note: useCapture = true ensures keydown is trapped before any default or bubbling action
    window.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  const [dragProgress, setDragProgress] = useState(0);
  const hapticTriggeredRef = useRef(false);

  const handleDrag = (_: any, info: PanInfo) => {
    if (info.offset.y > 0) {
      const progress = Math.min(1, info.offset.y / 100);
      setDragProgress(progress);

      // Subtle tactile tick when crossing 85% dismiss threshold
      if (progress >= 0.85 && !hapticTriggeredRef.current) {
        hapticTriggeredRef.current = true;
        androidBridge.triggerHaptic('selection');
      } else if (progress < 0.85) {
        hapticTriggeredRef.current = false;
      }
    } else {
      setDragProgress(0);
      hapticTriggeredRef.current = false;
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    setDragProgress(0);
    hapticTriggeredRef.current = false;
    // Dismiss if dragged down sufficiently or with downward velocity
    if (info.offset.y > 80 || info.velocity.y > 400) {
      soundManager.playTick();
      androidBridge.triggerHaptic('light');
      onClose();
    }
  };

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={() => {
        soundManager.playTick();
        androidBridge.triggerHaptic('light');
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 select-none"
    >
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 36 }}
        transition={{ type: 'spring', damping: 32, stiffness: 400, mass: 0.8 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.55 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={e => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-obsidian-surface border border-obsidian-border rounded-t-[28px] sm:rounded-[28px] shadow-executive flex flex-col ${maxHeight} overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50 transform-gpu will-change-[transform,opacity] [backface-visibility:hidden] ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Subtle Predictive Back Edge Affordance Pill */}
        {dragProgress > 0.15 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -4 }}
            animate={{
              opacity: Math.min(1, dragProgress * 1.2),
              scale: 0.9 + dragProgress * 0.1,
              y: 0,
            }}
            exit={{ opacity: 0 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-obsidian-elevated/95 border border-terracotta/40 text-[10px] font-mono font-medium text-terracotta shadow-specular pointer-events-none flex items-center space-x-1 z-30 sm:hidden"
          >
            <ChevronDown className="w-3 h-3 animate-bounce" />
            <span>{dragProgress >= 0.85 ? 'Release to dismiss' : 'Swipe down to close'}</span>
          </motion.div>
        )}

        {/* Pinned Top Header */}
        <div className="p-5 pb-3 border-b border-obsidian-borderSubtle bg-obsidian-surface flex-shrink-0 z-10">
          {/* Material 3 Drag Handle Pill with Predictive Feedback */}
          {showDragHandle && (
            <div className="flex justify-center mt-1 mb-3 sm:hidden">
              <motion.div
                animate={{
                  width: dragProgress >= 0.85 ? 56 : dragProgress > 0.15 ? 36 + Math.round(dragProgress * 20) : 36,
                  backgroundColor:
                    dragProgress >= 0.85
                      ? 'rgba(217, 119, 54, 0.85)'
                      : dragProgress > 0.15
                      ? 'rgba(217, 119, 54, 0.5)'
                      : 'rgba(255, 255, 255, 0.28)',
                }}
                transition={{ duration: 0.1 }}
                className="h-1.5 rounded-full cursor-grab active:cursor-grabbing"
              />
            </div>
          )}

          {(title || Icon || headerRight) && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                {Icon && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBgColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {typeof title === 'string' ? (
                    <h3 className="text-sm font-semibold text-bone-100 truncate">{title}</h3>
                  ) : (
                    title
                  )}
                  {subtitle &&
                    (typeof subtitle === 'string' ? (
                      <p className="text-[11px] text-bone-400 truncate mt-0.5">{subtitle}</p>
                    ) : (
                      subtitle
                    ))}
                </div>
              </div>

              <div className="flex items-center space-x-1.5 flex-shrink-0">
                {headerRight}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTick();
                    androidBridge.triggerHaptic('light');
                    onClose();
                  }}
                  aria-label="Close modal"
                  className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full text-bone-400 hover:text-bone-100 hover:bg-obsidian-elevated active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Dedicated Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar p-5 pb-[max(env(safe-area-inset-bottom),20px)] space-y-4">
          {children}
        </div>

        {/* Pinned Bottom Footer */}
        {footer && (
          <div className="p-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] border-t border-obsidian-borderSubtle bg-obsidian-surface flex-shrink-0 z-10">
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
