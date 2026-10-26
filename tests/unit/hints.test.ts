import { describe, expect, it } from 'vitest'
import type { SolverRow } from '../../src/core/solver/filter'
import { filterHardModeGuesses } from '../../src/core/solver/hints'
import { rankGuesses, strategyIds } from '../../src/core/solver/strategies'

describe('hard-mode hints', () => {
  it('requires yellow letters while still allowing grey letters in probes', () => {
    const hints: SolverRow[] = [{ id: '1', word: 'AUDIO', feedback: [0, 0, 1, 1, 0] }]
    expect(filterHardModeGuesses(['siler', 'riles', 'diver', 'idiom', 'diary'], hints)).toEqual([
      'diver',
      'idiom',
      'diary',
    ])
  })

  it('fixes green positions and retains the minimum count of yellow letters', () => {
    const hints: SolverRow[] = [{ id: '1', word: 'audio', feedback: [0, 0, 2, 1, 0] }]
    expect(filterHardModeGuesses(['rider', 'radii', 'diver', 'siler'], hints)).toEqual([
      'rider',
      'radii',
    ])
  })

  it('counts green and yellow copies together without adding repeated clues or capping copies', () => {
    // POPPY vs APPLE reveals two Ps, one of them fixed in the third position.
    const hint: SolverRow = { id: '1', word: 'poppy', feedback: [1, 0, 2, 0, 0] }
    expect(
      filterHardModeGuesses(['apple', 'apply', 'amply', 'sappy', 'puppy'], [
        hint,
        { ...hint, id: '2' },
      ]),
    ).toEqual(['apple', 'apply', 'sappy', 'puppy'])
  })

  it('combines green positions discovered in different rows', () => {
    const hints: SolverRow[] = [
      { id: '1', word: 'abb', feedback: [2, 0, 0] },
      { id: '2', word: 'caa', feedback: [0, 2, 0] },
    ]
    expect(filterHardModeGuesses(['aaa', 'aab', 'abc', 'baa'], hints)).toEqual(['aaa', 'aab'])
    expect(
      filterHardModeGuesses(['aaa', 'aab'], [
        ...hints,
        { id: '3', word: 'baa', feedback: [2, 0, 0] },
      ]),
    ).toEqual([])
  })

  it('ignores unfinished feedback and leaves the initial guess pool unrestricted', () => {
    const valid = ['apple', 'ample']
    const hints: SolverRow[] = [
      { id: '1', word: 'app', feedback: [2, 2, 2, 2, 2] },
      { id: '2', word: 'apple', feedback: [2, 2, 2, 2, 2], pendingFeedback: true },
    ]
    expect(filterHardModeGuesses(valid, hints)).toEqual(valid)
    expect(filterHardModeGuesses(valid, [])).toEqual(valid)
    expect(filterHardModeGuesses([], hints)).toEqual([])
  })

  it('requires yellow presence without banning its previous position', () => {
    const hints: SolverRow[] = [{ id: '1', word: 'crane', feedback: [0, 0, 1, 0, 0] }]
    expect(filterHardModeGuesses(['slate', 'apple', 'steel'], hints)).toEqual(['slate', 'apple'])
  })

  for (const exact of [true, false]) {
    it.each(strategyIds)(`%s enforces hints before ranking (exact=${exact})`, async (strategy) => {
      const valid = ['siler', 'diver', 'rider', 'radii', 'rides', 'aided']
      const possible = ['rider', 'rides']
      const hints: SolverRow[] = [{ id: '1', word: 'audio', feedback: [0, 0, 2, 1, 0] }]
      const ranking = await rankGuesses(strategy, valid, possible, {
        requiredHints: hints,
        exact,
        pairBudget: 1,
        shortlistSize: 10,
        limit: 10,
      })
      expect(ranking.guesses.map((guess) => guess.word).sort()).toEqual([
        'aided',
        'radii',
        'rider',
        'rides',
      ])
      expect(ranking.metadata.totalGuesses).toBe(4)
      expect(ranking.metadata.exact).toBe(exact || strategy === 'frequency')
      expect(ranking.guesses.some((guess) => !guess.isAnswer)).toBe(true)
      const unrestricted = await rankGuesses(strategy, valid, possible, { exact, limit: 10 })
      expect(unrestricted.guesses).toHaveLength(valid.length)
      const empty = await rankGuesses(strategy, valid, [], { requiredHints: hints })
      expect(empty.guesses).toEqual([])
    })
  }
})
