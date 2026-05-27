'use client'

import Image from 'next/image'
import { format, parseISO } from 'date-fns'
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
  prediction?: 'home' | 'draw' | 'away'
  onPredict: (matchId: number, pred: 'home' | 'draw' | 'away') => void
  saving: boolean
  pointsValue: number
}

function TeamFlag({ url, name }: { url: string; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-8 h-8 object-contain rounded"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-lg">
      ⚽
    </div>
  )
}

export default function MatchCard({ match, prediction, onPredict, saving, pointsValue }: Props) {
  const isScheduled = match.status === 'scheduled'
  const isLive = match.status === 'live'
  const isDone = match.status === 'completed'

  const matchDate = match.match_date ? parseISO(match.match_date) : null

  const result: 'home' | 'draw' | 'away' | null = isDone && match.home_score !== null && match.away_score !== null
    ? match.home_score > match.away_score ? 'home'
      : match.away_score > match.home_score ? 'away'
      : 'draw'
    : null

  const isCorrect = isDone && prediction && result ? prediction === result : null

  return (
    <div className={`glass-card p-4 transition-all ${isLive ? 'border-crimson-500/40' : ''} ${isCorrect === true ? 'border-green-500/40' : isCorrect === false ? 'border-red-500/30' : ''}`}>
      <div className="flex items-center gap-3">
        {/* Status badge */}
        <div className="flex flex-col items-center gap-1 min-w-[52px]">
          {isLive && (
            <span className="badge badge-live">EN VIVO</span>
          )}
          {isDone && (
            <span className="badge badge-done">FIN</span>
          )}
          {isScheduled && matchDate && (
            <div className="text-center">
              <div className="text-white/50 text-[10px] leading-none">
                {format(matchDate, 'dd MMM', { locale: es })}
              </div>
              <div className="text-white/70 text-xs font-semibold">
                {format(matchDate, 'HH:mm')}
              </div>
            </div>
          )}
          {isScheduled && !matchDate && (
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

          {/* Score / VS */}
          <div className="text-center min-w-[52px]">
            {(isLive || isDone) && match.home_score !== null ? (
              <div className="font-display text-2xl text-white tracking-wide">
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

        {/* Result indicator */}
        {isCorrect !== null && (
          <div className={`text-xl ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {isCorrect ? '✅' : '❌'}
          </div>
        )}
      </div>

      {/* Prediction buttons */}
      <div className="mt-3 pt-3 border-t border-white/8">
        {isScheduled ? (
          <div className="flex gap-2">
            <button
              className={`pred-btn pred-btn-home ${prediction === 'home' ? 'selected' : ''}`}
              onClick={() => onPredict(match.id, 'home')}
              disabled={saving}
            >
              {saving && prediction === 'home' ? '...' : `🏠 ${match.home_team.slice(0, 8)}`}
            </button>
            <button
              className={`pred-btn pred-btn-draw ${prediction === 'draw' ? 'selected' : ''}`}
              onClick={() => onPredict(match.id, 'draw')}
              disabled={saving}
            >
              {saving && prediction === 'draw' ? '...' : '🤝 EMPATE'}
            </button>
            <button
              className={`pred-btn pred-btn-away ${prediction === 'away' ? 'selected' : ''}`}
              onClick={() => onPredict(match.id, 'away')}
              disabled={saving}
            >
              {saving && prediction === 'away' ? '...' : `✈️ ${match.away_team.slice(0, 8)}`}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['home', 'draw', 'away'] as const).map(opt => (
                <div
                  key={opt}
                  className={`pred-btn text-center text-xs px-2 py-1.5 rounded
                    ${prediction === opt
                      ? result === opt
                        ? 'answer-correct'
                        : isDone ? 'answer-wrong' : 'pred-btn-' + opt + ' selected'
                      : 'opacity-30'
                    }
                    ${result === opt && prediction !== opt ? 'opacity-100 answer-correct' : ''}
                  `}
                >
                  {opt === 'home' ? match.home_team.slice(0, 6) : opt === 'away' ? match.away_team.slice(0, 6) : 'EMPATE'}
                  {result === opt && <span className="ml-1">✓</span>}
                </div>
              ))}
            </div>
            {prediction && result && prediction === result && (
              <span className="text-gold-500 font-display text-sm">+{pointsValue} pt</span>
            )}
            {!prediction && isDone && (
              <span className="text-white/30 text-xs">Sin predicción</span>
            )}
          </div>
        )}
      </div>

      {/* Venue */}
      {match.venue && (
        <div className="mt-2 text-white/25 text-[10px] text-right">📍 {match.venue}</div>
      )}
    </div>
  )
}
