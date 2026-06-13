import { DEFAULT_SETTINGS, type DiaryEntry, type Settings, parseImportedEntries } from '../domain/sleep'

export type AppState = {
  settings: Settings
  entries: DiaryEntry[]
}

const STORAGE_KEY = 'sleep-anchor-state-v1'

export function loadState(): AppState {
  if (typeof localStorage === 'undefined') {
    return { settings: DEFAULT_SETTINGS, entries: [] }
  }
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { settings: DEFAULT_SETTINGS, entries: [] }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      entries: parseImportedEntries(parsed.entries ?? []),
    }
  } catch {
    return { settings: DEFAULT_SETTINGS, entries: [] }
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetState(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function importState(text: string): AppState {
  const parsed = JSON.parse(text) as Partial<AppState> | DiaryEntry[]
  if (Array.isArray(parsed)) {
    return { settings: DEFAULT_SETTINGS, entries: parseImportedEntries(parsed) }
  }
  return {
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    entries: parseImportedEntries(parsed.entries ?? []),
  }
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state, null, 2)
}
