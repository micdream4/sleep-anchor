export type DiaryEntry = {
  id: string
  date: string
  inBedTime: string
  outBedTime: string
  sleepLatencyMin: number
  wakeAfterSleepOnsetMin: number
  earlyWakeMin: number
  outOfBedAwakeMin: number
  napMin: number
  caffeineAfter2pm: boolean
  alcoholTonight: boolean
  screenWithin1h: boolean
  exerciseDay: boolean
  morningLight: boolean
  relaxation: boolean
  quality: number
  stress: number
  notes: string
}

export type SleepMetrics = {
  rawTimeInBedMin: number
  timeInBedMin: number
  totalWakeMin: number
  totalSleepMin: number
  sleepEfficiency: number
}

export type Settings = {
  fixedWakeTime: string
  activeWindowMin: number
  minWindowMin: number
  maxWindowMin: number
}

export type WeeklyPlan = {
  status: 'empty' | 'baseline' | 'ready'
  recordsUsed: number
  avgSleepMin: number
  avgEfficiency: number
  avgTimeInBedMin: number
  anchorHitDays: number
  suggestedWindowMin: number
  suggestedBedtime: string
  activeBedtime: string
  action: 'record' | 'shorten' | 'hold' | 'expand'
  summary: string
}

export const DEFAULT_SETTINGS: Settings = {
  fixedWakeTime: '07:00',
  activeWindowMin: 390,
  minWindowMin: 330,
  maxWindowMin: 540,
}

export const EMPTY_ENTRY: Omit<DiaryEntry, 'id' | 'date'> = {
  inBedTime: '00:30',
  outBedTime: '07:00',
  sleepLatencyMin: 30,
  wakeAfterSleepOnsetMin: 20,
  earlyWakeMin: 0,
  outOfBedAwakeMin: 0,
  napMin: 0,
  caffeineAfter2pm: false,
  alcoholTonight: false,
  screenWithin1h: false,
  exerciseDay: true,
  morningLight: true,
  relaxation: false,
  quality: 3,
  stress: 3,
  notes: '',
}

export function createEntry(date = todayISO(), previous?: DiaryEntry): DiaryEntry {
  return {
    id: crypto.randomUUID(),
    date,
    ...EMPTY_ENTRY,
    inBedTime: previous?.inBedTime ?? EMPTY_ENTRY.inBedTime,
    outBedTime: previous?.outBedTime ?? EMPTY_ENTRY.outBedTime,
    exerciseDay: previous?.exerciseDay ?? EMPTY_ENTRY.exerciseDay,
    morningLight: previous?.morningLight ?? EMPTY_ENTRY.morningLight,
  }
}

export function todayISO(date = new Date()): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

export function toMinutes(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return 0
  }
  const [h, m] = value.split(':').map(Number)
  return clamp(h, 0, 23) * 60 + clamp(m, 0, 59)
}

export function fromMinutes(value: number): string {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function diffMinutes(start: string, end: string): number {
  const startMin = toMinutes(start)
  const endMin = toMinutes(end)
  return endMin >= startMin ? endMin - startMin : endMin + 1440 - startMin
}

export function subtractMinutes(anchor: string, amount: number): string {
  return fromMinutes(toMinutes(anchor) - amount)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function safeNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0
}

export function roundToQuarter(value: number): number {
  return Math.round(value / 15) * 15
}

export function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

export function calculateEntryMetrics(entry: DiaryEntry): SleepMetrics {
  const rawTimeInBedMin = diffMinutes(entry.inBedTime, entry.outBedTime)
  const outOfBedAwakeMin = safeNumber(entry.outOfBedAwakeMin)
  const timeInBedMin = Math.max(0, rawTimeInBedMin - outOfBedAwakeMin)
  const totalWakeMin =
    safeNumber(entry.sleepLatencyMin) +
    safeNumber(entry.wakeAfterSleepOnsetMin) +
    safeNumber(entry.earlyWakeMin)
  const totalSleepMin = Math.max(0, timeInBedMin - totalWakeMin)
  const sleepEfficiency = timeInBedMin > 0 ? totalSleepMin / timeInBedMin : 0

  return {
    rawTimeInBedMin,
    timeInBedMin,
    totalWakeMin,
    totalSleepMin,
    sleepEfficiency,
  }
}

export function sortEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date))
}

export function recentEntries(entries: DiaryEntry[], limit = 7): DiaryEntry[] {
  return sortEntries(entries).slice(-limit)
}

