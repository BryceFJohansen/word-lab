<script setup lang="ts">
import { lengths, type DictionarySettings } from '../core/dictionary/types'
defineProps<{ modelValue: DictionarySettings; prefix: string }>()
const emit = defineEmits<{ 'update:modelValue': [DictionarySettings] }>()
function update(value: DictionarySettings, key: keyof DictionarySettings, event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  emit('update:modelValue', { ...value, [key]: key === 'length' ? Number(raw) : raw })
}
</script>
<template>
  <div class="dictionary-controls">
    <label :for="`${prefix}-length`"
      >Word length<select
        :id="`${prefix}-length`"
        :value="modelValue.length"
        @change="update(modelValue, 'length', $event)"
      >
        <option v-for="n in lengths" :key="n" :value="n">{{ n }} letters</option>
      </select></label
    >
    <label :for="`${prefix}-difficulty`"
      >Vocabulary<select
        :id="`${prefix}-difficulty`"
        :value="modelValue.difficulty"
        @change="update(modelValue, 'difficulty', $event)"
      >
        <option value="common">Common</option>
        <option value="standard">Standard</option>
        <option value="all">All words</option>
      </select></label
    >
    <label :for="`${prefix}-spelling`"
      >Spelling<select
        :id="`${prefix}-spelling`"
        :value="modelValue.spelling"
        @change="update(modelValue, 'spelling', $event)"
      >
        <option value="combined">UK + US</option>
        <option value="uk">UK / NZ style</option>
        <option value="us">US English</option>
      </select></label
    >
  </div>
</template>
