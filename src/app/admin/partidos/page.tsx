'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Match {
  id: number
  home_team: string
  away_team: string
  phase: string
  match_date: string
  home_score: number | null
  away_score: number | null
  status: string
  group_name: string | null
}

export default function AdminPartidosPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingResults, setSyncingResults] = useState(false)
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState('all')

  const loadMatches = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true })
      .limit(200)
    setMatches(data || [])
    setLoading(false)
  }

  useEffect(() => { loadMatches() }, [])

  const syncAllMatches = async () => {
    setSyncing(true)
    setMsg('')
    try {
      const res = await fetch('/api/sync-matches', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` }
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✅ ${data.message}`)
        loadMatches()
      } else {
        setMsg('❌ Error: ' + data.error)
      }
    } catch {
      setMsg('❌ Error de conexión')
    }
    setSyncing(false)
  }

  const syncResults = async () => {
    setSyncingResults(true)
    setMsg('')
    try {
      const res = await fetch('/api/update-results', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✅ ${data.message}`)
        loadMatches()
      } else {
        setMsg('❌ Error: ' + data.error)
      }
    } catch {
      setMsg('❌ Error de conexión')
    }
    setSyncingResults(false)
  }

  const phases = ['all', 'groups', 'round32', 'round16', 'quarterfinals', 'semifinals', 'final']
  const phaseLabels: Record<string, string> = {
    all: 'Todos',
    groups: 'Grupos',
    round32: '32avos',
    round16: 'Octavos',
    quarterfinals: 'Cuartos',
    semifinals: 'Semis',
    final: 'Final',
  }

  const filtered = filter === 'all' ? matches : matches.filter(m => m.phase === filter)

  const statusLabel = (status: string) => {
    if (status === 'live') return <span className="badge badge-live">EN VIVO</span>
    if (status === 'completed') return <span className="badge badge-done">FIN</span>
    return <span className="badge badge-soon">PRÓXIMO</span>
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl text-white tracking-wide">⚽ GESTIÓN DE PARTIDOS</h1>
        <p className="text-white/50 text-sm mt-1">Sincroniza partidos y resultados con la API de fútbol</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm animate-fade-in ${
          msg.startsWith('✅') ? 'bg-green-900/30 border border-green-500/30 text-green-300'
            : 'bg-red-900/30 border border-red-500/30 text-red-300'
        }`}>
          {msg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={syncAllMatches}
          disabled={syncing}
          className="btn-gold flex items-center gap-2 text-sm px-4 py-2"
        >
          {syncing ? (
            <><span className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" /> Cargando partidos...</>
          ) : '📥 Importar todos los partidos'}
        </button>

        <button
          onClick={syncResults}
          disabled={syncingResults}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          {syncingResults ? (
            <><span className="w-4 h-4 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /> Actualizando...</>
          ) : '🔄 Actualizar resultados recientes'}
        </button>
      </div>

      <div className="text-white/40 text-xs">
        💡 "Importar" carga todos los 104 partidos del mundial desde la API. 
        "Actualizar resultados" solo sincroniza los partidos recientes y en vivo (úsalo diariamente).
      </div>

      {/* Phase filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {phases.map(p => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === p
                ? 'bg-gold-500/20 border border-gold-500/40 text-gold-500'
                : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80'
            }`}
          >
            {phaseLabels[p]} {p !== 'all' && `(${matches.filter(m => m.phase === p).length})`}
          </button>
        ))}
      </div>

      {/* Matches list */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <span className="font-display text-lg text-white">{filtered.length} partidos</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/40">Cargando partidos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">⚽</div>
            <p className="text-white/40">No hay partidos cargados aún.</p>
            <p className="text-white/30 text-sm mt-1">Usa el botón "Importar todos los partidos" arriba.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {filtered.map(match => (
              <div key={match.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3">
                <div className="min-w-[60px]">{statusLabel(match.status)}</div>
                <div className="flex-1 text-sm">
                  <span className="text-white font-semibold">{match.home_team}</span>
                  <span className="text-white/40 mx-2">
                    {match.status === 'completed' || match.status === 'live'
                      ? `${match.home_score ?? '?'} - ${match.away_score ?? '?'}`
                      : 'vs'}
                  </span>
                  <span className="text-white font-semibold">{match.away_team}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white/40 text-xs">{match.group_name || phaseLabels[match.phase]}</div>
                  {match.match_date && (
                    <div className="text-white/30 text-xs">
                      {new Date(match.match_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
