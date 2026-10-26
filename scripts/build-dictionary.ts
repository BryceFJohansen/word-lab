import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import config from '../data/configuration/dictionary.json'
import manifest from '../data/sources/manifest.json'
import {
  selectDictionary,
  spellings,
  difficulties,
  type DictionaryChunk,
  type WordEntry,
} from '../src/core/dictionary/types'

export const root = fileURLToPath(new URL('../', import.meta.url))
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')
export async function buildDictionary(write = true) {
  for (const [path, expected] of Object.entries(manifest.files)) {
    if (sha(await readFile(resolve(root, 'data', path))) !== expected)
      throw new Error(`Source checksum mismatch: ${path}`)
  }
  const exclusions = new Set<string>()
  for (const file of await readdir(resolve(root, 'data/exclusions'))) {
    if (file.includes('README')) continue
    const content = await readFile(resolve(root, 'data/exclusions', file), 'latin1')
    for (const line of content.split(/\r?\n/)) {
      const word = line.split('#')[0].trim().toLowerCase()
      if (/^[a-z]+$/.test(word)) exclusions.add(word)
    }
  }
  const words = new Map<string, WordEntry>()
  const sourceDir = resolve(root, 'data/sources/scowl/final')
  for (const file of (await readdir(sourceDir)).sort()) {
    const match = /^(english|american|british)-words\.(\d+)$/.exec(file)
    if (!match || Number(match[2]) > config.validMaxLevel) continue
    const level = Number(match[2]),
      mask = config.dialects[match[1] as keyof typeof config.dialects]
    for (const raw of (await readFile(resolve(sourceDir, file), 'latin1')).split(/\r?\n/)) {
      // Exclude uppercase source entries BEFORE normalisation: never turn names into ordinary words.
      const word = raw.trim()
      if (!/^[a-z]{3,12}$/.test(word)) continue
      const entry = words.get(word) ?? [word, 0, 999, 999]
      entry[1] |= mask
      if (!exclusions.has(word)) {
        if (mask & 1) entry[2] = Math.min(entry[2], level)
        if (mask & 2) entry[3] = Math.min(entry[3], level)
      }
      words.set(word, entry)
    }
  }
  const chunks: DictionaryChunk[] = []
  const counts: Record<string, unknown>[] = []
  const hashes: Record<string, string> = {}
  const output = resolve(root, 'src/dictionaries/generated')
  if (write) await mkdir(output, { recursive: true })
  for (let length = config.minLength; length <= config.maxLength; length++) {
    const entries = [...words.values()]
      .filter((e) => e[0].length === length)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    const chunk: DictionaryChunk = { version: 1, length, entries }
    if (!entries.length) throw new Error(`Empty dictionary at length ${length}`)
    const serialized = JSON.stringify(chunk) + '\n'
    hashes[String(length)] = sha(serialized)
    if (write) await writeFile(resolve(output, `${length}.json`), serialized)
    chunks.push(chunk)
    for (const spelling of spellings) {
      const row: Record<string, unknown> = { length, spelling }
      for (const difficulty of difficulties) {
        const selected = selectDictionary(chunk, { length, spelling, difficulty })
        row.valid = selected.valid.length
        row[difficulty] = selected.answers.length
        if (!selected.answers.length)
          throw new Error(`No ${difficulty} ${spelling} answers at length ${length}`)
      }
      counts.push(row)
    }
  }
  const metadata = {
    version: 1,
    source: manifest,
    configuration: config,
    answerExclusions: exclusions.size,
    configurationSha256: sha(JSON.stringify(config)),
    exclusionsSha256: sha([...exclusions].sort().join('\n')),
    counts,
    hashes,
  }
  if (write)
    await writeFile(resolve(output, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n')
  return { chunks, metadata }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { metadata } = await buildDictionary()
  console.table(metadata.counts.filter((row) => row.spelling === 'combined'))
}
