import { getDictionary } from '../dictionaries/dictionaryLoader'
import { completedRows, diagnose, filterCandidates } from '../core/solver/filter'
import { rankGuesses } from '../core/solver/strategies'
import type { SolverRequest, SolverResponse } from './protocol'
let generation = 0
self.onmessage = async ({ data }: { data: SolverRequest | { cancel: true } }) => {
  const version = ++generation
  if ('cancel' in data) return
  const start = performance.now()
  const cancelled = () => version !== generation
  const send = (message: SolverResponse) => {
    if (!cancelled()) self.postMessage(message)
  }
  try {
    const { valid, answers } = await getDictionary(data.settings)
    if (cancelled()) return
    const rows = completedRows(data.rows, data.settings.length)
    const candidates = filterCandidates(answers, rows)
    const diagnostic = candidates.length ? null : diagnose(answers, rows, data.settings.length)
    const ranking = await rankGuesses(data.strategy, [...valid], candidates, {
      requiredHints: data.hardMode ? rows : undefined,
      cancelled,
      yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
    })
    send({
      id: data.id,
      result: {
        candidates,
        ranking,
        diagnostic,
        unknownRows: rows.filter((row) => !valid.has(row.word)).map((row) => row.id),
        elapsedMs: performance.now() - start,
      },
    })
  } catch (e) {
    send({ id: data.id, error: (e as Error).message || 'The solver could not finish. Try again.' })
  }
}
