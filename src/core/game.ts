import { feedbackEquals, normalizeWord, scoreGuess, type LetterFeedback } from './scoring'
import { isSettings, type DictionarySettings } from './dictionary/types'
export const DEFAULT_ATTEMPTS = 6
export interface GameGuess {
  word: string
  feedback: LetterFeedback[]
}
export interface GameSession {
  id: string
  settings: DictionarySettings
  answer: string
  guesses: GameGuess[]
  input: string
  maxAttempts: number
  status: 'playing' | 'won' | 'lost'
}
export interface Statistics {
  played: number
  won: number
  streak: number
  bestStreak: number
  distribution: Record<string, number>
}
export function emptyStatistics(): Statistics {
  return { played: 0, won: 0, streak: 0, bestStreak: 0, distribution: {} }
}
export function statisticsKey(game: GameSession) {
  return `${game.settings.length}/${game.settings.spelling}/${game.settings.difficulty}/${game.maxAttempts}`
}
export function createGame(
  answer: string,
  settings: DictionarySettings,
  maxAttempts = DEFAULT_ATTEMPTS,
): GameSession {
  if (
    !isSettings(settings) ||
    !new RegExp(`^[a-z]{${settings.length}}$`).test(answer) ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1
  )
    throw new Error('Cannot start this puzzle.')
  return {
    id: crypto.randomUUID(),
    settings: { ...settings },
    answer,
    maxAttempts,
    guesses: [],
    input: '',
    status: 'playing',
  }
}
export function submitGuess(
  game: GameSession,
  raw: string,
  valid: ReadonlySet<string>,
): GameSession {
  if (game.status !== 'playing') throw new Error('This puzzle has ended. Start a new game.')
  const word = normalizeWord(raw)
  if (!/^[a-z]+$/.test(word)) throw new Error('Use letters A–Z only.')
  if (word.length !== game.settings.length)
    throw new Error(`Enter ${game.settings.length} letters.`)
  if (!valid.has(word)) throw new Error('That word is not in this dictionary.')
  const guesses = [...game.guesses, { word, feedback: scoreGuess(word, game.answer) }]
  return {
    ...game,
    guesses,
    input: '',
    status: word === game.answer ? 'won' : guesses.length >= game.maxAttempts ? 'lost' : 'playing',
  }
}
export function recordResult(previous: Statistics, game: GameSession): Statistics {
  if (game.status === 'playing') return previous
  const won = game.status === 'won',
    streak = won ? previous.streak + 1 : 0
  const distribution = { ...previous.distribution }
  if (won) distribution[game.guesses.length] = (distribution[game.guesses.length] ?? 0) + 1
  return {
    played: previous.played + 1,
    won: previous.won + Number(won),
    streak,
    bestStreak: Math.max(previous.bestStreak, streak),
    distribution,
  }
}
export function randomIndex(
  size: number,
  random: (a: Uint32Array) => Uint32Array = (a) => crypto.getRandomValues(a),
): number {
  if (!Number.isInteger(size) || size < 1 || size > 0x100000000)
    throw new Error('No eligible answers for these settings.')
  const limit = Math.floor(0x100000000 / size) * size
  const value = new Uint32Array(1)
  do {
    random(value)
  } while (value[0] >= limit)
  return value[0] % size
}
export function isGame(value: unknown): value is GameSession {
  try {
    const g = value as GameSession
    if (
      !g ||
      !isSettings(g.settings) ||
      typeof g.id !== 'string' ||
      typeof g.answer !== 'string' ||
      !new RegExp(`^[a-z]{${g.settings.length}}$`).test(g.answer) ||
      !Number.isInteger(g.maxAttempts) ||
      g.maxAttempts < 1 ||
      g.maxAttempts > 20 ||
      !Array.isArray(g.guesses) ||
      g.guesses.length > g.maxAttempts ||
      typeof g.input !== 'string' ||
      !/^[a-z]*$/.test(g.input) ||
      g.input.length > g.settings.length
    )
      return false
    if (
      !g.guesses.every(
        (row) =>
          typeof row.word === 'string' &&
          feedbackEquals(scoreGuess(row.word, g.answer), row.feedback),
      )
    )
      return false
    const wonAt = g.guesses.findIndex((row) => row.word === g.answer)
    if (wonAt >= 0 && wonAt !== g.guesses.length - 1) return false
    return (
      g.status === (wonAt >= 0 ? 'won' : g.guesses.length === g.maxAttempts ? 'lost' : 'playing')
    )
  } catch {
    return false
  }
}
