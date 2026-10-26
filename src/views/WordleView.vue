<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { feedbackNames, feedbackSymbols } from '../core/scoring'
import DictionaryControls from '../components/DictionaryControls.vue'
const props = defineProps<{ active: boolean }>()
const game = useGameStore()
const board = ref<HTMLElement | null>(null)
function focusBoard() {
  if (props.active) board.value?.focus({ preventScroll: true })
}
async function startGame() {
  await game.start()
  focusBoard()
}
const rows = computed(() =>
  Array.from({ length: game.session?.maxAttempts ?? 6 }, (_, i) => {
    const submitted = game.session?.guesses[i]
    return {
      word: submitted?.word ?? (i === game.session?.guesses.length ? game.session.input : ''),
      feedback: submitted?.feedback,
      current: i === game.session?.guesses.length && game.session.status === 'playing',
    }
  }),
)
const message = computed(() => {
  if (game.busy) return 'Preparing your puzzle…'
  if (game.error) return game.error
  if (game.session?.status === 'won')
    return (
      ['', 'One and done!', 'Beautifully done.', 'A lovely bit of wordplay.'][
        game.session.guesses.length
      ] ?? 'You found it. Nicely played!'
    )
  if (game.session?.status === 'lost')
    return `The word was ${game.session.answer.toUpperCase()}. A fresh puzzle awaits.`
  if (game.session?.guesses.length) {
    const remaining = game.session.maxAttempts - game.session.guesses.length
    return `${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left. Keep following the clues.`
  }
  return 'A fresh word. A little curiosity. Six chances.'
})
const feedbackSummary = computed(() => {
  const guesses = game.session?.guesses
  const guess = guesses?.at(-1)
  if (!guess || game.error || game.busy) return ''
  const letters = guess.feedback
    .map((state, i) => `Position ${i + 1}: ${guess.word[i].toUpperCase()}, ${feedbackNames[state]}`)
    .join('; ')
  return `Guess ${guesses!.length}: ${guess.word.toUpperCase()}. ${letters}.`
})
const average = computed(() =>
  game.statistics.won
    ? (
        Object.entries(game.statistics.distribution).reduce((n, [k, v]) => n + Number(k) * v, 0) /
        game.statistics.won
      ).toFixed(1)
    : '—',
)
function onKey(event: KeyboardEvent) {
  if (
    !props.active ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (event.target as HTMLElement).closest('input,select,textarea,[contenteditable]')
  )
    return
  const focusedControl = (event.target as HTMLElement).closest('button,summary,a')
  // Preserve native Enter activation for keyboard navigation of controls.
  if (event.key === 'Enter' && focusedControl) return
  if (/^[a-z]$/i.test(event.key) || ['Enter', 'Backspace'].includes(event.key)) {
    event.preventDefault()
    if (focusedControl) focusBoard()
    game.key(event.key)
  }
}
onMounted(() => {
  game.initialize()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
<template>
  <div class="game-layout">
    <section class="game-main" aria-label="Wordle game">
      <div class="section-heading">
        <div>
          <p class="eyebrow">YOUR DAILY DOSE OF WORDPLAY</p>
          <h1>Make every letter count.</h1>
        </div>
        <span class="mode-badge">Unlimited play</span>
      </div>
      <div class="game-card">
        <div class="board-caption">
          <span
            >{{ game.session?.settings.length ?? 5 }} letters <span class="quiet">/</span>
            {{ game.session?.settings.difficulty ?? 'common' }} words</span
          ><span
            >{{
              Math.max(0, (game.session?.maxAttempts ?? 6) - (game.session?.guesses.length ?? 0))
            }}
            attempts left</span
          >
        </div>
        <div
          ref="board"
          class="board"
          :style="{ '--letters': game.session?.settings.length ?? 5 }"
          role="group"
          aria-label="Guess board"
          tabindex="0"
        >
          <div
            v-for="(row, i) in rows"
            :key="`${game.session?.id}-${i}`"
            class="board-row"
            role="group"
            :class="{ current: row.current }"
            :aria-label="`Guess ${i + 1}${row.current ? ', current row' : ''}`"
          >
            <div
              v-for="(_, j) in Array(game.session?.settings.length ?? 5)"
              :key="j"
              class="tile"
              role="img"
              :class="[
                row.feedback ? `state-${row.feedback[j]} revealed` : '',
                { filled: row.word[j] },
              ]"
              :style="{ '--delay': `${j * 65}ms` }"
              :aria-label="
                row.word[j]
                  ? `${row.word[j]}, ${row.feedback ? feedbackNames[row.feedback[j]] : 'not submitted'}`
                  : 'Empty'
              "
            >
              <span aria-hidden="true">{{ row.word[j] }}</span
              ><small v-if="row.feedback" aria-hidden="true">{{
                feedbackSymbols[row.feedback[j]]
              }}</small>
            </div>
          </div>
        </div>
        <p
          class="game-message"
          :class="{ 'error-text': game.error, success: game.session?.status === 'won' }"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{{ message }}</span>
          <span class="sr-only">{{ feedbackSummary }}</span>
        </p>
        <div
          class="keyboard"
          role="group"
          aria-label="On-screen keyboard"
          @pointerdown.prevent="focusBoard"
        >
          <div
            v-for="(line, i) in ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']"
            :key="line"
            class="keyboard-row"
          >
            <button
              v-if="i === 2"
              class="key wide"
              :disabled="!game.ready || game.busy || game.session?.status !== 'playing'"
              @click="game.key('Enter')"
            >
              Enter
            </button>
            <button
              v-for="letter in line"
              :key="letter"
              class="key"
              :class="game.keyboard[letter] !== undefined ? `state-${game.keyboard[letter]}` : ''"
              :aria-label="`${letter}${game.keyboard[letter] !== undefined ? ', ' + feedbackNames[game.keyboard[letter]] : ''}`"
              :disabled="!game.ready || game.busy || game.session?.status !== 'playing'"
              @click="game.key(letter)"
            >
              {{ letter
              }}<small v-if="game.keyboard[letter] !== undefined" aria-hidden="true">{{
                feedbackSymbols[game.keyboard[letter]]
              }}</small>
            </button>
            <button
              v-if="i === 2"
              class="key wide"
              aria-label="Backspace"
              :disabled="!game.ready || game.busy || game.session?.status !== 'playing'"
              @click="game.key('Backspace')"
            >
              ⌫
            </button>
          </div>
        </div>
        <p class="keyboard-hint">Type with your keyboard, or tap the letters above.</p>
      </div>
    </section>
    <aside class="game-sidebar">
      <section class="panel settings-panel">
        <div class="panel-title">
          <h2>Your next puzzle</h2>
          <span aria-hidden="true">↗</span>
        </div>
        <DictionaryControls v-model="game.settings" prefix="game" />
        <p class="helper">
          Settings apply when you start a new game. Your current puzzle stays as it is.
        </p>
        <button class="button primary full" :disabled="game.busy" @click="startGame">
          {{ game.busy ? 'Getting ready…' : 'New game' }} <span aria-hidden="true">↻</span>
        </button>
      </section>
      <section class="panel">
        <div class="panel-title">
          <h2>A little progress</h2>
          <span class="tiny-tag">{{ game.session?.settings.length ?? 5 }} LETTERS</span>
        </div>
        <div class="stats">
          <div>
            <strong>{{ game.statistics.played }}</strong
            ><span>Played</span>
          </div>
          <div>
            <strong
              >{{
                game.statistics.played
                  ? Math.round((game.statistics.won / game.statistics.played) * 100)
                  : 0
              }}<small>%</small></strong
            ><span>Win rate</span>
          </div>
          <div>
            <strong>{{ game.statistics.streak }}</strong
            ><span>Streak</span>
          </div>
        </div>
        <details class="stats-details">
          <summary>More statistics</summary>
          <p>
            {{ game.statistics.won }} wins · Best streak {{ game.statistics.bestStreak }} · Average
            {{ average }}
          </p>
          <div v-for="n in game.session?.maxAttempts ?? 6" :key="n" class="distribution">
            <span>{{ n }}</span>
            <div
              :style="{
                width: `${Math.max(5, (100 * (game.statistics.distribution[n] ?? 0)) / Math.max(1, game.statistics.won))}%`,
              }"
            >
              {{ game.statistics.distribution[n] ?? 0 }}
            </div>
          </div>
          <p class="helper">
            Completed games for this length, vocabulary, spelling and attempt limit. Unfinished
            puzzles don’t count.
          </p>
        </details>
      </section>
      <section class="how-to">
        <p class="eyebrow">A FEW SMALL CLUES</p>
        <h2>Find the word,<br />one guess at a time.</h2>
        <div class="legend-line">
          <span class="mini-tile state-2">W<small>✓</small></span>
          <p><strong>Right letter. Right place.</strong><br />Keep this one where it is.</p>
        </div>
        <div class="legend-line">
          <span class="mini-tile state-1">O<small>•</small></span>
          <p><strong>Right letter. New place.</strong><br />Try it somewhere else.</p>
        </div>
        <div class="legend-line">
          <span class="mini-tile state-0">R<small>−</small></span>
          <p><strong>No extra copies.</strong><br />This occurrence isn’t in the word.</p>
        </div>
      </section>
    </aside>
  </div>
</template>
