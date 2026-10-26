import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cpus, totalmem, platform } from 'node:os'
import { selectDictionary, type DictionaryChunk } from '../src/core/dictionary/types'
import { scoreGuess } from '../src/core/scoring'
import { filterCandidates } from '../src/core/solver/filter'
import { rankGuesses, strategyIds } from '../src/core/solver/strategies'
const root = fileURLToPath(new URL('../', import.meta.url)),
  results = []
for (const length of [3, 5, 8, 12]) {
  const before = process.memoryUsage().heapUsed,
    loadStart = performance.now()
  const data = JSON.parse(
    await readFile(resolve(root, `src/dictionaries/generated/${length}.json`), 'utf8'),
  ) as DictionaryChunk
  const { valid, answers } = selectDictionary(data, {
    length,
    spelling: 'combined',
    difficulty: 'all',
  })
  const loadMs = performance.now() - loadStart,
    guess = answers[Math.floor(answers.length / 2)],
    answer = answers[Math.floor(answers.length / 3)]
  const filterStart = performance.now(),
    candidates = filterCandidates(answers, [
      { id: 'test', word: guess, feedback: scoreGuess(guess, answer) },
    ]),
    filterMs = performance.now() - filterStart
  const rankings = []
  for (const strategy of strategyIds) {
    const start = performance.now(),
      ranking = await rankGuesses(strategy, valid, answers)
    rankings.push({ elapsedMs: performance.now() - start, ...ranking.metadata })
  }
  results.push({
    length,
    valid: valid.length,
    answers: answers.length,
    candidates: candidates.length,
    loadMs,
    filterMs,
    heapDeltaBytes: process.memoryUsage().heapUsed - before,
    rankings,
  })
}
const report = {
  environment: {
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
    platform: platform(),
    node: process.version,
  },
  notes:
    'Single process, single runs. OS disk cache not flushed. Heap deltas include GC noise. Worker responsiveness is measured by Playwright (tests/e2e/word-lab.spec.ts).',
  results,
}
await mkdir(resolve(root, 'benchmarks'), { recursive: true })
await writeFile(
  resolve(root, 'benchmarks/performance.json'),
  JSON.stringify(report, null, 2) + '\n',
)
console.log(JSON.stringify(report, null, 2))
