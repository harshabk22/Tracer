import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('UI Performance, Anti-Blur & Fast Transition Ergonomics', () => {
  it('verifies ModalSheet eliminates scale downsampling and uses pure vertical translation with GPU promotion', () => {
    const sheetPath = path.resolve(__dirname, '../../components/common/ModalSheet.tsx');
    const content = fs.readFileSync(sheetPath, 'utf-8');

    // Should not contain scale downsampling in sheet motion attributes
    expect(content).not.toContain('scale: 0.98');
    expect(content).not.toContain('scale: 0.94');

    // Should use pure vertical translations
    expect(content).toContain('initial={{ opacity: 0, y: 48 }}');
    expect(content).toContain('animate={{ opacity: 1, y: 0 }}');
    expect(content).toContain('exit={{ opacity: 0, y: 36 }}');

    // Backdrop should use crisp solid overlay without GPU fill thrashing
    expect(content).toContain('bg-black/75 select-none');
    expect(content).not.toContain('bg-black/80 backdrop-blur-md select-none');

    // GPU layer promotion classes
    expect(content).toContain('transform-gpu will-change-[transform,opacity] [backface-visibility:hidden]');
  });

  it('verifies App.tsx implements static screen imports to eliminate chunk loading lag', () => {
    const appPath = path.resolve(__dirname, '../../App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');

    // Statically imported TeamScreen and AssistantSheet
    expect(content).toContain("import { TeamScreen } from './components/screens/TeamScreen'");
    expect(content).toContain("import { AssistantSheet } from './components/modals/AssistantSheet'");

    // No React.lazy for TeamScreen or AssistantSheet
    expect(content).not.toContain("const TeamScreen = React.lazy");
    expect(content).not.toContain("const AssistantSheet = React.lazy");
  });

  it('verifies App.tsx uses popLayout mode and M3 easing for fluid tab transitions', () => {
    const appPath = path.resolve(__dirname, '../../App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');

    expect(content).toContain('<AnimatePresence mode="popLayout"');
    expect(content).toContain('transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}');
    expect(content).toContain('transform-gpu will-change-[transform,opacity]');
    expect(content).toContain('x: dir * 14');
    expect(content).toContain('x: dir * -14');
  });

  it('verifies .gpu-layer hardware acceleration utility exists in index.css', () => {
    const cssPath = path.resolve(__dirname, '../../index.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    expect(content).toContain('.gpu-layer');
    expect(content).toContain('transform: translateZ(0)');
    expect(content).toContain('will-change: transform, opacity');
  });

  it('verifies ModalSkeleton avoids backdrop-blur fill overhead', () => {
    const skeletonPath = path.resolve(__dirname, '../../components/common/ScreenSkeleton.tsx');
    const content = fs.readFileSync(skeletonPath, 'utf-8');

    expect(content).toContain('bg-black/75 animate-pulse');
    expect(content).not.toContain('bg-black/80 backdrop-blur-md animate-pulse');
  });
});
