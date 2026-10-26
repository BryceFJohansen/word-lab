import type { DictionarySettings } from '../core/dictionary/types'
import type { Diagnostic, SolverRow } from '../core/solver/filter'
import type { Ranking, StrategyId } from '../core/solver/strategies'
export interface SolverRequest {
  id: number
  settings: DictionarySettings
  rows: SolverRow[]
  strategy: StrategyId
  hardMode: boolean
}
export interface SolverResult {
  candidates: string[]
  ranking: Ranking
  diagnostic: Diagnostic | null
  unknownRows: string[]
  elapsedMs: number
}
export type SolverResponse = { id: number; result: SolverResult } | { id: number; error: string }
export interface WorkerPort {
  onmessage: ((event: MessageEvent<SolverResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: SolverRequest | { cancel: true }): void
  terminate(): void
}
/** Both the client and worker reject stale generations; tests inject a fake transport. */
export class SolverClient {
  private generation = 0
  private failed = false
  private pending?: {
    id: number
    resolve: (result: SolverResult | null) => void
    reject: (error: Error) => void
  }
  constructor(private port: WorkerPort) {
    port.onmessage = ({ data }) => {
      if (data.id !== this.generation || this.pending?.id !== data.id) return
      const pending = this.pending
      this.pending = undefined
      if ('error' in data) pending.reject(new Error(data.error))
      else pending.resolve(data.result)
    }
    port.onerror = () => {
      this.failed = true
      this.pending?.reject(new Error('The solver worker stopped. Retry the calculation.'))
      this.pending = undefined
    }
  }
  cancel() {
    this.generation++
    this.pending?.resolve(null)
    this.pending = undefined
    this.port.postMessage({ cancel: true })
  }
  request(request: Omit<SolverRequest, 'id'>): Promise<SolverResult | null> {
    if (this.failed)
      return Promise.reject(new Error('The solver worker stopped. Retry the calculation.'))
    this.cancel()
    const id = this.generation
    return new Promise((resolve, reject) => {
      this.pending = { id, resolve, reject }
      this.port.postMessage({ ...request, id })
    })
  }
  dispose() {
    this.cancel()
    this.port.terminate()
  }
}
