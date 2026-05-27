import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, display_name')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  return (
    <div className="min-h-screen">
      {/* Admin header */}
      <header className="border-b border-crimson-500/30 sticky top-0 z-50"
        style={{ background: 'rgba(20, 5, 10, 0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white/50 hover:text-white/80 transition-colors text-sm">
              ← Quiniela
            </Link>
            <span className="text-white/20">|</span>
            <span className="font-display text-lg text-crimson-500 tracking-wide">⚙️ PANEL ADMIN</span>
          </div>
          <span className="text-white/40 text-sm">{profile.display_name}</span>
        </div>

        {/* Admin nav */}
        <div className="max-w-5xl mx-auto px-4 flex gap-4 pb-2">
          {[
            { href: '/admin', label: '🏠 Inicio' },
            { href: '/admin/partidos', label: '⚽ Partidos' },
            { href: '/admin/fases', label: '🔓 Fases' },
            { href: '/admin/trivia', label: '🧠 Trivia' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/50 hover:text-white text-sm font-semibold transition-colors py-1 px-2 rounded hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
