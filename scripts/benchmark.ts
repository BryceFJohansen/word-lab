import { parseArgs } from 'node:util'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { cpus, totalmem, platform, arch } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import {
  isSettings,
  selectDictionary,
  type DictionaryChunk,
  type DictionarySettings,
} from '../src/core/dictionary/types'
import {
  DEFAULT_SEARCH,
  seededSample,
  strategyIds,
  type StrategyId,
} from '../src/core/solver/strategies'
import { simulateBatch } from '../src/core/simulation'
const { values } = parseArgs({
  options: {
    length: { type: 'string', default: '5' },
    spelling: { type: 'string', default: 'combined' },
    difficulty: { type: 'string', default: 'common' },
    strategy: { type: 'string', default: 'entropy' },
    strategies: { type: 'string' },
    'max-attempts': { type: 'string', default: '6' },
    sample: { type: 'string', default: '25' },
    full: { type: 'boolean', default: false },
    seed: { type: 'string', default: '2026' },
    output: { type: 'string', default: 'benchmarks/latest' },
    exact: { type: 'boolean', default: false },
    help: { type: 'boolean' },
  },
})
if (values.help) {
  console.log(
    'npm run benchmark -- --length 5 --strategies frequency,entropy,expected,minimax --sample 25 --seed 2026 --spelling combined --difficulty common --max-attempts 6 --output benchmarks/comparison\nUse --full for every eligible answer, --exact for exhaustive partition ranking. Outputs .json, .csv (puzzles) and .summary.csv.',
  )
  process.exit(0)
}
const settings = {
  length: Number(values.length),
  spelling: values.spelling,
  difficulty: values.difficulty,
} as DictionarySettings
const strategies = (values.strategies ?? values.strategy).split(',') as StrategyId[]
const attempts = Number(values['max-attempts']),
  sample = Number(values.sample),
  seed = Number(values.seed)
if (
  !isSettings(settings) ||
  strategies.some((s) => !strategyIds.includes(s)) ||
  !Number.isInteger(attempts) ||
  attempts < 1 ||
  attempts > 100 ||
  !Number.isInteger(sample) ||
  sample < 1 ||
  !Number.isSafeInteger(seed)
)
  throw new Error('Invalid options. Run npm run benchmark -- --help.')
const root = fileURLToPath(new URL('../', import.meta.url))
const start = performance.now(),
  bytes = await readFile(
    resolve(root, `src/dictionaries/generated/${settings.length}.json`),
    'utf8',
  )
const { valid, answers } = selectDictionary(JSON.parse(bytes) as DictionaryChunk, settings)
const dictionaryLoadMs = performance.now() - start
const secrets = values.full
  ? [...answers]
  : seededSample(answers, Math.min(sample, answers.length), seed)
const results = []
for (const strategy of strategies) {
  console.log(
    `${strategy}: ${secrets.length} puzzles; ${valid.length} valid guesses, ${answers.length} answers.`,
  )
  const result = await simulateBatch(valid, answers, secrets, strategy, attempts, {
    exact: values.exact,
  })
  results.push({ strategy, ...result })
  console.log(JSON.stringify(result.summary, null, 2))
}
const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
  },
  settings,
  maxAttempts: attempts,
  sample: { mode: values.full ? 'full' : 'sample', seed, answers: secrets },
  dictionary: {
    valid: valid.length,
    answers: answers.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    loadMs: dictionaryLoadMs,
  },
  search: {
    ...DEFAULT_SEARCH,
    forceExact: values.exact,
    cache:
      'Per-strategy candidate-set decisions, shared across puzzles; bounded at 20,000 entries.',
  },
  failureConvention:
    'Unsolved puzzles cost maxAttempts + 1 in averagePenalized; medianSolved and averageSolved exclude failures.',
  results,
}
const base = resolve(root, values.output.replace(/\.(json|csv)$/, ''))
await mkdir(dirname(base), { recursive: true })
await writeFile(base + '.json', JSON.stringify(report, null, 2) + '\n')
const csv = (rows: (string | number | boolean | null)[][]) =>
  rows
    .map((row) => row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n') + '\n'
await writeFile(
  base + '.csv',
  csv([
    ['strategy', 'answer', 'solved', 'guesses', 'elapsedMs', 'trace'],
    ...results.flatMap((r) =>
      r.puzzles.map((p) => [
        r.strategy,
        p.answer,
        p.solved,
        p.guesses,
        p.elapsedMs,
        p.trace.map((t) => t.guess).join(' '),
      ]),
    ),
  ]),
)
await writeFile(
  base + '.summary.csv',
  csv([
    [
      'strategy',
      'attempted',
      'solved',
      'failures',
      'solvePercentage',
      'averageSolved',
      'averagePenalized',
      'medianSolved',
      'maximumGuesses',
      'averageComputationMs',
      'totalDurationMs',
      'exactSteps',
      'approximateSteps',
    ],
    ...results.map((r) => {
      const s = r.summary
      return [
        r.strategy,
        s.attempted,
        s.solved,
        s.failures,
        s.solvePercentage,
        s.averageSolved,
        s.averagePenalized,
        s.medianSolved,
        s.maximumGuesses,
        s.averageComputationMs,
        s.totalDurationMs,
        s.exactSteps,
        s.approximateSteps,
      ]
    }),
  ]),
)
console.log(`Saved ${base}.{json,csv,summary.csv}`)
