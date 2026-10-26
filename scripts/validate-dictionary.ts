import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildDictionary, root } from './build-dictionary'
const { chunks, metadata } = await buildDictionary(false)
for (const chunk of chunks) {
  const path = resolve(root, `src/dictionaries/generated/${chunk.length}.json`)
  if ((await readFile(path, 'utf8')) !== JSON.stringify(chunk) + '\n')
    throw new Error(`Nonreproducible output: ${path}`)
  for (const [word, mask, us, uk] of chunk.entries) {
    if (
      !/^[a-z]+$/.test(word) ||
      word.length !== chunk.length ||
      mask < 1 ||
      mask > 3 ||
      us < 10 ||
      uk < 10
    )
      throw new Error(`Invalid entry: ${word}`)
  }
}
if (
  (await readFile(resolve(root, 'src/dictionaries/generated/metadata.json'), 'utf8')) !==
  JSON.stringify(metadata, null, 2) + '\n'
)
  throw new Error('Metadata does not match build inputs.')
console.log(
  `Validated ${chunks.reduce((n, c) => n + c.entries.length, 0).toLocaleString()} entries; all generated files reproduce byte-for-byte.`,
)
