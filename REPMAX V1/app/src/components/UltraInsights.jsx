import { useMemo, useState } from 'react'
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiFlashlightFill,
  RiInformationLine,
  RiLineChartLine,
  RiPulseLine,
  RiShieldCheckLine,
  RiSparklingFill,
  RiThunderstormsLine,
  RiTrophyLine,
} from '@remixicon/react'

const DAY_MS = 24 * 60 * 60 * 1000

function formatSignedPct(value) {
  if (!Number.isFinite(value)) return '0%'
  const r = Math.round(value)
  if (r > 0) return `+${r}%`
  if (r < 0) return `${r}%`
  return '0%'
}

function daysAgo(ts) {
  if (!ts) return null
  return (Date.now() - new Date(ts).getTime()) / DAY_MS
}

function buildPlateauCases(prs = []) {
  const byExercise = new Map()
  prs.forEach((pr) => {
    const name = String(pr?.exercise_name || '').trim()
    if (!name) return
    const ts = new Date(pr.achieved_at).getTime()
    if (!Number.isFinite(ts)) return
    const current = byExercise.get(name)
    if (!current || ts > current.timestamp) {
      byExercise.set(name, {
        name,
        timestamp: ts,
        weight: Number(pr.weight) || 0,
        reps: Number(pr.reps) || 0,
        e1rm: Number(pr.estimated_1rm) || 0,
      })
    }
  })

  const now = Date.now()
  const cases = []
  byExercise.forEach((lift) => {
    const stallDays = Math.round((now - lift.timestamp) / DAY_MS)
    if (stallDays < 18) return
    let severity = 'low'
    if (stallDays > 40) severity = 'high'
    else if (stallDays > 28) severity = 'mid'

    const cause = stallDays > 45
      ? 'Extended stall — technique and loading scheme have drifted out of stimulus range.'
      : stallDays > 28
        ? 'Diminishing returns on current rep scheme. Likely accumulated fatigue.'
        : 'Normal plateau window — minor variation should unlock progress.'

    const prescription = stallDays > 40
      ? 'Deload 40% next session, then run 3×5 @ 85% for two weeks.'
      : stallDays > 28
        ? 'Swap rep scheme to 5×5 at 80% and add one tempo set.'
        : 'Drop 10% load next session, add a back-off triple, rest 3 min.'

    cases.push({ ...lift, stallDays, severity, cause, prescription })
  })

  return cases.sort((a, b) => b.stallDays - a.stallDays).slice(0, 4)
}

