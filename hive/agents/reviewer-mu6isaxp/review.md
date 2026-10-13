# UX Improvement Plan Audit

**Auditor:** Reviewer (`reviewer-mu6isaxp`)
**Subject:** `task-ux-review-plan` by `planner-mu6ib501`
**Date:** 2026-09-18

## 1. Ergonomics & Android Compliance (Strengths)
- **48dp Touch Targets:** Spot-on identification of the 32px/28px sub-minimum controls in `CompletionToast`. Elevating this to a P0 is correct and strictly enforces the flagship ergonomics rule.
- **Contrast Ratios:** Accurate identification of the AA failure on terracotta backgrounds (`#D97736`). 
- **M3 Dialog Semantics (P2-10):** Recommending the split between bottom sheets (for browse/select) and centered dialogs (for blocking confirmations) perfectly aligns with Material 3 guidelines. Bottom sheets should not be used for simple YES/NO blocking confirmations.
- **Dev Chrome Removal (P2-14):** Excellent catch on the `MobileFrame` dev chrome leaking into production models.

## 2. Architectural Risks & Refinements
- **CRITICAL: System Back Gesture Conflict (P1-7 - Swipe-to-switch tabs):**
  - **Risk:** The plan suggests adding an "edge-origin" requirement for horizontal tab swipes to fix conflicts. On Android 10+, horizontal edge swipes are strictly reserved for the system-wide "Back" gesture.
  - **Refinement:** Do NOT use edge-origin for custom app gestures. Either constrain the horizontal swipe to a safe central area, or rely solely on tapping the bottom nav. M3 advises against custom edge-swipes if they conflict with system navigation.
- **Native Edge-to-Edge vs Capacitor Plugins (P0-2, P0-3):**
  - **Risk:** Modifying `MainActivity.java` with `setDecorFitsSystemWindows(false)` is the correct Android native approach, but in a Capacitor app, this can conflict with `@capacitor/status-bar` and `@capacitor/keyboard` behaviors (which often resize the webview to avoid the keyboard).
  - **Refinement:** Proceed with caution. Verify that applying edge-to-edge at the `MainActivity` level does not break Capacitor's keyboard avoidance strategy or introduce double-insets.
- **Custom Snackbar Queue (P1-6):**
  - **Risk:** Managing multiple overlapping HUDs (Undo, Completion, Offline) via a custom queue can introduce React state race conditions.
  - **Refinement:** Ensure the queue is centrally managed and adhere strictly to the M3 rule: only **one** snackbar on screen at a time. No visual stacking.

## 3. Sequencing Assessment
- The proposed sequencing (Sprint A: Correctness → Sprint B: Feel → Sprint C: Clarity) is highly logical and front-loads the most critical accessibility and native compliance issues.
- **Adjustment:** Elevate **P2-14 (Dev preview chrome leak)** to **Sprint A**. Shipping workstation dev chrome (`MobileFrame`) in a production APK is a release-blocking correctness issue, not just a "polish/clarity" item.

## 4. Final Verdict
**GREEN LIGHT WITH REFINEMENTS.**
The plan strongly embodies the "Android-first, Material 3 flagship ergonomics" philosophy. The proposed interventions are precise and necessary. The planner should incorporate the refinement on edge-swipes (P1-7) and elevate P2-14 to Sprint A, after which implementation can safely begin.
