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

  const userRank = ranking?.findIndex(p => p.id === user?.id) ?? -1

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-4xl text-white tracking-wide">
          <span className="gold-shimmer">RANKING</span>
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Tabla de posiciones · Actualizada en tiempo real
        </p>
      </div>

      {/* User position card */}
      {userRank >= 0 && ranking && (
        <div className="glass-card p-4 mb-6 border-gold-500/30"
          style={{ borderColor: 'rgba(255,215,0,0.3)' }}>
          <div className="flex items-center gap-4">
            <div className="font-display text-4xl text-gold-500">#{userRank + 1}</div>
            <div>
              <div className="text-white/60 text-xs uppercase tracking-wide">Tu posición</div>
              <div className="text-white font-semibold">{ranking[userRank].display_name || ranking[userRank].username}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-display text-3xl text-gold-500">{ranking[userRank].total_points}</div>
              <div className="text-white/40 text-xs">puntos</div>
            </div>
          </div>
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
                  className={`flex items-center gap-4 px-4 py-3 transition-colors ${
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
      <div className="mt-6 glass-card p-4">
        <h3 className="font-display text-lg text-white/70 mb-3 tracking-wide">PUNTUACIÓN POR FASE</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: 'Grupos', pts: 1 },
            { label: '32avos', pts: 2 },
            { label: 'Octavos', pts: 3 },
            { label: 'Cuartos', pts: 4 },
            { label: 'Semis', pts: 5 },
            { label: 'Final', pts: 6 },
          ].map(item => (
            <div key={item.label} className="text-center bg-white/5 rounded-lg p-2">
              <div className="font-display text-xl text-gold-500">{item.pts}</div>
              <div className="text-white/50 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-center bg-white/5 rounded-lg p-2 inline-block w-full">
            <span className="font-display text-xl text-gold-500">3 pts</span>
            <span className="text-white/50 text-sm ml-2">por pregunta de Trivia diaria</span>
          </div>
        </div>
      </div>
    </div>
  )
}
