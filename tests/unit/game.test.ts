import { describe, it, expect } from 'vitest'
import {
  createGame,
  emptyStatistics,
  isGame,
  randomIndex,
  recordResult,
  submitGuess,
} from '../../src/core/game'
import { defaultSettings } from '../../src/core/dictionary/types'
const valid = new Set(['apple', 'allee', 'crane', 'hello'])
describe('game rules', () => {
  it('rejects invalid input without consuming attempts', () => {
    const game = createGame('apple', defaultSettings)
    for (const word of ['app', 'abcde', '12345', ''])
      expect(() => submitGuess(game, word, valid)).toThrow()
    expect(game.guesses).toHaveLength(0)
  })
  it('scores, wins, prevents postgame guesses and validates restored state', () => {
    let game = createGame('apple', defaultSettings)
    game = submitGuess(game, 'allee', valid)
    expect(game.guesses[0].feedback).toEqual([2, 1, 0, 0, 2])
    game = submitGuess(game, 'APPLE', valid)
    expect(game.status).toBe('won')
    expect(isGame(game)).toBe(true)
    expect(() => submitGuess(game, 'crane', valid)).toThrow('ended')
    expect(isGame({ ...game, status: 'playing' })).toBe(false)
    expect(isGame({ ...game, input: 'toooolong' })).toBe(false)
  })
  it('enforces custom attempt limits and resets on a new game', () => {
    const ended = submitGuess(createGame('apple', defaultSettings, 1), 'crane', valid)
    expect(ended.status).toBe('lost')
    expect(ended.answer).toBe('apple')
    expect(createGame('crane', defaultSettings).guesses).toHaveLength(0)
  })
  it('records win distribution and resets winning streak on loss', () => {
    const won = submitGuess(createGame('apple', defaultSettings), 'apple', valid)
    const stats = recordResult(emptyStatistics(), won)
    expect(stats).toEqual({ played: 1, won: 1, streak: 1, bestStreak: 1, distribution: { 1: 1 } })
    const lost = submitGuess(createGame('apple', defaultSettings, 1), 'crane', valid)
    expect(recordResult(stats, lost)).toMatchObject({ played: 2, won: 1, streak: 0, bestStreak: 1 })
  })
  it('uses rejection sampling without modulo bias', () => {
    let calls = 0
    expect(
      randomIndex(3, (a) => {
        a[0] = calls++ === 0 ? 0xffffffff : 5
        return a
      }),
    ).toBe(2)
    expect(calls).toBe(2)
    expect(() => randomIndex(0)).toThrow('No eligible')
  })
})
