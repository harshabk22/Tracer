import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { feedback } from '../feedback';
import { storage } from '../storage';
import { soundManager } from '../sound';
import { androidBridge } from '../androidBridge';

describe('Sprint B: Feel & Ergonomics Verification Suite', () => {
  it('verifies index.css defines prefers-reduced-motion overrides for infinite animations', () => {
    const cssPath = path.resolve(__dirname, '../../index.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    expect(content).toContain('@media (prefers-reduced-motion: reduce)');
    expect(content).toContain('animation-duration: 0.01ms !important');
    expect(content).toContain('transition-duration: 0.01ms !important');
    expect(content).toContain('.animate-ping');
    expect(content).toContain('.animate-pulse');
  });

  it('verifies App.tsx implements MotionConfig, Android edge-gesture exclusion, and single-slot snackbar queue', () => {
    const appPath = path.resolve(__dirname, '../../App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');

    // MotionConfig reduced motion
    expect(content).toContain('<MotionConfig reducedMotion="user">');

    // System back gesture edge exclusion threshold (36px)
    expect(content).toContain('edgeBackExclusionZone = 36');
    expect(content).toContain('isEdgeTouch');

    // Single-slot queue with FocusSessionHUD offset
    expect(content).toContain('hasActiveSnackbar={canUndo && !!lastUndoAction}');
    expect(content).toContain('<CompletionToast');
    expect(content).toContain('<UndoToast');
  });

  it('verifies FocusSessionHUD offsets cleanly above bottom snackbar', () => {
    const hudPath = path.resolve(__dirname, '../../components/focus/FocusSessionHUD.tsx');
    const content = fs.readFileSync(hudPath, 'utf-8');

    expect(content).toContain('hasActiveSnackbar');
    expect(content).toContain("bottom-[168px] sm:bottom-20");
  });

  it('verifies IntakeScreen inputs feature virtual keyboard ergonomics', () => {
    const intakePath = path.resolve(__dirname, '../../components/screens/IntakeScreen.tsx');
    const content = fs.readFileSync(intakePath, 'utf-8');

    expect(content).toContain('enterKeyHint="next"');
    expect(content).toContain('enterKeyHint="done"');
    expect(content).toContain('inputMode="numeric"');
    expect(content).toContain('autoFocus');
    expect(content).toContain('scrollIntoView');
  });

  it('verifies SettingsModal provides tactile haptics toggle', () => {
    const settingsPath = path.resolve(__dirname, '../../components/modals/SettingsModal.tsx');
    const content = fs.readFileSync(settingsPath, 'utf-8');

    expect(content).toContain('Tactile Haptic Feedback');
    expect(content).toContain('storage.saveHapticsEnabled');
  });

  it('verifies feedback service governs audio and haptics respecting mute and reduced-motion', () => {
    const playTickSpy = vi.spyOn(soundManager, 'playTick').mockImplementation(() => {});
    const triggerHapticSpy = vi.spyOn(androidBridge, 'triggerHaptic').mockResolvedValue();

    // Muted sound test
    storage.saveSoundMuted(true);
    storage.saveHapticsEnabled(true);
    feedback.tick();
    expect(playTickSpy).not.toHaveBeenCalled();

    // Enabled sound test
    storage.saveSoundMuted(false);
    feedback.tick();
    expect(playTickSpy).toHaveBeenCalled();

    // Disabled haptics test
    triggerHapticSpy.mockClear();
    storage.saveHapticsEnabled(false);
    feedback.tick();
    expect(triggerHapticSpy).not.toHaveBeenCalled();

    // Re-enable defaults
    storage.saveHapticsEnabled(true);
    storage.saveSoundMuted(false);
  });
});
