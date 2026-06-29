'use client'

import { useState, useRef, useEffect } from 'react'
import { parseISO } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import { es } from 'date-fns/locale'

interface Match {
  id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  match_date: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'completed'
  phase: string
  venue: string | null
}

interface Props {
  matches: Match[]
  predictions: Record<number, {
    prediction: 'home' | 'draw' | 'away' | null
    predicted_home_score: number | null
    predicted_away_score: number | null
  }>
  phases: { name: string; is_unlocked: boolean }[]
  onPredict: (matchId: number, homeScore: number | null, awayScore: number | null) => void
  saving: number | null
}

const PHASE_ORDER = ['round32', 'round16', 'quarterfinals', 'semifinals', 'final']

function isMatchLocked(m: Match, phases: { name: string; is_unlocked: boolean }[]): boolean {
  const phaseInfo = phases.find(p => p.name === m.phase)
  if (phaseInfo && !phaseInfo.is_unlocked && m.phase !== 'groups') return true
  if (m.status === 'completed') return true
  if (!m.match_date) return false
  return Date.now() >= new Date(m.match_date).getTime() + 60 * 60 * 1000
}

function TeamFlag({ url, name }: { url: string; name: string }) {
  if (url && (url.startsWith('http') || url.startsWith('/') || url.includes('.'))) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: '16px', height: '16px', objectFit: 'contain', borderRadius: '2px', flexShrink: 0 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }} title={name}>{url || '🏳️'}</span>
}

