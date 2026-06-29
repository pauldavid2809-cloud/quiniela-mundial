'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseISO } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import { es } from 'date-fns/locale'

interface Phase {
  id: number
  name: string
  display_name: string
  is_unlocked: boolean
  points_value: number
  sort_order: number
}

interface Profile {
  id: string
  username: string
  display_name: string | null
  total_points: number
}

interface Match {
  id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  phase: string
  match_date: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'completed'
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
  ranking: Profile[]
  currentUser: any
  userRank: number
  userProfile: Profile | null
  initialMatches: Match[]
  initialUserPredictions: Prediction[]
}

function TeamFlag({ url, name }: { url: string; name: string }) {
  if (url && (url.startsWith('http') || url.startsWith('/') || url.includes('.'))) {
    return (
      <img
        src={url}
        alt={name}
        className="w-5 h-5 object-contain rounded"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return (
    <span className="text-lg select-none leading-none shrink-0" title={name}>
      {url || '🏳️'}
    </span>
  )
}

export default function RankingClient({
  phases,
  ranking,
  currentUser,
  userRank,
  userProfile,
  initialMatches,
  initialUserPredictions
}: Props) {
  const supabase = createClient()
  
  // State for H2H Modal
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null)
  const [comparedPredictions, setComparedPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [filterMatchMode, setFilterMatchMode] = useState<'all' | 'differences' | 'coincidences'>('all')

  const medals = ['🥇', '🥈', '🥉']
  const podiumStyles = [
    {
      bg: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.03))',
      border: 'border-amber-500/40',
      rankBg: 'bg-amber-500 text-navy-950',
      trophyColor: 'text-amber-400',
      badge: 'CAMPEÓN',
      order: 'order-1 sm:order-2 scale-105 sm:scale-110 z-10'
    },
    {
      bg: 'linear-gradient(135deg, rgba(192,192,192,0.15), rgba(192,192,192,0.03))',
      border: 'border-slate-400/35',
      rankBg: 'bg-slate-400 text-navy-950',
      trophyColor: 'text-slate-400',
      badge: 'SUBCAMPEÓN',
      order: 'order-2 sm:order-1'
    },
    {
      bg: 'linear-gradient(135deg, rgba(205,127,50,0.15), rgba(205,127,50,0.03))',
      border: 'border-amber-700/35',
      rankBg: 'bg-amber-700 text-white',
      trophyColor: 'text-amber-600',
      badge: '3ER LUGAR',
      order: 'order-3'
    }
  ]

  const top3 = ranking ? ranking.slice(0, 3) : []
  const restOfRanking = ranking ? ranking.slice(3) : []

  // Reorder top 3 visually for sm+ screens: 2nd place, 1st place, 3rd place
  const visualTop3 = []
  if (top3[1]) visualTop3.push({ player: top3[1], index: 1, config: podiumStyles[1] })
  if (top3[0]) visualTop3.push({ player: top3[0], index: 0, config: podiumStyles[0] })
  if (top3[2]) visualTop3.push({ player: top3[2], index: 2, config: podiumStyles[2] })

  // Lock checking logic
  const groupPhaseDeadline = new Date('2026-06-15T14:39:43Z').getTime()
  
  const isMatchLocked = (m: Match) => {
    const phaseInfo = phases.find(p => p.name === m.phase)
    if (phaseInfo && !phaseInfo.is_unlocked && m.phase !== 'groups') {
      return true
    }

    const currentTime = new Date().getTime()
    if (m.phase === 'groups') {
      if (currentTime >= groupPhaseDeadline) return true
      if (m.status === 'completed') return true
      if (m.status === 'scheduled') return false
    }

    if (m.status === 'completed') return true
    if (!m.match_date) return false
    const matchTime = new Date(m.match_date).getTime()
    const gracePeriodDuration = 60 * 60 * 1000 // 1 hour grace period
    return currentTime >= matchTime + gracePeriodDuration
  }

  // Load predictions for target user when selected
  useEffect(() => {
    if (!selectedPlayer) return

    const loadPlayerPredictions = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', selectedPlayer.id)
        
        if (error) throw error
        setComparedPredictions(data || [])
      } catch (err) {
        console.error('Error fetching player predictions:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPlayerPredictions()
  }, [selectedPlayer])

  // Process data for side-by-side comparison
  const getComparisonStats = () => {
    if (!selectedPlayer || !userProfile) return null

    // Prediction points count
    const pPointsA = initialUserPredictions.reduce((acc, p) => acc + (p.points_earned || 0), 0)
    const pPointsB = comparedPredictions.reduce((acc, p) => acc + (p.points_earned || 0), 0)

    // Trivia points count
    const tPointsA = Math.max(0, userProfile.total_points - pPointsA)
    const tPointsB = Math.max(0, selectedPlayer.total_points - pPointsB)

    // Match counts
    let coincidences = 0
    let differences = 0
    let correctExactA = 0
    let correctExactB = 0

    initialMatches.forEach(match => {
      const predA = initialUserPredictions.find(p => p.match_id === match.id)
      const predB = comparedPredictions.find(p => p.match_id === match.id)
      
      const isLocked = isMatchLocked(match)

      if (isLocked) {
        const outcomeA = predA ? predA.prediction : null
        const outcomeB = predB ? predB.prediction : null

        if (outcomeA && outcomeB) {
          if (outcomeA === outcomeB) {
            coincidences++
          } else {
            differences++
          }
        } else if (outcomeA || outcomeB) {
          differences++
        }

        // Exact match correct count
        if (match.status === 'completed' && match.home_score !== null && match.away_score !== null) {
          if (predA && predA.predicted_home_score === match.home_score && predA.predicted_away_score === match.away_score) {
            correctExactA++
          }
          if (predB && predB.predicted_home_score === match.home_score && predB.predicted_away_score === match.away_score) {
            correctExactB++
          }
        }
      }
    })

    return {
      pPointsA,
      pPointsB,
      tPointsA,
      tPointsB,
      coincidences,
      differences,
      correctExactA,
      correctExactB
    }
  }

  const stats = getComparisonStats()

  // Filter comparison matches
  const comparedMatchesList = initialMatches.map(match => {
    const predA = initialUserPredictions.find(p => p.match_id === match.id)
    const predB = comparedPredictions.find(p => p.match_id === match.id)
    const isLocked = isMatchLocked(match)
    
    let comparisonType: 'coincidence' | 'difference' | 'incomplete' = 'incomplete'
    if (isLocked) {
      if (predA?.prediction === predB?.prediction && (predA || predB)) {
        comparisonType = 'coincidence'
      } else {
        comparisonType = 'difference'
      }
    }

    return {
      match,
      predA,
      predB,
      isLocked,
      comparisonType
    }
  }).filter(item => {
    if (filterMatchMode === 'all') return true
    if (filterMatchMode === 'differences') return item.comparisonType === 'difference'
    if (filterMatchMode === 'coincidences') return item.comparisonType === 'coincidence'
    return true
  }).sort((a, b) => {
    if (!a.match.match_date) return 1
    if (!b.match.match_date) return -1
    return new Date(b.match.match_date).getTime() - new Date(a.match.match_date).getTime()
  })

  return (
    <div className="animate-fade-in space-y-6">
      {/* User position card */}
      {userRank >= 1 && userProfile && (
        <button
          onClick={() => setSelectedPlayer(userProfile)}
          className="w-full text-left glass-card p-4 border-gold-500/30 hover:border-gold-500/50 hover:bg-gold-500/5 transition-all group flex items-center gap-4"
          style={{ borderColor: 'rgba(255,215,0,0.3)' }}
        >
          <div className="font-display text-4xl text-gold-500">#{userRank}</div>
          <div>
            <div className="text-white/60 text-xs uppercase tracking-wide">Tu posición</div>
            <div className="text-white font-semibold flex items-center gap-1.5">
              {userProfile.display_name || userProfile.username}
              <span className="text-[10px] text-gold-500 border border-gold-500/30 px-1.5 py-0.2 rounded-full opacity-60 group-hover:opacity-100 transition-opacity">Ver perfil</span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-display text-3xl text-gold-500">{userProfile.total_points}</div>
            <div className="text-white/40 text-xs">puntos</div>
          </div>
        </button>
      )}

      {/* Podium Cards for Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 items-end pt-4 pb-2">
          {visualTop3.map(({ player, index, config }) => (
            <button
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              className={`glass-card p-5 relative flex flex-col items-center text-center border transition-all hover:translate-y-[-6px] hover:shadow-lg hover:shadow-white/5 w-full cursor-pointer ${config.border} ${config.order}`}
              style={{ background: config.bg }}
            >
              {/* Badge */}
              <span className={`text-[9px] font-bold tracking-widest px-2.5 py-0.5 rounded-full mb-3 bg-white/5 border border-white/10 ${config.trophyColor}`}>
                {config.badge}
              </span>

              {/* Avatar representation with trophy */}
              <div className="relative mb-3">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl font-bold border-2 ${config.border} bg-navy-950 text-white`}>
                  {(player.display_name || player.username || '?')[0].toUpperCase()}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow ${config.rankBg}`}>
                  {index + 1}
                </div>
              </div>

              {/* Player names */}
              <h3 className="font-semibold text-white text-sm truncate max-w-full leading-snug">
                {player.display_name || player.username}
              </h3>
              <p className="text-white/40 text-[10px] truncate max-w-full mb-3">
                @{player.username}
              </p>

              {/* Score */}
              <div className="border-t border-white/5 w-full pt-3 mt-1">
                <div className={`font-display text-3xl font-bold ${config.trophyColor}`}>
                  {player.total_points}
                </div>
                <div className="text-[10px] text-white/35 uppercase tracking-wide">puntos</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Ranking table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/3">
          <h2 className="font-display text-xl text-white tracking-wide">TABLA DE POSICIONES</h2>
          <span className="text-[10px] text-white/40 uppercase tracking-widest">Haga clic en un jugador</span>
        </div>

        {!ranking || ranking.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            <div className="text-4xl mb-3">📊</div>
            <p>Aún no hay puntuaciones. ¡Haz tus predicciones!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {ranking.map((player, index) => {
              const isCurrentUser = player.id === currentUser?.id
              const isTop3 = index < 3

              return (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className={`w-full text-left flex items-center gap-4 px-4 py-3.5 transition-colors cursor-pointer group ${
                    isCurrentUser ? 'bg-gold-500/8 hover:bg-gold-500/12' : 'hover:bg-white/3'
                  }`}
                >
                  {/* Position */}
                  <div className="w-10 text-center shrink-0">
                    {isTop3 ? (
                      <span className="text-xl">{medals[index]}</span>
                    ) : (
                      <span className={`font-display text-lg ${isCurrentUser ? 'text-gold-500' : 'text-white/40'}`}>
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{
                      background: isTop3
                        ? index === 0 ? 'linear-gradient(135deg, #FFD700, #E6A800)'
                        : index === 1 ? 'linear-gradient(135deg, #C0C0C0, #A0A0A0)'
                        : 'linear-gradient(135deg, #CD7F32, #A0522D)'
                        : 'rgba(255,255,255,0.1)',
                      color: isTop3 ? '#020817' : '#fff',
                    }}
                  >
                    {(player.display_name || player.username || '?')[0].toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate flex items-center gap-1.5 ${isCurrentUser ? 'text-gold-500' : 'text-white'}`}>
                      {player.display_name || player.username}
                      {isCurrentUser && <span className="text-[10px] bg-gold-500/10 text-gold-500 px-1.5 py-0.2 rounded font-normal">Tú</span>}
                    </div>
                    <div className="text-white/35 text-xs">@{player.username}</div>
                  </div>

                  {/* Compare action badge (hidden by default, shown on hover) */}
                  <div className="hidden sm:block opacity-0 group-hover:opacity-100 text-xs text-gold-500 bg-gold-950/20 border border-gold-500/30 px-2 py-0.5 rounded transition-all">
                    ⚔️ Comparar
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <div className={`font-display text-2xl ${isTop3 ? 'text-gold-500' : isCurrentUser ? 'text-gold-400' : 'text-white'}`}>
                      {player.total_points}
                    </div>
                    <div className="text-white/30 text-xs">pts</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Points legend */}
      <div className="mt-6 glass-card p-5">
        <h3 className="font-display text-lg text-white/70 mb-4 tracking-wide">SISTEMA DE PUNTUACIÓN</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {[
            { label: 'Grupos', pts: 1 },
            { label: '32avos', pts: 2 },
            { label: 'Octavos', pts: 3 },
            { label: 'Cuartos', pts: 4 },
            { label: 'Semifinales', pts: 5 },
            { label: 'Gran Final', pts: 6 },
          ].map(item => (
            <div key={item.label} className="text-center bg-white/5 border border-white/5 rounded-xl p-2.5">
              <div className="font-display text-2xl text-gold-500 font-bold">{item.pts}</div>
              <div className="text-white/50 text-[10px] uppercase tracking-wide mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl p-3">
            <span className="text-2xl">🧠</span>
            <div>
              <div className="font-display text-lg text-gold-500 font-bold leading-none">1 PUNTO</div>
              <div className="text-white/50 text-xs mt-1">Por responder correctamente la pregunta de trivia diaria.</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl p-3">
            <span className="text-2xl">🎯</span>
            <div>
              <div className="font-display text-lg text-amber-500 font-bold leading-none">+2 PUNTOS BONUS</div>
              <div className="text-white/50 text-xs mt-1">Por acertar el marcador exacto del partido en la quiniela.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Head-to-Head Modal */}
      {selectedPlayer && userProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card w-full max-w-4xl max-h-[85vh] flex flex-col border border-white/10 overflow-hidden shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/3">
              <div>
                <h3 className="font-display text-2xl text-white tracking-wide flex items-center gap-2">
                  <span>⚔️ CARA A CARA</span>
                </h3>
                <p className="text-white/50 text-xs mt-0.5">
                  Comparando tus predicciones contra @{selectedPlayer.username}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPlayer(null)
                  setComparedPredictions([])
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* Profile comparison header card */}
              <div className="grid grid-cols-3 items-center gap-2 sm:gap-4 bg-gradient-to-b from-white/5 to-transparent p-4 rounded-xl border border-white/5">
                {/* User A (You) */}
                <div className="text-center">
                  <div className="w-12 h-12 sm:w-16 h-16 rounded-full bg-gold-500 text-navy-950 mx-auto flex items-center justify-center font-display text-xl sm:text-2xl font-bold mb-2">
                    {(userProfile.display_name || userProfile.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="font-semibold text-white text-xs sm:text-sm truncate">
                    {userProfile.display_name || userProfile.username}
                  </div>
                  <div className="text-gold-500/60 text-[10px] uppercase tracking-wider">Tú</div>
                </div>

                {/* VS Badge with score */}
                <div className="text-center">
                  <div className="text-white/30 font-display text-sm uppercase tracking-widest mb-1">PUNTAJE</div>
                  <div className="flex items-center justify-center gap-1.5 sm:gap-3 font-display text-2xl sm:text-4xl font-bold">
                    <span className="text-gold-500">{userProfile.total_points}</span>
                    <span className="text-white/20 text-lg sm:text-2xl">:</span>
                    <span className="text-amber-500">{selectedPlayer.total_points}</span>
                  </div>
                  <div className="text-white/30 text-[9px] uppercase mt-1">
                    {userProfile.total_points > selectedPlayer.total_points ? 'Vas ganando' : userProfile.total_points < selectedPlayer.total_points ? 'Vas perdiendo' : 'Empate'}
                  </div>
                </div>

                {/* User B (Target) */}
                <div className="text-center">
                  <div className="w-12 h-12 sm:w-16 h-16 rounded-full bg-amber-600 text-white mx-auto flex items-center justify-center font-display text-xl sm:text-2xl font-bold mb-2">
                    {(selectedPlayer.display_name || selectedPlayer.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="font-semibold text-white text-xs sm:text-sm truncate">
                    {selectedPlayer.display_name || selectedPlayer.username}
                  </div>
                  <div className="text-amber-500/60 text-[10px] uppercase tracking-wider">@{selectedPlayer.username}</div>
                </div>
              </div>

              {/* Loader */}
              {loading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-white/40 text-sm">Cargando predicciones de @{selectedPlayer.username}...</p>
                </div>
              ) : stats ? (
                <>
                  {/* Detailed Stat Bars */}
                  <div className="space-y-4">
                    <h4 className="font-display text-xs text-white/50 uppercase tracking-widest">DESGLOSE DE PUNTOS</h4>
                    
                    {/* Stat Row: Quiniela Points */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gold-400">{stats.pPointsA} pts</span>
                        <span className="text-white/60">Puntos de Quiniela</span>
                        <span className="text-amber-400">{stats.pPointsB} pts</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-gold-500 h-full transition-all" 
                          style={{ width: `${(stats.pPointsA || stats.pPointsB) ? (stats.pPointsA / (stats.pPointsA + stats.pPointsB || 1)) * 100 : 50}%` }}
                        />
                        <div 
                          className="bg-amber-600 h-full transition-all" 
                          style={{ width: `${(stats.pPointsA || stats.pPointsB) ? (stats.pPointsB / (stats.pPointsA + stats.pPointsB || 1)) * 100 : 50}%` }}
                        />
                      </div>
                    </div>

                    {/* Stat Row: Trivia Points */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gold-400">{stats.tPointsA} pts</span>
                        <span className="text-white/60">Puntos de Trivia</span>
                        <span className="text-amber-400">{stats.tPointsB} pts</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-gold-500 h-full transition-all" 
                          style={{ width: `${(stats.tPointsA || stats.tPointsB) ? (stats.tPointsA / (stats.tPointsA + stats.tPointsB || 1)) * 100 : 50}%` }}
                        />
                        <div 
                          className="bg-amber-600 h-full transition-all" 
                          style={{ width: `${(stats.tPointsA || stats.tPointsB) ? (stats.tPointsB / (stats.tPointsA + stats.tPointsB || 1)) * 100 : 50}%` }}
                        />
                      </div>
                    </div>

                    {/* Stat Row: Exact Scores Corrected */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gold-400">{stats.correctExactA} aciertos</span>
                        <span className="text-white/60">Marcadores Exactos</span>
                        <span className="text-amber-400">{stats.correctExactB} aciertos</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-gold-500 h-full transition-all" 
                          style={{ width: `${(stats.correctExactA || stats.correctExactB) ? (stats.correctExactA / (stats.correctExactA + stats.correctExactB || 1)) * 100 : 50}%` }}
                        />
                        <div 
                          className="bg-amber-600 h-full transition-all" 
                          style={{ width: `${(stats.correctExactB || stats.correctExactA) ? (stats.correctExactB / (stats.correctExactA + stats.correctExactB || 1)) * 100 : 50}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Coincidence counters */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">🤝</div>
                      <div className="font-display text-2xl font-bold text-emerald-400">{stats.coincidences}</div>
                      <div className="text-[10px] text-emerald-400/60 uppercase font-semibold tracking-wider">Pronósticos Idénticos</div>
                    </div>
                    <div className="bg-orange-950/20 border border-orange-500/20 rounded-xl p-3 text-center">
                      <div className="text-2xl mb-1">⚔️</div>
                      <div className="font-display text-2xl font-bold text-orange-400">{stats.differences}</div>
                      <div className="text-[10px] text-orange-400/60 uppercase font-semibold tracking-wider">Pronósticos Diferentes</div>
                    </div>
                  </div>

                  {/* Match-by-match comparison list */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <h4 className="font-display text-xs text-white/50 uppercase tracking-widest">COMPARACIÓN DE PARTIDOS</h4>
                      
                      {/* Filter modes */}
                      <div className="flex gap-1 bg-black/20 p-0.5 rounded-lg border border-white/5 self-start">
                        {(['all', 'differences', 'coincidences'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setFilterMatchMode(mode)}
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                              filterMatchMode === mode ? 'bg-gold-500 text-navy-950' : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {mode === 'all' ? 'Todos' : mode === 'differences' ? 'Diferencias' : 'Coincidencias'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 divide-y divide-white/5 max-h-[40vh] overflow-y-auto pr-1">
                      {comparedMatchesList.length === 0 ? (
                        <p className="text-center text-white/30 text-xs py-8">No hay partidos que coincidan con el filtro.</p>
                      ) : (
                        comparedMatchesList.map(({ match, predA, predB, isLocked, comparisonType }) => {
                          const dateObj = match.match_date ? parseISO(match.match_date) : null
                          const timeZone = 'America/Caracas'
                          const zonedDate = dateObj ? toZonedTime(dateObj, timeZone) : null
                          
                          // Determine styles for predictions
                          const isMatchDone = match.status === 'completed'
                          
                          const getPredStyle = (pred: Prediction | undefined) => {
                            if (!isLocked) return 'text-white/20 bg-white/2 border-white/5'
                            if (!pred) return 'text-white/25 bg-black/10 border-white/5'
                            if (!isMatchDone) return 'text-white bg-white/5 border-white/10'
                            
                            const isExact = pred.predicted_home_score === match.home_score && pred.predicted_away_score === match.away_score
                            if (isExact) return 'text-amber-400 bg-amber-950/20 border-amber-500/30 font-bold'
                            if (pred.is_correct) return 'text-emerald-400 bg-emerald-950/20 border-emerald-500/30'
                            return 'text-red-400 bg-red-950/15 border-red-500/25'
                          }

                          return (
                            <div key={match.id} className="pt-3 first:pt-0 flex items-center justify-between gap-2">
                              {/* Prediction User A (Left) */}
                              <div className="w-1/3 flex justify-end">
                                {!isLocked ? (
                                  <div className="text-[10px] text-white/30 bg-white/5 border border-white/5 px-2 py-1 rounded italic text-center min-w-[70px]">
                                    🔒 Oculto
                                  </div>
                                ) : predA ? (
                                  <div className={`text-xs px-2.5 py-1 rounded border min-w-[70px] text-center font-mono ${getPredStyle(predA)}`}>
                                    {predA.predicted_home_score} - {predA.predicted_away_score}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-white/30 bg-black/10 border border-white/5 px-2 py-1 rounded italic text-center min-w-[70px]">
                                    Sin Pred.
                                  </div>
                                )}
                              </div>

                              {/* Match Center details */}
                              <div className="w-2/5 text-center flex flex-col items-center">
                                <div className="flex items-center gap-1.5 justify-center mb-0.5">
                                  <TeamFlag url={match.home_flag} name={match.home_team} />
                                  <span className="text-[10px] font-semibold text-white/80 uppercase">
                                    {match.home_team.slice(0, 3)}
                                  </span>
                                  <span className="text-white/20 text-[9px] font-bold">vs</span>
                                  <span className="text-[10px] font-semibold text-white/80 uppercase">
                                    {match.away_team.slice(0, 3)}
                                  </span>
                                  <TeamFlag url={match.away_flag} name={match.away_team} />
                                </div>

                                {/* Actual Score or Date */}
                                {isMatchDone && match.home_score !== null ? (
                                  <div className="text-xs font-mono font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5 text-white/90">
                                    {match.home_score} - {match.away_score}
                                  </div>
                                ) : match.status === 'live' && match.home_score !== null ? (
                                  <div className="text-xs font-mono font-bold bg-crimson-950/20 px-2 py-0.5 rounded border border-crimson-500/30 text-crimson-400 animate-pulse">
                                    {match.home_score} - {match.away_score} (VIVO)
                                  </div>
                                ) : zonedDate ? (
                                  <div className="text-[9px] text-white/30 uppercase">
                                    {formatTz(zonedDate, 'dd MMM - HH:mm', { locale: es, timeZone })}
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-white/30 uppercase">Próximamente</div>
                                )}
                              </div>

                              {/* Prediction User B (Right) */}
                              <div className="w-1/3 flex justify-start">
                                {!isLocked ? (
                                  <div className="text-[10px] text-white/30 bg-white/5 border border-white/5 px-2 py-1 rounded italic text-center min-w-[70px]">
                                    🔒 Oculto
                                  </div>
                                ) : predB ? (
                                  <div className={`text-xs px-2.5 py-1 rounded border min-w-[70px] text-center font-mono ${getPredStyle(predB)}`}>
                                    {predB.predicted_home_score} - {predB.predicted_away_score}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-white/30 bg-black/10 border border-white/5 px-2 py-1 rounded italic text-center min-w-[70px]">
                                    Sin Pred.
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 flex justify-end bg-white/3">
              <button
                onClick={() => {
                  setSelectedPlayer(null)
                  setComparedPredictions([])
                }}
                className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-semibold transition-colors"
              >
                Cerrar Comparación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
