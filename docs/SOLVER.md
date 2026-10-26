# Solver correctness and search policy

## Authoritative scoring

`scoreGuess` trims and lowercases input, checks equal nonzero lengths and ASCII letters, then calls `scoreNormalized`. The latter is an internal validated-input hot path used by ranking/filtering. Both use the exact same two-pass algorithm: mark and consume greens, count remaining answer occurrences, allocate yellows left-to-right while an occurrence remains, mark the rest absent. For example, ALLEE vs APPLE is green/yellow/grey/grey/green.

Feedback codes are ternary integers, computed left-to-right as `code * 3 + feedback`. At length 12 the largest code is 531,440, comfortably within exact JavaScript integers. No independent letter-based filter is used: every complete row is rescored against each candidate and must match exactly. Incomplete and pending-suggestion rows are ignored; guesses need not be candidates or even in the selected guess dictionary. Unknown guesses show a note and still provide usable evidence.

## Algorithms

| ID | Primary objective |
|---|---|
| `frequency` | Maximize distinct-letter candidate coverage plus 0.5 times best matching positional frequency for each distinct letter |
| `entropy` | Maximize `-sum(p * log2(p))` over feedback buckets |
| `expected` | Minimize `sum(bucketSize²) / candidateCount` |
| `minimax` | Minimize the largest feedback bucket |

Frequency gives each distinct letter one global contribution and its strongest position, so repeated guess letters do not multiply coverage. It is a heuristic, not information theory, and can select a word that produces no progress. The simulator reports failures rather than switching algorithms without disclosure.

Exact partition algorithms consider **all eligible valid guesses**, including probes outside the remaining answers. Every candidate is treated as equally likely; SCOWL levels are not converted into invented probabilities.

Tie-breaking is primary score; candidate membership preferred; secondary metric (lower expected size for entropy, higher entropy for expected/minimax); then ASCII alphabetical word order. Frequency has no additional secondary metric and uses primary score, membership, alphabetic order. Generated lists have stable ASCII ordering.

## Hard-mode recommendations

The solver's **Hard mode — use revealed hints** option defaults to off and persists independently of the game. Older saves retain their clues and load with the option off. Changing it triggers a fresh worker calculation and cancels obsolete results.

With hard mode on, `filterHardModeGuesses` keeps every green in its revealed position and requires at least the greatest number of positive (green plus yellow) occurrences of each letter seen in any complete row. Repeated clues do not add copies together; green positions from different rows all remain mandatory. Incomplete rows and suggestions awaiting real feedback do not contribute constraints.

These rules enforce positive hints: grey letters may be reused, extra copies are allowed, and a yellow letter may be guessed again in its earlier position. The possible-answer list still applies the full exact feedback rules, including exclusions and maximum letter counts. Thus a legal hard-mode recommendation can be an information-gathering guess outside the possible answers.

The shared ranking entry point takes optional `requiredHints` in its context and filters the legal guess pool before any frequency shortlisting or partition evaluation. All four strategies, both exact and approximate, use this pool. Displayed guess totals refer to the eligible pool. CLI simulations and the recorded benchmarks remain unrestricted.

## Exact vs approximate

The default pair budget is **2,000,000**. If `eligibleGuesses × candidates` is at or below it, entropy/expected/minimax evaluate every pair. Above it:

1. Score the eligible guess vocabulary using the frequency baseline over all current candidates.
2. Evaluate the top 180 guesses, plus up to 50 top-ranked candidate words not already included.
3. Use all candidates up to 1,200, otherwise sample 1,200 via fixed-seed partial Fisher–Yates (LCG seed 2026).
4. Report evaluated/total guesses and evaluated/total answers, labelled approximate. Sample-based expected/minimax scores refer to the sampled population, not an extrapolated full-pool estimate.

Frequency always evaluates its defined heuristic exactly over the full pool; the label does not claim optimal word selection. The CLI’s `--exact` forces full partition evaluation and can be slow for long-word All dictionaries. Even exact one-step entropy is not a globally optimal multi-step solution strategy.

The implementation avoids an unbounded all-pairs cache. Dictionaries are cached, feedback partitions are computed as needed, and simulations memoize candidate-set decisions (cleared at 20,000 entries) across games within one strategy. Feedback matching remains exact even when ranking is approximate. Worker scheduling and generation checks are described in ARCHITECTURE.md.

## Contradictions

Zero candidates never produces fabricated recommendations. A conservative consistency check can prove conflicting greens, a forbidden green position, incompatible minimum/maximum letter counts, impossible required positions, or too many required letters. It uses exact per-row counts derived from duplicate-aware feedback, including grey copies limiting multiplicity. Unproven cases are called dictionary mismatches, with an explicit caveat that the true answer may be missing or the clues wrong. The checker is intentionally not a complete logical satisfiability solver.

For up to 12 complete rows, diagnostic removal checks identify rows whose individual removal restores dictionary matches. These are useful editing hints, not a unique or minimum explanation. Larger row sets preserve the diagnostic without expensive quadratic row-removal analysis.

## Benchmarks

The same scorer, filtering and ranking are reused by `simulateBatch`. Ranking has no secret-answer parameter; only the scoring step receives the answer. Each trace records guess, feedback, candidates before/after and exact/approximate metadata. Future Lab views can consume these structures without a second solver implementation.