// The main card — shows real result + prediction side by side
function BracketCard({
  match,
  prediction,
  phases,
  onPredict,
  saving
}: {
  match: Match
  prediction?: { prediction: 'home' | 'draw' | 'away' | null; predicted_home_score: number | null; predicted_away_score: number | null }
  phases: { name: string; is_unlocked: boolean }[]
  onPredict: (matchId: number, homeScore: number | null, awayScore: number | null) => void
  saving: boolean
}) {
  const locked = isMatchLocked(match, phases)
  const isCompleted = match.status === 'completed'
  const isLive = match.status === 'live'
  const isPlaceholderHome = !match.home_team || /^[\dWL]/.test(match.home_team.trim())
  const isPlaceholderAway = !match.away_team || /^[\dWL]/.test(match.away_team.trim())
  const canEdit = !locked && !isPlaceholderHome && !isPlaceholderAway

  const timeZone = 'America/Caracas'
  let dateStr = ''
  if (match.match_date) {
    try {
      const zoned = toZonedTime(parseISO(match.match_date), timeZone)
      dateStr = formatTz(zoned, "d MMM · HH:mm", { locale: es, timeZone })
    } catch { dateStr = '' }
  }

  const predHS = prediction?.predicted_home_score ?? null
  const predAS = prediction?.predicted_away_score ?? null
  const hasPred = predHS !== null && predAS !== null

  const realHS = match.home_score
  const realAS = match.away_score
  const hasReal = realHS !== null && realAS !== null

  // Real result winner
  const realHomeWins = hasReal && realHS! > realAS!
  const realAwayWins = hasReal && realAS! > realHS!

  // Accuracy
  let accuracy: 'exact' | 'correct' | 'wrong' | null = null
  if (isCompleted && hasPred) {
    const predW = predHS! > predAS! ? 'home' : predAS! > predHS! ? 'away' : 'draw'
    const realW = realHS! > realAS! ? 'home' : realAS! > realHS! ? 'away' : 'draw'
    if (predHS === realHS && predAS === realAS) accuracy = 'exact'
    else if (predW === realW) accuracy = 'correct'
    else accuracy = 'wrong'
  }

  // Edit state
  const [editing, setEditing] = useState(false)
  const [homeInput, setHomeInput] = useState('')
  const [awayInput, setAwayInput] = useState('')
  const homeRef = useRef<HTMLInputElement>(null)
  const awayRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setHomeInput(predHS !== null ? String(predHS) : '')
      setAwayInput(predAS !== null ? String(predAS) : '')
      setTimeout(() => homeRef.current?.focus(), 50)
    }
  }, [editing])

  const handleSave = () => {
    const h = homeInput === '' ? null : parseInt(homeInput)
    const a = awayInput === '' ? null : parseInt(awayInput)
    if (h !== null && a !== null && !isNaN(h) && !isNaN(a)) {
      onPredict(match.id, h, a)
    } else if (homeInput === '' && awayInput === '') {
      onPredict(match.id, null, null)
    }
    setEditing(false)
  }

  const borderColor = isLive ? 'rgba(34,197,94,0.5)' :
    accuracy === 'exact' ? 'rgba(250,204,21,0.55)' :
    accuracy === 'correct' ? 'rgba(34,197,94,0.4)' :
    accuracy === 'wrong' ? 'rgba(239,68,68,0.35)' :
    editing ? 'rgba(255,215,0,0.5)' :
    'rgba(255,215,0,0.12)'

  const cardBg = isLive
    ? 'linear-gradient(135deg,rgba(20,74,46,0.5),rgba(2,8,23,0.92))'
    : 'rgba(255,255,255,0.04)'

  return (
    <div style={{
      width: '196px',
      minWidth: '196px',
      background: cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: '10px',
      overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: editing ? '0 0 16px rgba(255,215,0,0.15)'
        : accuracy === 'exact' ? '0 0 10px rgba(250,204,21,0.15)'
        : isLive ? '0 0 10px rgba(34,197,94,0.15)' : 'none',
      position: 'relative'
    }}>
      {/* Top strip: status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: isLive ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.2)'
      }}>
        <span style={{
          fontSize: '8px', fontFamily: 'var(--font-bebas)', letterSpacing: '0.12em',
          color: isLive ? '#4ade80'
            : isCompleted ? 'rgba(255,215,0,0.45)'
            : 'rgba(255,255,255,0.22)'
        }}>
          {isLive ? '🔴 EN VIVO' : isCompleted ? '✓ FINALIZADO' : dateStr || '⏰ PENDIENTE'}
        </span>
        {accuracy && (
          <span style={{
            fontSize: '8px', fontFamily: 'var(--font-bebas)', letterSpacing: '0.08em',
            color: accuracy === 'exact' ? '#fde047' : accuracy === 'correct' ? '#4ade80' : '#f87171'
          }}>
            {accuracy === 'exact' ? '⭐ EXACTO' : accuracy === 'correct' ? '✓ OK' : '✗ FALL.'}
          </span>
        )}
      </div>

      {/* Column headers */}
      {!editing && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ padding: '2px 6px', fontSize: '7px', fontFamily: 'var(--font-bebas)', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            RESULTADO
          </div>
          <div style={{ padding: '2px 6px', fontSize: '7px', fontFamily: 'var(--font-bebas)', letterSpacing: '0.1em', color: 'rgba(255,165,0,0.5)', textAlign: 'center' }}>
            MI PRED.
          </div>
        </div>
      )}

      {editing ? (
        /* Edit mode */
        <div style={{ padding: '8px 10px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <TeamFlag url={match.home_flag} name={match.home_team} />
            <span style={{ flex: 1, fontSize: '10px', color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-rajdhani)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {match.home_team}
            </span>
            <input
              ref={homeRef}
              type="number" min="0" max="20"
              value={homeInput}
              onChange={e => setHomeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && awayRef.current?.focus()}
              style={{
                width: '32px', height: '26px', textAlign: 'center', fontSize: '13px', fontWeight: 800,
                fontFamily: 'var(--font-bebas)', background: 'rgba(255,215,0,0.12)',
                border: '1px solid rgba(255,215,0,0.4)', borderRadius: '5px', color: '#FFD700', outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
            <TeamFlag url={match.away_flag} name={match.away_team} />
            <span style={{ flex: 1, fontSize: '10px', color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-rajdhani)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {match.away_team}
            </span>
            <input
              ref={awayRef}
              type="number" min="0" max="20"
              value={awayInput}
              onChange={e => setAwayInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{
                width: '32px', height: '26px', textAlign: 'center', fontSize: '13px', fontWeight: 800,
                fontFamily: 'var(--font-bebas)', background: 'rgba(255,215,0,0.12)',
                border: '1px solid rgba(255,215,0,0.4)', borderRadius: '5px', color: '#FFD700', outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={e => { e.stopPropagation(); handleSave() }}
              style={{
                flex: 1, padding: '4px', borderRadius: '5px', border: 'none', cursor: 'pointer',
                background: 'rgba(255,215,0,0.18)', color: '#FFD700',
                fontFamily: 'var(--font-bebas)', fontSize: '11px', letterSpacing: '0.08em'
              }}
            >✓ GUARDAR</button>
            <button
              onClick={e => { e.stopPropagation(); setEditing(false) }}
              style={{
                padding: '4px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--font-bebas)', fontSize: '11px'
              }}
            >✕</button>
          </div>
        </div>
      ) : (
        /* Display mode: two columns (real | prediction) */
        <>
          {/* Home row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid rgba(255,255,255,0.04)'
          }}>
            {/* Real result side */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 6px',
              background: realHomeWins ? 'rgba(255,215,0,0.06)' : 'transparent',
              borderRight: '1px solid rgba(255,255,255,0.05)'
            }}>
              {!isPlaceholderHome && <TeamFlag url={match.home_flag} name={match.home_team} />}
              <span style={{
                flex: 1, fontSize: '10px',
                fontWeight: realHomeWins ? 700 : 400,
                color: isPlaceholderHome ? 'rgba(255,255,255,0.18)'
                  : realHomeWins ? '#FFD700' : 'rgba(255,255,255,0.75)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-rajdhani)'
              }}>
                {match.home_team || '?'}
              </span>
              <span style={{
                fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-bebas)',
                color: realHomeWins ? '#FFD700'
                  : realAwayWins ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.6)',
                minWidth: '12px', textAlign: 'right'
              }}>
                {hasReal ? realHS : '–'}
              </span>
            </div>
            {/* Prediction side */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              padding: '5px 6px',
              background: hasPred && predHS! > predAS! ? 'rgba(255,165,0,0.05)' : 'transparent'
            }}>
              <span style={{
                fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-bebas)',
                color: hasPred
                  ? (predHS! > predAS! ? '#FFA500'
                    : predAS! > predHS! ? 'rgba(255,165,0,0.3)' : 'rgba(255,165,0,0.6)')
                  : 'rgba(255,255,255,0.15)',
                textAlign: 'center', minWidth: '12px'
              }}>
                {hasPred ? predHS : canEdit ? '?' : '–'}
              </span>
            </div>
          </div>

          {/* Away row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Real result side */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 6px',
              background: realAwayWins ? 'rgba(255,215,0,0.06)' : 'transparent',
              borderRight: '1px solid rgba(255,255,255,0.05)'
            }}>
              {!isPlaceholderAway && <TeamFlag url={match.away_flag} name={match.away_team} />}
              <span style={{
                flex: 1, fontSize: '10px',
                fontWeight: realAwayWins ? 700 : 400,
                color: isPlaceholderAway ? 'rgba(255,255,255,0.18)'
                  : realAwayWins ? '#FFD700' : 'rgba(255,255,255,0.75)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-rajdhani)'
              }}>
                {match.away_team || '?'}
              </span>
              <span style={{
                fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-bebas)',
                color: realAwayWins ? '#FFD700'
                  : realHomeWins ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.6)',
                minWidth: '12px', textAlign: 'right'
              }}>
                {hasReal ? realAS : '–'}
              </span>
            </div>
            {/* Prediction side */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              padding: '5px 6px',
              background: hasPred && predAS! > predHS! ? 'rgba(255,165,0,0.05)' : 'transparent'
            }}>
              <span style={{
                fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-bebas)',
                color: hasPred
                  ? (predAS! > predHS! ? '#FFA500'
                    : predHS! > predAS! ? 'rgba(255,165,0,0.3)' : 'rgba(255,165,0,0.6)')
                  : 'rgba(255,255,255,0.15)',
                textAlign: 'center', minWidth: '12px'
              }}>
                {hasPred ? predAS : canEdit ? '?' : '–'}
              </span>
            </div>
          </div>

          {/* Footer: date + edit button */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '3px 6px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.18)'
          }}>
            {isCompleted ? (
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-rajdhani)' }}>
                {dateStr}
              </span>
            ) : (
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-rajdhani)' }}>
                {dateStr}
              </span>
            )}
            {canEdit && (
              <button
                onClick={e => { e.stopPropagation(); setEditing(true) }}
                style={{
                  fontSize: '8px', fontFamily: 'var(--font-bebas)', letterSpacing: '0.08em',
                  padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,165,0,0.3)',
                  background: 'rgba(255,165,0,0.1)', color: 'rgba(255,165,0,0.8)',
                  cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {hasPred ? '✏ EDITAR' : '+ PREDECIR'}
              </button>
            )}
            {!canEdit && !isCompleted && (
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-bebas)' }}>🔒</span>
            )}
          </div>
        </>
      )}

      {/* Saving overlay */}
      {saving && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(2,8,23,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px'
        }}>
          <span style={{ fontSize: '10px', color: '#FFD700', fontFamily: 'var(--font-bebas)', letterSpacing: '0.1em' }}>GUARDANDO…</span>
        </div>
      )}
    </div>
  )
}

