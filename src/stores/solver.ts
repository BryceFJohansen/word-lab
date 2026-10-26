import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { defaultSettings, isSettings, type DictionarySettings } from '../core/dictionary/types'
import { blankRow, type SolverRow } from '../core/solver/filter'
import { strategyIds, type StrategyId } from '../core/solver/strategies'
import { SolverClient, type SolverResult, type WorkerPort } from '../workers/protocol'
import { readSaved, writeSaved } from './persistence'
interface SavedSolver {
  settings: DictionarySettings
  rows: SolverRow[]
  strategy: StrategyId
  hardMode?: boolean
}
export function isSavedSolver(value: unknown): value is SavedSolver {
  const v = value as SavedSolver
  return (
    !!v &&
    isSettings(v.settings) &&
    strategyIds.includes(v.strategy) &&
    (v.hardMode === undefined || typeof v.hardMode === 'boolean') &&
    Array.isArray(v.rows) &&
    v.rows.length > 0 &&
    v.rows.length <= 100 &&
    new Set(v.rows.map((r) => r.id)).size === v.rows.length &&
    v.rows.every(
      (r) =>
        typeof r.id === 'string' &&
        (r.pendingFeedback === undefined || typeof r.pendingFeedback === 'boolean') &&
        typeof r.word === 'string' &&
        /^[a-z]*$/.test(r.word) &&
        r.word.length <= v.settings.length &&
        Array.isArray(r.feedback) &&
        r.feedback.length === v.settings.length &&
        r.feedback.every((f) => [0, 1, 2].includes(f)),
    )
  )
}
export const useSolverStore = defineStore('solver', () => {
  const saved = readSaved('solver', isSavedSolver)
  const settings = ref<DictionarySettings>(saved?.settings ?? { ...defaultSettings })
  const rows = ref<SolverRow[]>(saved?.rows ?? [blankRow(settings.value.length)])
  const strategy = ref<StrategyId>(saved?.strategy ?? 'entropy')
  const hardMode = ref(saved?.hardMode ?? false)
  const result = ref<SolverResult | null>(null),
    busy = ref(false),
    error = ref('')
  let client: SolverClient | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    revision = 0,
    initialized = false
  function makeClient() {
    return new SolverClient(
      new Worker(new URL('../workers/solver.worker.ts', import.meta.url), {
        type: 'module',
      }) as unknown as WorkerPort,
    )
  }
  function schedule() {
    if (!initialized) return
    const current = ++revision
    clearTimeout(timer)
    client?.cancel()
    busy.value = true
    error.value = ''
    result.value = null
    timer = setTimeout(async () => {
      try {
        client ??= makeClient()
        const response = await client.request({
          settings: { ...settings.value },
          rows: rows.value.map((r) => ({ ...r, feedback: [...r.feedback] })),
          strategy: strategy.value,
          hardMode: hardMode.value,
        })
        if (current === revision && response) result.value = response
      } catch (e) {
        if (current === revision) {
          error.value = (e as Error).message
          client?.dispose()
          client = undefined
        }
      } finally {
        if (current === revision) busy.value = false
      }
    }, 120)
  }
  watch(
    [settings, rows, strategy, hardMode],
    () => {
      writeSaved('solver', {
        settings: settings.value,
        rows: rows.value,
        strategy: strategy.value,
        hardMode: hardMode.value,
      })
      schedule()
    },
    { deep: true },
  )
  function initialize() {
    if (!initialized) {
      initialized = true
      schedule()
    }
  }
  function updateSettings(next: DictionarySettings) {
    if (next.length !== settings.value.length) rows.value = [blankRow(next.length)]
    settings.value = { ...next }
  }
  function addAfter(id: string) {
    if (rows.value.length >= 100) {
      error.value = 'Use up to 100 rows. Remove a row before adding another.'
      return
    }
    const index = rows.value.findIndex((r) => r.id === id)
    if (index >= 0) rows.value.splice(index + 1, 0, blankRow(settings.value.length))
  }
  function remove(id: string) {
    if (rows.value.length === 1) {
      if (rows.value[0].id === id) rows.value[0] = { ...blankRow(settings.value.length), id }
      return
    }
    rows.value = rows.value.filter((r) => r.id !== id)
  }
  function setWord(id: string, word: string) {
    const row = rows.value.find((r) => r.id === id)
    if (row)
      row.word = word
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .slice(0, settings.value.length)
  }
  function cycle(id: string, index: number) {
    const row = rows.value.find((r) => r.id === id)
    if (row && index >= 0 && index < row.feedback.length) {
      row.feedback[index] = (row.feedback[index] + 1) % 3
      row.pendingFeedback = false
    }
  }
  function allAbsent(id: string) {
    const row = rows.value.find((r) => r.id === id)
    if (row) {
      row.feedback.fill(0)
      row.pendingFeedback = false
    }
  }
  function useRecommendation(word: string) {
    const empty = rows.value.find((r) => !r.word)
    if (empty) {
      empty.word = word
      empty.feedback = Array(settings.value.length).fill(0)
      empty.pendingFeedback = true
    } else if (rows.value.length < 100) {
      rows.value.push({ ...blankRow(settings.value.length), word, pendingFeedback: true })
    } else {
      error.value = 'Remove a row before inserting another recommendation.'
      return
    }
  }
  function reset() {
    rows.value = [blankRow(settings.value.length)]
    error.value = ''
  }
  return {
    settings,
    rows,
    strategy,
    hardMode,
    result,
    busy,
    error,
    initialize,
    schedule,
    updateSettings,
    addAfter,
    remove,
    setWord,
    cycle,
    allAbsent,
    useRecommendation,
    reset,
  }
})
