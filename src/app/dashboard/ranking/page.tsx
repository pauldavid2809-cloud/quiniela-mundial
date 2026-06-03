import { createClient } from '@/lib/supabase/server'

export const revalidate = 60 // revalidate every minute

export default async function RankingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: ranking } = await supabase
    .from('profiles')
    .select('id, username, display_name, total_points')
    .order('total_points', { ascending: false })
    .limit(50)

  // Get user's own points and absolute rank
  let userRank = -1
  let userProfile: any = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, total_points')
      .eq('id', user.id)
      .single()
    if (profile) {
      userProfile = profile
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('total_points', profile.total_points)
      userRank = (count ?? 0) + 1
    }
  }

  const top3 = ranking ? ranking.slice(0, 3) : []
  const restOfRanking = ranking ? ranking.slice(3) : []

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

  // Reorder top 3 visually for sm+ screens: 2nd place, 1st place, 3rd place
  const visualTop3 = []
  if (top3[1]) visualTop3.push({ player: top3[1], index: 1, config: podiumStyles[1] })
  if (top3[0]) visualTop3.push({ player: top3[0], index: 0, config: podiumStyles[0] })
  if (top3[2]) visualTop3.push({ player: top3[2], index: 2, config: podiumStyles[2] })

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide">
          <span className="gold-shimmer">RANKING</span>
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Tabla de posiciones · Actualizada en tiempo real
        </p>
      </div>

      {/* User position card */}
      {userRank >= 1 && userProfile && (
        <div className="glass-card p-4 border-gold-500/30"
          style={{ borderColor: 'rgba(255,215,0,0.3)' }}>
          <div className="flex items-center gap-4">
            <div className="font-display text-4xl text-gold-500">#{userRank}</div>
            <div>
              <div className="text-white/60 text-xs uppercase tracking-wide">Tu posición</div>
              <div className="text-white font-semibold">{userProfile.display_name || userProfile.username}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-display text-3xl text-gold-500">{userProfile.total_points}</div>
              <div className="text-white/40 text-xs">puntos</div>
            </div>
          </div>
        </div>
      )}

      {/* Podium Cards for Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 items-end pt-4 pb-2">
          {visualTop3.map(({ player, index, config }) => (
            <div
              key={player.id}
              className={`glass-card p-5 relative flex flex-col items-center text-center border transition-all hover:translate-y-[-4px] ${config.border} ${config.order}`}
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
            </div>
          ))}
        </div>
      )}

      {/* Ranking table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-display text-xl text-white tracking-wide">TABLA DE POSICIONES</h2>
        </div>

        {!ranking || ranking.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            <div className="text-4xl mb-3">📊</div>
            <p>Aún no hay puntuaciones. ¡Haz tus predicciones!</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {ranking.map((player, index) => {
              const isCurrentUser = player.id === user?.id
              const isTop3 = index < 3

              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${
                    isCurrentUser ? 'bg-gold-500/8' : 'hover:bg-white/3'
                  }`}
                >
                  {/* Position */}
                  <div className="w-10 text-center">
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
                    <div className={`font-semibold truncate ${isCurrentUser ? 'text-gold-500' : 'text-white'}`}>
                      {player.display_name || player.username}
                      {isCurrentUser && <span className="text-xs text-white/40 ml-2">(tú)</span>}
                    </div>
                    <div className="text-white/35 text-xs">@{player.username}</div>
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <div className={`font-display text-2xl ${isTop3 ? 'text-gold-500' : isCurrentUser ? 'text-gold-400' : 'text-white'}`}>
                      {player.total_points}
                    </div>
                    <div className="text-white/30 text-xs">pts</div>
                  </div>
                </div>
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
    </div>
  )
}
