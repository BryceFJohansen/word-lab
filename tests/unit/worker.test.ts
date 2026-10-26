import { it, expect } from 'vitest'
import {
  SolverClient,
  type WorkerPort,
  type SolverRequest,
  type SolverResponse,
  type SolverResult,
} from '../../src/workers/protocol'
import { defaultSettings } from '../../src/core/dictionary/types'
class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null
  onerror: WorkerPort['onerror'] = null
  requests: (SolverRequest | { cancel: true })[] = []
  terminated = false
  postMessage(message: SolverRequest | { cancel: true }) {
    this.requests.push(message)
  }
  terminate() {
    this.terminated = true
  }
  respond(data: SolverResponse) {
    this.onmessage?.({ data } as MessageEvent<SolverResponse>)
  }
}
const request = {
  settings: defaultSettings,
  rows: [],
  strategy: 'entropy' as const,
  hardMode: false,
}
const result = { candidates: ['apple'] } as SolverResult
it('supersedes prior promises, ignores stale replies, and cancels/disposes', async () => {
  const worker = new FakeWorker(),
    client = new SolverClient(worker)
  const first = client.request(request),
    id1 = (worker.requests.at(-1) as SolverRequest).id
  const second = client.request(request),
    id2 = (worker.requests.at(-1) as SolverRequest).id
  expect(await first).toBe(null)
  worker.respond({ id: id1, result: { candidates: ['wrong'] } as SolverResult })
  worker.respond({ id: id2, result })
  expect(await second).toBe(result)
  const third = client.request(request)
  client.dispose()
  expect(await third).toBe(null)
  expect(worker.terminated).toBe(true)
})
it('reports worker errors and dictionary import failures', async () => {
  const worker = new FakeWorker(),
    client = new SolverClient(worker)
  const first = client.request(request)
  worker.onerror?.({} as ErrorEvent)
  await expect(first).rejects.toThrow('worker stopped')
  await expect(client.request(request)).rejects.toThrow('worker stopped')
  const anotherWorker = new FakeWorker(),
    anotherClient = new SolverClient(anotherWorker)
  const second = anotherClient.request(request),
    id = (anotherWorker.requests.at(-1) as SolverRequest).id
  anotherWorker.respond({ id, error: 'Dictionary missing' })
  await expect(second).rejects.toThrow('Dictionary missing')
})
