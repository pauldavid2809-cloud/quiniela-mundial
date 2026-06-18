import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = createClient()

  const [
    { count: matchCount },
    { count: userCount },
    { count: predCount },
    { count: triviaCount },
  ] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('predictions').select('*', { count: 'exact', head: true }),
    supabase.from('trivia_questions').select('*', { count: 'exact', head: true }),
  ])

  const { data: phases } = await supabase.from('phases').select('*').order('sort_order')

  const stats = [
    { label: 'Partidos cargados', value: matchCount || 0, icon: '⚽', href: '/admin/partidos' },
    { label: 'Usuarios registrados', value: userCount || 0, icon: '👥', href: '/dashboard/ranking' },
    { label: 'Predicciones totales', value: predCount || 0, icon: '🎯', href: '/dashboard/ranking' },
    { label: 'Preguntas trivia', value: triviaCount || 0, icon: '🧠', href: '/admin/trivia' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-3xl text-crimson-500 tracking-wide">PANEL DE ADMINISTRACIÓN</h1>
        <p className="text-white/50 text-sm mt-1">Gestión de la Quiniela Mundial 2026</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href} className="glass-card p-4 text-center hover:scale-105 transition-transform">
            <div className="text-3xl mb-1">{stat.icon}</div>
            <div className="font-display text-3xl text-gold-500">{stat.value}</div>
            <div className="text-white/50 text-xs mt-1">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Phases status */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-white tracking-wide">ESTADO DE FASES</h2>
          <Link href="/admin/fases" className="btn-ghost text-xs px-3 py-2">Gestionar →</Link>
        </div>
        <div className="space-y-2">
          {phases?.map(phase => (
            <div key={phase.id} className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-white/70">{phase.display_name}</span>
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-sm">+{phase.points_value} pt</span>
                <span className={`badge ${phase.is_unlocked ? 'badge-done' : 'badge-soon'}`}>
                  {phase.is_unlocked ? '✅ Activa' : '🔒 Bloqueada'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Link href="/admin/trivia" className="glass-card p-5 hover:border-gold-500/40 transition-all text-center group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🧠</div>
          <div className="font-display text-lg text-white">TRIVIA</div>
          <div className="text-white/45 text-xs">Agregar pregunta del día</div>
        </Link>
        <Link href="/admin/fases" className="glass-card p-5 hover:border-gold-500/40 transition-all text-center group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🔓</div>
          <div className="font-display text-lg text-white">FASES</div>
          <div className="text-white/45 text-xs">Desbloquear fases eliminatorias</div>
        </Link>
        <Link href="/admin/partidos" className="glass-card p-5 hover:border-gold-500/40 transition-all text-center group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">⚽</div>
          <div className="font-display text-lg text-white">PARTIDOS</div>
          <div className="text-white/45 text-xs">Sincronizar resultados API</div>
        </Link>
        <Link href="/api/admin/reset?target=admin" className="glass-card p-5 hover:border-crimson-500/40 transition-all text-center group">
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🔄</div>
          <div className="font-display text-lg text-white">REINICIAR</div>
          <div className="text-white/45 text-xs">Puntos y predicciones a 0</div>
        </Link>
      </div>
    </div>
  )
}
