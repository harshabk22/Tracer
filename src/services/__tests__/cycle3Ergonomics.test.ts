import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Sprint Cycle 3 Ergonomics & Features', () => {
  it('verifies Work Now action button in Tomorrow Trajectory with 48dp ergonomics', () => {
    const focusPath = path.resolve(__dirname, '../../components/screens/FocusScreen.tsx');
    const content = fs.readFileSync(focusPath, 'utf-8');

    expect(content).toContain('⚡ Work Now');
    expect(content).toContain('min-h-[48px] min-w-[48px]');
    expect(content).toContain("dateScheduled: todayStr, status: 'todo'");
    expect(content).toContain("androidBridge.triggerHaptic('medium')");
  });

  it('verifies Contextual Biometric Lock Chip in Conquered Ledger', () => {
    const focusPath = path.resolve(__dirname, '../../components/screens/FocusScreen.tsx');
    const content = fs.readFileSync(focusPath, 'utf-8');

    expect(content).toContain('isShieldEnabled && isShielded');
    expect(content).toContain('Private Reflection Encrypted • Tap to Authenticate');
    expect(content).toContain('min-h-[48px]');
    expect(content).toContain('onOpenAuthModal?.({ actionType: \'unlock\', title: \'Decrypt Private Reflection\' })');
  });

  it('verifies FocusScreen accepts onOpenAuthModal and is wired in App.tsx', () => {
    const focusPath = path.resolve(__dirname, '../../components/screens/FocusScreen.tsx');
    const appPath = path.resolve(__dirname, '../../App.tsx');
    const focusContent = fs.readFileSync(focusPath, 'utf-8');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    expect(focusContent).toContain('onOpenAuthModal?: (options?: { actionType?:');
    expect(appContent).toContain('onOpenAuthModal={openAuthModal}');
  });

  it('verifies Roadmap milestone phase indicator and progress bar in RoadmapTimeline.tsx', () => {
    const roadmapPath = path.resolve(__dirname, '../../components/roadmap/RoadmapTimeline.tsx');
    const content = fs.readFileSync(roadmapPath, 'utf-8');

    expect(content).toContain('Phase {idx + 1} of {milestones.length}');
    expect(content).toContain('moves conquered');
    expect(content).toContain('bg-sage transition-all duration-300');
    expect(content).toContain('h-1 w-full bg-white/[0.08] rounded-full overflow-hidden');
  });

  it('verifies sensory double-haptic cadence on daily queue clearance', () => {
    const focusPath = path.resolve(__dirname, '../../components/screens/FocusScreen.tsx');
    const content = fs.readFileSync(focusPath, 'utf-8');

    expect(content).toContain('prevPendingCountRef');
    expect(content).toContain('prevPendingCountRef.current > 0 && pendingMoves.length === 0 && completedTodayCount > 0');
    expect(content).toContain('playCompleteChime');
    expect(content).toContain("androidBridge.triggerHaptic('success')");
  });
});
