'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', displayName: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (form.username.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username.toLowerCase().replace(/\s+/g, '_'),
          display_name: form.displayName || form.username,
        },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este correo ya está registrado')
      } else {
        setError(error.message)
      }
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #DC143C, transparent)' }} />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="font-display text-4xl gold-shimmer">ÚNETE A LA QUINIELA</h1>
          <p className="text-white/40 text-sm mt-1">Mundial 2026 · USA · México · Canadá</p>
        </div>

        <div className="glass-card p-8">
          <h3 className="font-display text-2xl text-white tracking-wide mb-6">CREAR CUENTA</h3>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">
                  Usuario
                </label>
                <input
                  className="input-mundial"
                  placeholder="crack10"
                  value={form.username}
                  onChange={update('username')}
                  required
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">
                  Nombre
                </label>
                <input
                  className="input-mundial"
                  placeholder="Carlos"
                  value={form.displayName}
                  onChange={update('displayName')}
                />
              </div>
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">
                Correo electrónico
              </label>
              <input
                type="email"
                className="input-mundial"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={update('email')}
                required
              />
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">
                Contraseña
              </label>
              <input
                type="password"
                className="input-mundial"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={update('password')}
                required
              />
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">
                Confirmar contraseña
              </label>
              <input
                type="password"
                className="input-mundial"
                placeholder="Repite la contraseña"
                value={form.confirm}
                onChange={update('confirm')}
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
                  Registrando...
                </>
              ) : (
                '🚀 COMENZAR A JUGAR'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-white/50 text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="text-gold-500 hover:text-gold-400 font-semibold transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
