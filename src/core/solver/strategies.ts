import { encodeFeedback, scoreNormalized } from '../scoring'
import type { SolverRow } from './filter'
import { filterHardModeGuesses } from './hints'
export const strategyIds = ['frequency', 'entropy', 'expected', 'minimax'] as const
export type StrategyId = (typeof strategyIds)[number]
export const strategyNames: Record<StrategyId, string> = {
  frequency: 'Letter frequency',
  entropy: 'Information gain',
  expected: 'Expected remaining',
  minimax: 'Minimax',
}
export interface RankedGuess {
  word: string
  score: number
  isAnswer: boolean
  entropy?: number
  expected?: number
  worst?: number
  explanation: string
}
export interface SolverContext {
  /** Hard mode: enforce positive clues before shortlisting or ranking guesses. */
  requiredHints?: readonly SolverRow[]
  exact?: boolean
  pairBudget?: number
  shortlistSize?: number
  sampleSize?: number
  limit?: number
  cancelled?: () => boolean
  yieldControl?: () => Promise<void>
}
export interface RankingMetadata {
  exact: boolean
  evaluatedGuesses: number
  totalGuesses: number
  evaluatedAnswers: number
  totalAnswers: number
  strategy: StrategyId
}
export interface Ranking {
  guesses: RankedGuess[]
  metadata: RankingMetadata
}
export interface SolverStrategy {
  id: StrategyId
  name: string
  rankGuesses(
    validGuesses: readonly string[],
    possibleAnswers: readonly string[],
    context: SolverContext,
  ): Promise<RankedGuess[]>
}
export const DEFAULT_SEARCH = { pairBudget: 2_000_000, shortlistSize: 180, sampleSize: 1200 }
const alphabetic = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
export function frequencyRanking(
  valid: readonly string[],
  answers: readonly string[],
): RankedGuess[] {
  if (!answers.length) return []
  const global = new Uint32Array(26),
    positional = Array.from({ length: answers[0].length }, () => new Uint32Array(26))
  for (const word of answers) {
    for (const char of new Set(word)) global[char.charCodeAt(0) - 97]++
    for (let i = 0; i < word.length; i++) positional[i][word.charCodeAt(i) - 97]++
  }
  const answerSet = new Set(answers)
  return valid
    .map((word) => {
      let score = 0
      // Each distinct letter contributes once, with its strongest positional match.
      for (const char of new Set(word)) {
        const code = char.charCodeAt(0) - 97
        let bestPosition = 0
        for (let i = 0; i < word.length; i++)
          if (word[i] === char) bestPosition = Math.max(bestPosition, positional[i][code])
        score += (global[code] + bestPosition * 0.5) / answers.length
      }
      return {
        word,
        score,
        isAnswer: answerSet.has(word),
        explanation:
          'Distinct-letter coverage + half-weighted positional frequency; higher is better.',
      }
    })
    .sort(
      (a, b) =>
        b.score - a.score || Number(b.isAnswer) - Number(a.isAnswer) || alphabetic(a.word, b.word),
    )
}
export function partitionMetrics(guess: string, answers: readonly string[]) {
  if (!answers.length) return { entropy: 0, expected: 0, worst: 0 }
  const buckets = new Map<number, number>()
  for (const answer of answers) {
    const code = encodeFeedback(scoreNormalized(guess, answer))
    buckets.set(code, (buckets.get(code) ?? 0) + 1)
  }
  let entropy = 0,
    squared = 0,
    worst = 0
  for (const size of buckets.values()) {
    const p = size / answers.length
    entropy -= p * Math.log2(p)
    squared += size * size
    worst = Math.max(worst, size)
  }
  return { entropy, expected: squared / answers.length, worst }
}
/** Fixed PRNG and partial Fisher–Yates; alphabetically ordered input yields repeatable, dispersed samples. */
export function seededSample<T>(values: readonly T[], count: number, seed = 2026): T[] {
  const list = [...values]
  let state = seed >>> 0
  for (let i = 0; i < Math.min(count, list.length); i++) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    const j = i + Math.floor((state / 4294967296) * (list.length - i))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list.slice(0, count)
}
export async function rankGuesses(
  strategy: StrategyId,
  valid: readonly string[],
  answers: readonly string[],
  context: SolverContext = {},
): Promise<Ranking> {
  const check = () => {
    if (context.cancelled?.()) throw new Error('Calculation superseded')
  }
  check()
  if (context.requiredHints) valid = filterHardModeGuesses(valid, context.requiredHints)
  const restricted =
    strategy !== 'frequency' &&
    !context.exact &&
    valid.length * answers.length > (context.pairBudget ?? DEFAULT_SEARCH.pairBudget)
  const baseline = strategy === 'frequency' || restricted ? frequencyRanking(valid, answers) : []
  let guesses = valid,
    evaluatedAnswers = answers
  if (restricted) {
    const size = context.shortlistSize ?? DEFAULT_SEARCH.shortlistSize
    const words = new Set(baseline.slice(0, size).map((g) => g.word))
    // Keep a route to solving the puzzle even when the best probes are not candidates.
    for (const g of baseline.filter((g) => g.isAnswer).slice(0, Math.min(50, size)))
      words.add(g.word)
    guesses = [...words]
    if (answers.length > (context.sampleSize ?? DEFAULT_SEARCH.sampleSize))
      evaluatedAnswers = seededSample(answers, context.sampleSize ?? DEFAULT_SEARCH.sampleSize)
  }
  const metadata: RankingMetadata = {
    exact: !restricted,
    evaluatedGuesses: strategy === 'frequency' ? valid.length : guesses.length,
    totalGuesses: valid.length,
    evaluatedAnswers: strategy === 'frequency' ? answers.length : evaluatedAnswers.length,
    totalAnswers: answers.length,
    strategy,
  }
  if (!answers.length) return { guesses: [], metadata }
  if (strategy === 'frequency') return { guesses: baseline.slice(0, context.limit ?? 5), metadata }
  const answerSet = new Set(answers),
    ranked: RankedGuess[] = []
  let lastYield = performance.now()
  for (let i = 0; i < guesses.length; i++) {
    check()
    const word = guesses[i],
      metrics = partitionMetrics(word, evaluatedAnswers)
    ranked.push({
      word,
      ...metrics,
      isAnswer: answerSet.has(word),
      score:
        strategy === 'entropy'
          ? metrics.entropy
          : strategy === 'expected'
            ? metrics.expected
            : metrics.worst,
      explanation:
        strategy === 'entropy'
          ? 'Expected information in bits; higher is better.'
          : strategy === 'expected'
            ? 'Mean size of the feedback bucket; lower is better.'
            : 'Largest possible feedback bucket; lower is better.',
    })
    // Yield in time slices, avoiding hundreds of clamped timers for tiny pools.
    if (context.yieldControl && i % 16 === 15 && performance.now() - lastYield >= 8) {
      await context.yieldControl()
      check()
      lastYield = performance.now()
    }
  }
  ranked.sort(
    (a, b) =>
      (strategy === 'entropy' ? b.score - a.score : a.score - b.score) ||
      Number(b.isAnswer) - Number(a.isAnswer) ||
      (strategy === 'entropy' ? a.expected! - b.expected! : b.entropy! - a.entropy!) ||
      alphabetic(a.word, b.word),
  )
  return { guesses: ranked.slice(0, context.limit ?? 5), metadata }
}
export const strategies: SolverStrategy[] = strategyIds.map((id) => ({
  id,
  name: strategyNames[id],
  async rankGuesses(valid, answers, context) {
    return (await rankGuesses(id, valid, answers, context)).guesses
  },
}))