export function buildWeeklyPlan(entries: DiaryEntry[], settings: Settings): WeeklyPlan {
  const recent = recentEntries(entries, 7)
  const metrics = recent.map(calculateEntryMetrics)
  const avgSleepMin = average(metrics.map((item) => item.totalSleepMin))
  const avgEfficiency = average(metrics.map((item) => item.sleepEfficiency))
  const avgTimeInBedMin = average(metrics.map((item) => item.timeInBedMin))
  const anchorHitDays = recent.filter((entry) => {
    return circularDistanceMinutes(toMinutes(entry.outBedTime), toMinutes(settings.fixedWakeTime)) <= 20
  }).length

  if (recent.length === 0) {
    return {
      status: 'empty',
      recordsUsed: 0,
      avgSleepMin: 0,
      avgEfficiency: 0,
      avgTimeInBedMin: 0,
      anchorHitDays: 0,
      suggestedWindowMin: settings.activeWindowMin,
      activeBedtime: subtractMinutes(settings.fixedWakeTime, settings.activeWindowMin),
      suggestedBedtime: subtractMinutes(settings.fixedWakeTime, settings.activeWindowMin),
      action: 'record',
      summary: '先连续记录 7 天。第一周不要急着调整，把真实作息量出来。',
    }
  }

  if (recent.length < 7) {
    return {
      status: 'baseline',
      recordsUsed: recent.length,
      avgSleepMin,
      avgEfficiency,
      avgTimeInBedMin,
      anchorHitDays,
      suggestedWindowMin: settings.activeWindowMin,
      activeBedtime: subtractMinutes(settings.fixedWakeTime, settings.activeWindowMin),
      suggestedBedtime: subtractMinutes(settings.fixedWakeTime, settings.activeWindowMin),
      action: 'record',
      summary: `已记录 ${recent.length}/7 天。先守住固定起床时间，满 7 天后再调整窗口。`,
    }
  }

  const baselineWindow = clamp(roundToQuarter(avgSleepMin + 15), settings.minWindowMin, settings.maxWindowMin)
  let suggestedWindowMin = settings.activeWindowMin
  let action: WeeklyPlan['action'] = 'hold'
  let summary = '睡眠效率处在可观察区间，本周维持当前窗口。'

  if (avgEfficiency >= 0.9) {
    suggestedWindowMin = clamp(settings.activeWindowMin + 15, settings.minWindowMin, settings.maxWindowMin)
    action = 'expand'
    summary = '近 7 天睡眠效率较高，可以把睡眠窗口放宽 15 分钟。'
  } else if (avgEfficiency < 0.85) {
    suggestedWindowMin = clamp(Math.min(settings.activeWindowMin - 15, baselineWindow), settings.minWindowMin, settings.maxWindowMin)
    action = 'shorten'
    summary = '近 7 天睡眠效率偏低，建议把窗口收紧 15 分钟，并继续固定起床。'
  }

  if (settings.activeWindowMin === DEFAULT_SETTINGS.activeWindowMin && avgSleepMin > 0) {
    suggestedWindowMin = baselineWindow
    action = baselineWindow < settings.activeWindowMin ? 'shorten' : 'hold'
    summary = '这是首个 7 天基线，建议按平均总睡眠时长加 15 分钟设置下周窗口。'
  }

  return {
    status: 'ready',
    recordsUsed: recent.length,
    avgSleepMin,
    avgEfficiency,
    avgTimeInBedMin,
    anchorHitDays,
    suggestedWindowMin,
    activeBedtime: subtractMinutes(settings.fixedWakeTime, settings.activeWindowMin),
    suggestedBedtime: subtractMinutes(settings.fixedWakeTime, suggestedWindowMin),
    action,
    summary,
  }
}

export function buildHabitFlags(entries: DiaryEntry[]): string[] {
  const recent = recentEntries(entries, 7)
  if (!recent.length) {
    return ['今晚先记录一次，明早补全起床时间和清醒时长。']
  }
  const flags: string[] = []
  const caffeineDays = recent.filter((entry) => entry.caffeineAfter2pm).length
  const screenDays = recent.filter((entry) => entry.screenWithin1h).length
  const napAvg = average(recent.map((entry) => safeNumber(entry.napMin)))
  const exerciseDays = recent.filter((entry) => entry.exerciseDay).length
  const lightDays = recent.filter((entry) => entry.morningLight).length
  const relaxDays = recent.filter((entry) => entry.relaxation).length

  if (caffeineDays >= 2) flags.push(`近 7 天有 ${caffeineDays} 天下午摄入咖啡因，先把截止时间前移。`)
  if (screenDays >= 4) flags.push(`近 7 天有 ${screenDays} 天睡前看屏幕，换成固定放松流程。`)
  if (napAvg > 30) flags.push(`白天小睡均值 ${Math.round(napAvg)} 分钟，建议压到 20-30 分钟。`)
  if (exerciseDays >= 4) flags.push('白天活动执行稳定，继续保留。')
  if (lightDays < 4) flags.push('晨间户外光照不足，优先补 10-20 分钟自然光。')
  if (relaxDays < 3) flags.push('放松练习偏少，可用 5 分钟呼吸或肌肉放松替代硬躺。')

  return flags.slice(0, 4)
}

