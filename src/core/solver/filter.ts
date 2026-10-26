import { feedbackEquals, LetterFeedback, normalizeWord, scoreNormalized } from '../scoring'
export interface SolverRow {
  id: string
  word: string
  feedback: LetterFeedback[]
  pendingFeedback?: boolean
}
export function blankRow(length: number): SolverRow {
  return { id: crypto.randomUUID(), word: '', feedback: Array(length).fill(LetterFeedback.Absent) }
}
export function completedRows(rows: readonly SolverRow[], length: number): SolverRow[] {
  return rows
    .filter(
      (row) =>
        !row.pendingFeedback &&
        new RegExp(`^[a-zA-Z]{${length}}$`).test(row.word) &&
        row.feedback.length === length &&
        row.feedback.every((f) => [0, 1, 2].includes(f)),
    )
    .map((row) => ({ ...row, word: normalizeWord(row.word) }))
}
export function filterCandidates(answers: readonly string[], rows: readonly SolverRow[]): string[] {
  if (!answers.length) return []
  const complete = completedRows(rows, answers[0].length)
  return answers.filter((answer) =>
    complete.every((row) => feedbackEquals(scoreNormalized(row.word, answer), row.feedback)),
  )
}
export interface Diagnostic {
  kind: 'internal' | 'dictionary'
  message: string
  rowIds: string[]
}
/** Conservative proof: only call feedback internally inconsistent when a letter/position/count conflict is provable. */
function internalConflict(rows: readonly SolverRow[], length: number): boolean {
  const greens = Array<string | undefined>(length).fill(undefined),
    forbidden = Array.from({ length }, () => new Set<string>())
  const min = new Map<string, number>(),
    max = new Map<string, number>()
  for (const row of rows) {
    for (const letter of new Set(row.word)) {
      let positive = 0,
        absent = 0
      for (let i = 0; i < length; i++)
        if (row.word[i] === letter) row.feedback[i] === 0 ? absent++ : positive++
      min.set(letter, Math.max(min.get(letter) ?? 0, positive))
      if (absent) max.set(letter, Math.min(max.get(letter) ?? length, positive))
    }
    for (let i = 0; i < length; i++) {
      if (row.feedback[i] === 2) {
        if (greens[i] && greens[i] !== row.word[i]) return true
        greens[i] = row.word[i]
      } else forbidden[i].add(row.word[i])
    }
  }
  if (greens.some((g, i) => g && forbidden[i].has(g))) return true
  let minimumTotal = 0
  for (const [letter, count] of min) {
    const greenCount = greens.filter((g) => g === letter).length
    const required = Math.max(count, greenCount)
    if (required > (max.get(letter) ?? length)) return true
    const available = greens.filter(
      (g, i) => g === letter || (!g && !forbidden[i].has(letter)),
    ).length
    if (required > available) return true
    minimumTotal += required
  }
  return minimumTotal > length
}
export function diagnose(
  answers: readonly string[],
  rows: readonly SolverRow[],
  length: number,
): Diagnostic | null {
  const complete = completedRows(rows, length)
  if (filterCandidates(answers, complete).length) return null
  const internal = internalConflict(complete, length)
  // Bounded removal checks suggest useful rows without claiming a unique minimal conflict.
  const suspects =
    complete.length <= 12
      ? complete
          .filter(
            (_, i) =>
              filterCandidates(
                answers,
                complete.filter((__, j) => j !== i),
              ).length > 0,
          )
          .map((r) => r.id)
      : []
  return {
    kind: internal ? 'internal' : 'dictionary',
    rowIds: suspects,
    message: internal
      ? 'These rows contain conflicting letter positions or counts. Check the feedback, especially repeated letters.'
      : 'No answer in this vocabulary matches every row. Check the feedback or try Standard / All words. The answer may be missing from this dictionary; the available evidence does not prove an internal contradiction.',
  }
}
