import { scoreGuess, type LetterFeedback } from '../scoring'
import { filterCandidates, type SolverRow } from '../solver/filter'
import {
  rankGuesses,
  type RankingMetadata,
  type SolverContext,
  type StrategyId,
} from '../solver/strategies'
export interface TraceStep {
  guess: string
  feedback: LetterFeedback[]
  candidatesBefore: number
  candidatesAfter: number
  search: RankingMetadata
}
export interface PuzzleResult {
  answer: string
  solved: boolean
  guesses: number
  elapsedMs: number
  trace: TraceStep[]
}
export interface BenchmarkSummary {
  attempted: number
  solved: number
  failures: number
  solvePercentage: number
  averageSolved: number | null
  averagePenalized: number
  failurePenalty: number
  medianSolved: number | null
  maximumGuesses: number
  distribution: Record<string, number>
  averageComputationMs: number
  totalDurationMs: number
  worstAnswers: { answer: string; solved: boolean; guesses: number }[]
  exactSteps: number
  approximateSteps: number
}

export async function simulateBatch(
  valid: readonly string[],
  answers: readonly string[],
  secrets: readonly string[],
  strategy: StrategyId,
  maxAttempts: number,
  context: SolverContext = {},
  progress?: (count: number) => void,
) {
  const started = performance.now(),
    puzzles: PuzzleResult[] = []
  const cache = new Map<string, { word: string; metadata: RankingMetadata }>()
  // This function deliberately accepts only the candidate set. The secret never enters ranking.
  async function choose(candidates: readonly string[]) {
    const key = candidates.join(',')
    let choice = cache.get(key)
    if (!choice) {
      const ranking = await rankGuesses(strategy, valid, candidates, { ...context, limit: 1 })
      if (!ranking.guesses[0]) throw new Error('Simulation exhausted its candidate pool.')
      choice = { word: ranking.guesses[0].word, metadata: ranking.metadata }
      if (cache.size >= 20000) cache.clear()
      cache.set(key, choice)
    }
    return choice
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1)
    throw new Error('Maximum attempts must be a positive integer.')
  const eligible = new Set(answers)
  for (const answer of secrets) {
    if (!eligible.has(answer)) throw new Error(`Secret is not in answer dictionary: ${answer}`)
    let candidates = [...answers],
      solved = false
    const trace: TraceStep[] = [],
      start = performance.now()
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { word, metadata } = await choose(candidates)
      const feedback = scoreGuess(word, answer)
      const row: SolverRow = { id: String(attempt), word, feedback }
      const remaining = filterCandidates(candidates, [row])
      trace.push({
        guess: word,
        feedback,
        candidatesBefore: candidates.length,
        candidatesAfter: remaining.length,
        search: metadata,
      })
      candidates = remaining
      if (feedback.every((value) => value === 2)) {
        solved = true
        break
      }
    }
    puzzles.push({
      answer,
      solved,
      guesses: trace.length,
      elapsedMs: performance.now() - start,
      trace,
    })
    progress?.(puzzles.length)
  }
  return {
    puzzles,
    summary: summarize(puzzles, maxAttempts, performance.now() - started),
    cachedDecisions: cache.size,
  }
}
export function summarize(
  puzzles: PuzzleResult[],
  maxAttempts: number,
  duration: number,
): BenchmarkSummary {
  const solved = puzzles.filter((p) => p.solved),
    counts = solved.map((p) => p.guesses).sort((a, b) => a - b),
    distribution: Record<string, number> = {}
  for (const p of puzzles) {
    const key = p.solved ? String(p.guesses) : 'failed'
    distribution[key] = (distribution[key] ?? 0) + 1
  }
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
  const median = counts.length
    ? (counts[Math.floor((counts.length - 1) / 2)] + counts[Math.floor(counts.length / 2)]) / 2
    : null
  const steps = puzzles.flatMap((p) => p.trace)
  return {
    attempted: puzzles.length,
    solved: solved.length,
    failures: puzzles.length - solved.length,
    solvePercentage: puzzles.length ? (solved.length / puzzles.length) * 100 : 0,
    averageSolved: counts.length ? sum(counts) / counts.length : null,
    averagePenalized: puzzles.length
      ? sum(puzzles.map((p) => (p.solved ? p.guesses : maxAttempts + 1))) / puzzles.length
      : 0,
    failurePenalty: maxAttempts + 1,
    medianSolved: median,
    maximumGuesses: Math.max(0, ...puzzles.map((p) => p.guesses)),
    distribution,
    averageComputationMs: puzzles.length
      ? sum(puzzles.map((p) => p.elapsedMs)) / puzzles.length
      : 0,
    totalDurationMs: duration,
    worstAnswers: [...puzzles]
      .sort(
        (a, b) =>
          Number(a.solved) - Number(b.solved) ||
          b.guesses - a.guesses ||
          (a.answer < b.answer ? -1 : 1),
      )
      .slice(0, 20)
      .map(({ answer, solved, guesses }) => ({ answer, solved, guesses })),
    exactSteps: steps.filter((s) => s.search.exact).length,
    approximateSteps: steps.filter((s) => !s.search.exact).length,
  }
}
