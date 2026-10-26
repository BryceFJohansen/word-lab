import {
  isSettings,
  lengths,
  selectDictionary,
  type DictionaryChunk,
  type DictionarySettings,
  type SpellingMode,
  type AnswerDifficulty,
} from '../core/dictionary/types'
import { normalizeWord } from '../core/scoring'

type Importer = () => Promise<unknown>
// Bundle only URLs. Main thread and worker fetch the same content-hashed JSON asset.
const urls = import.meta.glob('./generated/[0-9]*.json', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>
const imports: Record<string, Importer> = Object.fromEntries(
  Object.entries(urls).map(([key, url]) => [
    key,
    async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Dictionary request failed (${response.status}).`)
      return response.json()
    },
  ]),
)
export function createDictionaryLoader(importers: Record<string, Importer>) {
  const chunks = new Map<number, Promise<DictionaryChunk>>()
  const selections = new Map<
    string,
    Promise<{ valid: ReadonlySet<string>; answers: readonly string[] }>
  >()
  async function load(length: number): Promise<DictionaryChunk> {
    if (!lengths.includes(length)) throw new Error('Choose a word length from 3 to 12.')
    if (!chunks.has(length)) {
      const importer = importers[`./generated/${length}.json`]
      if (!importer)
        throw new Error(`The ${length}-letter dictionary is missing. Rebuild dictionary data.`)
      chunks.set(
        length,
        importer()
          .then((data) => {
            const chunk = data as DictionaryChunk
            if (chunk.version !== 1 || chunk.length !== length || !Array.isArray(chunk.entries))
              throw new Error('This dictionary version is incompatible.')
            return chunk
          })
          .catch(() => {
            chunks.delete(length)
            throw new Error(
              `Could not load the ${length}-letter dictionary. Check local files and retry.`,
            )
          }),
      )
    }
    return chunks.get(length)!
  }
  async function getDictionary(settings: DictionarySettings) {
    if (!isSettings(settings)) throw new Error('Invalid dictionary settings.')
    const key = `${settings.length}/${settings.spelling}/${settings.difficulty}`
    if (!selections.has(key))
      selections.set(
        key,
        load(settings.length)
          .then((chunk) => {
            const { valid, answers } = selectDictionary(chunk, settings)
            return { valid: new Set(valid) as ReadonlySet<string>, answers: Object.freeze(answers) }
          })
          .catch((error) => {
            selections.delete(key)
            throw error
          }),
      )
    return selections.get(key)!
  }
  return {
    getDictionary,
    async getValidGuesses(length: number, spelling: SpellingMode) {
      return (await getDictionary({ length, spelling, difficulty: 'all' })).valid
    },
    async getPossibleAnswers(length: number, difficulty: AnswerDifficulty, spelling: SpellingMode) {
      return (await getDictionary({ length, spelling, difficulty })).answers
    },
    async isValidGuess(word: string, settings: DictionarySettings) {
      return (await getDictionary(settings)).valid.has(normalizeWord(word))
    },
  }
}
export const { getDictionary, getValidGuesses, getPossibleAnswers, isValidGuess } =
  createDictionaryLoader(imports)
