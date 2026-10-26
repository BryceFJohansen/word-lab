import { ref } from 'vue'
export const storageWarning = ref('')
export function readSaved<T>(key: string, validate: (value: unknown) => value is T): T | undefined {
  try {
    const raw = localStorage.getItem(`wordlab:${key}`)
    if (!raw) return
    const envelope = JSON.parse(raw)
    if (envelope.version !== 1 || !validate(envelope.data)) {
      storageWarning.value = 'Older or damaged saved progress was ignored. You can start fresh.'
      return
    }
    return envelope.data
  } catch {
    storageWarning.value = 'Saved progress could not be read. You can still play in this session.'
  }
}
export function writeSaved(key: string, data: unknown) {
  try {
    localStorage.setItem(`wordlab:${key}`, JSON.stringify({ version: 1, data }))
  } catch {
    storageWarning.value = 'Your browser could not save progress. Keep this page open to continue.'
  }
}
