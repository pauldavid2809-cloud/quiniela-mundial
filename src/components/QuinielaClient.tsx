'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
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

  // Dynamic lock check: a phase is locked if the current time is past the earliest match start date of that phase.
  const getPhaseLockStatus = (phaseName: string) => {
    const phaseMatchesWithDates = matches
      .filter(m => m.phase === phaseName && m.match_date)
      .map(m => new Date(m.match_date))
      
    if (phaseMatchesWithDates.length === 0) return false // No matches/dates loaded yet, open

    const earliestDate = new Date(Math.min(...phaseMatchesWithDates.map(d => d.getTime())))
    return new Date() >= earliestDate
  }

  const isCurrentPhaseLocked = getPhaseLockStatus(activePhase)

  // Group by day for visual separation
  const groupedByDay = phaseMatches.reduce((acc, m) => {
    if (!m.match_date) return acc
    const dateStr = m.match_date.split('T')[0]
    if (!acc[dateStr]) {
      acc[dateStr] = {
        dateLabel: format(parseISO(m.match_date), "EEEE d 'de' MMMM", { locale: es }),
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
    const isLocked = match.status !== 'scheduled' || getPhaseLockStatus(match.phase)
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
          const isPhaseLocked = getPhaseLockStatus(phase.name)
          // Convenient auto-open: accessible if unlocked manually OR if matches are loaded and phase hasn't started yet
          const isPhaseOpen = phase.is_unlocked || (matchCount > 0 && !isPhaseLocked)

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
      {isCurrentPhaseLocked && (
        <div className="mb-4 p-3 bg-red-950/30 border border-red-500/30 text-red-300 text-sm rounded-lg flex items-center gap-2">
          <span>🔒</span>
          <span>Esta fase se encuentra **CERRADA**. El primer partido de esta fase ya ha comenzado y no se permiten más predicciones.</span>
        </div>
      )}

      {/* Phase locked message */}
      {!(currentPhase?.is_unlocked || (phaseMatches.length > 0 && !isCurrentPhaseLocked)) ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="font-display text-2xl text-white/70 mb-2">FASE BLOQUEADA</h3>
          <p className="text-white/40 max-w-md mx-auto">
            Esta fase se abrirá automáticamente para predicciones tan pronto como se definan y carguen los equipos de sus partidos, y permanecerá abierta hasta que comience el primer encuentro de la misma.
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
                  const isPhaseLocked = getPhaseLockStatus(match.phase)
                  
                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      prediction={pred.prediction}
                      predictedHomeScore={pred.predicted_home_score}
                      predictedAwayScore={pred.predicted_away_score}
                      onPredict={handlePredict}
                      saving={saving === match.id}
                      pointsValue={currentPhase.points_value}
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
