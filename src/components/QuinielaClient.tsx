'use client'

import { useState } from 'react'
import { parseISO } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import MatchCard from './MatchCard'
import BracketView from './BracketView'

interface Phase {
  id: number
  name: string
  display_name: string
  is_unlocked: boolean
  points_value: number
  sort_order: number
}

interface Match {
  id: number
  api_id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  phase: string
  match_date: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'completed'
  group_name: string | null
  venue: string | null
}

interface Prediction {
  id: number
  match_id: number
  prediction: 'home' | 'draw' | 'away'
  predicted_home_score: number | null
  predicted_away_score: number | null
  is_correct: boolean | null
  points_earned: number
}

interface Props {
  phases: Phase[]
  matches: Match[]
  predictions: Prediction[]
  userId: string
}

const isPlaceholderTeam = (team: string): boolean => {
  if (!team) return true
  const name = team.trim()
  if (/^\d/.test(name)) return true
  if (/^[WL]\d+$/i.test(name)) return true
  if (/^(winner|runner|ganador|perdedor|grupo|tbd|por definir|play-off|puesto)/i.test(name)) return true
  return false
}

export default function QuinielaClient({ phases, matches, predictions, userId }: Props) {
  const router = useRouter()
  const [activePhase, setActivePhase] = useState(phases.find(p => p.is_unlocked)?.name || 'groups')
  const [localPredictions, setLocalPredictions] = useState<Record<number, {
    prediction: 'home' | 'draw' | 'away' | null
    predicted_home_score: number | null
    predicted_away_score: number | null
  }>>(
    Object.fromEntries(matches.map(m => {
      const pred = predictions.find(p => p.match_id === m.id)
      return [m.id, {
        prediction: pred?.prediction || null,
        predicted_home_score: pred?.predicted_home_score ?? null,
        predicted_away_score: pred?.predicted_away_score ?? null
      }]
    }))
  )
  const [saving, setSaving] = useState<number | null>(null)
  const supabase = createClient()

  const currentPhase = phases.find(p => p.name === activePhase)
  const phaseMatches = matches.filter(m => m.phase === activePhase)

  // Check if a phase contains placeholder teams (like "2A" or "W73")
  const getPhasePlaceholderStatus = (phaseName: string) => {
    if (phaseName === 'groups') return false
    return matches
      .filter(m => m.phase === phaseName)
      .some(m => isPlaceholderTeam(m.home_team) || isPlaceholderTeam(m.away_team))
  }

  // Dynamic lock check: a phase is locked if the current time is past the earliest match start date of that phase.
  const getPhaseLockStatus = (phaseName: string) => {
    const phaseMatchesWithDates = matches
      .filter(m => m.phase === phaseName && m.match_date)
      .map(m => new Date(m.match_date))
      
    if (phaseMatchesWithDates.length === 0) return false // No matches/dates loaded yet, open

    const earliestDate = new Date(Math.min(...phaseMatchesWithDates.map(d => d.getTime())))
    return new Date() >= earliestDate
  }

  const groupPhaseDeadline = new Date('2026-06-15T14:39:43Z').getTime()

  // Check if a specific match is locked for predictions.
  // Locked if status is 'completed', if the phase is locked in DB, or if current time is 1 hour or more past the match start date/time.
  const isMatchLocked = (m: Match) => {
    // If the phase itself is locked in the database, lock all its matches (except groups and round32 which bypass it)
    const phaseInfo = phases.find(p => p.name === m.phase)
    if (phaseInfo && !phaseInfo.is_unlocked && m.phase !== 'groups' && m.phase !== 'round32') {
      return true
    }

    const currentTime = new Date().getTime()

    // Special deadline rule for Group Phase (1-hour window from now)
    if (m.phase === 'groups') {
      // Lock everything if we are past the 1-hour grace window
      if (currentTime >= groupPhaseDeadline) {
        return true
      }
      // Completed group matches are locked
      if (m.status === 'completed') {
        return true
      }
      // Scheduled group matches are open
      if (m.status === 'scheduled') {
        return false
      }
    }

    // Default rules (for live matches, other phases, or completed matches)
    if (m.status === 'completed' || m.status === 'live') return true
    if (!m.match_date) return false
    const matchTime = new Date(m.match_date).getTime()
    const gracePeriodDuration = 60 * 60 * 1000 // 1 hour grace period
    return currentTime >= matchTime + gracePeriodDuration
  }

  const isCurrentPhaseLocked = getPhaseLockStatus(activePhase)
  const isCurrentPhaseHasPlaceholders = getPhasePlaceholderStatus(activePhase)
  // A phase is open (accessible) if it's groups, manually unlocked, or if matches are loaded and there are no placeholder teams.
  const isCurrentPhaseOpen = activePhase === 'groups' || currentPhase?.is_unlocked || (phaseMatches.length > 0 && !isCurrentPhaseHasPlaceholders)

  // Group by day for visual separation (using Caracas timezone America/Caracas)
  const timeZone = 'America/Caracas'
  const groupedByDay = phaseMatches.reduce((acc, m) => {
    if (!m.match_date) return acc
    const matchDate = parseISO(m.match_date)
    const zonedDate = toZonedTime(matchDate, timeZone)
    const dateStr = formatTz(zonedDate, 'yyyy-MM-dd', { timeZone })
    if (!acc[dateStr]) {
      acc[dateStr] = {
        dateLabel: formatTz(zonedDate, "EEEE d 'de' MMMM", { locale: es, timeZone }),
        matches: []
      }
    }
    acc[dateStr].matches.push(m)
    return acc
  }, {} as Record<string, { dateLabel: string; matches: Match[] }>)

  const sortedDays = Object.entries(groupedByDay).sort((a, b) => a[0].localeCompare(b[0]))

  const handlePredict = async (matchId: number, homeScore: number | null, awayScore: number | null) => {
    const match = matches.find(m => m.id === matchId)
    if (!match) return
    
    // Check if the specific match is locked (including the 1-hour grace period)
    if (isMatchLocked(match)) return

    setSaving(matchId)

    if (homeScore === null || awayScore === null) {
      // Clear prediction if scores are deleted/empty
      setLocalPredictions(prev => ({
        ...prev,
        [matchId]: { prediction: null, predicted_home_score: null, predicted_away_score: null }
      }))
      await supabase
        .from('predictions')
        .delete()
        .eq('user_id', userId)
        .eq('match_id', matchId)
      router.refresh()
      setSaving(null)
      return
    }

    const prediction = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw'

    setLocalPredictions(prev => ({
      ...prev,
      [matchId]: { prediction, predicted_home_score: homeScore, predicted_away_score: awayScore }
    }))

    const { error } = await supabase
      .from('predictions')
      .upsert(
        { 
          user_id: userId, 
          match_id: matchId, 
          prediction,
          predicted_home_score: homeScore,
          predicted_away_score: awayScore
        },
        { onConflict: 'user_id,match_id' }
      )

    if (error) {
      console.error(error)
      alert(`Error al guardar predicción: ${error.message}\n(Asegúrate de haber ejecutado la consulta SQL de alteración de columnas en Supabase)`)
      // revert on error
      const pred = predictions.find(p => p.match_id === matchId)
      setLocalPredictions(prev => ({
        ...prev,
        [matchId]: {
          prediction: pred?.prediction || null,
          predicted_home_score: pred?.predicted_home_score ?? null,
          predicted_away_score: pred?.predicted_away_score ?? null
        }
      }))
    } else {
      router.refresh()
    }
    setSaving(null)
  }

  const phaseMatchCount = (phaseName: string) => matches.filter(m => m.phase === phaseName).length
  const phasePredCount = (phaseName: string) =>
    Object.entries(localPredictions).filter(([matchId, pred]) => {
      const match = matches.find(m => m.id === Number(matchId))
      return match && match.phase === phaseName && pred.predicted_home_score !== null && pred.predicted_away_score !== null
    }).length

  // Compute knockout summary for the tab badge
  const knockoutPhases = ['round32', 'round16', 'quarterfinals', 'semifinals', 'final']
  const knockoutMatches = matches.filter(m => knockoutPhases.includes(m.phase))
  const knockoutPredCount = Object.entries(localPredictions).filter(([matchId, pred]) => {
    const match = matches.find(m => m.id === Number(matchId))
    return match && knockoutPhases.includes(match.phase) && pred.predicted_home_score !== null && pred.predicted_away_score !== null
  }).length
  const hasKnockout = knockoutMatches.length > 0

  // The two simplified tabs
  const simpleTabs = [
    { id: 'groups', label: '⚽ Grupos', predCount: phasePredCount('groups'), matchCount: phaseMatchCount('groups') },
    { id: 'knockout', label: '🏆 Fase Eliminatoria', predCount: knockoutPredCount, matchCount: knockoutMatches.length, disabled: !hasKnockout },
  ]
  const activeTab = knockoutPhases.includes(activePhase) ? 'knockout' : 'groups'

  const handleTabChange = (tabId: string) => {
    if (tabId === 'groups') {
      setActivePhase('groups')
    } else {
      // Pick first available knockout phase
      const firstKnockout = knockoutPhases.find(p => matches.some(m => m.phase === p))
      if (firstKnockout) setActivePhase(firstKnockout)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-4xl text-white tracking-wide">
          <span className="gold-shimmer">QUINIELA</span>
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Predice los marcadores exactos. ¡Acierto del ganador/empate = puntos base de la fase, acierto del marcador exacto = <span className="text-gold-500 font-bold">+2 puntos extra</span>!
        </p>
      </div>

      {/* Simplified 2-tab navigation */}
      <div className="flex gap-0 mb-6 border-b border-white/10">
        {simpleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && handleTabChange(tab.id)}
            className={`phase-tab flex items-center gap-1.5 ${
              activeTab === tab.id ? 'active' : tab.disabled ? 'locked' : ''
            }`}
          >
            {tab.disabled && <span className="text-xs">🔒</span>}
            <span>{tab.label}</span>
            {!tab.disabled && tab.matchCount > 0 && (
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">
                {tab.predCount}/{tab.matchCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Phase lock info banner (groups only) */}
      {activeTab === 'groups' && new Date().getTime() >= groupPhaseDeadline ? (
        <div className="mb-4 p-3 bg-red-950/30 border border-red-500/30 text-red-300 text-sm rounded-lg flex items-center gap-2 animate-fade-in">
          <span>🔒</span>
          <span>La fase de grupos ha cerrado para predicciones. Todos los partidos se encuentran bloqueados.</span>
        </div>
      ) : activeTab === 'groups' && isCurrentPhaseLocked ? (
        <div className="mb-4 p-3 bg-amber-950/30 border border-amber-500/30 text-amber-300 text-sm rounded-lg flex items-center gap-2">
          <span>⏳</span>
          <span>Esta fase se encuentra en curso. Aún puedes registrar o modificar predicciones para partidos que no hayan comenzado o tengan menos de 1 hora de juego.</span>
        </div>
      ) : null}

      {/* KNOCKOUT TAB: bracket view */}
      {activeTab === 'knockout' ? (
        <div className="animate-fade-in">
          {!hasKnockout ? (
            <div className="glass-card p-12 text-center">
              <div className="text-5xl mb-4">⏳</div>
              <h3 className="font-display text-2xl text-white/70 mb-2">SIN PARTIDOS AÚN</h3>
              <p className="text-white/40">Los partidos eliminatorios se agregarán pronto.</p>
            </div>
          ) : (
            <BracketView
              matches={knockoutMatches}
              predictions={localPredictions}
              phases={phases}
              onPredict={handlePredict}
              saving={saving}
            />
          )}
        </div>
      ) : (
        /* GROUPS TAB: day-grouped match cards */
        <>
          {phaseMatches.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="text-5xl mb-4">⏳</div>
              <h3 className="font-display text-2xl text-white/70 mb-2">SIN PARTIDOS AÚN</h3>
              <p className="text-white/40">Los partidos de esta fase se agregarán pronto.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedDays.map(([dateStr, dayData], idx) => (
                <div key={dateStr} className={`animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-display text-xs text-gold-500 uppercase tracking-widest bg-gold-950/20 border border-gold-500/25 px-3 py-1 rounded-full capitalize">
                      📅 {dayData.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-gold-500/20 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dayData.matches.map(match => {
                      const pred = localPredictions[match.id] || {
                        prediction: null,
                        predicted_home_score: null,
                        predicted_away_score: null
                      }
                      const isLocked = isMatchLocked(match)
                      return (
                        <MatchCard
                          key={match.id}
                          match={match}
                          prediction={pred.prediction}
                          predictedHomeScore={pred.predicted_home_score}
                          predictedAwayScore={pred.predicted_away_score}
                          onPredict={handlePredict}
                          saving={saving === match.id}
                          pointsValue={currentPhase?.points_value || 1}
                          isPhaseLocked={isLocked}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