function RoundColumn({ label, matches: rMatches, gap, topPad, predictions, phases, onPredict, saving }: {
  label: string; matches: Match[]; gap: number; topPad: number
  predictions: Props['predictions']; phases: Props['phases']
  onPredict: Props['onPredict']; saving: number | null
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '12px', letterSpacing: '0.1em', color: 'rgba(255,215,0,0.6)', marginBottom: '10px', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, paddingTop: `${topPad}px` }}>
        {rMatches.map(m => (
          <BracketCard key={m.id} match={m} prediction={predictions[m.id]} phases={phases} onPredict={onPredict} saving={saving === m.id} />
        ))}
      </div>
    </div>
  )
}

function RoundConnector({ leftCount, rightCount, cardH, leftGap, rightGap, leftTopPad, rightTopPad }: {
  leftCount: number; rightCount: number; cardH: number
  leftGap: number; rightGap: number; leftTopPad: number; rightTopPad: number
}) {
  if (leftCount === 0 || rightCount === 0) return <div style={{ width: '16px' }} />
  const W = 16
  const totalH = leftTopPad + leftCount * cardH + Math.max(0, leftCount - 1) * leftGap + 80
  const paths: string[] = []
  for (let i = 0; i < rightCount; i++) {
    const topCenter = leftTopPad + (i * 2) * (cardH + leftGap) + cardH / 2
    const botCenter = leftTopPad + (i * 2 + 1) * (cardH + leftGap) + cardH / 2
    const parentCenter = rightTopPad + i * (cardH + rightGap) + cardH / 2
    paths.push(`M 0 ${topCenter} H ${W} V ${parentCenter}`)
    paths.push(`M 0 ${botCenter} H ${W} V ${parentCenter}`)
  }
  return (
    <div style={{ width: `${W}px`, flexShrink: 0, alignSelf: 'flex-start' }}>
      <svg width={W} height={totalH} style={{ overflow: 'visible' }}>
        {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(255,215,0,0.18)" strokeWidth="1" />)}
      </svg>
    </div>
  )
}

export default function BracketView({ matches, predictions, phases, onPredict, saving }: Props) {
  const byPhase: Record<string, Match[]> = {}
  PHASE_ORDER.forEach(p => { byPhase[p] = matches.filter(m => m.phase === p).sort((a, b) => a.id - b.id) })

  const allFinals = byPhase['final'] || []
  const thirdPlace = allFinals.find(m =>
    m.home_team?.toLowerCase().includes('loser') || m.home_team?.toLowerCase().includes('perdedor') ||
    (allFinals.length === 2 && allFinals.indexOf(m) === 0)
  )
  const grandFinal = allFinals.find(m => m !== thirdPlace) || allFinals[0]

  const rounds = [
    { phase: 'round32', label: '32avos' },
    { phase: 'round16', label: '16avos' },
    { phase: 'quarterfinals', label: 'Cuartos' },
    { phase: 'semifinals', label: 'Semis' },
  ].filter(r => byPhase[r.phase]?.length > 0)

  const CARD_H = 96

  function getGap(idx: number): number {
    if (idx === 0) return 8
    return CARD_H * (Math.pow(2, idx) - 1) + getGap(idx - 1) * (Math.pow(2, idx) - 1) + 8
  }
  function getTopPad(idx: number): number {
    if (idx === 0) return 0
    return (getGap(idx) - getGap(idx - 1)) / 2
  }
  function phaseIdx(phase: string) { return PHASE_ORDER.indexOf(phase) }

  const knockoutPredCount = matches.filter(m => {
    const p = predictions[m.id]
    return p?.predicted_home_score !== null && p?.predicted_away_score !== null
  }).length

  if (rounds.length === 0 && allFinals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-rajdhani)', fontSize: '16px' }}>Los partidos eliminatorios se cargarán pronto.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: '20px', letterSpacing: '0.1em', color: 'white', margin: 0 }}>
            CUADRO <span style={{ color: '#FFD700' }}>ELIMINATORIO</span>
          </h2>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-rajdhani)', marginTop: '2px' }}>
            {knockoutPredCount}/{matches.length} predicciones · cada tarjeta muestra resultado real (izq) y tu predicción (der)
          </p>
        </div>
        {/* Column legend */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-bebas)', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', borderLeft: '2px solid rgba(255,215,0,0.4)', paddingLeft: '6px' }}>RESULTADO</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-bebas)', letterSpacing: '0.08em', color: 'rgba(255,165,0,0.5)', borderLeft: '2px solid rgba(255,165,0,0.4)', paddingLeft: '6px' }}>MI PRED.</span>
        </div>
      </div>

      {/* Scrollable bracket */}
      <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
          {rounds.map((round, i) => {
            const pi = phaseIdx(round.phase)
            const cnt = byPhase[round.phase].length
            const gap = getGap(pi)
            const topPad = getTopPad(pi)
            const nextRound = rounds[i + 1]

            return (
              <div key={round.phase} style={{ display: 'flex', alignItems: 'flex-start' }}>
                <RoundColumn
                  label={round.label}
                  matches={byPhase[round.phase]}
                  gap={gap}
                  topPad={topPad}
                  predictions={predictions}
                  phases={phases}
                  onPredict={onPredict}
                  saving={saving}
                />
                {nextRound ? (
                  <RoundConnector
                    leftCount={cnt}
                    rightCount={byPhase[nextRound.phase].length}
                    cardH={CARD_H}
                    leftGap={gap}
                    rightGap={getGap(phaseIdx(nextRound.phase))}
                    leftTopPad={topPad}
                    rightTopPad={getTopPad(phaseIdx(nextRound.phase))}
                  />
                ) : allFinals.length > 0 ? (
                  <RoundConnector
                    leftCount={cnt}
                    rightCount={grandFinal ? 1 : 0}
                    cardH={CARD_H}
                    leftGap={gap}
                    rightGap={0}
                    leftTopPad={topPad}
                    rightTopPad={getTopPad(phaseIdx('final'))}
                  />
                ) : null}
              </div>
            )
          })}

          {/* Finals */}
          {allFinals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '12px', letterSpacing: '0.1em', color: 'rgba(255,215,0,0.6)', marginBottom: '10px' }}>Final</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: `${getTopPad(phaseIdx('final'))}px` }}>
                {thirdPlace && (
                  <div>
                    <div style={{ fontSize: '8px', fontFamily: 'var(--font-bebas)', color: '#cd7f32', textAlign: 'center', marginBottom: '3px', letterSpacing: '0.08em' }}>🥉 3er PUESTO</div>
                    <BracketCard match={thirdPlace} prediction={predictions[thirdPlace.id]} phases={phases} onPredict={onPredict} saving={saving === thirdPlace.id} />
                  </div>
                )}
                {grandFinal && (
                  <div>
                    <div style={{ fontSize: '8px', fontFamily: 'var(--font-bebas)', color: '#FFD700', textAlign: 'center', marginBottom: '3px', letterSpacing: '0.08em' }}>🏆 GRAN FINAL</div>
                    <div style={{ border: '1px solid rgba(255,215,0,0.35)', borderRadius: '12px', padding: '3px', background: 'linear-gradient(135deg,rgba(255,215,0,0.05),transparent)', boxShadow: '0 0 18px rgba(255,215,0,0.1)' }}>
                      <BracketCard match={grandFinal} prediction={predictions[grandFinal.id]} phases={phases} onPredict={onPredict} saving={saving === grandFinal.id} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.025)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-rajdhani)' }}>
          🏆 Ganador en dorado · ⭐ Marcador exacto · ✓ Acertado · ✗ Fallado · + PREDECIR = partido abierto
        </span>
      </div>
    </div>
  )
}
