import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { defaultSettings, isSettings, type DictionarySettings } from '../core/dictionary/types'
import {
  createGame,
  emptyStatistics,
  isGame,
  randomIndex,
  recordResult,
  statisticsKey,
  submitGuess,
  type GameSession,
  type Statistics,
} from '../core/game'
import { getDictionary } from '../dictionaries/dictionaryLoader'
import { readSaved, writeSaved } from './persistence'

interface SavedGame {
  session: GameSession | null
  settings: DictionarySettings
  stats: Record<string, Statistics>
}
export function isSavedGame(value: unknown): value is SavedGame {
  const v = value as SavedGame
  return (
    !!v &&
    isSettings(v.settings) &&
    (v.session === null || isGame(v.session)) &&
    !!v.stats &&
    typeof v.stats === 'object' &&
    Object.values(v.stats).every((s) => {
      if (
        !s ||
        !['played', 'won', 'streak', 'bestStreak'].every(
          (k) =>
            Number.isInteger(s[k as keyof Statistics]) && Number(s[k as keyof Statistics]) >= 0,
        ) ||
        !s.distribution ||
        typeof s.distribution !== 'object'
      )
        return false
      return (
        s.won <= s.played &&
        s.streak <= s.bestStreak &&
        s.bestStreak <= s.won &&
        Object.entries(s.distribution).every(
          ([k, n]) => /^[1-9]\d*$/.test(k) && Number.isInteger(n) && n >= 0,
        ) &&
        Object.values(s.distribution).reduce((a, b) => a + b, 0) === s.won
      )
    })
  )
}
export const useGameStore = defineStore('game', () => {
  const saved = readSaved('game', isSavedGame)
  const session = ref<GameSession | null>(saved?.session ?? null)
  const settings = ref<DictionarySettings>(saved?.settings ?? { ...defaultSettings })
  const stats = ref<Record<string, Statistics>>(saved?.stats ?? {})
  const error = ref(''),
    busy = ref(false),
    ready = ref(false)
  let valid: ReadonlySet<string> = new Set(),
    generation = 0
  const statistics = computed(() =>
    session.value
      ? (stats.value[statisticsKey(session.value)] ?? emptyStatistics())
      : emptyStatistics(),
  )
  const keyboard = computed(() => {
    const result: Record<string, number> = {}
    for (const row of session.value?.guesses ?? [])
      row.feedback.forEach((f, i) => {
        result[row.word[i]] = Math.max(result[row.word[i]] ?? -1, f)
      })
    return result
  })
  watch(
    [session, settings, stats],
    () =>
      writeSaved('game', { session: session.value, settings: settings.value, stats: stats.value }),
    { deep: true, flush: 'sync' },
  )
  async function start() {
    const id = ++generation
    busy.value = true
    error.value = ''
    const chosen = { ...settings.value }
    try {
      const dictionary = await getDictionary(chosen)
      if (id !== generation) return
      const answer = dictionary.answers[randomIndex(dictionary.answers.length)]
      valid = dictionary.valid
      session.value = createGame(answer, chosen)
      ready.value = true
    } catch (e) {
      if (id === generation) error.value = (e as Error).message
    } finally {
      if (id === generation) busy.value = false
    }
  }
  async function initialize() {
    if (ready.value || busy.value) return
    if (!session.value) return start()
    busy.value = true
    try {
      const dictionary = await getDictionary(session.value.settings)
      valid = dictionary.valid
      if (
        !dictionary.answers.includes(session.value.answer) ||
        session.value.guesses.some((row) => !valid.has(row.word))
      )
        throw new Error('This saved puzzle uses an older dictionary. Start a new game.')
      ready.value = true
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      busy.value = false
    }
  }
  function key(value: string) {
    const game = session.value
    if (!game || !ready.value || busy.value || game.status !== 'playing') return
    error.value = ''
    if (value === 'Backspace') game.input = game.input.slice(0, -1)
    else if (value === 'Enter') {
      try {
        const next = submitGuess(game, game.input, valid)
        if (next.status !== 'playing')
          stats.value[statisticsKey(next)] = recordResult(
            stats.value[statisticsKey(next)] ?? emptyStatistics(),
            next,
          )
        session.value = next
      } catch (e) {
        error.value = (e as Error).message
      }
    } else if (/^[a-z]$/i.test(value) && game.input.length < game.settings.length)
      game.input += value.toLowerCase()
  }
  return {
    session,
    settings,
    stats,
    statistics,
    keyboard,
    error,
    busy,
    ready,
    start,
    initialize,
    key,
  }
})
