'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface NavBarProps {
  profile: {
    username: string
    display_name: string
    is_admin: boolean
    total_points: number
  } | null
}

export default function NavBar({ profile }: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const links = [
    { href: '/dashboard', label: '⚽ Quiniela' },
    { href: '/dashboard/ranking', label: '🏅 Ranking' },
    { href: '/dashboard/trivia', label: '🧠 Trivia' },
  ]

  if (profile?.is_admin) {
    links.push({ href: '/admin', label: '⚙️ Admin' })
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gold-500/15"
      style={{ background: 'rgba(2, 8, 23, 0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl trophy-glow">🏆</span>
          <div className="hidden sm:block">
            <span className="font-display text-xl text-gold-500 tracking-widest">MUNDIAL</span>
            <span className="font-display text-xl text-white/70 tracking-widest ml-1">2026</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link px-3 py-2 rounded-lg text-sm transition-all ${
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'text-gold-500 bg-gold-500/10'
                  : 'text-white/55 hover:text-white/90 hover:bg-white/5'
              }`}
              style={{ fontFamily: 'var(--font-bebas)', letterSpacing: '0.08em' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User info */}
        <div className="flex items-center gap-3">
          {profile && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-right">
                <div className="text-white/80 text-sm font-semibold leading-none">
                  {profile.display_name || profile.username}
                </div>
                <div className="text-gold-500 text-xs font-bold">
                  {profile.total_points} pts
                </div>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #FFD700, #E6A800)', color: '#020817' }}>
                {(profile.display_name || profile.username || '?')[0].toUpperCase()}
              </div>
            </div>
          )}

          <button onClick={handleLogout} className="btn-ghost text-xs px-3 py-2 hidden sm:block">
            Salir
          </button>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-white/70 p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 py-3 px-4 animate-fade-in"
          style={{ background: 'rgba(2, 8, 23, 0.97)' }}>
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block py-3 px-3 rounded-lg mb-1 font-display tracking-wide text-sm ${
                pathname === link.href ? 'text-gold-500 bg-gold-500/10' : 'text-white/70'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {profile && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-white/60 text-sm">{profile.display_name} · <span className="text-gold-500">{profile.total_points} pts</span></span>
              <button onClick={handleLogout} className="btn-ghost text-xs">Salir</button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
