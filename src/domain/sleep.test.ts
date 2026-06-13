import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  buildWeeklyPlan,
  calculateEntryMetrics,
  createEntry,
  demoEntries,
  diffMinutes,
  exportCsv,
  formatDuration,
  subtractMinutes,
} from './sleep'

describe('sleep domain', () => {
  it('calculates overnight minutes across midnight', () => {
    expect(diffMinutes('23:30', '06:45')).toBe(435)
    expect(subtractMinutes('07:00', 390)).toBe('00:30')
  })

  it('calculates TIB, TST, and sleep efficiency', () => {
    const entry = {
      ...createEntry('2026-06-13'),
      inBedTime: '00:00',
      outBedTime: '07:00',
      sleepLatencyMin: 30,
      wakeAfterSleepOnsetMin: 40,
      earlyWakeMin: 20,
      outOfBedAwakeMin: 10,
    }
    const metrics = calculateEntryMetrics(entry)
    expect(metrics.rawTimeInBedMin).toBe(420)
    expect(metrics.timeInBedMin).toBe(410)
    expect(metrics.totalWakeMin).toBe(90)
    expect(metrics.totalSleepMin).toBe(320)
    expect(Math.round(metrics.sleepEfficiency * 100)).toBe(78)
  })

  it('keeps first week in baseline mode until seven records exist', () => {
    const plan = buildWeeklyPlan(demoEntries().slice(0, 5), DEFAULT_SETTINGS)
    expect(plan.status).toBe('baseline')
    expect(plan.recordsUsed).toBe(5)
    expect(plan.action).toBe('record')
  })

  it('builds a concrete weekly recommendation after seven records', () => {
    const plan = buildWeeklyPlan(demoEntries().slice(0, 7), DEFAULT_SETTINGS)
    expect(plan.status).toBe('ready')
    expect(plan.suggestedWindowMin).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.minWindowMin)
    expect(plan.suggestedWindowMin).toBeLessThanOrEqual(DEFAULT_SETTINGS.maxWindowMin)
    expect(plan.suggestedBedtime).toMatch(/^\d{2}:\d{2}$/)
  })

  it('exports csv with calculated metrics', () => {
    const csv = exportCsv(demoEntries().slice(0, 1))
    expect(csv).toContain('totalSleepMin')
    expect(csv.split('\n')).toHaveLength(2)
  })

  it('formats durations compactly', () => {
    expect(formatDuration(390)).toBe('6h 30m')
    expect(formatDuration(25)).toBe('25m')
  })
})
