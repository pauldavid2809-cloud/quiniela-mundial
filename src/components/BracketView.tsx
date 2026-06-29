'use client'

import { useState } from 'react'
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

interface Prediction {
  match_id: number
  prediction: 'home' | 'draw' | 'away' | null
  predicted_home_score: number | null
  predicted_away_score: number | null
  points_earned: number
  is_correct: boolean | null
}

interface Props {
  matches: Match[]
  predictions: Record<number, {
    prediction: 'home' | 'draw' | 'away' | null
    predicted_home_score: number | null
    predicted_away_score: number | null
  }>
  onPhaseChange?: (phase: string) => void
}

function TeamFlag({ url, name, size = 'sm' }: { url: string; name: string; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'
  if (url && (url.startsWith('http') || url.startsWith('/') || url.includes('.'))) {
    return (
      <img
        src={url}
        alt={name}
        className={`${cls} object-contain rounded`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span className="text-xl leading-none select-none shrink-0" title={name}>{url || '🏳️'}</span>
}

const PHASE_ORDER = ['round32', 'round16', 'quarterfinals', 'semifinals', 'final']
const PHASE_LABELS: Record<string, string> = {
  round32: '32avos',
  round16: '16avos',
  quarterfinals: 'Cuartos',
  semifinals: 'Semis',
  final: 'Final'
}

interface BracketMatchCardProps {
  match: Match
  mode: 'results' | 'predictions'
  prediction?: { prediction: 'home' | 'draw' | 'away' | null; predicted_home_score: number | null; predicted_away_score: number | null }
  isPlaceholder?: boolean
  size?: 'compact' | 'normal'
  onClick?: () => void
}

function BracketMatchCard({ match, mode, prediction, isPlaceholder, size = 'normal', onClick }: BracketMatchCardProps) {
  const isCompleted = match.status === 'completed'
  const isLive = match.status === 'live'
  const timeZone = 'America/Caracas'

  let dateStr = ''
  if (match.match_date) {
    try {
      const zoned = toZonedTime(parseISO(match.match_date), timeZone)
      dateStr = formatTz(zoned, 'd MMM · HH:mm', { locale: es, timeZone })
    } catch { dateStr = '' }
  }

  const showPrediction = mode === 'predictions' && prediction
  const predHS = showPrediction ? prediction!.predicted_home_score : null
  const predAS = showPrediction ? prediction!.predicted_away_score : null
  const hasPred = predHS !== null && predAS !== null

  const realHS = match.home_score
  const realAS = match.away_score

  const displayHome = mode === 'results' ? realHS : (hasPred ? predHS : null)
  const displayAway = mode === 'results' ? realAS : (hasPred ? predAS : null)
  const hasScore = displayHome !== null && displayAway !== null

  // Determine winner for highlighting
  const homeWins = hasScore && displayHome! > displayAway!
  const awayWins = hasScore && displayAway! > displayHome!

  // Prediction accuracy
  let predAccuracy: 'correct' | 'wrong' | 'pending' | null = null
  if (mode === 'predictions' && isCompleted && hasPred) {
    const predWinner = predHS! > predAS! ? 'home' : predAS! > predHS! ? 'away' : 'draw'
    const realWinner = realHS! > realAS! ? 'home' : realAS! > realHS! ? 'away' : 'draw'
    const exactMatch = predHS === realHS && predAS === realAS
    predAccuracy = exactMatch ? 'correct' : (predWinner === realWinner ? 'correct' : 'wrong')
  }

  const homeTeam = isPlaceholder ? match.home_team : match.home_team
  const awayTeam = isPlaceholder ? match.away_team : match.away_team
  const isPlaceholderHome = !match.home_team || /^[\dWL]/.test(match.home_team.trim())
  const isPlaceholderAway = !match.away_team || /^[\dWL]/.test(match.away_team.trim())

  const compact = size === 'compact'

  return (
    <div
      onClick={onClick}
      className={`bracket-match-card ${onClick ? 'cursor-pointer' : ''} ${
        predAccuracy === 'correct' ? 'border-green-500/40' :
        predAccuracy === 'wrong' ? 'border-red-500/40' : ''
      }`}
      style={{
        background: isLive
          ? 'linear-gradient(135deg, rgba(20,74,46,0.6), rgba(2,8,23,0.9))'
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${
          isLive ? 'rgba(34,197,94,0.4)' :
          predAccuracy === 'correct' ? 'rgba(34,197,94,0.35)' :
          predAccuracy === 'wrong' ? 'rgba(239,68,68,0.35)' :
          'rgba(255,215,0,0.12)'
        }`,
        borderRadius: '10px',
        width: compact ? '140px' : '160px',
        minWidth: compact ? '140px' : '160px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: isLive ? '0 0 12px rgba(34,197,94,0.2)' : 'none'
      }}
    >
      {/* Status bar */}
      {(isLive || isCompleted) && (
        <div style={{
          padding: '2px 8px',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textAlign: 'center',
          fontFamily: 'var(--font-bebas)',
          background: isLive ? 'rgba(34,197,94,0.25)' : 'rgba(255,215,0,0.08)',
          color: isLive ? '#4ade80' : 'rgba(255,215,0,0.6)',
          borderBottom: `1px solid ${isLive ? 'rgba(34,197,94,0.2)' : 'rgba(255,215,0,0.08)'}`
        }}>
          {isLive ? '🔴 EN VIVO' : '✓ FINALIZADO'}
        </div>
      )}

      {/* Home team row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: compact ? '6px 8px' : '7px 10px',
        background: homeWins ? 'rgba(255,215,0,0.08)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        {!isPlaceholderHome && <TeamFlag url={match.home_flag} name={homeTeam} />}
        <span style={{
          flex: 1,
          fontSize: compact ? '11px' : '12px',
          fontWeight: homeWins ? 700 : 500,
          color: isPlaceholderHome ? 'rgba(255,255,255,0.25)' : homeWins ? '#FFD700' : 'rgba(255,255,255,0.85)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-rajdhani)'
        }}>
          {isPlaceholderHome ? (homeTeam || '?') : homeTeam}
        </span>
        {hasScore && (
          <span style={{
            fontSize: compact ? '13px' : '15px',
            fontWeight: 800,
            fontFamily: 'var(--font-bebas)',
            color: homeWins ? '#FFD700' : awayWins ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)',
            minWidth: '14px',
            textAlign: 'center'
          }}>
            {displayHome}
          </span>
        )}
        {mode === 'predictions' && !hasPred && !isPlaceholderHome && (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>-</span>
        )}
      </div>

      {/* Away team row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: compact ? '6px 8px' : '7px 10px',
        background: awayWins ? 'rgba(255,215,0,0.08)' : 'transparent'
      }}>
        {!isPlaceholderAway && <TeamFlag url={match.away_flag} name={awayTeam} />}
        <span style={{
          flex: 1,
          fontSize: compact ? '11px' : '12px',
          fontWeight: awayWins ? 700 : 500,
          color: isPlaceholderAway ? 'rgba(255,255,255,0.25)' : awayWins ? '#FFD700' : 'rgba(255,255,255,0.85)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-rajdhani)'
        }}>
          {isPlaceholderAway ? (awayTeam || '?') : awayTeam}
        </span>
        {hasScore && (
          <span style={{
            fontSize: compact ? '13px' : '15px',
            fontWeight: 800,
            fontFamily: 'var(--font-bebas)',
            color: awayWins ? '#FFD700' : homeWins ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)',
            minWidth: '14px',
            textAlign: 'center'
          }}>
            {displayAway}
          </span>
        )}
        {mode === 'predictions' && !hasPred && !isPlaceholderAway && (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>-</span>
        )}
      </div>

      {/* Date / Pred badge */}
      <div style={{
        padding: '3px 8px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.2)'
      }}>
        {dateStr && (
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-rajdhani)' }}>
            {dateStr}
          </span>
        )}
        {mode === 'predictions' && predAccuracy === 'correct' && (
          <span style={{ fontSize: '9px', color: '#4ade80', fontWeight: 700 }}>✓ ACERTADO</span>
        )}
        {mode === 'predictions' && predAccuracy === 'wrong' && (
          <span style={{ fontSize: '9px', color: '#f87171', fontWeight: 700 }}>✗ FALLADO</span>
        )}
        {mode === 'predictions' && !hasPred && !isCompleted && (
          <span style={{ fontSize: '9px', color: 'rgba(255,165,0,0.6)', fontWeight: 700 }}>Sin pred.</span>
        )}
      </div>
    </div>
  )
}

// Returns a pair of connector lines pointing right (toward the next round)
function ConnectorLines({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'center'
        }}>
          {/* Top half-bracket arm */}
          <div style={{ height: '40px', borderRight: '1px solid rgba(255,215,0,0.25)', borderTop: i % 2 === 0 ? '1px solid rgba(255,215,0,0.25)' : 'none' }} />
          {/* Bottom half-bracket arm */}
          <div style={{ height: '40px', borderRight: '1px solid rgba(255,215,0,0.25)', borderBottom: i % 2 === 1 ? '1px solid rgba(255,215,0,0.25)' : 'none' }} />
        </div>
      ))}
    </div>
  )
}

export default function BracketView({ matches, predictions }: Props) {
  const [mode, setMode] = useState<'results' | 'predictions'>('results')

  const phaseMatches: Record<string, Match[]> = {}
  PHASE_ORDER.forEach(phase => {
    phaseMatches[phase] = matches
      .filter(m => m.phase === phase)
      .sort((a, b) => a.id - b.id)
  })

  // Separate the third-place match from the final
  const allFinals = phaseMatches['final'] || []
  const thirdPlaceMatch = allFinals.find(m =>
    m.home_team?.toLowerCase().includes('loser') ||
    m.away_team?.toLowerCase().includes('loser') ||
    m.home_team?.toLowerCase().includes('perdedor') ||
    m.away_team?.toLowerCase().includes('perdedor') ||
    (allFinals.length === 2 && allFinals.indexOf(m) === 0)
  )
  const finalMatch = allFinals.find(m => m !== thirdPlaceMatch) || allFinals[0]

  const r32 = phaseMatches['round32'] || []
  const r16 = phaseMatches['round16'] || []
  const qf = phaseMatches['quarterfinals'] || []
  const sf = phaseMatches['semifinals'] || []

  const cardSize: 'compact' | 'normal' = r32.length >= 16 ? 'compact' : 'normal'
  const cardW = cardSize === 'compact' ? 148 : 164
  const gapH = cardSize === 'compact' ? 8 : 10
  const matchH = cardSize === 'compact' ? 82 : 88 // approx height of a card

  // Vertical spacing per round multiplier
  function getMatchSpacing(roundIndex: number): number {
    // round32 = index 0, r16 = 1, qf = 2, sf = 3, final = 4
    const baseSpacing = matchH + gapH
    return baseSpacing * Math.pow(2, roundIndex)
  }

  function getRoundOffset(roundIndex: number): number {
    if (roundIndex === 0) return 0
    const childSpacing = getMatchSpacing(roundIndex - 1)
    const mySpacing = getMatchSpacing(roundIndex)
    return (mySpacing - childSpacing) / 2
  }

  function RoundColumn({
    roundMatches,
    roundIndex,
    label
  }: {
    roundMatches: Match[]
    roundIndex: number
    label: string
  }) {
    const spacing = getMatchSpacing(roundIndex)
    const topOffset = getRoundOffset(roundIndex)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        {/* Round label */}
        <div style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: '13px',
          letterSpacing: '0.1em',
          color: 'rgba(255,215,0,0.7)',
          marginBottom: '8px',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          {label}
        </div>
        {/* Cards */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${spacing - matchH}px`,
          paddingTop: `${topOffset}px`
        }}>
          {roundMatches.map(match => (
            <BracketMatchCard
              key={match.id}
              match={match}
              mode={mode}
              prediction={predictions[match.id]}
              size={cardSize}
            />
          ))}
        </div>
      </div>
    )
  }

  // Connector between two rounds
  function Connector({ leftCount, rightCount }: { leftCount: number; rightCount: number }) {
    if (leftCount === 0 || rightCount === 0) return <div style={{ width: '20px' }} />
    const ratio = leftCount / rightCount
    const leftSpacing = getMatchSpacing(Math.log2(32 / leftCount))
    const rightSpacing = getMatchSpacing(Math.log2(32 / rightCount))
    const leftTopOffset = getRoundOffset(Math.log2(32 / leftCount))
    const rightTopOffset = getRoundOffset(Math.log2(32 / rightCount))

    const lines = []
    for (let i = 0; i < rightCount; i++) {
      const topChildIdx = i * 2
      const bottomChildIdx = i * 2 + 1

      const topChildCenter = leftTopOffset + topChildIdx * leftSpacing + matchH / 2
      const bottomChildCenter = leftTopOffset + bottomChildIdx * leftSpacing + matchH / 2
      const parentCenter = rightTopOffset + i * rightSpacing + matchH / 2

      const midX = 20
      lines.push(
        <svg
          key={i}
          style={{ position: 'absolute', top: 0, left: 0, width: '20px', pointerEvents: 'none' }}
          height={Math.max(bottomChildCenter + 10, 400) + 'px'}
        >
          {/* Top child → mid */}
          <path
            d={`M 0 ${topChildCenter} H ${midX} V ${parentCenter}`}
            fill="none"
            stroke="rgba(255,215,0,0.2)"
            strokeWidth="1"
          />
          {/* Bottom child → mid */}
          <path
            d={`M 0 ${bottomChildCenter} H ${midX} V ${parentCenter}`}
            fill="none"
            stroke="rgba(255,215,0,0.2)"
            strokeWidth="1"
          />
        </svg>
      )
    }

    return (
      <div style={{ position: 'relative', width: '20px', flexShrink: 0 }}>
        {lines}
      </div>
    )
  }

  const hasKnockoutMatches = r32.length > 0 || r16.length > 0 || qf.length > 0 || sf.length > 0 || allFinals.length > 0

  if (!hasKnockoutMatches) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-rajdhani)', fontSize: '16px' }}>
          Los partidos de eliminatorias se cargarán pronto.
        </p>
      </div>
    )
  }

  // Gather all rounds with their data
  const rounds: { matches: Match[]; label: string }[] = [
    { matches: r32, label: '32avos de Final' },
    { matches: r16, label: '16avos de Final' },
    { matches: qf, label: 'Cuartos de Final' },
    { matches: sf, label: 'Semifinales' },
  ].filter(r => r.matches.length > 0)

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: '24px', letterSpacing: '0.1em', color: 'white' }}>
            CUADRO DEL <span style={{ color: '#FFD700' }}>TORNEO</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-rajdhani)', marginTop: '2px' }}>
            {mode === 'results' ? 'Resultados reales del Mundial 2026' : 'Tus predicciones para el cuadro'}
          </p>
        </div>
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,215,0,0.15)',
          borderRadius: '10px',
          padding: '3px',
          gap: '2px'
        }}>
          {(['results', 'predictions'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: '13px',
                letterSpacing: '0.08em',
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: mode === m ? 'rgba(255,215,0,0.15)' : 'transparent',
                color: mode === m ? '#FFD700' : 'rgba(255,255,255,0.45)',
                borderColor: mode === m ? 'rgba(255,215,0,0.3)' : 'transparent',
                boxShadow: mode === m ? '0 0 10px rgba(255,215,0,0.1)' : 'none'
              }}
            >
              {m === 'results' ? '⚽ Resultados' : '🎯 Mis Predicciones'}
            </button>
          ))}
        </div>
      </div>

      {/* Bracket scroll container */}
      <div style={{
        overflowX: 'auto',
        overflowY: 'visible',
        paddingBottom: '24px',
        paddingTop: '4px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '20px',
          alignItems: 'flex-start',
          minWidth: 'max-content',
          paddingRight: '8px'
        }}>
          {/* Render each round */}
          {rounds.map((round, i) => {
            const roundIndex = PHASE_ORDER.indexOf(
              ['round32', 'round16', 'quarterfinals', 'semifinals'][i] ?? 'round32'
            )
            return (
              <RoundColumn
                key={round.label}
                roundMatches={round.matches}
                roundIndex={roundIndex}
                label={round.label}
              />
            )
          })}

          {/* Final column */}
          {allFinals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: '13px',
                letterSpacing: '0.1em',
                color: 'rgba(255,215,0,0.7)',
                marginBottom: '8px',
                textAlign: 'center'
              }}>
                Gran Final
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingTop: `${getRoundOffset(4)}px`
              }}>
                {/* Tercer puesto */}
                {thirdPlaceMatch && (
                  <div>
                    <div style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-bebas)',
                      letterSpacing: '0.1em',
                      color: '#cd7f32',
                      textAlign: 'center',
                      marginBottom: '4px'
                    }}>
                      🥉 3er y 4to Puesto
                    </div>
                    <BracketMatchCard
                      match={thirdPlaceMatch}
                      mode={mode}
                      prediction={predictions[thirdPlaceMatch.id]}
                      size={cardSize}
                    />
                  </div>
                )}

                {/* Grand Final */}
                {finalMatch && (
                  <div>
                    <div style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-bebas)',
                      letterSpacing: '0.1em',
                      color: '#FFD700',
                      textAlign: 'center',
                      marginBottom: '4px'
                    }}>
                      🏆 GRAN FINAL
                    </div>
                    <div style={{
                      border: '1px solid rgba(255,215,0,0.4)',
                      borderRadius: '12px',
                      padding: '3px',
                      background: 'linear-gradient(135deg, rgba(255,215,0,0.06), transparent)',
                      boxShadow: '0 0 24px rgba(255,215,0,0.12)'
                    }}>
                      <BracketMatchCard
                        match={finalMatch}
                        mode={mode}
                        prediction={predictions[finalMatch.id]}
                        size={cardSize}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        marginTop: '16px',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-rajdhani)' }}>
          🏆 Ganador en dorado · 🔴 En vivo · ✓ Finalizado
          {mode === 'predictions' && ' · ✓ Predicción acertada · ✗ Predicción fallada · Sin pred. = sin predicción'}
        </span>
      </div>
    </div>
  )
}
