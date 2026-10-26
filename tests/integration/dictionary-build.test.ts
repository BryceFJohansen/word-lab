// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildDictionary, root } from '../../scripts/build-dictionary'
import { selectDictionary, spellings, difficulties } from '../../src/core/dictionary/types'

describe('verified real dictionary build', () => {
  it('reproduces every generated asset from pinned inputs with sorted distinct length groups', async () => {
    const { chunks, metadata } = await buildDictionary(false)
    expect(chunks.map((c) => c.length)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(chunks.reduce((sum, c) => sum + c.entries.length, 0)).toBe(217980)
    for (const chunk of chunks) {
      expect(
        await readFile(resolve(root, `src/dictionaries/generated/${chunk.length}.json`), 'utf8'),
      ).toBe(JSON.stringify(chunk) + '\n')
      const words = chunk.entries.map((entry) => entry[0])
      expect(new Set(words).size).toBe(words.length)
      expect(words).toEqual([...words].sort())
      expect(words.every((word) => word.length === chunk.length && /^[a-z]+$/.test(word))).toBe(
        true,
      )
      for (const spelling of spellings)
        for (const difficulty of difficulties) {
          const { valid, answers } = selectDictionary(chunk, {
            length: chunk.length,
            spelling,
            difficulty,
          })
          expect(answers.length).toBeGreaterThan(0)
          const set = new Set(valid)
          expect(answers.every((word) => set.has(word))).toBe(true)
        }
    }
    expect(await readFile(resolve(root, 'src/dictionaries/generated/metadata.json'), 'utf8')).toBe(
      JSON.stringify(metadata, null, 2) + '\n',
    )
    const five = chunks.find((chunk) => chunk.length === 5)!
    expect(
      selectDictionary(five, { length: 5, spelling: 'us', difficulty: 'all' }).valid,
    ).toContain('color')
    expect(
      selectDictionary(five, { length: 5, spelling: 'uk', difficulty: 'all' }).valid,
    ).not.toContain('color')
    const six = chunks.find((chunk) => chunk.length === 6)!
    expect(selectDictionary(six, { length: 6, spelling: 'uk', difficulty: 'all' }).valid).toContain(
      'colour',
    )
    expect(
      selectDictionary(six, { length: 6, spelling: 'us', difficulty: 'all' }).valid,
    ).not.toContain('colour')
  })
})
