'use client'

import { useState } from 'react'
import { parseISO } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import MatchCard from './MatchCard'

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

  const isGracePeriodActive = new Date() < new Date('2026-06-12T02:30:00Z')

  const isTemporaryBypassActive = (m: Match) => {
    if (!isGracePeriodActive) return false
    const isMexicoSudafrica = 
      m.api_id === 1 || 
      (m.home_team === 'México' && m.away_team === 'Sudáfrica') ||
      (m.home_team === 'Mexico' && m.away_team === 'South Africa')
    return !isMexicoSudafrica
  }

  const isCurrentPhaseLocked = getPhaseLockStatus(activePhase) && !(activePhase === 'groups' && isGracePeriodActive)
  const isCurrentPhaseHasPlaceholders = getPhasePlaceholderStatus(activePhase)
  const isCurrentPhaseOpen = activePhase === 'groups' || currentPhase?.is_unlocked || (phaseMatches.length > 0 && !isCurrentPhaseLocked && !isCurrentPhaseHasPlaceholders)

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
    
    // Check dynamic lock status for this match's phase
    const isLocked = (match.status !== 'scheduled' || getPhaseLockStatus(match.phase)) && !isTemporaryBypassActive(match)
    if (isLocked) return

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

      {/* Phase tabs */}
      <div className="flex gap-0 overflow-x-auto mb-6 border-b border-white/10 pb-0 scrollbar-hide">
        {phases.map(phase => {
          const predCount = phasePredCount(phase.name)
          const matchCount = phaseMatchCount(phase.name)
          const isPhaseLocked = getPhaseLockStatus(phase.name) && !(phase.name === 'groups' && isGracePeriodActive)
          const hasPlaceholders = getPhasePlaceholderStatus(phase.name)
          // Convenient auto-open: accessible if Groups, manually unlocked, or matches loaded, no lock, and no placeholders
          const isPhaseOpen = phase.name === 'groups' || phase.is_unlocked || (matchCount > 0 && !isPhaseLocked && !hasPlaceholders)

          return (
            <button
              key={phase.name}
              onClick={() => isPhaseOpen && setActivePhase(phase.name)}
              className={`phase-tab flex items-center gap-1.5 ${
                activePhase === phase.name ? 'active' : isPhaseOpen ? '' : 'locked'
              }`}
            >
              {isPhaseLocked ? (
                <span className="text-xs" title="Fase cerrada (partido en curso/terminado)">🔒</span>
              ) : !isPhaseOpen ? (
                <span className="text-xs" title="Esperando confirmación de clasificados">🔒</span>
              ) : null}
              <span>{phase.display_name}</span>
              {isPhaseOpen && matchCount > 0 && (
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">
                  {predCount}/{matchCount}
                </span>
              )}
              <span className="text-[10px] text-gold-500/60 ml-0.5">+{phase.points_value}pt</span>
            </button>
          )
        })}
      </div>

      {/* Phase lock info banner */}
      {isGracePeriodActive && activePhase === 'groups' ? (
        <div className="mb-4 p-3 bg-amber-950/30 border border-amber-500/30 text-amber-300 text-sm rounded-lg flex items-center gap-2 animate-pulse">
          <span>🔓</span>
          <span><strong>Periodo de gracia activo</strong>: Puedes registrar o modificar tus predicciones para todos los partidos de esta fase (excepto México vs Sudáfrica) durante la próxima hora.</span>
        </div>
      ) : isCurrentPhaseLocked ? (
        <div className="mb-4 p-3 bg-red-950/30 border border-red-500/30 text-red-300 text-sm rounded-lg flex items-center gap-2">
          <span>🔒</span>
          <span>Esta fase se encuentra **CERRADA**. El primer partido de esta fase ya ha comenzado y no se permiten más predicciones.</span>
        </div>
      ) : null}

      {/* Phase locked message */}
      {!isCurrentPhaseOpen ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="font-display text-2xl text-white/70 mb-2">FASE BLOQUEADA</h3>
          <p className="text-white/40 max-w-md mx-auto">
            Esta fase se encuentra bloqueada. Se abrirá automáticamente para predicciones una vez que se definan y confirmen todos los equipos participantes de sus partidos.
          </p>
        </div>
      ) : phaseMatches.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h3 className="font-display text-2xl text-white/70 mb-2">SIN PARTIDOS AÚN</h3>
          <p className="text-white/40">
            Los partidos de esta fase se agregarán pronto.
          </p>
        </div>
      ) : (
        // Render matches grouped by day
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
                  const isPhaseLocked = getPhaseLockStatus(match.phase) && !isTemporaryBypassActive(match)
                  
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
                      isPhaseLocked={isPhaseLocked}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
