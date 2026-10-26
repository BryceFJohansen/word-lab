import { it, expect } from 'vitest'
import { simulateBatch, summarize } from '../../src/core/simulation'
it('solves deterministic fixtures without exposing secrets to ranking and produces traces', async () => {
  const result = await simulateBatch(
    ['cat', 'car', 'bar', 'aaa'],
    ['cat', 'car', 'bar'],
    ['car', 'cat', 'bar'],
    'entropy',
    6,
  )
  expect(result.summary.solved).toBe(3)
  expect(result.summary.solvePercentage).toBe(100)
  expect(new Set(result.puzzles.map((p) => p.trace[0].guess)).size).toBe(1)
  for (const p of result.puzzles) {
    expect(p.trace.at(-1)?.guess).toBe(p.answer)
    expect(p.trace.at(-1)?.feedback).toEqual([2, 2, 2])
  }
})
it('records failures with a maxAttempts + 1 penalty and excludes them from solved medians', () => {
  const summary = summarize(
    [
      { answer: 'cat', solved: true, guesses: 2, elapsedMs: 2, trace: [] },
      { answer: 'bar', solved: false, guesses: 6, elapsedMs: 4, trace: [] },
    ],
    6,
    10,
  )
  expect(summary).toMatchObject({
    attempted: 2,
    solved: 1,
    failures: 1,
    solvePercentage: 50,
    averageSolved: 2,
    averagePenalized: 4.5,
    medianSolved: 2,
    maximumGuesses: 6,
    averageComputationMs: 3,
    distribution: { 2: 1, failed: 1 },
  })
})
