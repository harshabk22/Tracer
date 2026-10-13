import React from 'react';

export const ScreenSkeleton: React.FC = () => {
  return (
    <div
      className="flex-1 p-4 pb-36 sm:pb-32 space-y-4 max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto w-full animate-pulse select-none"
      aria-label="Loading screen contents"
      role="status"
    >
      {/* Header Skeleton */}
      <div className="flex items-center justify-between py-2 border-b border-obsidian-borderSubtle/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.07]" />
          <div className="space-y-2">
            <div className="h-2.5 w-28 rounded-full bg-white/[0.05]" />
            <div className="h-5 w-44 rounded-lg bg-white/[0.09]" />
            <div className="h-3 w-60 rounded-full bg-white/[0.05]" />
          </div>
        </div>
        <div className="h-8 w-20 rounded-full bg-white/[0.05]" />
      </div>

      {/* Primary Card Skeleton */}
      <div className="p-5 rounded-3xl bg-obsidian-surface border border-obsidian-border space-y-4 shadow-executive">
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 rounded-full bg-white/[0.08]" />
          <div className="h-6 w-16 rounded-full bg-white/[0.05]" />
        </div>
        <div className="h-10 w-full rounded-xl bg-white/[0.04]" />
        <div className="space-y-2 pt-2">
          <div className="h-3.5 w-5/6 rounded-full bg-white/[0.06]" />
          <div className="h-3 w-2/3 rounded-full bg-white/[0.04]" />
        </div>
      </div>

      {/* Secondary Card Skeleton */}
      <div className="p-5 rounded-3xl bg-obsidian-surface border border-obsidian-border space-y-3.5 shadow-executive">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 rounded-full bg-white/[0.06]" />
          <div className="h-3.5 w-36 rounded-full bg-white/[0.07]" />
        </div>
        <div className="h-16 w-full rounded-2xl bg-white/[0.03]" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-2.5 w-24 rounded-full bg-white/[0.04]" />
          <div className="h-7 w-28 rounded-xl bg-white/[0.07]" />
        </div>
      </div>

      {/* Tertiary Card Skeleton */}
      <div className="p-5 rounded-3xl bg-obsidian-surface border border-obsidian-border space-y-3 shadow-executive">
        <div className="h-3 w-40 rounded-full bg-white/[0.06]" />
        <div className="h-12 w-full rounded-2xl bg-white/[0.03]" />
      </div>
    </div>
  );
};

export const ModalSkeleton: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 animate-pulse"
      role="status"
      aria-label="Loading modal"
    >
      <div className="w-full max-w-md bg-obsidian-surface border border-obsidian-border rounded-t-[28px] sm:rounded-[28px] shadow-executive p-5 space-y-4">
        <div className="w-8 h-1 rounded-full bg-white/20 mx-auto sm:hidden" />
        <div className="flex items-center justify-between border-b border-obsidian-borderSubtle pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-white/[0.08]" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-lg bg-white/[0.09]" />
              <div className="h-2.5 w-44 rounded-full bg-white/[0.05]" />
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/[0.05]" />
        </div>
        <div className="space-y-3 py-2">
          <div className="h-14 w-full rounded-2xl bg-white/[0.04]" />
          <div className="h-14 w-full rounded-2xl bg-white/[0.04]" />
          <div className="h-14 w-full rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
};
