import { completedRows, type SolverRow } from './filter'

/** Require revealed letters and fixed greens; grey letters and old yellow positions remain legal. */
export function filterHardModeGuesses(
  valid: readonly string[],
  rows: readonly SolverRow[],
): string[] {
  if (!valid.length) return []
  const length = valid[0].length
  const greens = Array<string | undefined>(length).fill(undefined)
  const minimumCounts = new Map<string, number>()
  for (const row of completedRows(rows, length)) {
    const counts = new Map<string, number>()
    for (let i = 0; i < length; i++) {
      const letter = row.word[i]
      if (row.feedback[i] > 0) counts.set(letter, (counts.get(letter) ?? 0) + 1)
      if (row.feedback[i] === 2) {
        if (greens[i] && greens[i] !== letter) return []
        greens[i] = letter
      }
    }
    // Repeated clues do not imply extra copies; a single row can reveal several copies.
    for (const [letter, count] of counts)
      minimumCounts.set(letter, Math.max(minimumCounts.get(letter) ?? 0, count))
  }
  return valid.filter((word) => {
    if (greens.some((letter, i) => letter && word[i] !== letter)) return false
    for (const [letter, minimum] of minimumCounts) {
      let count = 0
      for (const char of word) if (char === letter) count++
      if (count < minimum) return false
    }
    return true
  })
}
