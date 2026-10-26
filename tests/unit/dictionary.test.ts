import { describe, expect, it, vi } from 'vitest'
import {
  normalizeEntries,
  selectDictionary,
  type DictionaryChunk,
} from '../../src/core/dictionary/types'
import { createDictionaryLoader } from '../../src/dictionaries/dictionaryLoader'
const chunk: DictionaryChunk = {
  version: 1,
  length: 5,
  entries: [
    ['color', 1, 35, 999],
    ['crane', 3, 35, 35],
    ['curio', 3, 60, 60],
    ['cuzes', 3, 80, 80],
    ['taboo', 3, 999, 999],
  ],
}
describe('dictionary selection', () => {
  it('normalizes, deduplicates, rejects punctuation, numbers and unsupported lengths', () =>
    expect(
      normalizeEntries([' CrAnE ', 'crane', 'a', 'two words', 'a-b', 'abc1', 'hello', 'café']),
    ).toEqual(['crane', 'hello']))
  it('applies dialect, level and answer-only exclusions', () => {
    expect(selectDictionary(chunk, { length: 5, spelling: 'uk', difficulty: 'common' })).toEqual({
      valid: ['crane', 'curio', 'cuzes', 'taboo'],
      answers: ['crane'],
    })
    expect(
      selectDictionary(chunk, { length: 5, spelling: 'us', difficulty: 'standard' }).answers,
    ).toEqual(['color', 'crane', 'curio'])
    expect(
      selectDictionary(chunk, { length: 5, spelling: 'combined', difficulty: 'all' }).answers,
    ).toHaveLength(4)
  })
  it('caches imports, validates guesses and rejects missing data', async () => {
    const importer = vi.fn(async () => chunk)
    const loader = createDictionaryLoader({ './generated/5.json': importer })
    expect(
      await loader.isValidGuess(' CRANE ', { length: 5, spelling: 'uk', difficulty: 'common' }),
    ).toBe(true)
    expect(
      await loader.isValidGuess('color', { length: 5, spelling: 'uk', difficulty: 'common' }),
    ).toBe(false)
    await loader.getPossibleAnswers(5, 'all', 'combined')
    expect(importer).toHaveBeenCalledTimes(1)
    await expect(loader.getValidGuesses(13, 'combined')).rejects.toThrow()
    await expect(loader.getValidGuesses(6, 'combined')).rejects.toThrow('missing')
  })
  it('retries failed imports', async () => {
    const importer = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(chunk)
    const loader = createDictionaryLoader({ './generated/5.json': importer })
    await expect(loader.getValidGuesses(5, 'us')).rejects.toThrow('Could not load')
    expect((await loader.getValidGuesses(5, 'us')).has('color')).toBe(true)
  })
})
