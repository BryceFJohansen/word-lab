# Word Lab

A locally runnable word game and independent puzzle solver. Vue 3, TypeScript, Vite, Pinia, Vitest and Playwright. No backend, account, external runtime API, remote fonts or analytics.

## License

Word Lab's application code and original documentation are licensed under the [MIT License](LICENSE). Bundled SCOWL dictionary sources and generated dictionary data retain their own license terms and attribution requirements; see [NOTICE](NOTICE) and the [complete dictionary license](public/DICTIONARY-LICENSE.txt).

## Run locally

Use Node **22.18+ or 24+** (tested on 24.21.0) and npm.

```sh
npm ci
npm run dev
```

Open the URL Vite prints, normally **http://127.0.0.1:5173**. Generated dictionaries are included, so no dictionary download or rebuild is required. Use a web server rather than opening `index.html` as a file; workers and asset loading need HTTP.

```sh
npm run build
npm run preview
```

The production site is in `dist/`. It can be served by any static HTTP server. Keep `DICTIONARY-LICENSE.txt` with the build. This project has not been deployed to external hosting.

## Play and solve

- **Wordle:** choose 3–12 letters, vocabulary and spelling, then start a new game. Settings affect the next puzzle only. Six attempts, random answers, physical and on-screen keyboards. Invalid guesses consume no attempts. The answer appears after a loss.
- **Solver:** enter any number of guesses up to 100, without submitting them individually. Tiles cycle absent → present → correct. All complete rows combine; unfinished rows do not constrain the answer. Plus inserts immediately below its row; minus removes it or clears the final row.
- Long solver words wrap into two numbered rows when space is tight. Read positions left to right, then continue on the next line; twelve letters use two rows of six.
- Recommendations show five guesses when the dictionary has that many, their strategy scores, and whether each is a candidate. **Use** fills an empty/new row but waits for feedback before filtering. Tap a feedback tile, or choose **mark all absent** if that was the actual result.
- Enable **Hard mode — use revealed hints** beneath Strategy when your game requires it. All four strategies then keep greens fixed and include the revealed yellow letters, respecting repeated copies. Grey letters can still be reused. The setting is saved; turning it on changes recommendations without changing the possible answers.
- Candidate search is substring-based and displays 36 words per page. Zero results preserve input and distinguish provable contradictions from uncertain dictionary mismatches.
- Each tab has independent settings, progress and errors. Changing the solver’s word length clears its rows. Changing its spelling or vocabulary reuses the current clues against the new dictionary. Resetting one tab never resets the other.
- Theme, selected tab, game, solver and statistics persist in versioned localStorage. Completed-game statistics are separated by length, spelling, vocabulary and attempt limit. Abandoning a puzzle does not record a loss. Private browsing, clearing site data, or switching origins/ports may discard or separate progress.

## Verify

```sh
npm test
npm run dictionary:validate
npx playwright install chromium firefox webkit
npm run test:e2e
npm run build
```

On minimal Linux installations, Playwright may need browser system libraries: `npx playwright install-deps chromium firefox webkit` (an operating-system package installation). Tests launch their own Vite server on port 4173 and run in all three engines. To run one engine, use `npm run test:e2e -- --project=firefox` (or `chromium` / `webkit`). The browser tests cover a win, a loss, invalid guesses, multi-row live solving, independent tabs, persistence, theme, numbered long-word feedback at phone/tablet widths, accessible names and keyboard order, worker responsiveness and dictionary errors. Unit tests also cover duplicate letters, rankings, contradiction diagnostics, cancellation and stale responses, dictionary caching, statistics and simulations.

The test browser can read a seeded fixture answer from its own test setup. **The application solver has no import, field, message, or API that supplies the game’s secret.** Since this is a local game, its secret is necessarily inspectable in localStorage/developer tools; it is not designed for competitive anti-cheat.

## Dictionary data

```sh
npm run dictionary:build
npm run dictionary:validate
```

The offline build verifies checksums of bundled SCOWL inputs, filters ordinary lowercase ASCII words, retains dialect membership, excludes source proper-name/abbreviation categories, groups by length, and emits deterministic JSON plus metadata. Validation rebuilds in memory and compares every output byte-for-byte.

**217,980 valid guesses** across lengths 3–12, using the combined spelling mode:

| Letters | Valid guesses | Common answers | Standard answers | All answers |
|---:|---:|---:|---:|---:|
| 3 | 1,151 | 481 | 659 | 1,149 |
| 4 | 4,964 | 1,888 | 2,575 | 4,954 |
| 5 | 11,193 | 3,493 | 5,094 | 11,184 |
| 6 | 19,816 | 5,359 | 8,261 | 19,802 |
| 7 | 29,870 | 6,802 | 11,568 | 29,857 |
| 8 | 37,175 | 6,648 | 12,652 | 37,164 |
| 9 | 36,799 | 5,604 | 11,746 | 36,791 |
| 10 | 32,523 | 4,260 | 9,776 | 32,521 |
| 11 | 25,693 | 2,758 | 7,093 | 25,689 |
| 12 | 18,796 | 1,544 | 4,667 | 18,792 |

