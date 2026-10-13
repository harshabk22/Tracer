# Tracer UX Review & Improvement Plan

**Scope:** Android-first, Material 3 flagship ergonomics. Codebase audited: `src/` (~70 files). **No code changed** — research only.
**Date:** 2026-09-18 · **Baseline:** overall strong. Consistent sheet system, centralized back routing, 48dp discipline on primary controls, focus-trapped sheets.

## Method & hard numbers

- 126 `<button>`s across 24 files; ~78 carry `aria-label` (~62%).
- Touch-target violations: **CompletionToast** clusters five 32px/28px controls (`CompletionToast.tsx:115-176`).
- Tiny text: 84× `text-[11px]`, 72× `text-[10px]`, 6× `text-[9px]` (all 9px are status/meta labels — acceptable, but 10px appears in interactive contexts).
- No `prefers-reduced-motion` / `useReducedMotion` anywhere; `animate-ping/pulse/bounce/spin` in 10 files.
- Manifest gaps: no `enableOnBackInvokedCallback` (predictive back), `MainActivity.java` is stock `BridgeActivity` (no edge-to-edge enforcement), no nav-bar handling in `androidBridge.initStatusBar`.

---

## P0 — Fix now (correctness / policy / exclusion risks)

### 1. Sub-48dp cluster in CompletionToast
Five controls at 32px (`±5m`, note toggle) and 28px (dismiss), plus an `h-8` Undo button and 36px note input (`CompletionToast.tsx:115-199`). These are the smallest, most-tapped post-completion controls in the app.
- Bump ±/note/dismiss to 48px; widen toast or move note input to its own row. Undo → `min-h-[48px]`. Note input → 48px.
- Effort: S. Owner file: `src/components/common/CompletionToast.tsx`.

### 2. Enable Android predictive back
`AndroidManifest.xml` lacks `android:enableOnBackInvokedCallback="true"`; custom drag-pill in `ModalSheet.tsx:188-203` mimics but is not the system predictive-back animation. Add the flag, test back-progress on Android 14+ (sheets should track the gesture, not just snap shut).
- Effort: S (flag) + M (gesture-progress polish). Files: `android/app/src/main/AndroidManifest.xml`, `ModalSheet.tsx`.

### 3. Enforce real edge-to-edge in native layer
`initStatusBar` (`androidBridge.ts:148-158`) sets overlay + dark style, but there is no navigation-bar handling (transparent nav, contrast enforcement) and `MainActivity.java` does no `WindowCompat.setDecorFitsSystemWindows(window, false)`. On 3-button nav devices the bottom nav can sit on an opaque/solid bar.
- Set transparent nav bar + `setDecorFitsSystemWindows(false)` in `MainActivity`; keep `pb-[max(env(safe-area-inset-bottom),12px)]`-style insets (already correct in `BottomNav.tsx:48`). Verify gesture bar + 3-button nav + landscape cutout.
- Effort: M.

### 4. White-on-terracotta contrast fails AA
White text on `#D97736` ≈ 3.4:1 — below 4.5:1 for `text-sm` button labels (e.g. `FocusScreen.tsx:181`, `IntakeScreen` CTA). Options: darken button bg toward `#B85A1F`-range for text-bearing fills (keep `#D97736` for icons/accents), or use near-black text on terracotta fills. Audit sage-on-dark small text similarly (~4.3:1, borderline).
- Effort: S-M (token change + spot check). File: `tailwind.config.js` + CTA usages.

## P1 — High value, low risk

### 5. Respect `prefers-reduced-motion`
Zero reduced-motion handling; infinite `animate-ping/pulse` in 10 files (status dots, shield lock, drone icon). Add a global media query killing infinite animations + a `useReducedMotion` gate for framer-motion tab/sheet transitions (instant crossfade fallback).
- Effort: M. Files: `index.css`, sheet/nav transitions.

### 6. Toast/HUD stacking collisions
`UndoToast`, `CompletionToast` (`bottom-20`), `FocusSessionHUD` (`bottom-20`), offline banner (`top-14`) can overlap each other; only one undo type renders at a time (`App.tsx:341`) and completion vs undo interplay is implicit. Define a single anchored snackbar stack (bottom-above-nav slot, one visible + queue) with HUD offset rules.
- Effort: M. Files: `App.tsx`, `UndoToast.tsx`, `CompletionToast.tsx`, `FocusSessionHUD.tsx`.

