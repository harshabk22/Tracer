# Project Rules

- **Response Style**: Always provide the shortest possible response in the simplest way (spoon-feeding style: bite-sized, crystal clear, zero fluff, strictly minimal).
- **Subagent Lifecycle**: NEVER kill or terminate subagents after a milestone or pass. They must run in a continuous autonomous improvement loop without interruption until the user explicitly commands them to stop.
- **Platform & Product Architecture**: Tracer is fundamentally a first-class **Android application**. Full-stack architecture is backed by native Android tooling (Capacitor Android, Android SDK at `~/Library/Android/sdk`, `android` CLI at `/Users/harshavardhanbk/.local/bin/android`, and `adb`).
- **Design Philosophy**: Executive Material 3 / Android Flagship Ergonomics. Purge iOS-specific tropes in favor of Android edge-to-edge transparent system bars, native Android hardware/predictive back button interception, 48dp minimum touch targets, native Android haptic feedback (`navigator.vibrate` / Capacitor Haptics), native Android system share sheets, and Android viewport geometry (e.g. Pixel 412x915).
