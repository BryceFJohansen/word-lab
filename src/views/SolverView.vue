<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSolverStore } from '../stores/solver'
import { feedbackNames, feedbackSymbols } from '../core/scoring'
import { completedRows, type SolverRow } from '../core/solver/filter'
import { strategyIds, strategyNames } from '../core/solver/strategies'
import DictionaryControls from '../components/DictionaryControls.vue'
const props = defineProps<{ active: boolean }>()
const solver = useSolverStore()
watch(
  () => props.active,
  (value) => {
    if (value) solver.initialize()
  },
  { immediate: true },
)
const search = ref(''),
  page = ref(1),
  pageSize = 36
const filtered = computed(
  () =>
    solver.result?.candidates.filter((w) => w.includes(search.value.trim().toLowerCase())) ?? [],
)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visibleCandidates = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
function resetSolver() {
  solver.reset()
  search.value = ''
}
function onWordInput(row: SolverRow, event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.value
  const start = input.selectionStart ?? raw.length
  const end = input.selectionEnd ?? start
  solver.setWord(row.id, raw)
  // A rejected edit may leave the reactive value unchanged, so also repair the native input.
  if (input.value !== row.word) {
    input.value = row.word
    const caret = (offset: number) =>
      Math.min(raw.slice(0, offset).replace(/[^a-z]/gi, '').length, row.word.length)
    input.setSelectionRange(caret(start), caret(end))
  }
}
const complete = computed(() => completedRows(solver.rows, solver.settings.length).length)
watch([search, () => solver.result], () => (page.value = 1))
const suspectRows = computed(() =>
  solver.result?.diagnostic?.rowIds
    .map((id) => solver.rows.findIndex((r) => r.id === id) + 1)
    .join(', '),
)
</script>
<template>
  <div class="section-heading solver-heading">
    <div>
      <p class="eyebrow">A SECOND PAIR OF EYES</p>
      <h1>Turn clues into possibilities.</h1>
      <p>Your independent word puzzle assistant. Add guesses, match the colours, and explore.</p>
    </div>
  </div>
  <div class="solver-toolbar">
    <DictionaryControls
      :model-value="solver.settings"
      prefix="solver"
      @update:model-value="solver.updateSettings"
    /><button
      class="button"
      @click="resetSolver"
    >
      Reset solver <span aria-hidden="true">↻</span>
    </button>
  </div>
  <div class="solver-layout">
    <div>
      <section class="panel solver-rows-panel" aria-label="Guess rows">
        <div class="panel-title">
          <h2>What have you tried?</h2>
          <span class="tiny-tag"
            >{{ complete }} ACTIVE {{ complete === 1 ? 'CLUE' : 'CLUES' }}</span
          >
        </div>
        <p class="feedback-legend">
          <span><i class="legend-dot state-0"></i> − Absent</span
          ><span><i class="legend-dot state-1"></i> • Elsewhere</span
          ><span><i class="legend-dot state-2"></i> ✓ Correct</span>
        </p>
        <div class="solver-rows">
          <div
            v-for="(row, i) in solver.rows"
            :key="row.id"
            class="solver-row"
            :data-row-id="row.id"
          >
            <div class="solver-row-top">
              <label class="row-label" :for="`row-${row.id}`"
                >{{ String(i + 1).padStart(2, '0') }}<span class="sr-only">Guess</span></label
              ><input
                :id="`row-${row.id}`"
                class="word-input"
                :value="row.word"
                :aria-label="`Guess ${i + 1}`"
                :aria-describedby="`note-${row.id}`"
                :placeholder="'·'.repeat(solver.settings.length)"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                @input="onWordInput(row, $event)"
              />
              <div class="row-actions">
                <button
                  class="icon-button"
                  :aria-label="`Add row after row ${i + 1}`"
                  @click="solver.addAfter(row.id)"
                >
                  +</button
                ><button
                  class="icon-button"
                  :aria-label="`${solver.rows.length === 1 ? 'Clear' : 'Remove'} row ${i + 1}`"
                  @click="solver.remove(row.id)"
                >
                  −
                </button>
              </div>
            </div>
            <div
              class="feedback-tiles"
              :style="{
                '--letters': solver.settings.length,
                '--compact-columns': Math.ceil(solver.settings.length / 2),
              }"
              :data-length="solver.settings.length"
              role="group"
              :aria-label="`Feedback for guess ${i + 1}`"
            >
              <button
                v-for="(feedback, j) in row.feedback"
                :key="j"
                class="feedback-tile"
                :class="`state-${feedback}`"
                :aria-label="`Row ${i + 1}, letter ${j + 1}${row.word[j] ? ', ' + row.word[j] : ''}: ${row.pendingFeedback ? 'not set' : feedbackNames[feedback]}. Click to cycle.`"
                @click="solver.cycle(row.id, j)"
              >
                <span class="tile-position" aria-hidden="true">{{ j + 1 }}</span>
                <span class="tile-letter" aria-hidden="true">{{ row.word[j] || '·' }}</span
                ><small aria-hidden="true">{{
                  row.pendingFeedback ? '?' : feedbackSymbols[feedback]
                }}</small>
              </button>
            </div>
            <p :id="`note-${row.id}`" class="row-note">
              <template v-if="row.pendingFeedback"
                >Awaiting feedback; this suggestion is not filtering answers. Tap a tile or
                <button class="text-button" @click="solver.allAbsent(row.id)">
                  mark all absent</button
                >.</template
              ><template v-else-if="row.word.length !== solver.settings.length">{{
                row.word.length
                  ? 'Incomplete — ignored until all letters are entered.'
                  : 'Enter a guess, then tap each tile to match its feedback.'
              }}</template
              ><template v-else-if="solver.result?.unknownRows.includes(row.id)"
                >Not in this guess dictionary. Its feedback still applies; it may come from another
                puzzle.</template
              ><template v-else
                >Included automatically · Tap tiles to cycle grey → yellow → green.</template
              >
            </p>
          </div>
        </div>
      </section>
      <div class="solver-tips">
        <h3>Every clue tells a story.</h3>
        <p>
          Complete rows work together. Leave a row unfinished and it won’t narrow the answers.
          Repeated letters are counted exactly, so a grey tile can still sit beside a yellow or
          green copy.
        </p>
        <p>
          Changing word length clears these rows. Vocabulary and spelling changes keep your clues
          and use the new answer list.
        </p>
      </div>
      <section class="panel" aria-label="Candidate list">
        <div class="panel-title">
          <h2>Possible answers</h2>
          <span class="tiny-tag"
            >{{ solver.result?.candidates.length.toLocaleString() ?? '—' }} WORDS</span
          >
        </div>
        <label class="sr-only" for="candidate-search">Search candidates</label
        ><input
          id="candidate-search"
          v-model="search"
          class="search-input"
          placeholder="Find a word in the possibilities…"
          type="search"
        />
        <ul class="candidate-list">
          <li v-for="word in visibleCandidates" :key="word">{{ word }}</li>
        </ul>
        <p v-if="!visibleCandidates.length" class="helper">
          {{
            solver.busy
              ? 'Finding matching words…'
              : search
                ? 'No candidates match your search.'
                : 'No matching candidates yet.'
          }}
        </p>
        <div class="pagination">
          <button :disabled="page <= 1" @click="page--">← Previous</button
          ><span>{{ filtered.length.toLocaleString() }} results · {{ page }} / {{ pages }}</span
          ><button :disabled="page >= pages" @click="page++">Next →</button>
        </div>
      </section>
    </div>
    <div class="solver-results">
      <div class="candidate-total" role="status" aria-live="polite">
        <strong>{{ solver.result?.candidates.length.toLocaleString() ?? '—' }}</strong>
        <div>
          <h2>{{ solver.busy ? 'Following your clues…' : 'Possible answers' }}</h2>
          <p>
            <span v-if="solver.busy" class="busy-dot" aria-hidden="true"></span>
            {{
              solver.busy
                ? 'You can keep editing while we calculate.'
                : `${complete} complete ${complete === 1 ? 'row' : 'rows'} combined`
            }}
          </p>
        </div>
      </div>
      <div v-if="solver.error" class="diagnostic" role="alert">
        <p>{{ solver.error }}</p>
        <button class="button" @click="solver.schedule()">Retry calculation</button>
      </div>
      <div v-if="solver.result?.diagnostic" class="diagnostic" role="status">
        <h3>
          {{
            solver.result.diagnostic.kind === 'internal'
              ? 'Some clues conflict'
              : 'No words fit these clues'
          }}
        </h3>
        <p>{{ solver.result.diagnostic.message }}</p>
        <p v-if="suspectRows">
          Try checking {{ solver.result.diagnostic.rowIds.length === 1 ? 'row' : 'rows' }}
          {{ suspectRows }}: removing one restores dictionary matches.
        </p>
      </div>
      <section class="panel" aria-label="Recommended guesses">
        <div class="panel-title">
          <h2>A good next guess</h2>
          <span aria-hidden="true">✳</span>
        </div>
        <div class="strategy-control">
          <label for="strategy">Strategy</label
          ><select id="strategy" v-model="solver.strategy">
            <option v-for="id in strategyIds" :key="id" :value="id">{{ strategyNames[id] }}</option>
          </select>
        </div>
        <div class="hard-mode-control">
          <label for="solver-hard-mode">
            <input
              id="solver-hard-mode"
              v-model="solver.hardMode"
              type="checkbox"
              aria-describedby="solver-hard-mode-help"
            />
            Hard mode — use revealed hints
          </label>
          <p id="solver-hard-mode-help" class="helper">
            Keep greens in place and include every yellow, including repeated copies. Grey letters
            may still be used.
          </p>
        </div>
        <div
          v-for="(guess, i) in solver.result?.ranking.guesses ?? []"
          :key="guess.word"
          class="recommendation"
        >
          <span class="rank">{{ i + 1 }}</span>
          <div class="recommendation-body">
            <strong>{{ guess.word }}</strong
            ><span v-if="guess.isAnswer" class="answer-dot" aria-hidden="true"></span
            ><small>{{ guess.isAnswer ? 'Possible answer' : 'Information-gathering guess' }}</small
            ><small>{{ guess.explanation }}</small>
          </div>
          <span class="score">{{ guess.score.toFixed(2) }}</span
          ><button
            :aria-label="`Use ${guess.word} as a guess`"
            @click="solver.useRecommendation(guess.word)"
          >
            Use ↗
          </button>
        </div>
        <p v-if="!solver.result?.ranking.guesses.length" class="helper">
          {{
            solver.busy
              ? 'Comparing the next possibilities…'
              : 'Recommendations appear when at least one answer fits.'
          }}
        </p>
        <p v-if="solver.result" class="calculation-note">
          <strong>{{
            solver.result.ranking.metadata.exact ? 'Exact evaluation' : 'Approximate ranking'
          }}</strong>
          · {{ solver.result.ranking.metadata.evaluatedGuesses.toLocaleString() }} /
          {{ solver.result.ranking.metadata.totalGuesses.toLocaleString() }}
          {{ solver.hardMode ? 'hard-mode guesses' : 'guesses' }} against
          {{ solver.result.ranking.metadata.evaluatedAnswers.toLocaleString() }} /
          {{ solver.result.ranking.metadata.totalAnswers.toLocaleString() }} answers.
          <template v-if="!solver.result.ranking.metadata.exact"
            >Frequency shortlist and deterministic answer sample; not a globally optimal
            guarantee.</template
          >
          Calculated in {{ Math.round(solver.result.elapsedMs) }} ms.
        </p>
        <p class="helper">
          Using a suggestion fills a row. Set its real feedback before it contributes a clue.
        </p>
      </section>
      <details class="panel">
        <summary>About this vocabulary</summary>
        <p class="helper">
          Common uses SCOWL’s smaller coverage tier (≤35), Standard extends to ≤60, and All includes
          eligible words through ≤80. These are dictionary coverage bands, not measured
          probabilities. Inflections and plurals are included. UK / NZ style uses British spellings;
          it is not a dedicated New Zealand lexicon.
        </p>
      </details>
    </div>
  </div>
</template>