export function exportCsv(entries: DiaryEntry[]): string {
  const columns: Array<keyof DiaryEntry | 'timeInBedMin' | 'totalSleepMin' | 'sleepEfficiency'> = [
    'date',
    'inBedTime',
    'outBedTime',
    'sleepLatencyMin',
    'wakeAfterSleepOnsetMin',
    'earlyWakeMin',
    'outOfBedAwakeMin',
    'napMin',
    'caffeineAfter2pm',
    'alcoholTonight',
    'screenWithin1h',
    'exerciseDay',
    'morningLight',
    'relaxation',
    'quality',
    'stress',
    'timeInBedMin',
    'totalSleepMin',
    'sleepEfficiency',
    'notes',
  ]
  const rows = sortEntries(entries).map((entry) => {
    const metrics = calculateEntryMetrics(entry)
    const row: Record<string, unknown> = {
      ...entry,
      timeInBedMin: metrics.timeInBedMin,
      totalSleepMin: metrics.totalSleepMin,
      sleepEfficiency: Math.round(metrics.sleepEfficiency * 100),
    }
    return columns.map((column) => csvCell(row[column])).join(',')
  })
  return [columns.join(','), ...rows].join('\n')
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function parseImportedEntries(value: unknown): DiaryEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeEntry(item))
    .filter((entry): entry is DiaryEntry => Boolean(entry))
}

export function demoEntries(): DiaryEntry[] {
  const today = new Date()
  return Array.from({ length: 10 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (9 - index))
    const drift = index % 4
    return {
      ...createEntry(todayISO(date)),
      id: `demo-${index}`,
      inBedTime: ['00:55', '00:40', '00:30', '00:45'][drift],
      outBedTime: ['07:05', '06:55', '07:10', '07:00'][drift],
      sleepLatencyMin: [50, 35, 25, 20][drift],
      wakeAfterSleepOnsetMin: [45, 35, 25, 20][drift],
      earlyWakeMin: [20, 10, 0, 0][drift],
      napMin: [0, 20, 0, 15][drift],
      screenWithin1h: index < 5,
      caffeineAfter2pm: index % 5 === 0,
      relaxation: index > 4,
      quality: Math.min(5, 2 + Math.floor(index / 3)),
      stress: Math.max(1, 5 - Math.floor(index / 3)),
      notes: index === 9 ? '示例：醒来更清爽，继续固定起床。' : '',
    }
  })
}

function circularDistanceMinutes(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 1440 - diff)
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function normalizeEntry(item: unknown): DiaryEntry | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Partial<DiaryEntry>
  if (!raw.date || !raw.inBedTime || !raw.outBedTime) return null
  return {
    ...createEntry(String(raw.date)),
    id: String(raw.id ?? crypto.randomUUID()),
    date: String(raw.date),
    inBedTime: String(raw.inBedTime),
    outBedTime: String(raw.outBedTime),
    sleepLatencyMin: safeNumber(raw.sleepLatencyMin),
    wakeAfterSleepOnsetMin: safeNumber(raw.wakeAfterSleepOnsetMin),
    earlyWakeMin: safeNumber(raw.earlyWakeMin),
    outOfBedAwakeMin: safeNumber(raw.outOfBedAwakeMin),
    napMin: safeNumber(raw.napMin),
    caffeineAfter2pm: Boolean(raw.caffeineAfter2pm),
    alcoholTonight: Boolean(raw.alcoholTonight),
    screenWithin1h: Boolean(raw.screenWithin1h),
    exerciseDay: Boolean(raw.exerciseDay),
    morningLight: Boolean(raw.morningLight),
    relaxation: Boolean(raw.relaxation),
    quality: clamp(safeNumber(raw.quality) || 3, 1, 5),
    stress: clamp(safeNumber(raw.stress) || 3, 1, 5),
    notes: String(raw.notes ?? ''),
  }
}
