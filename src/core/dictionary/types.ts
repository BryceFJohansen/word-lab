import configuration from '../../../data/configuration/dictionary.json'
export const lengths = Array.from({ length: 10 }, (_, i) => i + 3)
export const spellings = ['combined', 'uk', 'us'] as const
export const difficulties = ['common', 'standard', 'all'] as const
export type SpellingMode = (typeof spellings)[number]
export type AnswerDifficulty = (typeof difficulties)[number]
export interface DictionarySettings {
  length: number
  spelling: SpellingMode
  difficulty: AnswerDifficulty
}
export const defaultSettings: DictionarySettings = {
  length: 5,
  spelling: 'combined',
  difficulty: 'common',
}
export function isSettings(value: unknown): value is DictionarySettings {
  if (!value || typeof value !== 'object') return false
  const v = value as DictionarySettings
  return (
    lengths.includes(v.length) &&
    spellings.includes(v.spelling) &&
    difficulties.includes(v.difficulty)
  )
}
// bit 1 = US, bit 2 = UK; answer level independently tracks each dialect.
export type WordEntry = [word: string, dialectMask: number, usLevel: number, ukLevel: number]
export interface DictionaryChunk {
  version: 1
  length: number
  entries: WordEntry[]
}
export function normalizeEntries(words: readonly string[]): string[] {
  return [
    ...new Set(words.map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z]{3,12}$/.test(w))),
  ].sort()
}
export function selectDictionary(chunk: DictionaryChunk, settings: DictionarySettings) {
  const bit = settings.spelling === 'us' ? 1 : settings.spelling === 'uk' ? 2 : 3
  const cutoff =
    settings.difficulty === 'common'
      ? configuration.commonMaxLevel
      : settings.difficulty === 'standard'
        ? configuration.standardMaxLevel
        : configuration.validMaxLevel
  const valid: string[] = [],
    answers: string[] = []
  for (const [word, mask, us, uk] of chunk.entries) {
    if (!(mask & bit)) continue
    valid.push(word)
    const level = bit === 1 ? us : bit === 2 ? uk : Math.min(us, uk)
    if (level <= cutoff) answers.push(word)
  }
  return { valid, answers }
}
