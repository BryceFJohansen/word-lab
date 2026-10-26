# Executed validation

Initial validation executed on **10 October 2026 (Pacific/Auckland)**. The table and saved browser reports below describe that initial run; the hard-mode follow-up is recorded at the end. Machine-specific paths in the saved browser report have been replaced with repository-relative paths or executable names for publication; test results are unchanged.

| Check | Actual result |
|---|---|
| `npm test` | **51 tests passed across 8 files** |
| `npm run dictionary:validate` | **217,980 entries**; all ten dictionary chunks and metadata reproduce byte-for-byte |
| `npm run build` | TypeScript/Vue typecheck and Vite production bundle both **passed** |
| Playwright Chromium suite | **6 passed**, 0 failed, 0 skipped, 0 flaky; approximately **6.9 seconds** |
| Additional final mobile regression after layout polish | **1 passed** |
| `npm audit` | **0 vulnerabilities** in the installed dependency graph |
| Production browser smoke check | Game restoration, real module worker, multi-row recommendations, mobile 12-letter layouts and dark theme **passed** |
| Production network / browser errors | **0 external requests**, **0 page errors**; startup fetched only the chosen five-letter JSON asset |
| Four-strategy shared benchmark | All four executed against the same 25 five-letter Common answers; JSON and two CSV exports generated |
| CLI full and force-exact modes | Full three-letter UK/Common frequency run and a ten-answer US/Common force-exact entropy sample executed successfully |

Raw browser results: [`benchmarks/e2e-results.json`](../benchmarks/e2e-results.json). Production smoke result: [`benchmarks/production-smoke.json`](../benchmarks/production-smoke.json). The real-worker heartbeat’s maximum interval was **21.4 ms**, below the test’s 250 ms regression bound. The test sets a 16 ms timer; this observation includes browser scheduling and machine load.

Browser engine: **Chromium 156.0.8078.4** installed by Playwright. This minimal Linux environment lacked `libnspr4` and `libnss3`. To run the tests here, Ubuntu packages were downloaded and extracted into a temporary directory without changing the operating system, and `LD_LIBRARY_PATH` pointed to its `usr/lib/x86_64-linux-gnu` directory. For a normal installation, use the documented `npx playwright install-deps chromium` or `npx playwright install --with-deps chromium` when these dependencies are missing. They are test-browser dependencies, not Word Lab runtime dependencies.

Test scenarios cover duplicate scoring, case normalization, invalid guesses, win/loss/restart/attempt limits, statistics and independent stores, source hashes and build reproducibility, dialect and answer-tier filters, single/multiple/incomplete/contradictory clues, positional and occurrence constraints, deterministic strategies, cancellation and stale responses, row controls, saved-state restoration, mixed physical/on-screen keys, keyboard tabs, mobile overflow, themes, worker responsiveness and dictionary errors. A small-alphabet exhaustive diagnostic test ensures feedback generated from a legitimate answer is never falsely called internally contradictory merely because that answer is absent from the selected dictionary.

Preview screenshots from real browser sessions are in [`docs/screenshots/`](screenshots/): desktop Wordle and Solver, plus 12-letter mobile dark-theme views. Screenshot puzzle states are demonstration fixtures, not benchmark outcomes.

At the initial validation, no Safari/Firefox run, full accessibility conformance audit, exhaustive large-dictionary strategy comparison, or mobile-device hardware test was performed. Later browser-engine coverage is recorded below. Known product/data limits and future optional modes are described in the README.

## Hard-mode follow-up

After adding the solver's persisted hard-mode option, `npm test` passed **66 tests across 9 files**, the complete Chromium suite passed **7 tests** (0 failed or skipped, approximately 9.8 seconds), and `npm run build` passed both typechecking and production bundling.

Added coverage checks positive-letter counts, accumulated greens, repeated clues, unfinished feedback, older saved-state compatibility, and every strategy in exact and approximate ranking. The real-worker browser test reproduces AUDIO with yellow D/I, verifies that enabling hard mode keeps 120 possible answers while requiring those letters in recommendations, changes D to green, checks all four strategies, reloads the saved option, and disables it again. The initial saved browser JSON above has not been replaced by this follow-up run.

