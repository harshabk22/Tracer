import React, { useState, Suspense } from 'react';
import { GoalProvider, useGoal, AppTab } from './context/GoalContext';
import { MobileFrame } from './components/common/MobileFrame';
import { TopStatusPill } from './components/common/TopStatusPill';
import { BottomNav } from './components/common/BottomNav';
import { FocusScreen } from './components/screens/FocusScreen';
import { RoadmapTimeline } from './components/roadmap/RoadmapTimeline';
import { TeamScreen } from './components/screens/TeamScreen';
import { AssistantSheet } from './components/modals/AssistantSheet';
import { ScreenSkeleton, ModalSkeleton } from './components/common/ScreenSkeleton';
import { OfflineStatusBanner } from './components/common/OfflineStatusBanner';
import { UndoToast } from './components/common/UndoToast';
import { CompletionToast } from './components/common/CompletionToast';
import { VictoryBurst } from './components/common/VictoryBurst';
import { FocusSessionHUD } from './components/focus/FocusSessionHUD';
import { soundManager } from './services/sound';
import { AndroidBridge, androidBridge } from './services/androidBridge';
import { feedback } from './services/feedback';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';

const IntakeScreen = React.lazy(() =>
  import('./components/screens/IntakeScreen').then(m => ({ default: m.IntakeScreen }))
);
const TeamSheet = React.lazy(() =>
  import('./components/modals/TeamSheet').then(m => ({ default: m.TeamSheet }))
);
const SettingsModal = React.lazy(() =>
  import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal }))
);
const BiometricAuthModal = React.lazy(() =>
  import('./components/modals/BiometricAuthModal').then(m => ({ default: m.BiometricAuthModal }))
);
const GoalSwitcherSheet = React.lazy(() =>
  import('./components/modals/GoalSwitcherSheet').then(m => ({ default: m.GoalSwitcherSheet }))
);
const FlightTelemetrySheet = React.lazy(() =>
  import('./components/modals/FlightTelemetrySheet').then(m => ({ default: m.FlightTelemetrySheet }))
);

const TAB_ORDER: Record<string, number> = {
  focus: 0,
  roadmap: 1,
  team: 2,
  intake: 3,
};

const ORDERED_TABS: AppTab[] = ['focus', 'roadmap', 'team'];

