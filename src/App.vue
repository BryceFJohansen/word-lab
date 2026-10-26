<script setup lang="ts">
import { ref, watch } from 'vue'
import WordleView from './views/WordleView.vue'
import SolverView from './views/SolverView.vue'
import { readSaved, writeSaved, storageWarning } from './stores/persistence'
const tab = ref(
  readSaved('tab', (v): v is 'wordle' | 'solver' => v === 'wordle' || v === 'solver') ?? 'wordle',
)
const theme = ref(
  readSaved('theme', (v): v is 'light' | 'dark' => v === 'light' || v === 'dark') ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
)
watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value
    writeSaved('theme', value)
  },
  { immediate: true },
)
watch(tab, (value) => writeSaved('tab', value))
function changeTab(event: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    tab.value =
      event.key === 'Home'
        ? 'wordle'
        : event.key === 'End'
          ? 'solver'
          : tab.value === 'wordle'
            ? 'solver'
            : 'wordle'
    document.getElementById(`tab-${tab.value}`)?.focus()
  }
}
</script>
<template>
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="./" aria-label="Word Lab home"
        ><span class="brand-mark" aria-hidden="true">w<span>.</span></span
        ><span>word<span class="brand-light">lab</span><small>A LITTLE WORDPLAY.</small></span></a
      >
      <div class="header-right">
        <span class="local-note"><i></i> A space for curious minds</span
        ><button
          class="theme-toggle"
          :aria-label="`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`"
          @click="theme = theme === 'light' ? 'dark' : 'light'"
        >
          {{ theme === 'light' ? '☾' : '☀' }}
        </button>
      </div>
    </header>
    <nav class="tab-bar" aria-label="Word Lab tools">
      <div class="tabs" role="tablist" aria-label="Game and solver" @keydown="changeTab">
        <button
          id="tab-wordle"
          role="tab"
          :aria-selected="tab === 'wordle'"
          aria-controls="panel-wordle"
          :tabindex="tab === 'wordle' ? 0 : -1"
          @click="tab = 'wordle'"
        >
          <span aria-hidden="true">▦</span> Wordle</button
        ><button
          id="tab-solver"
          role="tab"
          :aria-selected="tab === 'solver'"
          aria-controls="panel-solver"
          :tabindex="tab === 'solver' ? 0 : -1"
          @click="tab = 'solver'"
        >
          <span aria-hidden="true">⌕</span> Solver
        </button>
      </div>
      <span class="tab-note">Play a little. Think a little.</span>
    </nav>
    <p v-if="storageWarning" class="notice" role="status">{{ storageWarning }}</p>
    <main>
      <section
        id="panel-wordle"
        role="tabpanel"
        aria-labelledby="tab-wordle"
        :hidden="tab !== 'wordle'"
      >
        <WordleView :active="tab === 'wordle'" />
      </section>
      <section
        id="panel-solver"
        role="tabpanel"
        aria-labelledby="tab-solver"
        :hidden="tab !== 'solver'"
      >
        <SolverView :active="tab === 'solver'" />
      </section>
    </main>
    <footer>
      <span>Made for the love of language.</span
      ><span>Local play · No account needed <span aria-hidden="true">✳</span></span
      ><a href="/DICTIONARY-LICENSE.txt" target="_blank" rel="noopener"
        >Dictionary credits & licences</a
      ><small
        >SCOWL © Kevin Atkinson · UKACD © J Ross Beresford 1993–1999. All rights reserved.</small
      >
    </footer>
  </div>
</template>