Source: **SCOWL 2020.12.07**, retrieved 10 October 2026. SCOWL’s permissive collective licence includes notices for Kevin Atkinson, VarCon, WordNet, UKACD and Ispell, plus public-domain component lists. The full licence is retained in [data/sources/scowl/Copyright](data/sources/scowl/Copyright) and [public/DICTIONARY-LICENSE.txt](public/DICTIONARY-LICENSE.txt). **UKACD Copyright (c) J Ross Beresford 1993–1999. All Rights Reserved.** Generated files are modified, filtered derivatives; they are not an official SCOWL release.

Common/Standard/All use documented SCOWL coverage levels **≤35 / ≤60 / ≤80**, followed by answer exclusions. These are source-informed vocabulary bands, not invented corpus frequencies or a manually playtested answer list. Inflections and plurals are included. UK / NZ style is the British `-ise` subset, not a dedicated NZ lexicon. Combined is US ∪ British. See [dictionary provenance, policy and limitations](docs/DICTIONARY.md), including why dwyl was investigated but not included.

## Benchmark algorithms

```sh
npm run benchmark -- --length 5 --strategy entropy --sample 25 --seed 2026
npm run benchmark -- --strategies frequency,entropy,expected,minimax --sample 25 --seed 2026 --output benchmarks/comparison
npm run benchmark -- --length 3 --spelling uk --difficulty common --strategy entropy --full --exact
npm run benchmark:performance
```

Options also include `--max-attempts` and `--help`. Reports export detailed JSON traces, per-puzzle CSV and summary CSV. All compared strategies receive the **same answer sample**. Failures cost `maxAttempts + 1` in the penalized average; solved-only averages and medians omit failures.

Frequency evaluates every valid guess against the full candidate pool. The other three strategies exhaustively evaluate up to **2,000,000 guess–answer pairs**. Above that, they use the top 180 frequency guesses plus up to 50 highly ranked candidates, with a fixed-seed sample of up to 1,200 answers. UI and reports label restricted evaluation **approximate**. `--exact` disables both restrictions. Exhaustive full-dictionary runs can be expensive.

The included 25-word, five-letter Common benchmark (seed 2026) solved **23/25** with frequency and **25/25** with each partition strategy. Solved-game averages: **3.83 / 3.76 / 3.60 / 3.84** for frequency / entropy / expected / minimax. These are small-sample observations. Raw results, hardware, timings and search settings are in [benchmarks/comparison-5-common.json](benchmarks/comparison-5-common.json) and [benchmark notes](docs/BENCHMARKS.md).

## Main modules

| Module | Responsibility |
|---|---|
| `src/core/scoring/` | Single authoritative two-pass duplicate-aware scorer and ternary feedback encoding |
| `src/core/dictionary/`, `src/dictionaries/` | Types, vocabulary selection, lazy asset loading and caches |
| `src/core/game.ts`, `src/stores/game.ts` | Pure game rules, unbiased answer sampling, statistics and game persistence |
| `src/core/solver/` | Exact clue intersection, conservative diagnostics and four ranking strategies |
| `src/workers/`, `src/stores/solver.ts` | Background calculations, cancellation, stale-result protection and independent solver state |
| `src/views/`, `src/components/`, `src/style.css` | Accessible Vue views, common controls and responsive themes |
| `src/core/simulation/`, `scripts/` | Reusable simulations, dictionary build/validation and benchmark CLI |
| `data/`, `tests/`, `docs/`, `benchmarks/` | Verified inputs/licences, automated tests, decisions and measured reports |

See [architecture](docs/ARCHITECTURE.md) and [solver algorithms](docs/SOLVER.md).

## Deliberate limits

The future Lab tab, daily puzzles, hard-mode enforcement in the playable Wordle tab, other languages, cloud sync and a service worker are not implemented. The solver supports hard-mode recommendations. All requested first-release game/solver features and the CLI laboratory are implemented. Browser tests target Chromium, Firefox and WebKit. WebKit engine coverage is not a Safari.app test on Apple hardware; real NVDA/VoiceOver speech output also needs manual verification. See the remaining [manual accessibility checks](docs/VALIDATION.md#manual-screen-reader-checks-still-required). Common is not a guarantee that every word will be familiar. The source taboo lists and maintainable answer exclusions cannot guarantee removal of every potentially offensive use. SCOWL level 80 intentionally admits unusual vocabulary and can contain source errors. Ambiguous zero-candidate diagnoses remain uncertain. Frequency is a simple baseline and can repeat an unhelpful guess; simulations record such failures honestly.
