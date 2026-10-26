# Measured benchmarks

Recorded 10 October 2026 on Linux x64, Node **24.21.0**, **AMD Ryzen 7 2700X Eight-Core Processor**, 16 logical CPUs, **16,725,401,600 bytes RAM** (about 15.6 GiB). These are single-machine observations, not universal performance guarantees. The implementation runs ranking on one thread; CPU count is descriptive, not a parallel benchmark configuration.

## Comparable strategy sample

```sh
npm run benchmark -- --strategies frequency,entropy,expected,minimax --sample 25 --seed 2026 --output benchmarks/comparison-5-common
```

All four strategies received the exact same 25 sampled answers, five letters, Combined spelling, Common vocabulary, six attempts, **11,193 valid guesses** and **3,493 eligible answers**. Full sample, traces, dictionary SHA-256, environment and metrics are retained in `benchmarks/comparison-5-common.json`; per-puzzle and summary CSV files accompany it.

| Strategy | Solved | Mean guesses, wins | Mean incl. failures | Median, wins | Maximum used | Mean computation / puzzle | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Frequency | 23/25 (92%) | 3.826 | 4.08 | 4 | 6 | 35.5 ms | 0.89 s |
| Entropy | 25/25 (100%) | 3.76 | 3.76 | 4 | 6 | 153.8 ms | 3.84 s |
| Expected remaining | 25/25 (100%) | 3.60 | 3.60 | 4 | 5 | 174.4 ms | 4.36 s |
| Minimax | 25/25 (100%) | 3.84 | 3.84 | 4 | 6 | 159.4 ms | 3.98 s |

Unsolved puzzles are assigned **7 guesses** only in the penalized mean. Median and mean on wins exclude failures. Maximum used reports actual attempts, including failures. `babes` and `seals` were the frequency failures; see traces for the exact guesses. The simple frequency heuristic can repeat an unhelpful probe. Partition strategies do not silently substitute the answer.

Frequency computes its heuristic over the full population. Default partition strategies use approximate early searches when the pair count exceeds 2,000,000: top 180 frequency guesses plus up to 50 candidates, sample at most 1,200 answers, then exact evaluation once below the threshold. The report counts exact/approximate steps separately. **These results do not establish a broadly superior strategy.** Larger, full-dictionary comparisons and multiple representative lengths are needed for that claim.

Timing includes shared per-strategy candidate-set decision caching between puzzles, including the opening. A repeated state is measured as a cache hit; reports state this convention. Rankings themselves do not have access to the secret. CLI timings omit worker messaging, browser rendering and worker yield delays, so they should not be presented as UI latency.

## Dictionary, filtering, ranking and memory

```sh
npm run benchmark:performance
```

This exercises **All** vocabulary, Combined spelling at lengths 3, 5, 8 and 12. Each row is a single run. File reading, JSON parsing and selection are included in load time. OS caches are not flushed. Filtering uses one reproducible valid guess/answer pair from the dictionary; therefore selectivity differs by length. Rankings here start from the full answer pool, independent of that filter measurement.

| Length | Valid / answers | Load | Filter | Frequency | Entropy | Expected | Minimax |
|---|---:|---:|---:|---:|---:|---:|---:|
| 3 | 1,151 / 1,149 | 6.98 ms | 1.56 ms | 4.50 ms | 269.40 ms | 249.82 ms | 251.90 ms |
| 5 | 11,193 / 11,184 | 8.20 ms | 6.74 ms | 27.57 ms | 76.03 ms | 70.56 ms | 86.33 ms |
| 8 | 37,175 / 37,164 | 25.14 ms | 15.73 ms | 92.14 ms | 193.76 ms | 162.63 ms | 167.47 ms |
| 12 | 18,796 / 18,792 | 8.87 ms | 7.85 ms | 93.39 ms | 194.88 ms | 163.46 ms | 197.76 ms |

Three-letter partition ranking is exhaustive here; the other partition rows are approximate. The latter can be faster despite larger dictionaries because fewer pairs are evaluated. Raw search counts and heap-used deltas are in `benchmarks/performance.json`. Heap deltas are process observations affected by garbage collection, not peak-memory claims.

## Browser responsiveness and validation

The Playwright suite changes solver settings during real worker work, then verifies only the newest length’s count and recommendations. A 30-tick, 16 ms main-thread heartbeat runs while an eight-letter All/Minimax request is active, with a deliberately loose **250 ms maximum interval** regression bound. The observed interval is recorded as the `worker-heartbeat-ms` test annotation. This includes browser scheduling and machine load; it is a responsiveness check, not a controlled animation benchmark.

`benchmarks/e2e-results.json` contains the executed browser report. The six workflows include complete win/loss games, multi-row feedback editing, candidate recalculation, recommendation insertion without invented feedback, tab independence, restoration, twelve-letter mobile layouts, themes, keyboard tabs and dictionary-load errors. The final verification record is in `docs/VALIDATION.md`.
