import { describe, it, expect, vi } from 'vitest'
import {
  completedRows,
  diagnose,
  filterCandidates,
  type SolverRow,
} from '../../src/core/solver/filter'
import { scoreGuess } from '../../src/core/scoring'
import {
  frequencyRanking,
  partitionMetrics,
  rankGuesses,
  strategyIds,
  seededSample,
} from '../../src/core/solver/strategies'
const answers = ['apple', 'ample', 'allee', 'apply', 'angle', 'addle', 'maple']
const row = (word: string, answer: string, id = word): SolverRow => ({
  id,
  word,
  feedback: scoreGuess(word, answer),
})
describe('feedback intersection', () => {
  it('never diagnoses valid feedback as internally impossible, even when the answer is missing', () => {
    const words: string[] = []
    for (const a of 'abc') for (const b of 'abc') for (const c of 'abc') words.push(a+b+c)
    for (const answer of words) for (const guess of words) {
      const diagnostic = diagnose(['zzz'], [row(guess, answer), row('abc', answer, 'second')], 3)
      expect(diagnostic?.kind).not.toBe('internal')
    }
  })
  it('combines complete rows with AND and ignores incomplete rows', () => {
    const rows = [
      row('allee', 'apple'),
      row('maple', 'apple'),
      { id: 'blank', word: 'a', feedback: [0, 0, 0, 0, 0] },
    ]
    expect(completedRows(rows, 5)).toHaveLength(2)
    expect(filterCandidates(answers, rows)).toEqual(['apple'])
    expect(filterCandidates(answers, [])).toEqual(answers)
  })
  it('handles duplicate greys, greens and yellow restrictions exactly', () => {
    expect(filterCandidates(answers, [row('allee', 'apple')])).toEqual([
      'apple',
      'ample',
      'angle',
      'addle',
    ])
    expect(filterCandidates(['apple', 'ample', 'addle'], [row('ppppp', 'apple')])).toEqual([
      'apple',
    ])
    expect(filterCandidates(['crane', 'cater', 'trace'], [row('trace', 'crane')])).toEqual([
      'crane',
    ])
  })
  it('accepts guesses outside the candidate dictionary', () =>
    expect(filterCandidates(['apple'], [row('zzzzz', 'apple')])).toEqual(['apple']))
  it('does not fabricate feedback for inserted suggestions', () =>
    expect(
      filterCandidates(answers, [{ ...row('apple', 'apple'), pendingFeedback: true }]),
    ).toEqual(answers))
  it('distinguishes provable conflicts from dictionary misses', () => {
    const contradictory = [row('apple', 'apple', 'one'), row('apple', 'zzzzz', 'two')]
    expect(filterCandidates(answers, contradictory)).toEqual([])
    expect(diagnose(answers, contradictory, 5)?.kind).toBe('internal')
    expect(diagnose(answers, [row('crane', 'crane')], 5)?.kind).toBe('dictionary')
    expect(diagnose(answers, [], 5)).toBe(null)
  })
  it('proves count contradictions and identifies useful removal checks', () => {
    const rows = [row('allee', 'apple', 'one'), row('apple', 'allee', 'two')]
    const diagnostic = diagnose(answers, rows, 5)
    expect(diagnostic?.kind).toBe('internal')
    expect(diagnostic?.rowIds).toEqual(['one', 'two'])
  })
})
describe('strategies', () => {
  it('calculates entropy, expected size, and worst bucket from hand-known partitions', () => {
    expect(partitionMetrics('cat', ['cat', 'car', 'bar'])).toEqual({
      entropy: Math.log2(3),
      expected: 1,
      worst: 1,
    })
    expect(partitionMetrics('aaa', ['cat', 'car', 'bar'])).toEqual({
      entropy: 0,
      expected: 3,
      worst: 3,
    })
  })
  it('does not multiply a duplicate letter’s global frequency reward', () => {
    const ranking = frequencyRanking(['aaa', 'abc'], ['abc', 'bca', 'cab'])
    expect(ranking[0].word).toBe('abc')
    expect(ranking[1].score).toBeCloseTo(1 + 1 / 6)
  })
  it.each(strategyIds)(
    '%s ranks deterministic ties and prefers a remaining answer',
    async (strategy) => {
      const first = await rankGuesses(
        strategy,
        ['cat', 'aaa', 'bar', 'car'],
        ['cat', 'car', 'bar'],
        { exact: true, limit: 10 },
      )
      const second = await rankGuesses(
        strategy,
        ['car', 'bar', 'aaa', 'cat'],
        ['cat', 'car', 'bar'],
        { exact: true, limit: 10 },
      )
      expect(first.guesses).toEqual(second.guesses)
      expect(first.guesses[0].isAnswer).toBe(true)
      expect(first.guesses.at(-1)?.word).toBe('aaa')
      const single = await rankGuesses(strategy, ['apple', 'ample'], ['apple'])
      expect(single.guesses[0].word).toBe('apple')
    },
  )
  it('labels restricted search and samples reproducibly', async () => {
    const result = await rankGuesses('entropy', answers, answers, {
      pairBudget: 1,
      shortlistSize: 2,
      sampleSize: 3,
    })
    expect(result.metadata.exact).toBe(false)
    expect(result.metadata.evaluatedAnswers).toBe(3)
    expect(result.metadata.evaluatedGuesses).toBeLessThan(answers.length)
    expect(seededSample(answers, 4, 42)).toEqual(seededSample(answers, 4, 42))
  })
  it('cancels cooperative work after yielding', async () => {
    let cancelled = false
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 10))
    await expect(
      rankGuesses('entropy', Array(40).fill('apple'), answers, {
        exact: true,
        cancelled: () => cancelled,
        yieldControl: async () => {
          cancelled = true
        },
      }),
    ).rejects.toThrow('superseded')
  })
})
