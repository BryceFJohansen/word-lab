import { beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useGameStore } from '../../src/stores/game'
import { isSavedSolver, useSolverStore } from '../../src/stores/solver'
import { readSaved, storageWarning, writeSaved } from '../../src/stores/persistence'
import SolverView from '../../src/views/SolverView.vue'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
beforeEach(() => {
  localStorage.clear()
  storageWarning.value = ''
  setActivePinia(createPinia())
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const length = /\/(\d+)\.json/.exec(String(input))?.[1]
    if (!length) throw new Error('Unexpected request')
    const bytes = await readFile(
      resolve(process.cwd(), `src/dictionaries/generated/${length}.json`),
      'utf8',
    )
    return { ok: true, json: async () => JSON.parse(bytes) } as Response
  })
})
describe('independent stores and persistence', () => {
  it('preserves a game through solver edits, reset and restoration', async () => {
    const game = useGameStore(),
      solver = useSolverStore()
    await game.initialize()
    game.key('a')
    game.key('p')
    const answer = game.session?.answer
    solver.setWord(solver.rows[0].id, 'crane')
    solver.hardMode = true
    solver.addAfter(solver.rows[0].id)
    solver.updateSettings({ ...solver.settings, length: 12 })
    expect(game.session?.input).toBe('ap')
    expect(game.session?.settings.length).toBe(5)
    expect(solver.rows).toHaveLength(1)
    expect(solver.rows[0].feedback).toHaveLength(12)
    solver.reset()
    await nextTick()
    setActivePinia(createPinia())
    expect(useGameStore().session?.answer).toBe(answer)
    expect(useGameStore().session?.input).toBe('ap')
    expect(useSolverStore().settings.length).toBe(12)
    expect(useSolverStore().hardMode).toBe(true)
  })
  it('restores older solver saves with hard mode off and validates the new setting', () => {
    const saved = {
      settings: { length: 5, spelling: 'us', difficulty: 'common' },
      strategy: 'entropy',
      rows: [{ id: 'saved-row', word: 'audio', feedback: [0, 0, 1, 1, 0] }],
    }
    writeSaved('solver', saved)
    const solver = useSolverStore()
    expect(solver.rows).toEqual(saved.rows)
    expect(solver.hardMode).toBe(false)
    expect(isSavedSolver({ ...saved, hardMode: true })).toBe(true)
    expect(isSavedSolver({ ...saved, hardMode: 'yes' })).toBe(false)
  })
  it('applies new settings only to a new puzzle and records completed games once', async () => {
    const game = useGameStore()
    await game.initialize()
    const answer = game.session!.answer
    game.settings = { ...game.settings, length: 6 }
    expect(game.session?.settings.length).toBe(5)
    for (const c of answer) game.key(c)
    game.key('Enter')
    game.key('Enter')
    expect(game.statistics.played).toBe(1)
    expect(game.statistics.won).toBe(1)
    await game.start()
    expect(game.session?.settings.length).toBe(6)
    expect(game.session?.guesses).toHaveLength(0)
  })
  it('keeps the strongest keyboard evidence', async () => {
    const game = useGameStore()
    await game.initialize()
    game.session!.guesses = [{ word: 'allee', feedback: [2, 1, 0, 0, 2] }]
    expect(game.keyboard).toEqual({ a: 2, l: 1, e: 2 })
  })
  it('tolerates damaged, incompatible, and unavailable storage', () => {
    localStorage.setItem('wordlab:bad', '{')
    expect(readSaved('bad', isSavedSolver)).toBeUndefined()
    localStorage.setItem('wordlab:bad', JSON.stringify({ version: 0, data: {} }))
    expect(readSaved('bad', isSavedSolver)).toBeUndefined()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => writeSaved('test', {})).not.toThrow()
    expect(storageWarning.value).toContain('could not save')
  })
})
it('inserts, removes, edits and clears stable independent solver rows through controls', async () => {
  const wrapper = mount(SolverView, {
    props: { active: false },
    global: { plugins: [createPinia()] },
  })
  const solver = useSolverStore()
  await wrapper.get('#solver-hard-mode').setValue(true)
  expect(solver.hardMode).toBe(true)
  await wrapper.get('input[aria-label="Guess 1"]').setValue('apple')
  const first = solver.rows[0].id
  await wrapper.get('button[aria-label="Add row after row 1"]').trigger('click')
  await wrapper.get('input[aria-label="Guess 2"]').setValue('crane')
  const second = solver.rows[1].id
  await wrapper.get('button[aria-label="Add row after row 1"]').trigger('click')
  expect(solver.rows.map((r) => r.word)).toEqual(['apple', '', 'crane'])
  expect(solver.rows[2].id).toBe(second)
  const tile = wrapper.findAll('.feedback-tile')[0]
  await tile.trigger('click')
  expect(solver.rows[0].feedback[0]).toBe(1)
  await tile.trigger('click')
  expect(solver.rows[0].feedback[0]).toBe(2)
  await tile.trigger('click')
  expect(solver.rows[0].feedback[0]).toBe(0)
  await wrapper.get('button[aria-label="Remove row 2"]').trigger('click')
  expect(solver.rows.map((r) => r.id)).toEqual([first, second])
  await wrapper.get('button[aria-label="Remove row 2"]').trigger('click')
  await wrapper.get('button[aria-label="Clear row 1"]').trigger('click')
  expect(solver.rows).toHaveLength(1)
  expect(solver.rows[0].word).toBe('')
  solver.useRecommendation('apple')
  expect(solver.rows[0].pendingFeedback).toBe(true)
  solver.allAbsent(solver.rows[0].id)
  expect(solver.rows[0].pendingFeedback).toBe(false)
  wrapper.unmount()
})
