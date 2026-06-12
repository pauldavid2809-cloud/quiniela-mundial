'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TriviaQuestion {
  id: number
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  active_date: string | null
  is_active: boolean
  created_at: string
}

const emptyForm = {
  question: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'a',
  active_date: new Date().toISOString().split('T')[0],
}

export default function AdminTriviaPage() {
  const supabase = createClient()
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [form, setForm] = useState({ ...emptyForm })
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadQuestions = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('trivia_questions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setQuestions(data || [])
    setLoading(false)
  }

  useEffect(() => { loadQuestions() }, [])

  const generateWithAI = async () => {
    setGenerating(true)
    setMsg('')
    try {
      const res = await fetch('/api/generate-trivia', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.question) {
        setForm(prev => ({
          ...prev,
          question: data.question,
          option_a: data.option_a,
          option_b: data.option_b,
          option_c: data.option_c,
          option_d: data.option_d,
          correct_answer: data.correct_answer,
        }))
        setMsg('✅ Pregunta generada con IA. Revísala y guárdala.')
      } else {
        setMsg('❌ Error: ' + (data.error || 'No se pudo generar la pregunta con la IA.'))
      }
    } catch (e: any) {
      setMsg('❌ Error al generar pregunta con IA: ' + (e?.message || 'Error de conexión'))
    }
    setGenerating(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg('')

    const { error } = await supabase.from('trivia_questions').insert({
      ...form,
      is_active: false,
    })

    if (error) {
      setMsg('❌ Error: ' + (error.message.includes('unique') ? 'Ya existe una pregunta para esa fecha' : error.message))
    } else {
      setMsg('✅ Pregunta guardada correctamente')
      setForm({ ...emptyForm, active_date: new Date().toISOString().split('T')[0] })
      loadQuestions()
    }
    setSaving(false)
  }

  const toggleActive = async (q: TriviaQuestion) => {
    const { error } = await supabase
      .from('trivia_questions')
      .update({ is_active: !q.is_active })
      .eq('id', q.id)

    if (!error) loadQuestions()
  }

  const deleteQuestion = async (id: number) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    await supabase.from('trivia_questions').delete().eq('id', id)
    loadQuestions()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl text-white tracking-wide">🧠 GESTIÓN DE TRIVIA</h1>
        <p className="text-white/50 text-sm mt-1">Crea y activa las preguntas diarias del mundial</p>
      </div>

      {/* Create form */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white tracking-wide">NUEVA PREGUNTA</h2>
          <button
            onClick={generateWithAI}
            disabled={generating}
            className="btn-gold text-sm px-4 py-2 flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />
                Generando...
              </>
            ) : '🤖 Generar con IA'}
          </button>
        </div>

        {msg && (
          <div className={`mb-4 p-3 rounded-lg text-sm animate-fade-in ${
            msg.startsWith('✅') ? 'bg-green-900/30 border border-green-500/30 text-green-300'
              : 'bg-red-900/30 border border-red-500/30 text-red-300'
          }`}>
            {msg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">Pregunta *</label>
            <textarea
              className="input-mundial resize-none h-20"
              placeholder="¿Cuántos goles marcó Pelé en mundiales?"
              value={form.question}
              onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(['a', 'b', 'c', 'd'] as const).map(opt => (
              <div key={opt}>
                <label className="block text-xs mb-1 uppercase tracking-wide"
                  style={{ color: opt === 'a' ? '#7BA7FF' : opt === 'b' ? '#FF7096' : opt === 'c' ? '#FFB940' : '#7DE87D' }}>
                  Opción {opt.toUpperCase()} {form.correct_answer === opt && '✓ Correcta'}
                </label>
                <input
                  className="input-mundial"
                  placeholder={`Opción ${opt.toUpperCase()}`}
                  value={form[`option_${opt}` as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [`option_${opt}`]: e.target.value }))}
                  required
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">Respuesta correcta *</label>
              <select
                className="input-mundial"
                value={form.correct_answer}
                onChange={e => setForm(p => ({ ...p, correct_answer: e.target.value }))}
              >
                <option value="a">A — {form.option_a || 'Opción A'}</option>
                <option value="b">B — {form.option_b || 'Opción B'}</option>
                <option value="c">C — {form.option_c || 'Opción C'}</option>
                <option value="d">D — {form.option_d || 'Opción D'}</option>
              </select>
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1 uppercase tracking-wide">Fecha de activación *</label>
              <input
                type="date"
                className="input-mundial"
                value={form.active_date}
                onChange={e => setForm(p => ({ ...p, active_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-gold flex-1 flex items-center justify-center gap-2">
              {saving ? (
                <><span className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" /> Guardando...</>
              ) : '💾 GUARDAR PREGUNTA'}
            </button>
            <button type="button" onClick={() => setForm({ ...emptyForm })} className="btn-ghost px-4">
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Questions list */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-display text-xl text-white tracking-wide">PREGUNTAS GUARDADAS</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/40">Cargando...</div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-white/40">No hay preguntas aún. ¡Crea la primera!</div>
        ) : (
          <div className="divide-y divide-white/5">
            {questions.map(q => (
              <div key={q.id} className="p-4 hover:bg-white/3 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {q.active_date && (
                        <span className="badge" style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)', color: '#FFD700' }}>
                          📅 {q.active_date}
                        </span>
                      )}
                      <span className={`badge ${q.is_active ? 'badge-done' : 'badge-soon'}`}>
                        {q.is_active ? '✅ Activa' : '⏳ Inactiva'}
                      </span>
                    </div>
                    <p className="text-white text-sm font-semibold mb-2 truncate">{q.question}</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-white/50">
                      {(['a', 'b', 'c', 'd'] as const).map(opt => (
                        <span key={opt} className={q.correct_answer === opt ? 'text-green-400' : ''}>
                          {opt.toUpperCase()}) {q[`option_${opt}` as keyof TriviaQuestion] as string}
                          {q.correct_answer === opt && ' ✓'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(q)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        q.is_active
                          ? 'bg-red-900/30 border-red-500/30 text-red-300 hover:bg-red-900/50'
                          : 'bg-green-900/30 border-green-500/30 text-green-300 hover:bg-green-900/50'
                      }`}
                    >
                      {q.is_active ? '🔕 Desactivar' : '✅ Activar'}
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 hover:bg-red-900/40 transition-colors"
                    >
                      🗑️ Borrar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
