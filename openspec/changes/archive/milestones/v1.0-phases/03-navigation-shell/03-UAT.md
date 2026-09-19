---
status: complete
phase: 03-navigation-shell
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md
started: 2026-05-18T15:00:00Z
updated: 2026-05-19T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. App Shell Loads
expected: Open the app. TitleBar (with "OIMG · image optimizer" brand), Toolbar (with "Optimize all" button), and StatusBar (bottom bar with version strings) are all visible. No errors or blank screen.
result: pass

### 2. TitleBar Menus Open
expected: Click "Codec" in the TitleBar — a popover appears with WebP, AVIF, JPEG, PNG, SVG options. Click "View" — the Codec popover closes and a new popover appears with Batch/Compare/Report + Light/Dark theme items. Menus are mutually exclusive.
result: pass

### 3. Optimize All → Worker Pip
expected: Click the green "Optimize all" button in the Toolbar. The worker pip in the StatusBar bottom-left changes from accent-green (Idle) to a pulsing blue (Running). Its aria-label reads "Worker status: Running".
result: pass

### 4. Toolbar Segmented Control
expected: Click the "Compare" segment in the Batch/Compare/Report control. It becomes visually active (darker background). Click "Report" — it activates. Click "Batch" to return. Only one segment is active at a time.
result: pass

### 5. Toolbar Filter Input
expected: Type "hero" in the "Filter files…" search input. The files list in the Files pane narrows to show only files whose name contains "hero". Clear the input — all files return.
result: pass

### 6. Toolbar Theme Toggle
expected: Click the Sun/Moon icon button on the right of the Toolbar. The app switches between dark and light themes — background and text colors invert. The icon swaps (Sun ↔ Moon).
result: pass

### 7. StatusBar Versions + Totals
expected: The StatusBar shows "SVGO 4.0.1", "@squoosh-kit/core 0.6.0", a file count like "12 files", and a size summary like "4.2 MB → 1.8 MB".
result: pass

### 8. ⌘K Opens Command Palette
expected: Press ⌘K (or click the ⌘K button in the TitleBar right cluster). A modal overlay appears with a search input and a list of commands (Optimize all, Add files, Batch view, etc.).
result: pass

### 9. Command Palette Filtering
expected: With the palette open, type "opt". The list narrows to show only "Optimize all". Type "view" — shows view-related commands. Clear the input — full list returns.
result: pass

### 10. Command Palette Keyboard Nav + Close
expected: With the palette open, press ↓ arrow — selection moves to the next item. Press Escape — the palette closes and focus returns to the page.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
