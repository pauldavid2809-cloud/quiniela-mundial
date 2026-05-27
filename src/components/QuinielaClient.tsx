'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const [activePhase, setActivePhase] = useState(phases.find(p => p.is_unlocked)?.name || 'groups')
  const [localPredictions, setLocalPredictions] = useState<Record<number, 'home' | 'draw' | 'away'>>(
    Object.fromEntries(predictions.map(p => [p.match_id, p.prediction]))
  )
  const [saving, setSaving] = useState<number | null>(null)
  const supabase = createClient()

  const currentPhase = phases.find(p => p.name === activePhase)
  const phaseMatches = matches.filter(m => m.phase === activePhase)

  // Group by group_name for group stage
  const grouped = activePhase === 'groups'
    ? phaseMatches.reduce((acc, m) => {
        const key = m.group_name || 'Sin grupo'
        if (!acc[key]) acc[key] = []
        acc[key].push(m)
        return acc
      }, {} as Record<string, Match[]>)
    : null

  const handlePredict = async (matchId: number, prediction: 'home' | 'draw' | 'away') => {
    const match = matches.find(m => m.id === matchId)
    if (!match || match.status !== 'scheduled') return

    setSaving(matchId)
    setLocalPredictions(prev => ({ ...prev, [matchId]: prediction }))

    const { error } = await supabase
      .from('predictions')
      .upsert(
        { user_id: userId, match_id: matchId, prediction },
        { onConflict: 'user_id,match_id' }
      )

    if (error) {
      console.error(error)
      // revert on error
      setLocalPredictions(prev => {
        const copy = { ...prev }
        delete copy[matchId]
        return copy
      })
    }
    setSaving(null)
  }

  const phaseMatchCount = (phaseName: string) => matches.filter(m => m.phase === phaseName).length
  const phasePredCount = (phaseName: string) =>
    predictions.filter(p => matches.find(m => m.id === p.match_id && m.phase === phaseName)).length

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-4xl text-white tracking-wide">
          <span className="gold-shimmer">QUINIELA</span>
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Predice los resultados y acumula puntos. ¡Que gane el mejor!
        </p>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-0 overflow-x-auto mb-6 border-b border-white/10 pb-0 scrollbar-hide">
        {phases.map(phase => {
          const predCount = phasePredCount(phase.name)
          const matchCount = phaseMatchCount(phase.name)

          return (
            <button
              key={phase.name}
              onClick={() => phase.is_unlocked && setActivePhase(phase.name)}
              className={`phase-tab flex items-center gap-1.5 ${
                activePhase === phase.name ? 'active' : phase.is_unlocked ? '' : 'locked'
              }`}
            >
              {!phase.is_unlocked && <span className="text-xs">🔒</span>}
              <span>{phase.display_name}</span>
              {phase.is_unlocked && matchCount > 0 && (
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">
                  {predCount}/{matchCount}
                </span>
              )}
              <span className="text-[10px] text-gold-500/60 ml-0.5">+{phase.points_value}pt</span>
            </button>
          )
        })}
      </div>

      {/* Phase locked message */}
      {!currentPhase?.is_unlocked ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="font-display text-2xl text-white/70 mb-2">FASE BLOQUEADA</h3>
          <p className="text-white/40">
            Esta fase se desbloqueará cuando se confirmen todos los equipos participantes.
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
      ) : activePhase === 'groups' && grouped ? (
        // Group stage - organized by group
        <div className="space-y-6">
          {Object.entries(grouped).sort().map(([groupName, groupMatches], idx) => (
            <div key={groupName} className={`animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gradient-to-r from-gold-500/30 to-transparent" />
                <span className="font-display text-lg text-gold-500 tracking-widest px-3">
                  {groupName}
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-gold-500/30 to-transparent" />
              </div>
              <div className="space-y-3">
                {groupMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={localPredictions[match.id]}
                    onPredict={handlePredict}
                    saving={saving === match.id}
                    pointsValue={currentPhase.points_value}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Knockout stage
        <div className="space-y-3">
          {phaseMatches.map((match, idx) => (
            <div key={match.id} className={`animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
              <MatchCard
                match={match}
                prediction={localPredictions[match.id]}
                onPredict={handlePredict}
                saving={saving === match.id}
                pointsValue={currentPhase.points_value}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
