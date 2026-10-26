import { describe, expect, it } from 'vitest'
import { scoreGuess, encodeFeedback } from '../../src/core/scoring'
describe('authoritative duplicate-aware scoring', () => {
  it.each([
    ['crane', 'crane', [2, 2, 2, 2, 2]],
    ['blimp', 'crane', [0, 0, 0, 0, 0]],
    ['trace', 'crane', [0, 2, 2, 1, 2]],
    ['abc', 'bca', [1, 1, 1]],
    ['allee', 'apple', [2, 1, 0, 0, 2]],
    ['eerie', 'serve', [0, 2, 2, 0, 2]],
    ['level', 'hello', [1, 2, 0, 0, 1]],
    ['aaaaa', 'banal', [0, 2, 0, 2, 0]],
    ['belle', 'level', [0, 2, 1, 1, 1]],
    ['sassy', 'assay', [1, 1, 2, 0, 2]],
    [' CRANE ', 'CrAnE', [2, 2, 2, 2, 2]],
    ['aa', 'aa', [2, 2]],
  ])('%s against %s', (guess, answer, feedback) =>
    expect(scoreGuess(guess, answer)).toEqual(feedback),
  )
  it.each([
    ['a', 'ab'],
    ['', ''],
    ['hello', 'he11o'],
    ['café', 'cafe'],
  ])('rejects incompatible input %s/%s', (g, a) => expect(() => scoreGuess(g, a)).toThrow())
  it('encodes patterns without collision', () => {
    const patterns = new Set<number>()
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++) patterns.add(encodeFeedback([a, b, c]))
    expect(patterns.size).toBe(27)
  })
})
