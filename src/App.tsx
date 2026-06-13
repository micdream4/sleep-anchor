import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Download,
  FileJson,
  Moon,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  DEFAULT_ONBOARDING,
  DEFAULT_SETTINGS,
  buildChallengeProgress,
  buildHabitFlags,
  buildReminderIcs,
  buildWeeklyPlan,
  buildWeeklyReport,
  calculateEntryMetrics,
  createEntry,
  demoEntries,
  exportCsv,
  formatDuration,
  formatPercent,
  recentEntries,
  sortEntries,
  todayISO,
  type DiaryEntry,
  type Settings,
} from './domain/sleep'
import { importState, loadState, resetState, saveState, serializeState, type AppState } from './lib/storage'
import './index.css'

type Tab = 'start' | 'today' | 'trend' | 'plan' | 'data'

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'start', label: '开始' },
  { id: 'today', label: '记录' },
  { id: 'trend', label: '趋势' },
  { id: 'plan', label: '计划' },
  { id: 'data', label: '数据' },
]

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [activeTab, setActiveTab] = useState<Tab>(() => (loadState().entries.length ? 'today' : 'start'))
  const [draft, setDraft] = useState<DiaryEntry>(() => {
    const loaded = loadState()
    return loaded.entries.find((entry) => entry.date === todayISO()) ?? createEntry(todayISO(), loaded.entries.at(-1))
  })
  const [notice, setNotice] = useState('数据只保存在本机浏览器。')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sorted = useMemo(() => sortEntries(state.entries), [state.entries])
  const recent = useMemo(() => recentEntries(sorted, 14), [sorted])
  const plan = useMemo(() => buildWeeklyPlan(sorted, state.settings), [sorted, state.settings])
  const progress = useMemo(() => buildChallengeProgress(sorted), [sorted])
  const weeklyReport = useMemo(() => buildWeeklyReport(sorted, state.settings), [sorted, state.settings])
  const habitFlags = useMemo(() => buildHabitFlags(sorted), [sorted])
  const draftMetrics = useMemo(() => calculateEntryMetrics(draft), [draft])
  const latestMetrics = useMemo(() => recent.map((entry) => ({ entry, metrics: calculateEntryMetrics(entry) })), [recent])
  const isBaselinePhase = plan.status !== 'ready'
  const windowTile = isBaselinePhase
    ? { label: '基线进度', value: `${progress.recordedDays}/7 天`, detail: '先记录，不调整' }
    : { label: '本周窗口', value: formatDuration(state.settings.activeWindowMin), detail: `${plan.activeBedtime} - ${state.settings.fixedWakeTime}` }

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
  }, [])

  function updateDraft<K extends keyof DiaryEntry>(key: K, value: DiaryEntry[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }))
  }

  function updateOnboarding<K extends keyof AppState['onboarding']>(key: K, value: AppState['onboarding'][K]) {
    setState((current) => ({
      ...current,
      onboarding: { ...current.onboarding, [key]: value },
    }))
  }

  function beginChallenge() {
    setState((current) => ({
      ...current,
      onboarding: {
        ...current.onboarding,
        challengeStartedAt: current.onboarding.challengeStartedAt ?? todayISO(),
      },
    }))
    setActiveTab('today')
    setNotice('7 天挑战已开始。先按真实情况记录，不要急着调整作息。')
  }

  function saveDraft() {
    setState((current) => {
      const withoutSameDate = current.entries.filter((entry) => entry.date !== draft.date)
      return { ...current, entries: sortEntries([...withoutSameDate, draft]) }
    })
    setNotice(`${draft.date} 已保存。`)
  }

  function deleteEntry(id: string) {
    setState((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }))
    setNotice('已删除一条记录。')
  }

  function editEntry(entry: DiaryEntry) {
    setDraft(entry)
    setActiveTab('today')
    setNotice(`正在编辑 ${entry.date}。`)
  }

  function applySuggestedWindow() {
    updateSettings('activeWindowMin', plan.suggestedWindowMin)
    setNotice(`已采用 ${formatDuration(plan.suggestedWindowMin)} 睡眠窗口。`)
  }

  function download(filename: string, text: string, type: string) {
    const blob = new Blob([text], { type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    file
      .text()
      .then((text) => {
        setState(importState(text))
        setNotice('导入完成。')
      })
      .catch(() => setNotice('导入失败，请检查 JSON 文件。'))
      .finally(() => {
        event.target.value = ''
      })
  }

  function hardReset() {
    resetState()
    setState({ settings: DEFAULT_SETTINGS, onboarding: DEFAULT_ONBOARDING, entries: [] })
    setDraft(createEntry())
    setActiveTab('start')
    setNotice('本地数据已清空。')
  }

  function loadDemo() {
    const entries = demoEntries()
    setState({ settings: DEFAULT_SETTINGS, onboarding: { ...DEFAULT_ONBOARDING, challengeStartedAt: entries[0]?.date ?? todayISO(), safetyChecked: true }, entries })
    setDraft(entries.at(-1) ?? createEntry())
    setNotice('已载入 10 天示例数据，可随时清空。')
  }

  function copyWeeklyReport() {
    navigator.clipboard
      ?.writeText(weeklyReport.plainText)
      .then(() => setNotice('周报告已复制，可以发给咨询师或自己留档。'))
      .catch(() => {
        download(`sleep-anchor-report-${todayISO()}.txt`, weeklyReport.plainText, 'text/plain;charset=utf-8')
        setNotice('浏览器不允许复制，已改为下载周报告。')
      })
  }

  function downloadReminder() {
    download('sleep-anchor-7-day-reminder.ics', buildReminderIcs(state.onboarding.reminderTime), 'text/calendar;charset=utf-8')
    setNotice('已生成 7 天补记提醒，可导入系统日历。')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Moon size={18} />
          </span>
          <div>
            <h1>Sleep Anchor</h1>
            <p>CBT-I 睡眠日记与窗口训练</p>
          </div>
        </div>
        <nav className="tabs" aria-label="主导航">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="dashboard-band">
        <MetricTile icon={<Sun />} label="起床锚点" value={state.settings.fixedWakeTime} detail={`${plan.anchorHitDays}/7 天命中`} />
        <MetricTile icon={<Moon />} label={windowTile.label} value={windowTile.value} detail={windowTile.detail} />
        <MetricTile icon={<Activity />} label="近 7 天效率" value={plan.recordsUsed ? formatPercent(plan.avgEfficiency) : '--'} detail={plan.recordsUsed ? `${plan.recordsUsed} 条记录` : '等待记录'} />
        <MetricTile icon={<CalendarDays />} label="平均睡眠" value={plan.recordsUsed ? formatDuration(plan.avgSleepMin) : '--'} detail="TST，不含小睡" />
      </section>

      <section className="notice-row" aria-live="polite">
        <ShieldCheck size={18} />
        <span>{notice}</span>
      </section>

      {activeTab === 'start' && (
        <section className="workspace two-col">
          <section className="panel primary-panel">
            <PanelTitle icon={<ClipboardList />} title="7 天睡眠基线挑战" detail="第一周只记录，不急着改变作息" />
            <div className="start-hero">
              <div>
                <span className="eyebrow">当前进度</span>
                <strong>{progress.statusText}</strong>
                <p>{progress.nextAction}</p>
              </div>
              <div className="progress-ring" aria-label={`7 天挑战进度 ${progress.percent}%`}>
                <span>{progress.recordedDays}/7</span>
              </div>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="quick-steps">
              <StepItem index="1" title="明早补记" text="上床、起床、清醒时长，估不准也先记录。" />
              <StepItem index="2" title="守住起床" text={`尽量接近 ${state.settings.fixedWakeTime} 起床，先稳定锚点。`} />
              <StepItem index="3" title="第 8 天调整" text="满 7 条后再看效率和睡眠窗口建议。" />
            </div>
            <div className="button-row">
              <button type="button" className="primary-button" disabled={!state.onboarding.safetyChecked} onClick={beginChallenge}>
                <Check size={18} />
                开始并记录今天
              </button>
              <button type="button" className="secondary-button" onClick={loadDemo}>
                <Sparkles size={18} />
                先看示例
              </button>
              <button type="button" className="ghost-button" onClick={() => setActiveTab('plan')}>
                <ShieldCheck size={18} />
                查看边界
              </button>
            </div>
          </section>

          <aside className="panel">
            <PanelTitle icon={<AlertTriangle />} title="先确认适不适合" detail="有下面情况先找专业人员" />
            <div className="safety-list">
              <Toggle label="我没有严重日间嗜睡或驾驶风险" checked={state.onboarding.safetyChecked} onChange={(value) => updateOnboarding('safetyChecked', value)} />
              {!state.onboarding.safetyChecked && <p className="inline-warning">先确认这一项，才能开始睡眠窗口训练。</p>}
              <ul className="check-list">
                <li>疑似睡眠呼吸暂停：打鼾明显、憋醒、白天控制不住犯困。</li>
                <li>双相情感障碍、癫痫、严重抑郁、孕期或高危工作。</li>
                <li>正在服用影响睡眠或警觉性的药物，需要先问医生。</li>
              </ul>
            </div>
            <div className="reminder-box">
              <Field label="每天补记提醒">
                <input type="time" value={state.onboarding.reminderTime} onChange={(event) => updateOnboarding('reminderTime', event.target.value)} />
              </Field>
              <button type="button" className="secondary-button" onClick={downloadReminder}>
                <Bell size={18} />
                生成日历提醒
              </button>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'today' && (
        <section className="workspace two-col">
          <section className="panel primary-panel">
            <PanelTitle icon={<Save />} title="今日睡眠日记" detail="1 分钟完成，明早补充也可以" />
            <div className="form-grid">
              <Field label="日期">
                <input type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} />
              </Field>
              <Field label="上床时间">
                <input type="time" value={draft.inBedTime} onChange={(event) => updateDraft('inBedTime', event.target.value)} />
              </Field>
              <Field label="起床离床">
                <input type="time" value={draft.outBedTime} onChange={(event) => updateDraft('outBedTime', event.target.value)} />
              </Field>
              <Field label="入睡耗时">
                <NumberInput value={draft.sleepLatencyMin} onChange={(value) => updateDraft('sleepLatencyMin', value)} suffix="分钟" />
              </Field>
              <Field label="夜间醒后清醒">
                <NumberInput value={draft.wakeAfterSleepOnsetMin} onChange={(value) => updateDraft('wakeAfterSleepOnsetMin', value)} suffix="分钟" />
              </Field>
              <Field label="早醒未再睡">
                <NumberInput value={draft.earlyWakeMin} onChange={(value) => updateDraft('earlyWakeMin', value)} suffix="分钟" />
              </Field>
              <Field label="离床清醒">
                <NumberInput value={draft.outOfBedAwakeMin} onChange={(value) => updateDraft('outOfBedAwakeMin', value)} suffix="分钟" />
              </Field>
              <Field label="白天小睡">
                <NumberInput value={draft.napMin} onChange={(value) => updateDraft('napMin', value)} suffix="分钟" />
              </Field>
            </div>

            <div className="choice-grid">
              <Toggle label="下午咖啡因" checked={draft.caffeineAfter2pm} onChange={(value) => updateDraft('caffeineAfter2pm', value)} />
              <Toggle label="饮酒助眠" checked={draft.alcoholTonight} onChange={(value) => updateDraft('alcoholTonight', value)} />
              <Toggle label="睡前看屏幕" checked={draft.screenWithin1h} onChange={(value) => updateDraft('screenWithin1h', value)} />
              <Toggle label="白天运动" checked={draft.exerciseDay} onChange={(value) => updateDraft('exerciseDay', value)} />
              <Toggle label="晨间见光" checked={draft.morningLight} onChange={(value) => updateDraft('morningLight', value)} />
              <Toggle label="放松练习" checked={draft.relaxation} onChange={(value) => updateDraft('relaxation', value)} />
            </div>

            <div className="slider-grid">
              <Field label={`主观睡眠质量 ${draft.quality}/5`}>
                <input type="range" min="1" max="5" value={draft.quality} onChange={(event) => updateDraft('quality', Number(event.target.value))} />
              </Field>
              <Field label={`睡前压力 ${draft.stress}/5`}>
                <input type="range" min="1" max="5" value={draft.stress} onChange={(event) => updateDraft('stress', Number(event.target.value))} />
              </Field>
            </div>

            <Field label="备注">
              <textarea value={draft.notes} rows={3} onChange={(event) => updateDraft('notes', event.target.value)} placeholder="例如：半夜醒后没有看时间；早上有阳光。" />
            </Field>

            <div className="button-row">
              <button type="button" className="primary-button" onClick={saveDraft}>
                <Save size={18} />
                保存记录
              </button>
              <button type="button" className="ghost-button" onClick={() => setDraft(createEntry(todayISO(), sorted.at(-1)))}>
                <RotateCcw size={18} />
                重置今天
              </button>
            </div>
          </section>

          <aside className="panel">
            <PanelTitle icon={<Activity />} title="即时计算" detail="保存前即可检查" />
            <div className="metric-stack">
              <InlineMetric label="床上时长" value={formatDuration(draftMetrics.timeInBedMin)} />
              <InlineMetric label="总睡眠" value={formatDuration(draftMetrics.totalSleepMin)} />
              <InlineMetric label="睡眠效率" value={formatPercent(draftMetrics.sleepEfficiency)} />
            </div>
            <div className="timeline">
              <div className="timeline-track">
                <span style={{ width: `${Math.min(100, (draftMetrics.totalSleepMin / Math.max(1, draftMetrics.timeInBedMin)) * 100)}%` }} />
              </div>
              <div className="timeline-labels">
                <span>{draft.inBedTime}</span>
                <span>{draft.outBedTime}</span>
              </div>
            </div>
            <div className="callout">
              <strong>{isBaselinePhase ? '基线期动作' : '今晚执行'}</strong>
              <span>
                {isBaselinePhase
                  ? `按平常作息睡，尽量接近 ${state.settings.fixedWakeTime} 起床。满 7 条记录后再调整上床窗口。`
                  : `${plan.activeBedtime} 上床，${state.settings.fixedWakeTime} 起床。没睡着时优先离床放松，不在床上硬耗。`}
              </span>
            </div>
            <ul className="flag-list">
              {habitFlags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          </aside>
        </section>
      )}

      {activeTab === 'trend' && (
        <section className="workspace">
          <section className="panel">
            <PanelTitle icon={<Activity />} title="近 14 天趋势" detail="蓝色为总睡眠，橙点为睡眠效率" />
            {latestMetrics.length ? <SleepChart rows={latestMetrics} /> : <EmptyState onDemo={loadDemo} />}
          </section>
          <section className="panel">
            <PanelTitle icon={<CalendarDays />} title="历史记录" detail={`${sorted.length} 条本地记录`} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>上床</th>
                    <th>起床</th>
                    <th>TST</th>
                    <th>效率</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {[...latestMetrics].reverse().map(({ entry, metrics }) => (
                    <tr key={entry.id}>
                      <td>{entry.date}</td>
                      <td>{entry.inBedTime}</td>
                      <td>{entry.outBedTime}</td>
                      <td>{formatDuration(metrics.totalSleepMin)}</td>
                      <td>{formatPercent(metrics.sleepEfficiency)}</td>
                      <td>
                        <button type="button" className="icon-button" aria-label={`编辑 ${entry.date}`} onClick={() => editEntry(entry)}>
                          <CalendarDays size={16} />
                        </button>
                        <button type="button" className="icon-button danger" aria-label={`删除 ${entry.date}`} onClick={() => deleteEntry(entry.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {activeTab === 'plan' && (
        <section className="workspace two-col">
          <section className="panel primary-panel">
            <PanelTitle icon={<Moon />} title="睡眠窗口计划" detail="每 7 条记录调整一次，不逐日追涨杀跌" />
            <div className="plan-hero">
              <div>
                <span className="eyebrow">建议下周窗口</span>
                <strong>{formatDuration(plan.suggestedWindowMin)}</strong>
                <p>
                  {plan.suggestedBedtime} - {state.settings.fixedWakeTime}
                </p>
              </div>
              <button type="button" className="primary-button" disabled={plan.status !== 'ready'} onClick={applySuggestedWindow}>
                <Check size={18} />
                采用建议
              </button>
            </div>
            <p className="summary-text">{plan.summary}</p>
            <div className="report-card">
              <div>
                <span className="eyebrow">可复制周报告</span>
                <h3>{weeklyReport.title}</h3>
                <p>
                  {progress.recordedDays < 7
                    ? `还差 ${progress.remainingDays} 天。现在可以预览格式，满 7 天后内容更完整。`
                    : '已生成可发给咨询师或自己复盘的文字报告。'}
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={copyWeeklyReport}>
                <Copy size={18} />
                复制周报告
              </button>
            </div>
            <pre className="report-preview">{weeklyReport.plainText}</pre>
            <div className="settings-grid">
              <Field label="固定起床时间">
                <input type="time" value={state.settings.fixedWakeTime} onChange={(event) => updateSettings('fixedWakeTime', event.target.value)} />
              </Field>
              <Field label="当前窗口">
                <NumberInput value={state.settings.activeWindowMin} onChange={(value) => updateSettings('activeWindowMin', value)} suffix="分钟" min={300} max={600} />
              </Field>
              <Field label="最短窗口">
                <NumberInput value={state.settings.minWindowMin} onChange={(value) => updateSettings('minWindowMin', value)} suffix="分钟" min={300} max={420} />
              </Field>
              <Field label="最长窗口">
                <NumberInput value={state.settings.maxWindowMin} onChange={(value) => updateSettings('maxWindowMin', value)} suffix="分钟" min={420} max={660} />
              </Field>
            </div>
          </section>
          <aside className="panel">
            <PanelTitle icon={<ShieldCheck />} title="执行边界" detail="这是自助工具，不替代诊疗" />
            <ul className="check-list">
              <li>如果有双相情感障碍、癫痫、严重抑郁、睡眠呼吸暂停风险、孕期或明显日间嗜睡，请先咨询专业人员。</li>
              <li>困到影响驾驶或操作设备时，不要硬撑执行窗口。</li>
              <li>睡眠限制的核心是稳定节律，不是惩罚自己少睡。</li>
              <li>建议连续 2-4 周看趋势，不用用单晚结果否定计划。</li>
            </ul>
            <div className="source-box">
              <strong>参考方向</strong>
              <a href="https://www.acponline.org/acp-newsroom/acp-recommends-cognitive-behavioral-therapy-as-initial-treatment-for-chronic-insomnia" target="_blank" rel="noreferrer">
                ACP 慢性失眠 CBT-I 建议
              </a>
              <a href="https://sleepeducation.org/patients/cognitive-behavioral-therapy/" target="_blank" rel="noreferrer">
                AASM Sleep Education: CBT-I
              </a>
              <a href="https://mobile.va.gov/app/cbt-i-coach" target="_blank" rel="noreferrer">
                VA CBT-i Coach
              </a>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'data' && (
        <section className="workspace two-col">
          <section className="panel primary-panel">
            <PanelTitle icon={<FileJson />} title="数据管理" detail="本地优先，方便备份和给医生复盘" />
            <div className="button-grid">
              <button type="button" className="secondary-button" onClick={() => download(`sleep-anchor-${todayISO()}.json`, serializeState(state), 'application/json')}>
                <Download size={18} />
                导出 JSON
              </button>
              <button type="button" className="secondary-button" onClick={() => download(`sleep-anchor-${todayISO()}.csv`, exportCsv(sorted), 'text/csv;charset=utf-8')}>
                <Download size={18} />
                导出 CSV
              </button>
              <button type="button" className="secondary-button" onClick={() => download(`sleep-anchor-report-${todayISO()}.txt`, weeklyReport.plainText, 'text/plain;charset=utf-8')}>
                <Download size={18} />
                导出周报
              </button>
              <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                导入 JSON
              </button>
              <button type="button" className="ghost-button" onClick={loadDemo}>
                <Sparkles size={18} />
                载入示例
              </button>
              <button type="button" className="danger-button" onClick={hardReset}>
                <Trash2 size={18} />
                清空本地
              </button>
            </div>
            <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={handleImport} />
          </section>
          <aside className="panel">
            <PanelTitle icon={<ShieldCheck />} title="隐私说明" detail="没有账号，也没有服务器数据库" />
            <p className="body-copy">
              记录保存在浏览器 localStorage。清除浏览器数据会删除记录；换设备使用前请先导出 JSON。部署站点只提供静态文件，不收集睡眠数据。
            </p>
          </aside>
        </section>
      )}
    </main>
  )
}

function MetricTile({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="metric-tile">
      <span className="metric-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function PanelTitle({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="panel-title">
      <span>{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function NumberInput({
  value,
  onChange,
  suffix,
  min = 0,
  max = 720,
}: {
  value: number
  onChange: (value: number) => void
  suffix: string
  min?: number
  max?: number
}) {
  return (
    <div className="number-input">
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span>{suffix}</span>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={checked ? 'toggle checked' : 'toggle'}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StepItem({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <article className="step-item">
      <span>{index}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </article>
  )
}

function SleepChart({ rows }: { rows: Array<{ entry: DiaryEntry; metrics: ReturnType<typeof calculateEntryMetrics> }> }) {
  const maxSleep = Math.max(...rows.map((row) => row.metrics.totalSleepMin), 480)
  return (
    <div className="chart" role="img" aria-label="近 14 天睡眠趋势图">
      {rows.map(({ entry, metrics }) => (
        <div className="chart-col" key={entry.id}>
          <div className="bar-wrap">
            <span className="eff-dot" style={{ bottom: `${Math.round(metrics.sleepEfficiency * 100)}%` }} title={`效率 ${formatPercent(metrics.sleepEfficiency)}`} />
            <span className="sleep-bar" style={{ height: `${Math.max(8, Math.round((metrics.totalSleepMin / maxSleep) * 100))}%` }} />
          </div>
          <small>{entry.date.slice(5)}</small>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="empty-state">
      <Moon size={34} />
      <strong>还没有趋势数据</strong>
      <p>先记录第一晚，或载入示例看看完整体验。</p>
      <button type="button" className="secondary-button" onClick={onDemo}>
        <Sparkles size={18} />
        载入示例
      </button>
    </div>
  )
}

export default App
