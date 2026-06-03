'use client'

import { useState, useEffect } from 'react'
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
  venue: string | null
}

interface Props {
  match: Match
  prediction?: 'home' | 'draw' | 'away' | null
  predictedHomeScore: number | null
  predictedAwayScore: number | null
  onPredict: (matchId: number, homeScore: number | null, awayScore: number | null) => void
  saving: boolean
  pointsValue: number
  isPhaseLocked?: boolean
}

function TeamFlag({ url, name }: { url: string; name: string }) {
  if (url && (url.startsWith('http') || url.startsWith('/') || url.includes('.'))) {
    return (
      <img
        src={url}
        alt={name}
        className="w-6 h-6 object-contain rounded"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <span className="text-2xl select-none leading-none shrink-0" title={name}>
      {url || '🏳️'}
    </span>
  )
}

export default function MatchCard({
  match,
  prediction,
  predictedHomeScore,
  predictedAwayScore,
  onPredict,
  saving,
  pointsValue,
  isPhaseLocked = false
}: Props) {
  const isScheduled = match.status === 'scheduled'
  const isLive = match.status === 'live'
  const isDone = match.status === 'completed'

  const isLocked = isPhaseLocked || !isScheduled

  const matchDate = match.match_date ? parseISO(match.match_date) : null
  
  // Venezuela timezone: America/Caracas (UTC-4)
  const timeZone = 'America/Caracas'
  const zonedDate = matchDate ? toZonedTime(matchDate, timeZone) : null

  // Local state for exact score inputs
  const [homeInput, setHomeInput] = useState(predictedHomeScore !== null ? String(predictedHomeScore) : '')
  const [awayInput, setAwayInput] = useState(predictedAwayScore !== null ? String(predictedAwayScore) : '')
  
  // Track if user is currently editing inputs to prevent overwrite from props
  const [isEditing, setIsEditing] = useState(false)

  // Sync inputs with props only if the user is not actively editing
  useEffect(() => {
    if (!isEditing) {
      setHomeInput(predictedHomeScore !== null ? String(predictedHomeScore) : '')
    }
  }, [predictedHomeScore, isEditing])

  useEffect(() => {
    if (!isEditing) {
      setAwayInput(predictedAwayScore !== null ? String(predictedAwayScore) : '')
    }
  }, [predictedAwayScore, isEditing])

  // Reset editing state once the saved props change to match the inputs
  useEffect(() => {
    if (predictedHomeScore !== null && predictedAwayScore !== null) {
      if (String(predictedHomeScore) === homeInput.trim() && String(predictedAwayScore) === awayInput.trim()) {
        setIsEditing(false)
      }
    } else if (predictedHomeScore === null && predictedAwayScore === null) {
      if (homeInput === '' && awayInput === '') {
        setIsEditing(false)
      }
    }
  }, [predictedHomeScore, predictedAwayScore])

  const handleHomeChange = (val: string) => {
    setIsEditing(true)
    setHomeInput(val)
  }

  const handleAwayChange = (val: string) => {
    setIsEditing(true)
    setAwayInput(val)
  }

  const handleBlur = () => {
    submitPrediction()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitPrediction()
    }
  }

  const submitPrediction = () => {
    const hVal = homeInput.trim()
    const aVal = awayInput.trim()

    // If both are empty, delete prediction
    if (hVal === '' && aVal === '') {
      if (predictedHomeScore !== null || predictedAwayScore !== null) {
        setIsEditing(false)
        onPredict(match.id, null, null)
      }
      return
    }

    const h = parseInt(hVal, 10)
    const a = parseInt(aVal, 10)

    // Save only if both inputs are valid numbers
    if (!isNaN(h) && !isNaN(a)) {
      if (h !== predictedHomeScore || a !== predictedAwayScore) {
        onPredict(match.id, h, a)
      } else {
        setIsEditing(false)
      }
    }
  }

  const result: 'home' | 'draw' | 'away' | null = isDone && match.home_score !== null && match.away_score !== null
    ? match.home_score > match.away_score ? 'home'
      : match.away_score > match.home_score ? 'away'
      : 'draw'
    : null

  const isWinnerCorrect = isDone && prediction && result ? prediction === result : null
  const isExactScoreCorrect = isDone && 
    predictedHomeScore !== null && 
    predictedAwayScore !== null && 
    predictedHomeScore === match.home_score && 
    predictedAwayScore === match.away_score

  const earnedPoints = isExactScoreCorrect ? pointsValue + 2 : isWinnerCorrect ? pointsValue : 0

  return (
    <div className={`glass-card p-4 transition-all relative overflow-hidden ${isLive ? 'border-crimson-500/40' : ''} ${
      isExactScoreCorrect ? 'border-amber-500/50 shadow-lg shadow-amber-500/5' :
      isWinnerCorrect === true ? 'border-green-500/40' : 
      isWinnerCorrect === false ? 'border-red-500/30' : ''
    }`}>
      {/* Background glow for exact match winner */}
      {isExactScoreCorrect && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      )}

      <div className="flex items-center gap-3">
        {/* Status badge */}
        <div className="flex flex-col items-center gap-1 min-w-[56px]">
          {isLive && (
            <span className="badge badge-live animate-pulse">VIVO</span>
          )}
          {isDone && (
            <span className="badge badge-done">FIN</span>
          )}
          {isScheduled && zonedDate && (
            <div className="text-center">
              <div className="text-white/40 text-[9px] uppercase tracking-wider leading-none mb-1">
                {formatTz(zonedDate, 'dd MMM', { locale: es, timeZone })}
              </div>
              <div className="text-white/70 text-xs font-semibold">
                {formatTz(zonedDate, 'HH:mm', { timeZone })}
              </div>
            </div>
          )}
          {isScheduled && !zonedDate && (
            <span className="badge badge-soon">PRÓXIMO</span>
          )}
        </div>

        {/* Teams and score */}
        <div className="flex-1 flex items-center gap-2">
          {/* Home team */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-white font-semibold text-sm text-right leading-tight hidden xs:block">
              {match.home_team}
            </span>
            <span className="text-white font-semibold text-xs text-right leading-tight xs:hidden">
              {match.home_team.slice(0, 3).toUpperCase()}
            </span>
            <TeamFlag url={match.home_flag} name={match.home_team} />
          </div>

          {/* Actual score / VS */}
          <div className="text-center min-w-[64px]">
            {(isLive || isDone) && match.home_score !== null ? (
              <div className="font-display text-2xl text-white tracking-wide bg-black/25 px-2 py-0.5 rounded border border-white/5">
                {match.home_score} - {match.away_score}
              </div>
            ) : (
              <div className="font-display text-lg text-white/30">VS</div>
            )}
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2 flex-1">
            <TeamFlag url={match.away_flag} name={match.away_team} />
            <span className="text-white font-semibold text-sm leading-tight hidden xs:block">
              {match.away_team}
            </span>
            <span className="text-white font-semibold text-xs leading-tight xs:hidden">
              {match.away_team.slice(0, 3).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Result status icon */}
        {isDone && (
          <div className="shrink-0 flex items-center justify-center">
            {isExactScoreCorrect ? (
              <span className="text-xl" title="¡Marcador Exacto! 🎯">🎯</span>
            ) : isWinnerCorrect ? (
              <span className="text-xl" title="Acertado general">✅</span>
            ) : (
              <span className="text-xl" title="No acertado">❌</span>
            )}
          </div>
        )}
      </div>

      {/* Prediction inputs */}
      <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-white/40 text-xs font-semibold uppercase tracking-wider">
          Mi Predicción:
        </div>

        <div className="flex items-center gap-3">
          {!isLocked ? (
            // Edit mode (Inputs with flags)
            <div className="flex items-center gap-2">
              {/* Home input group */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/40 font-semibold uppercase hidden sm:block">
                  {match.home_team.slice(0, 3)}
                </span>
                <TeamFlag url={match.home_flag} name={match.home_team} />
                <input
                  type="number"
                  min="0"
                  placeholder="-"
                  value={homeInput}
                  onChange={e => handleHomeChange(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  disabled={saving}
                  className="w-10 h-8 text-center bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white font-bold rounded border border-white/10 focus:border-gold-500/50 outline-none text-sm transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <span className="text-white/30 text-xs font-bold">-</span>

              {/* Away input group */}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  placeholder="-"
                  value={awayInput}
                  onChange={e => handleAwayChange(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  disabled={saving}
                  className="w-10 h-8 text-center bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white font-bold rounded border border-white/10 focus:border-gold-500/50 outline-none text-sm transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <TeamFlag url={match.away_flag} name={match.away_team} />
                <span className="text-[10px] text-white/40 font-semibold uppercase hidden sm:block">
                  {match.away_team.slice(0, 3)}
                </span>
              </div>
              {saving && (
                <span className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin ml-1" />
              )}
            </div>
          ) : (
            // Locked / Completed display mode with flags
            <div className="flex items-center gap-2 bg-black/10 px-2 py-1 rounded border border-white/5">
              <TeamFlag url={match.home_flag} name={match.home_team} />
              {predictedHomeScore !== null && predictedAwayScore !== null ? (
                <div className={`font-mono text-sm px-2 py-0.5 rounded font-bold border ${
                  isExactScoreCorrect ? 'bg-amber-950/20 border-amber-500/30 text-amber-300' :
                  isWinnerCorrect ? 'bg-green-950/20 border-green-500/30 text-green-300' :
                  isDone ? 'bg-red-950/10 border-red-500/20 text-red-300' : 'bg-white/5 border-white/10 text-white'
                }`}>
                  {predictedHomeScore} - {predictedAwayScore}
                </div>
              ) : (
                <span className="text-white/20 text-xs italic px-1">Sin predicción</span>
              )}
              <TeamFlag url={match.away_flag} name={match.away_team} />
            </div>
          )}

          {/* Points indicator */}
          {isDone && (
            <div className="shrink-0">
              {earnedPoints > 0 ? (
                <span className={`font-display text-sm font-semibold ${isExactScoreCorrect ? 'text-amber-400' : 'text-green-400'}`}>
                  +{earnedPoints} pt
                </span>
              ) : (
                <span className="text-white/25 text-xs">0 pt</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Match details (Venue) */}
      {match.venue && (
        <div className="mt-2 text-white/20 text-[9px] text-right font-medium">📍 {match.venue}</div>
      )}
    </div>
  )
}
