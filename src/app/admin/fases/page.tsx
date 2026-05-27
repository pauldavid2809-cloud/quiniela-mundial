'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Phase {
  id: number
  name: string
  display_name: string
  is_unlocked: boolean
  points_value: number
  sort_order: number
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  groups: 'Siempre desbloqueada. Los 104 partidos de la fase de grupos.',
  round32: 'Desbloquear cuando se confirmen los 32 equipos clasificados.',
  round16: 'Desbloquear cuando se confirmen los 16 clasificados de 32avos.',
  quarterfinals: 'Desbloquear cuando se confirmen los 8 clasificados de octavos.',
  semifinals: 'Desbloquear cuando se confirmen los 4 semifinalistas.',
  final: 'Desbloquear cuando se confirmen los 2 finalistas.',
}

export default function AdminFasesPage() {
  const supabase = createClient()
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  const loadPhases = async () => {
    const { data } = await supabase.from('phases').select('*').order('sort_order')
    setPhases(data || [])
    setLoading(false)
  }

  useEffect(() => { loadPhases() }, [])

  const togglePhase = async (phase: Phase) => {
    if (phase.name === 'groups') return // always unlocked
    setToggling(phase.id)
    setMsg('')

    const { error } = await supabase
      .from('phases')
      .update({ is_unlocked: !phase.is_unlocked })
      .eq('id', phase.id)

    if (error) {
      setMsg('❌ Error al actualizar la fase')
    } else {
      setMsg(`✅ Fase "${phase.display_name}" ${!phase.is_unlocked ? 'desbloqueada' : 'bloqueada'}`)
      loadPhases()
    }
    setToggling(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl text-white tracking-wide">🔓 GESTIÓN DE FASES</h1>
        <p className="text-white/50 text-sm mt-1">
          Desbloquea cada fase cuando se conozcan los equipos clasificados
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm animate-fade-in ${
          msg.startsWith('✅') ? 'bg-green-900/30 border border-green-500/30 text-green-300'
            : 'bg-red-900/30 border border-red-500/30 text-red-300'
        }`}>
          {msg}
        </div>
      )}

      {/* Warning */}
      <div className="glass-card p-4 border-yellow-500/20 bg-yellow-500/5">
        <div className="flex gap-3">
          <span className="text-2xl shrink-0">⚠️</span>
          <div>
            <p className="text-yellow-300 font-semibold text-sm">Importante</p>
            <p className="text-yellow-300/70 text-xs mt-1">
              Al desbloquear una fase, los usuarios podrán hacer sus predicciones para esos partidos.
              Solo desbloquea cuando ya esten cargados los partidos de esa fase en la base de datos.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-8">Cargando fases...</div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, index) => (
            <div
              key={phase.id}
              className={`glass-card p-5 transition-all ${
                phase.is_unlocked ? 'border-green-500/30' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Step indicator */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-lg shrink-0 ${
                  phase.is_unlocked
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                    : 'bg-white/5 text-white/30 border border-white/10'
                }`}>
                  {phase.is_unlocked ? '✓' : index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="font-display text-xl text-white tracking-wide">{phase.display_name}</h3>
                    <span className={`badge ${phase.is_unlocked ? 'badge-done' : 'badge-soon'}`}>
                      {phase.is_unlocked ? '✅ Desbloqueada' : '🔒 Bloqueada'}
                    </span>
                    <span className="badge" style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)', color: '#FFD700' }}>
                      +{phase.points_value} pt por acierto
                    </span>
                  </div>
                  <p className="text-white/45 text-sm">
                    {PHASE_DESCRIPTIONS[phase.name]}
                  </p>
                </div>

                <div className="shrink-0">
                  {phase.name === 'groups' ? (
                    <span className="text-white/30 text-xs px-3 py-2 rounded-lg border border-white/10">
                      Siempre activa
                    </span>
                  ) : (
                    <button
                      onClick={() => togglePhase(phase)}
                      disabled={toggling === phase.id}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        phase.is_unlocked
                          ? 'bg-red-900/30 border-red-500/30 text-red-300 hover:bg-red-900/50'
                          : 'bg-green-900/30 border-green-500/30 text-green-300 hover:bg-green-900/50'
                      }`}
                    >
                      {toggling === phase.id ? '...' : phase.is_unlocked ? '🔒 Bloquear' : '🔓 Desbloquear'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