### 7. Swipe-to-switch-tabs gesture conflicts
`App.tsx:164-185` (85px, 2.2:1 horizontal lock) fires on the whole `<main>`, competing with horizontal scroll content, sheet drag (`ModalSheet` uses vertical — OK), and roadmap timelines. Add: edge-origin or handle-zone requirement, suppress while a sheet/HUD-tray is open, and announce tab changes via `aria-live`.
- Effort: M. File: `App.tsx`.

### 8. Keyboard / input ergonomics on Intake
`adjustResize` is set (good). Missing: `enterKeyHint` (`next`/`done`), `inputMode="numeric"` on custom-days number input, autofocus + scroll-into-view above keyboard for the goal field, `aria-label`s on icon-only steppers. Number input `w-20` is fine as a field (not a button).
- Effort: S. File: `IntakeScreen.tsx:264,397`.

### 9. Haptic/sound governance
Every tap fires both `soundManager` + `triggerHaptic` inline (~100+ call sites); no global mute, no "haptics only on native" policy, double-haptic cadences (`FocusScreen.tsx:117-125`) can't be disabled. Centralize behind a `feedback.action()` helper honoring: system sound setting, a user toggle in Settings, and `prefers-reduced-motion` (haptics off or minimal).
- Effort: M. Files: new helper + `SettingsModal.tsx` toggle.

## P2 — Polish & cognitive load

### 10. M3 dialog vs sheet discipline
All 10 sheets route through `ModalSheet` (good consistency), but confirmations (`CompleteModal`, `BlockerModal`, `BiometricAuthModal`) render as bottom sheets on phones. Per M3, blocking confirmations should be centered dialogs; sheets for browse/select flows. Split `ModalSheet` variants: `dialog` (centered, scrim, no drag handle) vs `sheet`.
- Effort: M.

### 11. Focus-screen information density
FocusScreen is 749 lines with 5+ competing sections (hero, rescue card, queue, tomorrow accordion, ledger, blocker, daily pulse). Progressive disclosure is already partly there; go further: collapse "Conquered" to a summary row by default, move Daily Pulse into the header capsule, cap rescue card to one line + expand.
- Effort: M-L. File: `FocusScreen.tsx`.

### 12. Status-pill overload
`TopStatusPill` merges connectivity + schedule + vault-shield into one tappable capsule with 4 different destinations (`TopStatusPill.tsx:70-137`). Split into: status indicator (opens telemetry) + separate lock affordance when shielded. Keep the 48dp targets.
- Effort: S-M.

### 13. Badge + toast semantics
Nav badge (`BottomNav.tsx:82-86`) has no `aria-label` count announcement; toasts use `role="status"` correctly in Undo but CompletionToast lacks `aria-live`. Add live-region announcements for badge count, queue-cleared, and offline→restored transitions.
- Effort: S.

### 14. Desktop preview chrome leaks mobile mental model
`MobileFrame` workstation/handheld switcher + `⌘\` shortcut is dev-preview chrome shipped in the product frame. Gate behind `import.meta.env.DEV` or a settings flag so production APK never shows "Pixel 8 Pro (412x915)" furniture.
- Effort: S. File: `MobileFrame.tsx:54-104`.

## Explicit non-goals (audited, leave alone)

- Back-button architecture (`androidBridge` LIFO stack + interceptors + `useModalDismiss` history shim) is sound; only predictive-back animation is missing (P0-2).
- Focus trap in `ModalSheet.tsx:48-124` is correct incl. restore-focus; extend it to nothing — it already covers all 10 sheets.
- `user-select:none` + `touch-action:manipulation` + `viewport-fit=cover` + `interactive-widget=resizes-content` are correctly set.
- 9px micro-labels are eyebrow/meta only — acceptable; do not blanket-ban, just keep out of interactive controls.

## Suggested sequencing

1. Sprint A (correctness): P0-1 → P0-4 → P0-2 → P0-3.
2. Sprint B (feel): P1-5 → P1-9 → P1-6 → P1-7.
3. Sprint C (clarity): P2-10 → P2-12 → P2-13 → P2-11 → P2-14.
4. Each item independently shippable; re-run the ergonomics suites (`screensErgonomics`, `cycle2/3Ergonomics`, `modalAccessibility`, `transitionPerformance`) per item.