## Audit fixes

After fixing virtual-key focus, solver input normalization, submitted-guess announcements, and light-theme text contrast, `npm test` passed **66 tests across 9 files**, the complete Chromium suite passed **10 tests**, and `npm run build` passed.

Three added browser regressions cover switching from settings to virtual and physical keys (including Enter/Backspace), retaining native keyboard activation of virtual buttons, invalid and pasted solver input with caret/save consistency, and feedback announcements across repeated guesses, errors, wins, and new games. The spoken summary includes each position and its feedback, and stays unchanged while the next word is typed.

Automated axe checks on the production build reported **zero definite violations** in either tab in light and dark themes. The repaired light-theme candidate caption measured **9.76:1** contrast and the footer credits **4.54:1**; dark-theme ratios were **8.24:1** and **8.15:1** respectively. Some automated checks still require manual interpretation; this is not a full accessibility certification. Live-region content was verified in Chromium, without a separate NVDA/VoiceOver speech-output session. No browser page errors occurred during these production checks.

## Long-word tiles and browser compatibility

Long solver words now wrap according to the available width of their row, including narrow tablet columns. Twelve letters use two numbered lines of six. Words with 7–11 letters use balanced lines when needed; ordinary five-letter rows remain on one line. Position labels are visual only, since each button already has a full accessible name, and the feedback collection has an explicit group role.

Validation after this change:

- **66 unit/integration tests** passed across 9 files; TypeScript/Vue checks and the production build passed.
- **36 browser tests** passed: the same 12 workflows in Chromium **156.0.8078.4**, Firefox **157.0**, and WebKit **27.2**. Chromium + Firefox completed in 35.5 seconds; WebKit completed in 29.4 seconds.
- Browser checks measured every 7–12-letter layout at **320, 375 and 768 CSS pixels**, with tiles at least **40px wide and 44px tall**, correct numbering, and no horizontal page overflow. Keyboard navigation and editing across the line break, accessible names, and restoration after reload passed in all three engines.
- Production axe checks covered both tabs and themes in all three engines, including the wrapped 12-letter solver. There were **zero definite violations** and no browser page errors. Some colour-contrast checks remain marked for manual interpretation. Raw results: [accessibility-browsers.json](../benchmarks/accessibility-browsers.json).

The browser suite now runs all three engines by default with four workers. This minimal WSL/Linux environment needed additional browser libraries, extracted into a temporary directory. WebKit's launcher replaces `LD_LIBRARY_PATH`, so missing libraries were linked into its local Playwright cache; application code and operating-system libraries were not modified for this workaround. Normal installations should use Playwright's documented `install-deps` command from the README.

These are browser-engine checks, not a Safari.app run on Apple hardware or a real screen-reader speech-output test. This environment had no installed NVDA/VoiceOver session. Those checks remain explicitly open.

### Manual screen-reader checks still required

Run with NVDA and Firefox on Windows, and VoiceOver and Safari on an Apple device. Record the operating system, browser and screen-reader versions alongside the result.

1. Navigate between Wordle and Solver using the tab controls; confirm each tab and its controls are named correctly and hidden content is skipped.
2. In Wordle, focus the Guess board and use the reader's interaction/focus mode. Submit a valid word. Confirm the attempt count and each letter's position and feedback are spoken, including repeated letters. Typing the next word should not continually repeat the previous feedback summary.
3. Submit an invalid word, repeat a valid guess, and finish a puzzle. Confirm validation errors, distinct guess numbers, and the final win/loss message are announced. Start a new game and confirm old feedback is cleared.
4. In Solver, choose 12 letters and enter CONVERSATION. Navigate through positions 6 and 7, then position 12. Confirm the spoken letter/position matches the visible number and that keyboard activation cycles absent → present → correct.
5. Add/remove a clue, enable hard mode, and reload. Confirm result-count announcements and restored controls remain understandable. Record any missing, duplicated, interrupted or excessively verbose announcements rather than assuming DOM/ARIA checks prove speech output.
