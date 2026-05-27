'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #DC143C, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20rem] opacity-[0.03] font-display select-none">
          ⚽
        </div>
      </div>

      <div className="w-full max-w-md animate-slide-up">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3 trophy-glow">🏆</div>
          <h1 className="font-display text-5xl gold-shimmer mb-1">QUINIELA</h1>
          <h2 className="font-display text-3xl text-white/60 tracking-widest">MUNDIAL 2026</h2>
          <p className="text-white/40 text-sm mt-2 font-body">
            🇺🇸 USA · 🇲🇽 MÉXICO · 🇨🇦 CANADÁ
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h3 className="font-display text-2xl text-white tracking-wide mb-6">INICIAR SESIÓN</h3>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-1 font-body font-600">
                Correo electrónico
              </label>
              <input
                type="email"
                className="input-mundial"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-white/60 text-sm mb-1 font-body font-600">
                Contraseña
              </label>
              <input
                type="password"
                className="input-mundial"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3 text-red-300 text-sm animate-fade-in">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                '⚽ ENTRAR AL TORNEO'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-white/50 text-sm">
              ¿No tienes cuenta?{' '}
              <Link href="/auth/register" className="text-gold-500 hover:text-gold-400 font-semibold transition-colors">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-white/25 text-xs mt-6 font-body">
          FIFA World Cup 2026 • Quiniela Privada
        </p>
      </div>
    </div>
  )
}
