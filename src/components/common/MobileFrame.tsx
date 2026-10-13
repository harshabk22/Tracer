import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Compass } from 'lucide-react';
import { motion } from 'framer-motion';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface MobileFrameProps {
  children: React.ReactNode;
}

export type ViewportMode = 'workstation' | 'handheld';

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  // Gate dev preview and desktop workstation simulation strictly behind DEV mode & non-native
  const isDevPreview = import.meta.env.DEV && !androidBridge.isNative;

  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => {
    if (typeof window !== 'undefined' && isDevPreview) {
      const saved = localStorage.getItem('tracer_viewport_mode');
      if (saved === 'handheld' || saved === 'workstation') return saved;
    }
    return 'workstation';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && isDevPreview) {
      localStorage.setItem('tracer_viewport_mode', viewportMode);
    }
  }, [viewportMode, isDevPreview]);

  // Listen for ⌘\ keyboard shortcut to toggle viewport mode on desktop DEV only
  useEffect(() => {
    if (!isDevPreview) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        soundManager.playTick();
        androidBridge.triggerHaptic('selection');
        setViewportMode(prev => (prev === 'workstation' ? 'handheld' : 'workstation'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevPreview]);

  // Production or Native Android: Pure native edge-to-edge container without simulated chrome
  if (!isDevPreview) {
    return (
      <div className="w-full h-[100dvh] bg-[#090A0D] flex flex-col relative overflow-hidden select-none text-[#F6F5F2]">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {children}
        </div>
      </div>
    );
  }

  const isWorkstation = viewportMode === 'workstation';

  return (
    <div className="min-h-[100dvh] w-full bg-[#090A0D] flex flex-col items-center justify-center text-[#F6F5F2] overflow-x-hidden relative select-none">
      {/* Ambient background glow for desktop viewing */}
      <div 
        className="hidden md:block absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(217, 119, 54, 0.08), transparent 70%)',
        }}
      />

      {/* Desktop Top Command Bar Pill */}
      <div className="hidden md:flex items-center space-x-3 mb-2.5 z-20">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-obsidian-surface/90 border border-obsidian-border text-xs shadow-specular">
          <div className="flex items-center space-x-1.5 text-bone-400 font-mono text-[11px]">
            <Compass className="w-3.5 h-3.5 text-terracotta" />
            <span className="font-semibold text-bone-200">Tracer Android Flagship Cockpit</span>
          </div>

          <div className="h-3 w-px bg-obsidian-border mx-1" />

          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-obsidian-elevated border border-obsidian-border">
            <button
              onClick={() => {
                soundManager.playTick();
                androidBridge.triggerHaptic('selection');
                setViewportMode('workstation');
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                isWorkstation
                  ? 'bg-terracotta text-white shadow-sm'
                  : 'text-bone-400 hover:text-bone-200'
              }`}
              title="Expanded Executive Workstation"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Studio Workstation</span>
            </button>
            <button
              onClick={() => {
                soundManager.playTick();
                androidBridge.triggerHaptic('selection');
                setViewportMode('handheld');
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                !isWorkstation
                  ? 'bg-terracotta text-white shadow-sm'
                  : 'text-bone-400 hover:text-bone-200'
              }`}
              title="Google Pixel Android Flagship (412 × 915dp)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Pixel 8 Pro (412x915)</span>
            </button>
          </div>

          <span className="text-[10px] text-bone-400 font-mono hidden lg:inline pl-1">
            ⌘\
          </span>
        </div>
      </div>

      {/* Main Viewport Container */}
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className={`w-full h-[100dvh] bg-[#090A0D] flex flex-col relative overflow-hidden z-10 ${
          isWorkstation
            ? 'md:h-[93vh] md:max-h-[960px] md:max-w-4xl lg:max-w-5xl md:rounded-[32px] md:border md:border-white/[0.08] md:shadow-executive'
            : 'md:w-[412px] md:h-[915px] md:max-h-[915px] md:rounded-[36px] md:border md:border-white/[0.1] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)]'
        }`}
      >
        {/* Android Punch Hole Camera (Handheld Simulation Mode) */}
        {!isWorkstation && (
          <div className="w-3.5 h-3.5 rounded-full bg-black mx-auto mt-2 ring-1 ring-white/10 hidden md:block flex-shrink-0 z-30" />
        )}

        {/* Screen Content Root */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {children}
        </div>

        {/* Android Gesture Navigation Bar Pill (Handheld Simulation Mode) */}
        {!isWorkstation && (
          <div className="w-28 h-1 rounded-full bg-white/30 mx-auto my-2 hidden md:block flex-shrink-0 z-30" />
        )}
      </motion.div>
    </div>
  );
};