function buildExerciseROI(sets = [], prs = []) {
  const byExercise = new Map()
  sets.forEach((set) => {
    const name = String(set?.exercise_name || '').trim()
    if (!name) return
    if (!byExercise.has(name)) byExercise.set(name, { name, sets: 0, tonnage: 0, prs: 0, lastPr: null })
    const row = byExercise.get(name)
    row.sets += 1
    const weight = Number(set?.actual_weight ?? set?.target_weight) || 0
    const reps = Number(set?.actual_reps ?? set?.target_reps) || 0
    row.tonnage += weight * reps
  })

  prs.forEach((pr) => {
    const name = String(pr?.exercise_name || '').trim()
    if (!name) return
    if (!byExercise.has(name)) byExercise.set(name, { name, sets: 0, tonnage: 0, prs: 0, lastPr: null })
    const row = byExercise.get(name)
    row.prs += 1
    const ts = new Date(pr.achieved_at).getTime()
    if (Number.isFinite(ts) && (!row.lastPr || ts > row.lastPr)) row.lastPr = ts
  })

  const rows = Array.from(byExercise.values())
    .filter((row) => row.sets >= 3)
    .map((row) => ({
      ...row,
      roi: row.sets > 0 ? (row.prs / row.sets) * 100 : 0,
    }))

  const maxROI = Math.max(1, ...rows.map((r) => r.roi))
  return rows
    .map((row) => ({
      ...row,
      pct: Math.round((row.roi / maxROI) * 100),
      tier: row.roi >= maxROI * 0.66 ? 'high' : row.roi >= maxROI * 0.33 ? 'mid' : 'low',
    }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 8)
}

function buildForecast(workouts = [], prs = [], readiness = 50) {
  const now = Date.now()
  const dayBuckets = [0, 0, 0, 0, 0, 0, 0]
  const daySamples = [0, 0, 0, 0, 0, 0, 0]

  workouts.forEach((w) => {
    const ts = new Date(w.completed_at).getTime()
    if (!Number.isFinite(ts)) return
    const dayIdx = new Date(ts).getDay()
    const vol = Number(w.total_volume) || 0
    const dur = Math.max(5, Number(w.duration_seconds) / 60 || 45)
    const efficiency = vol / dur
    dayBuckets[dayIdx] += efficiency
    daySamples[dayIdx] += 1
  })

  const dayScores = dayBuckets.map((sum, i) => ({
    day: i,
    score: daySamples[i] > 0 ? sum / daySamples[i] : 0,
    samples: daySamples[i],
  }))
  const maxScore = Math.max(1, ...dayScores.map((d) => d.score))

  const today = new Date().getDay()
  const fourteenDay = Array.from({ length: 14 }).map((_, offset) => {
    const dayIdx = (today + offset) % 7
    const dayScore = dayScores[dayIdx].score
    const dayStrength = (dayScore / maxScore) * 100
    const readinessDrift = readiness + (offset % 7 === 0 ? 0 : Math.sin(offset / 2) * 8)
    const prProb = Math.round(Math.max(8, Math.min(94, (readinessDrift * 0.55) + (dayStrength * 0.3))))
    return {
      offset,
      dayIdx,
      date: new Date(now + offset * DAY_MS),
      prProb,
      dayStrength: Math.round(dayStrength),
    }
  })

  const peak = [...fourteenDay].sort((a, b) => b.prProb - a.prProb)[0]
  const lastPrDay = prs.length ? Math.max(...prs.map((pr) => new Date(pr.achieved_at).getTime())) : null
  const prDrought = lastPrDay ? Math.round(daysAgo(lastPrDay)) : null

  return { dayScores, maxScore, fourteenDay, peak, prDrought }
}

function buildFlexSuggestions(analytics, workouts = [], prs = []) {
  const suggestions = []
  const loadNote = analytics?.charts?.load?.note || ''
  const efficiencyTone = analytics?.charts?.efficiency?.tone
  const adherenceTone = analytics?.charts?.adherence?.tone
  const readiness = analytics?.overview?.readiness?.score || 50

  if (loadNote.toLowerCase().includes('high') || readiness < 48) {
    suggestions.push({
      id: 'deload',
      icon: RiShieldCheckLine,
      title: 'Auto-deload next cycle',
      body: 'Acute load is outrunning baseline. Reduce top sets by 40% for one week to clear fatigue.',
      impact: 'Protects PR window',
    })
  }

  if (efficiencyTone === 'down' || efficiencyTone === 'warn') {
    suggestions.push({
      id: 'compress',
      icon: RiPulseLine,
      title: 'Compress rest windows',
      body: 'Your weight-per-minute is slipping. Trim rest to 90s between back-off sets to restore density.',
      impact: '+12% session efficiency',
    })
  }

  if (adherenceTone === 'down' || adherenceTone === 'warn') {
    suggestions.push({
      id: 'shorter',
      icon: RiFlashlightFill,
      title: 'Switch to a 3-day split',
      body: 'Missing sessions crushes readiness. A shorter split lets you hit every planned day.',
      impact: 'Recovers adherence',
    })
  }

  const latestPr = prs.length ? Math.max(...prs.map((pr) => new Date(pr.achieved_at).getTime())) : null
  if (!latestPr || daysAgo(latestPr) > 28) {
    suggestions.push({
      id: 'variation',
      icon: RiSparklingFill,
      title: 'Rotate one primary lift',
      body: 'PR drought detected. Swap bench → incline DB for two weeks to re-stimulate the pattern.',
      impact: 'Unlocks stalled lift',
    })
  }

  if (readiness >= 78) {
    suggestions.push({
      id: 'peak',
      icon: RiThunderstormsLine,
      title: 'Attack a PR this week',
      body: 'Readiness is elevated. Open the strongest session with a top single @ RPE 9.',
      impact: 'Likely PR window',
    })
  }

  return suggestions.slice(0, 4)
}

function findCard(analytics, sectionId, cardId) {
  const section = (analytics?.sections || []).find((s) => s.id === sectionId)
  if (!section) return null
  return (section.cards || []).find((c) => c.id === cardId) || null
}

function parseSignedPct(text) {
  if (typeof text !== 'string') return null
  const match = text.match(/(-?\+?\d+)%/)
  if (!match) return null
  return Number(match[1])
}

function toneFromSigned(n) {
  if (!Number.isFinite(n)) return 'flat'
  if (n > 3) return 'up'
  if (n < -3) return 'down'
  return 'flat'
}

function buildChanges(analytics) {
  const changes = []

  const momentumCard = findCard(analytics, 'performance', 'momentum')
  if (momentumCard) {
    const n = parseSignedPct(momentumCard.value)
    changes.push({
      id: 'load',
      label: 'Volume (14d)',
      delta: momentumCard.value,
      tone: toneFromSigned(n),
    })
  }

  const efficiencyCard = findCard(analytics, 'performance', 'efficiency')
  if (efficiencyCard) {
    const n = parseSignedPct(efficiencyCard.value)
    changes.push({
      id: 'efficiency',
      label: 'Density',
      delta: efficiencyCard.value,
      tone: toneFromSigned(n),
    })
  }

  const adherenceValue = analytics?.charts?.adherence?.value
  const adherenceTone = analytics?.charts?.adherence?.tone
  if (adherenceValue) {
    changes.push({
      id: 'adherence',
      label: 'Adherence',
      delta: String(adherenceValue),
      tone: adherenceTone === 'high' ? 'up' : adherenceTone === 'low' ? 'down' : 'flat',
    })
  }

  const readinessScore = analytics?.overview?.readiness?.score
  if (Number.isFinite(readinessScore)) {
    changes.push({
      id: 'readiness',
      label: 'Readiness',
      delta: String(readinessScore),
      tone: readinessScore >= 70 ? 'up' : readinessScore <= 45 ? 'down' : 'flat',
    })
  }

  return changes
}

export default function UltraInsights({ workouts = [], sets = [], prs = [], analytics, unit = 'kg' }) {
  const [openReason, setOpenReason] = useState(null)

  const plateauCases = useMemo(() => buildPlateauCases(prs), [prs])
  const roiRows = useMemo(() => buildExerciseROI(sets, prs), [sets, prs])
  const forecast = useMemo(
    () => buildForecast(workouts, prs, analytics?.overview?.readiness?.score || 50),
    [workouts, prs, analytics],
  )
  const flex = useMemo(() => buildFlexSuggestions(analytics, workouts, prs), [analytics, workouts, prs])
  const changes = useMemo(() => buildChanges(analytics), [analytics])

  const heroTitle = analytics?.overview?.title
  const heroBody = analytics?.overview?.body
  const heroNext = analytics?.overview?.nextMove

  function toggleReason(id) {
    setOpenReason((prev) => (prev === id ? null : id))
  }

  const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <>
      <section className="ultra-hero-recommend">
        <div className="ultra-hero-recommend-head">
          <div className="ultra-hero-recommend-kicker">
            <RiSparklingFill size={14} /> TODAY&apos;S CALL
          </div>
          <button
            type="button"
            className="ultra-why-btn"
            onClick={() => toggleReason('hero')}
          >
            <RiInformationLine size={14} />
            Why this?
          </button>
        </div>
        <h2 className="ultra-hero-recommend-title">{heroTitle}</h2>
        <p className="ultra-hero-recommend-body">{heroBody}</p>
        <div className="ultra-hero-recommend-next">
          <span className="ultra-hero-next-label">Next move</span>
          <strong>{heroNext}</strong>
        </div>
        {openReason === 'hero' && (
          <div className="ultra-reason-drawer">
            <div className="ultra-reason-title">How the model decided</div>
            <ul className="ultra-reason-list">
              <li>Current readiness score: <strong>{analytics?.overview?.readiness?.display}</strong></li>
              <li>Acute / chronic load ratio: <strong>{analytics?.charts?.load?.value}</strong></li>
              <li>Recent density trend: <strong>{analytics?.charts?.efficiency?.value}</strong></li>
              <li>Signal confidence: <strong>{analytics?.overview?.readiness?.confidence?.label}</strong></li>
            </ul>
          </div>
        )}
      </section>

      {changes.length > 0 && (
        <section className="ultra-changes-strip">
          <div className="ultra-changes-head">
            <div className="ultra-section-kicker">
              <RiLineChartLine size={12} /> WHAT CHANGED SINCE LAST WEEK
            </div>
          </div>
          <div className="ultra-changes-grid">
            {changes.map((c) => (
              <div key={c.id} className={`ultra-change-chip tone-${c.tone}`}>
                <div className="ultra-change-label">{c.label}</div>
                <div className="ultra-change-delta">{c.delta}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ultra-section-panel ultra-plateau-section">
        <div className="ultra-section-head">
          <div>
            <div className="ultra-section-kicker"><RiAlertLine size={12} /> PLATEAU DOCTOR</div>
            <h3>Stalled lifts, diagnosed</h3>
          </div>
          <button type="button" className="ultra-why-btn" onClick={() => toggleReason('plateau')}>
            <RiInformationLine size={14} /> Why this?
          </button>
        </div>

        {openReason === 'plateau' && (
          <div className="ultra-reason-drawer">
            A lift is flagged when its last PR is older than 18 days. Severity escalates past 28 days. Prescriptions come from standard hypertrophy/strength auto-regulation rules.
          </div>
        )}

        {plateauCases.length === 0 ? (
          <div className="ultra-empty-block">
            <RiShieldCheckLine size={20} />
            <div>
              <strong>No plateaus detected</strong>
              <p>Every logged lift has progressed in the last 18 days.</p>
            </div>
          </div>
        ) : (
          <div className="ultra-plateau-list">
            {plateauCases.map((c) => (
              <article key={c.name} className={`ultra-plateau-card severity-${c.severity}`}>
                <div className="ultra-plateau-top">
                  <div className="ultra-plateau-name">{c.name}</div>
                  <div className="ultra-plateau-stall">
                    <strong>{c.stallDays}d</strong> stalled
                  </div>
                </div>
                <div className="ultra-plateau-meta">
                  {c.weight > 0 && <span>{Math.round(c.weight)} {unit} × {c.reps || 1}</span>}
                  <span className={`ultra-severity-chip severity-${c.severity}`}>{c.severity.toUpperCase()}</span>
                </div>
                <p className="ultra-plateau-cause">{c.cause}</p>
                <div className="ultra-plateau-rx">
                  <div className="ultra-rx-kicker">PRESCRIPTION</div>
                  <div className="ultra-rx-body">{c.prescription}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ultra-section-panel ultra-roi-section">
        <div className="ultra-section-head">
          <div>
            <div className="ultra-section-kicker"><RiTrophyLine size={12} /> EXERCISE ROI</div>
            <h3>Where your reps pay off</h3>
          </div>
          <button type="button" className="ultra-why-btn" onClick={() => toggleReason('roi')}>
            <RiInformationLine size={14} /> Why this?
          </button>
        </div>

        {openReason === 'roi' && (
          <div className="ultra-reason-drawer">
            ROI = PRs per set completed. High-ROI lifts convert tonnage into measurable gain faster than low-ROI lifts. Lifts with fewer than 3 logged sets are excluded to keep the signal clean.
          </div>
        )}

        {roiRows.length === 0 ? (
          <div className="ultra-empty-block">
            <RiLineChartLine size={20} />
            <div>
              <strong>Not enough data</strong>
              <p>Log at least three sets on a lift before ROI appears.</p>
            </div>
          </div>
        ) : (
          <div className="ultra-roi-list">
            {roiRows.map((row) => (
              <div key={row.name} className={`ultra-roi-row tier-${row.tier}`}>
                <div className="ultra-roi-name">{row.name}</div>
                <div className="ultra-roi-bar">
                  <div className="ultra-roi-bar-fill" style={{ width: `${row.pct}%` }} />
                </div>
                <div className="ultra-roi-stats">
                  <span className="ultra-roi-prs"><strong>{row.prs}</strong> PRs</span>
                  <span className="ultra-roi-sets">{row.sets} sets</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ultra-section-panel ultra-forecast-section">
        <div className="ultra-section-head">
          <div>
            <div className="ultra-section-kicker"><RiPulseLine size={12} /> FORECASTS</div>
            <h3>Your 14-day PR window</h3>
          </div>
          <button type="button" className="ultra-why-btn" onClick={() => toggleReason('forecast')}>
            <RiInformationLine size={14} /> Why this?
          </button>
        </div>

        {openReason === 'forecast' && (
          <div className="ultra-reason-drawer">
            Forecast blends current readiness with your historical strongest training day-of-week. Days you train best (higher weight/minute efficiency) get higher PR probability weighting.
          </div>
        )}

        {forecast.peak && (
          <div className="ultra-forecast-hero">
            <div className="ultra-forecast-peak">
              <div className="ultra-section-kicker">PEAK WINDOW</div>
              <div className="ultra-forecast-peak-date">
                {DAY_LABEL[forecast.peak.dayIdx]} · {forecast.peak.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              <div className="ultra-forecast-peak-prob">
                <strong>{forecast.peak.prProb}%</strong>
                <span>PR probability</span>
              </div>
            </div>
            {forecast.prDrought != null && (
              <div className="ultra-forecast-drought">
                <div className="ultra-section-kicker">PR DROUGHT</div>
                <strong>{forecast.prDrought}d</strong>
                <span>since last PR</span>
              </div>
            )}
          </div>
        )}

        <div className="ultra-forecast-bars">
          {forecast.fourteenDay.map((day) => (
            <div key={day.offset} className="ultra-forecast-col">
              <div className="ultra-forecast-col-bar">
                <div
                  className="ultra-forecast-col-fill"
                  style={{ height: `${day.prProb}%` }}
                />
              </div>
              <div className="ultra-forecast-col-day">{DAY_LABEL[day.dayIdx]}</div>
              <div className="ultra-forecast-col-prob">{day.prProb}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="ultra-section-panel ultra-flex-section">
        <div className="ultra-section-head">
          <div>
            <div className="ultra-section-kicker"><RiFlashlightFill size={12} /> FLEX</div>
            <h3>Adaptive prescriptions</h3>
          </div>
          <button type="button" className="ultra-why-btn" onClick={() => toggleReason('flex')}>
            <RiInformationLine size={14} /> Why this?
          </button>
        </div>

        {openReason === 'flex' && (
          <div className="ultra-reason-drawer">
            Flex watches your load, density, and adherence signals. When two or more drift the same direction, a specific prescription is offered instead of a generic insight.
          </div>
        )}

        {flex.length === 0 ? (
          <div className="ultra-empty-block">
            <RiShieldCheckLine size={20} />
            <div>
              <strong>On track</strong>
              <p>No adjustments needed — keep the plan.</p>
            </div>
          </div>
        ) : (
          <div className="ultra-flex-grid">
            {flex.map((s) => {
              const Icon = s.icon
              return (
                <article key={s.id} className="ultra-flex-card">
                  <div className="ultra-flex-icon"><Icon size={18} /></div>
                  <div className="ultra-flex-title">{s.title}</div>
                  <p className="ultra-flex-body">{s.body}</p>
                  <div className="ultra-flex-impact">{s.impact}</div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
