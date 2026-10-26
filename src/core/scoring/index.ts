export enum LetterFeedback {
  Absent = 0,
  Present = 1,
  Correct = 2,
}
export const feedbackNames = ['Absent', 'Present elsewhere', 'Correct position'] as const
export const feedbackSymbols = ['−', '•', '✓'] as const

export function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}

/** The sole scoring implementation: exact matches consume occurrences first. */
export function scoreGuess(guess: string, answer: string): LetterFeedback[] {
  guess = normalizeWord(guess)
  answer = normalizeWord(answer)
  if (!guess.length || guess.length !== answer.length)
    throw new Error('Guess and answer must have the same nonzero length.')
  if (!/^[a-z]+$/.test(guess) || !/^[a-z]+$/.test(answer)) throw new Error('Use letters A–Z only.')
  return scoreNormalized(guess, answer)
}

/** Internal hot path for already validated dictionary words; same authoritative algorithm. */
export function scoreNormalized(guess: string, answer: string): LetterFeedback[] {
  const result = Array<LetterFeedback>(guess.length).fill(LetterFeedback.Absent)
  const remaining = new Uint8Array(26)
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) result[i] = LetterFeedback.Correct
    else remaining[answer.charCodeAt(i) - 97]++
  }
  for (let i = 0; i < guess.length; i++) {
    const letter = guess.charCodeAt(i) - 97
    if (result[i] !== LetterFeedback.Correct && remaining[letter]) {
      result[i] = LetterFeedback.Present
      remaining[letter]--
    }
  }
  return result
}
export function encodeFeedback(feedback: readonly LetterFeedback[]): number {
  return feedback.reduce((pattern, value) => pattern * 3 + value, 0)
}
export function feedbackEquals(
  a: readonly LetterFeedback[],
  b: readonly LetterFeedback[],
): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i])
}