const AppContent: React.FC = () => {
  const {
    activeGoal,
    activeTab,
    setActiveTab,
    canUndo,
    lastUndoAction,
    undo,
    dismissUndo,
    victoryBurstTrigger,
    completeMicroMove,
    updateGoal,
  } = useGoal();

  const [showAssistantSheet, setShowAssistantSheet] = useState(false);
  const [showTeamSheet, setShowTeamSheet] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGoalSwitcher, setShowGoalSwitcher] = useState(false);
  const [showTelemetrySheet, setShowTelemetrySheet] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{
    isOpen: boolean;
    actionType?: 'unlock' | 'destructive' | 'setup' | 'export';
    title?: string;
    description?: string;
    onSuccess?: () => void;
  }>({
    isOpen: false,
  });

  const openAuthModal = (options?: {
    actionType?: 'unlock' | 'destructive' | 'setup' | 'export';
    title?: string;
    description?: string;
    onSuccess?: () => void;
  }) => {
    setAuthModalConfig({
      isOpen: true,
      actionType: options?.actionType || 'unlock',
      title: options?.title,
      description: options?.description,
      onSuccess: options?.onSuccess,
    });
  };

  // Directional tab transitions
  const [prevTab, setPrevTab] = useState<AppTab>(activeTab);
  const [direction, setDirection] = useState(1);

  // Touch gesture swipe coordinates
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (activeTab !== prevTab) {
      const prevIdx = TAB_ORDER[prevTab] ?? 0;
      const nextIdx = TAB_ORDER[activeTab] ?? 0;
      setDirection(nextIdx >= prevIdx ? 1 : -1);
      setPrevTab(activeTab);
    }
  }, [activeTab, prevTab]);

  // Native Android Platform Integration (Edge-to-edge system bars & hardware back button routing)
  React.useEffect(() => {
    AndroidBridge.initStatusBar();

    const cleanupPromise = AndroidBridge.initHardwareBackButton(() => {
      // Priority 0: Centralized LIFO modal stack
      if (AndroidBridge.hasOpenModals()) {
        AndroidBridge.closeTopModal();
        return true;
      }

      // Single-sheet rule: Priority 1 - Close active modal/sheet
      if (authModalConfig.isOpen) {
        setAuthModalConfig(prev => ({ ...prev, isOpen: false }));
        return true;
      }
      if (showAssistantSheet) {
        setShowAssistantSheet(false);
        return true;
      }
      if (showTeamSheet) {
        setShowTeamSheet(false);
        return true;
      }
      if (showSettingsModal) {
        setShowSettingsModal(false);
        return true;
      }
      if (showGoalSwitcher) {
        setShowGoalSwitcher(false);
        return true;
      }
      if (showTelemetrySheet) {
        setShowTelemetrySheet(false);
        return true;
      }

      // Priority 2: Navigate back to Focus tab
      if (activeTab !== 'focus') {
        setActiveTab('focus');
        return true;
      }

      // Priority 3: Exit app when on Focus screen with no modals open
      return false;
    });

    return () => {
      cleanupPromise.then((cleanup: () => void) => cleanup());
    };
  }, [authModalConfig.isOpen, showAssistantSheet, showTeamSheet, showSettingsModal, showGoalSwitcher, showTelemetrySheet, activeTab, setActiveTab]);

  // Touch swipe handling for mobile gestures with Android edge back gesture protection
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 412;
    const edgeBackExclusionZone = 36; // 36px Android 10+ system back gesture threshold

    // Suppress swipe initiation if touching edge zones or if any sheet/modal is active
    const isEdgeTouch =
      touch.clientX < edgeBackExclusionZone ||
      touch.clientX > windowWidth - edgeBackExclusionZone;
    const isModalOpen =
      authModalConfig.isOpen ||
      showAssistantSheet ||
      showTeamSheet ||
      showSettingsModal ||
      showGoalSwitcher ||
      showTelemetrySheet;

    if (isEdgeTouch || isModalOpen) {
      setTouchStart(null);
      return;
    }

    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStart.x;
    const diffY = touch.clientY - touchStart.y;

    if (Math.abs(diffX) > 85 && Math.abs(diffX) > Math.abs(diffY) * 2.2) {
      const currentIdx = ORDERED_TABS.indexOf(activeTab);
      if (diffX < 0 && currentIdx < ORDERED_TABS.length - 1) {
        // Swipe Left -> Next Tab
        feedback.tabSwitch();
        setActiveTab(ORDERED_TABS[currentIdx + 1]);
      } else if (diffX > 0 && currentIdx > 0) {
        // Swipe Right -> Previous Tab
        feedback.tabSwitch();
        setActiveTab(ORDERED_TABS[currentIdx - 1]);
      }
    }
    setTouchStart(null);
  };

  const tabVariants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir * 14,
    }),
    animate: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir * -14,
    }),
  };

  return (
    <MobileFrame>
      <MotionConfig reducedMotion="user">
        {/* Top Dynamic Status Pill */}
      <TopStatusPill
        onOpenAssistant={() => setShowAssistantSheet(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenGoalSwitcher={() => setShowGoalSwitcher(true)}
        onOpenTelemetry={() => setShowTelemetrySheet(true)}
        onOpenAuthModal={openAuthModal}
      />

      {/* Autonomous Animated Offline & Recovery Banner */}
      <OfflineStatusBanner />

      {/* Screen Viewport with smooth scroll & fluid spring animations */}
      <main
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden relative overscroll-contain"
      >
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            className="flex-1 flex flex-col min-h-0 w-full transform-gpu will-change-[transform,opacity]"
          >
            {activeTab === 'intake' && (
              <Suspense fallback={<ScreenSkeleton />}>
                <IntakeScreen />
              </Suspense>
            )}
            {activeTab === 'focus' && (
              <FocusScreen
                onOpenAssistant={() => setShowAssistantSheet(true)}
                onOpenAuthModal={openAuthModal}
              />
            )}
            {activeTab === 'roadmap' && (
              <RoadmapTimeline onOpenTeamSheet={() => setShowTeamSheet(true)} />
            )}
            {activeTab === 'team' && (
              <TeamScreen />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persisted Deep Work Focus Session HUD across all tabs with dynamic toast offset */}
      <FocusSessionHUD
        hasActiveSnackbar={canUndo && !!lastUndoAction}
        onCompleteMove={(id, mins, note, source) =>
          completeMicroMove(id, mins, note, source || 'focus_timer')
        }
      />

      {/* Material 3 Executive Bottom Navigation (3 Tabs) */}
      <BottomNav />

      {/* Autonomous Assistant Co-Pilot Ambient Sheet */}
      <AnimatePresence>
        {showAssistantSheet && (
          <AssistantSheet onClose={() => setShowAssistantSheet(false)} />
        )}
      </AnimatePresence>

      {/* On-Demand Team / Crew Sheet */}
      <AnimatePresence>
        {showTeamSheet && (
          <Suspense fallback={<ModalSkeleton />}>
            <TeamSheet onClose={() => setShowTeamSheet(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* App Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <Suspense fallback={<ModalSkeleton />}>
            <SettingsModal
              onClose={() => setShowSettingsModal(false)}
              onOpenAuthModal={openAuthModal}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Dedicated Goal Switcher Modal Sheet */}
      <AnimatePresence>
        {showGoalSwitcher && (
          <Suspense fallback={<ModalSkeleton />}>
            <GoalSwitcherSheet
              onClose={() => setShowGoalSwitcher(false)}
              onOpenNewObjective={() => {
                setShowGoalSwitcher(false);
                setActiveTab('intake');
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Decoupled Flight Telemetry Modal Sheet */}
      <AnimatePresence>
        {showTelemetrySheet && (
          <Suspense fallback={<ModalSkeleton />}>
            <FlightTelemetrySheet
              onClose={() => setShowTelemetrySheet(false)}
              onOpenAssistant={() => {
                setShowTelemetrySheet(false);
                setShowAssistantSheet(true);
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Hardware-Backed Biometric Security Gate Modal */}
      <AnimatePresence>
        {authModalConfig.isOpen && (
          <Suspense fallback={<ModalSkeleton />}>
            <BiometricAuthModal
              isOpen={authModalConfig.isOpen}
              actionType={authModalConfig.actionType}
              title={authModalConfig.title}
              description={authModalConfig.description}
              onClose={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
              onSuccess={() => {
                authModalConfig.onSuccess?.();
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Material 3 Single-Slot Anchored Snackbar Queue (Strictly one snackbar on screen at a time) */}
      {canUndo && lastUndoAction && (
        lastUndoAction.type === 'complete_move' ? (
          (() => {
            const completedMove =
              (activeGoal?.microMoves || []).find(
                m => m.status === 'completed' && `Completed: ${m.title}` === lastUndoAction.description
              ) ||
              (activeGoal?.microMoves || []).filter(m => m.status === 'completed').slice(-1)[0];
            return (
              <CompletionToast
                moveId={completedMove?.id || 'last_completed'}
                moveTitle={completedMove?.title || lastUndoAction.description.replace(/^Completed:\s*/, '')}
                actualMinutes={completedMove?.actualMinutes || completedMove?.estimatedMinutes || 25}
                onAdjustDuration={(id, delta) => {
                  if (!activeGoal) return;
                  const updated = (activeGoal.microMoves || []).map(m =>
                    m.id === id ? { ...m, actualMinutes: Math.max(5, (m.actualMinutes || m.estimatedMinutes || 25) + delta) } : m
                  );
                  updateGoal({ ...activeGoal, microMoves: updated });
                }}
                onUpdateNote={(id, note) => {
                  if (!activeGoal) return;
                  const updated = (activeGoal.microMoves || []).map(m =>
                    m.id === id ? { ...m, learningRemark: note } : m
                  );
                  updateGoal({ ...activeGoal, microMoves: updated });
                }}
                onUndo={undo}
                onDismiss={dismissUndo}
              />
            );
          })()
        ) : (
          <UndoToast
            undoAction={lastUndoAction}
            onUndo={undo}
            onDismiss={dismissUndo}
          />
        )
      )}

      {/* Ambient VictoryBurst Particle Burst on Goal / Milestone Conquest */}
      <VictoryBurst trigger={victoryBurstTrigger} />
      </MotionConfig>
    </MobileFrame>
  );
};

export function App() {
  return (
    <GoalProvider>
      <AppContent />
    </GoalProvider>
  );
}

export default App;
