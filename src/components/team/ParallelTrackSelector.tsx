import React from 'react';
import { TeamMember } from '../../types/goal';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { Users, User, Layers } from 'lucide-react';

interface ParallelTrackSelectorProps {
  selectedTrack: string; // 'all' | assigneeId
  onSelectTrack: (trackId: string) => void;
  teamMembers: TeamMember[];
  trackCounts: Record<string, number>;
  workloadDistribution: Record<string, { total: number; completed: number; pending: number; name: string }>;
  totalCount: number;
}

export const ParallelTrackSelector: React.FC<ParallelTrackSelectorProps> = ({
  selectedTrack,
  onSelectTrack,
  teamMembers,
  workloadDistribution,
  totalCount,
}) => {
  const handleSelect = (id: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    onSelectTrack(id);
  };

  interface TrackOption {
    id: string;
    label: string;
    count: number;
    icon?: React.ComponentType<{ className?: string }>;
    avatar?: string;
  }

  // Build list of filter chips
  // 1. All Tracks
  // 2. You (user)
  // 3. Other teammates
  const options: TrackOption[] = [
    {
      id: 'all',
      label: 'All Tracks',
      count: totalCount,
      icon: Layers,
    },
    {
      id: 'user',
      label: 'You',
      count: workloadDistribution['user']?.pending ?? 0,
      icon: User,
    },
    ...teamMembers
      .filter((tm) => !tm.isCurrentUser)
      .map((tm) => ({
        id: tm.id,
        label: tm.name.split(' ')[0], // First name for clean chip ergonomics
        count: workloadDistribution[tm.id]?.pending ?? 0,
        avatar: tm.avatar,
      })),
  ];

  return (
    <div className="relative w-full">
      <nav
        aria-label="Parallel Track Filters"
        className="w-full overflow-x-auto no-scrollbar py-2 px-4 flex items-center gap-2"
      >
        {options.map((opt) => {
          const isSelected = selectedTrack === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-150 m3-press shrink-0 border ${
                isSelected
                  ? 'bg-terracotta text-white border-terracotta shadow-md shadow-terracotta/30'
                  : 'bg-charcoal-surface/80 text-bone-400 border-white/[0.06] hover:border-white/10 hover:text-bone-200'
              }`}
            >
              {Icon ? (
                <Icon className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-bone-800 border border-bone-700/60 flex items-center justify-center text-[9px] font-mono text-bone-300">
                  {opt.avatar || '👤'}
                </span>
              )}
              <span>{opt.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-bone-800 text-bone-400 border border-bone-700/60'
                }`}
              >
                {opt.count}
              </span>
            </button>
          );
        })}
      </nav>
      {/* Right-edge gradient fade mask to signal overflow scrollability */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-obsidian to-transparent z-10"
        aria-hidden="true"
      />
    </div>
  );
};
