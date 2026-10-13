import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Sprint Cycle 2 Ergonomics, Portal & Stacking Isolation', () => {
  it('verifies ModalSheet implements createPortal into document.body', () => {
    const modalSheetPath = path.resolve(__dirname, '../../components/common/ModalSheet.tsx');
    const content = fs.readFileSync(modalSheetPath, 'utf-8');

    expect(content).toContain("import { createPortal } from 'react-dom'");
    expect(content).toContain('createPortal(modalContent, document.body)');
    expect(content).toContain("typeof document !== 'undefined'");
  });

  it('verifies FocusSessionHUD 3-column layout with 48dp controls and expandable secondary tray', () => {
    const hudPath = path.resolve(__dirname, '../../components/focus/FocusSessionHUD.tsx');
    const content = fs.readFileSync(hudPath, 'utf-8');

    // Primary row controls (48dp touch targets)
    expect(content).toContain('min-h-[48px]');
    expect(content).toContain('min-w-[48px]');
    // Expandable secondary tray controls
    expect(content).toContain('showMore');
    expect(content).toContain('432Hz');
    expect(content).toContain('+5m Buffer');
    expect(content).toContain('Cancel');
  });

  it('verifies GoalSwitcherSheet and FlightTelemetrySheet exist with 48dp touch targets', () => {
    const switcherPath = path.resolve(__dirname, '../../components/modals/GoalSwitcherSheet.tsx');
    const telemetryPath = path.resolve(__dirname, '../../components/modals/FlightTelemetrySheet.tsx');

    expect(fs.existsSync(switcherPath)).toBe(true);
    expect(fs.existsSync(telemetryPath)).toBe(true);

    const switcherContent = fs.readFileSync(switcherPath, 'utf-8');
    const telemetryContent = fs.readFileSync(telemetryPath, 'utf-8');

    expect(switcherContent).toContain('+ Create New Objective');
    expect(switcherContent).toContain('min-h-[48px]');

    expect(telemetryContent).toContain('Flight Telemetry & Health');
    expect(telemetryContent).toContain('min-h-[48px]');
  });

  it('verifies MilestoneDetailSheet deduplicates owner to You (Owner)', () => {
    const sheetPath = path.resolve(__dirname, '../../components/roadmap/MilestoneDetailSheet.tsx');
    const content = fs.readFileSync(sheetPath, 'utf-8');

    expect(content).toContain("'You (Owner)'");
    expect(content).toContain('normalizeOwner');
  });

  it('verifies FocusScreen daily pulse pills satisfy 48dp touch targets', () => {
    const focusPath = path.resolve(__dirname, '../../components/screens/FocusScreen.tsx');
    const content = fs.readFileSync(focusPath, 'utf-8');

    expect(content).toContain('min-w-[48px] min-h-[48px]');
  });

  it('verifies FocusSessionHUD is hoisted to AppContent above BottomNav', () => {
    const appPath = path.resolve(__dirname, '../../App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');

    expect(content).toContain('<FocusSessionHUD');
    expect(content).toContain('<BottomNav />');
    // Ensure FocusSessionHUD comes before BottomNav
    const hudIdx = content.indexOf('<FocusSessionHUD');
    const navIdx = content.indexOf('<BottomNav />');
    expect(hudIdx).toBeGreaterThan(-1);
    expect(navIdx).toBeGreaterThan(-1);
    expect(hudIdx).toBeLessThan(navIdx);
  });
});
