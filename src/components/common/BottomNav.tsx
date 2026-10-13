import React from 'react';
import { useGoal, AppTab } from '../../context/GoalContext';
import { Crosshair, TrendingUp, Users } from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, activeGoal } = useGoal();

  // Count active microMoves for today
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const pendingMovesCount =
    activeGoal?.microMoves?.filter(
      m => m.status === 'todo' && !m.isPruned && m.dateScheduled <= todayStr
    ).length || 0;

  const tabs: {
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    {
      id: 'focus',
      label: 'Focus',
      icon: Crosshair,
      badge: pendingMovesCount > 0 ? pendingMovesCount : undefined,
    },
    {
      id: 'roadmap',
      label: 'Roadmap',
      icon: TrendingUp,
    },
    {
      id: 'team',
      label: 'Team',
      icon: Users,
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main Navigation"
      className="w-full bg-[#090A0D]/95 backdrop-blur-2xl border-t border-white/[0.08] px-4 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] flex items-center justify-around z-30 flex-shrink-0 shadow-dock select-none"
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => {
              soundManager.playTick();
              androidBridge.triggerHaptic('tabSwitch');
              setActiveTab(tab.id);
            }}
            aria-label={tab.label}
            aria-selected={isActive}
            className={`relative flex-1 min-h-[56px] min-w-[56px] max-w-[140px] flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all duration-150 m3-press group focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none ${
              isActive ? 'text-bone-100' : 'text-bone-400 hover:text-bone-200'
            }`}
          >
            {/* Material 3 Active Indicator Pill */}
            <div className="relative flex items-center justify-center">
              <div
                className={`h-8 w-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isActive ? 'bg-terracotta/20 text-terracotta' : 'text-bone-400 group-hover:text-bone-200'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />
              </div>

              {tab.badge !== undefined && (
                <span className="absolute -top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta text-[10px] font-mono font-bold text-white flex items-center justify-center ring-2 ring-[#090A0D] shadow-sm">
                  {tab.badge}
                </span>
              )}
            </div>

            <span
              className={`text-[11px] tracking-tight mt-1 transition-colors ${
                isActive ? 'font-semibold text-bone-100' : 'font-medium text-bone-400'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
