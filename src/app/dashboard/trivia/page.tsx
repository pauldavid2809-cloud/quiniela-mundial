'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TriviaQuestion {
  id: number
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  active_date: string
}

interface TriviaAnswer {
  question_id: number
  answer: string
  is_correct: boolean
  points_earned: number
}

const TIMER_SECONDS = 10
const OPTIONS = ['a', 'b', 'c', 'd'] as const
const OPTION_LABELS = { a: 'A', b: 'B', c: 'C', d: 'D' }
const OPTION_COLORS = {
  a: { base: 'rgba(41,98,255,0.12)', border: 'rgba(41,98,255,0.3)', text: '#7BA7FF' },
  b: { base: 'rgba(220,20,60,0.12)', border: 'rgba(220,20,60,0.3)', text: '#FF7096' },
  c: { base: 'rgba(255,165,0,0.12)', border: 'rgba(255,165,0,0.3)', text: '#FFB940' },
  d: { base: 'rgba(100,200,100,0.12)', border: 'rgba(100,200,100,0.3)', text: '#7DE87D' },
}

export default function TriviaPage() {
  const supabase = createClient()
  const [question, setQuestion] = useState<TriviaQuestion | null>(null)
  const [alreadyAnswered, setAlreadyAnswered] = useState<TriviaAnswer | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const [timerActive, setTimerActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [worldCupStarted] = useState(true) // set to false before the World Cup begins
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadQuestion = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const today = new Date().toISOString().split('T')[0]

    // Get today's active question
    const { data: q } = await supabase
      .from('trivia_questions')
      .select('*')
      .eq('active_date', today)
      .eq('is_active', true)
      .single()

    if (q) {
      setQuestion(q)

      // Check if user already answered
      const { data: ans } = await supabase
        .from('trivia_answers')
        .select('*')
        .eq('user_id', user.id)
        .eq('question_id', q.id)
        .single()

      if (ans) {
        setAlreadyAnswered(ans)
        setSelectedAnswer(ans.answer)
        setRevealed(true)
      } else {
        setTimerActive(true)
        setTimeLeft(TIMER_SECONDS)
      }
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadQuestion()
  }, [loadQuestion])

  // Timer countdown
  useEffect(() => {
    if (!timerActive || revealed) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setTimerActive(false)
          setRevealed(true) // time's up
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current!)
  }, [timerActive, revealed])

  const handleAnswer = async (answer: string) => {
    if (revealed || !question || !userId) return

    clearInterval(timerRef.current!)
    setTimerActive(false)
    setSelectedAnswer(answer)
    setRevealed(true)

    const isCorrect = answer === question.correct_answer
    const points = isCorrect ? 3 : 0

    const { error } = await supabase.from('trivia_answers').insert({
      user_id: userId,
      question_id: question.id,
      answer,
      is_correct: isCorrect,
      points_earned: points,
    })

    if (!error && isCorrect) {
      // Recalculate total points
      await supabase.rpc('recalculate_user_points', { p_user_id: userId })
    }
  }

  const getOptionStyle = (opt: string) => {
    const colors = OPTION_COLORS[opt as keyof typeof OPTION_COLORS]
    if (!revealed || !selectedAnswer) {
      return {
        background: colors.base,
        borderColor: colors.border,
        color: colors.text,
      }
    }
    if (opt === question?.correct_answer) {
      return {
        background: 'rgba(40,180,100,0.25)',
        borderColor: '#28B464',
        color: '#5DE899',
      }
    }
    if (opt === selectedAnswer && opt !== question?.correct_answer) {
      return {
        background: 'rgba(220,20,60,0.25)',
        borderColor: '#DC143C',
        color: '#FF6B8A',
      }
    }
    return {
      background: 'rgba(255,255,255,0.03)',
      borderColor: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.3)',
    }
  }

  const timerPct = (timeLeft / TIMER_SECONDS) * 100
  const timerColor = timeLeft > 6 ? '#28B464' : timeLeft > 3 ? '#FFA500' : '#DC143C'

  if (!worldCupStarted) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="font-display text-4xl gold-shimmer">TRIVIA MUNDIAL</h1>
        </div>
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h3 className="font-display text-2xl text-white/70 mb-2">EL MUNDIAL AÚN NO EMPIEZA</h3>
          <p className="text-white/40">La trivia diaria estará disponible a partir del primer día del torneo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-4xl gold-shimmer">TRIVIA MUNDIAL</h1>
        <p className="text-white/50 text-sm mt-1">
          Una pregunta por día · 10 segundos · Hasta 3 puntos
        </p>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl animate-spin mb-4">⚽</div>
          <p className="text-white/50">Cargando pregunta de hoy...</p>
        </div>
      ) : !question ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">😴</div>
          <h3 className="font-display text-2xl text-white/70 mb-2">SIN PREGUNTA HOY</h3>
          <p className="text-white/40">El administrador aún no ha publicado la pregunta de hoy. ¡Vuelve más tarde!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Question card */}
          <div className="glass-card p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <span className="font-display text-lg text-white/60 tracking-wide">PREGUNTA DEL DÍA</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge" style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', color: '#FFD700' }}>
                  +3 pts
                </span>
                {!revealed && (
                  <span
                    className="font-display text-2xl tabular-nums"
                    style={{ color: timerColor, textShadow: `0 0 10px ${timerColor}` }}
                  >
                    {timeLeft}s
                  </span>
                )}
              </div>
            </div>

            {/* Timer bar */}
            {!revealed && (
              <div className="h-1 rounded-full bg-white/10 mb-5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${timerPct}%`,
                    background: `linear-gradient(90deg, ${timerColor}, ${timerColor}99)`,
                    boxShadow: `0 0 8px ${timerColor}`,
                  }}
                />
              </div>
            )}

            {/* Question text */}
            <h2 className="text-white text-lg font-semibold leading-snug mb-6">
              {question.question}
            </h2>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPTIONS.map(opt => {
                const optText = question[`option_${opt}` as keyof TriviaQuestion] as string
                const style = getOptionStyle(opt)
                const isCorrectOpt = opt === question.correct_answer
                const isSelectedOpt = opt === selectedAnswer

                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={revealed}
                    className="text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer"
                    style={{
                      background: style.background,
                      borderColor: style.borderColor,
                      color: style.color,
                      transform: revealed && isCorrectOpt ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-display text-lg shrink-0">{OPTION_LABELS[opt]}</span>
                      <span className="font-semibold text-sm leading-snug">{optText}</span>
                      {revealed && isCorrectOpt && <span className="ml-auto shrink-0">✅</span>}
                      {revealed && isSelectedOpt && !isCorrectOpt && <span className="ml-auto shrink-0">❌</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Result */}
          {revealed && (
            <div className={`glass-card p-5 text-center animate-bounce-in ${
              selectedAnswer === question.correct_answer
                ? 'border-green-500/40'
                : timeLeft === 0 && !selectedAnswer
                  ? 'border-orange-500/40'
                  : 'border-red-500/30'
            }`}>
              {selectedAnswer === question.correct_answer ? (
                <>
                  <div className="text-4xl mb-2">🎉</div>
                  <div className="font-display text-2xl text-green-400 mb-1">¡CORRECTO!</div>
                  <div className="text-white/60">Sumaste <span className="text-gold-500 font-bold">+3 puntos</span> al ranking</div>
                </>
              ) : timeLeft === 0 && !selectedAnswer ? (
                <>
                  <div className="text-4xl mb-2">⏱️</div>
                  <div className="font-display text-2xl text-orange-400 mb-1">¡TIEMPO!</div>
                  <div className="text-white/60">
                    La respuesta correcta era: <span className="text-green-400 font-bold">
                      {OPTION_LABELS[question.correct_answer as keyof typeof OPTION_LABELS]} — {question[`option_${question.correct_answer}` as keyof TriviaQuestion] as string}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">😅</div>
                  <div className="font-display text-2xl text-red-400 mb-1">INCORRECTO</div>
                  <div className="text-white/60">
                    La respuesta era: <span className="text-green-400 font-bold">
                      {OPTION_LABELS[question.correct_answer as keyof typeof OPTION_LABELS]} — {question[`option_${question.correct_answer}` as keyof TriviaQuestion] as string}
                    </span>
                  </div>
                </>
              )}

              {alreadyAnswered && (
                <div className="mt-3 text-white/40 text-xs">Ya respondiste esta pregunta hoy.</div>
              )}
            </div>
          )}

          {/* Already answered note */}
          {alreadyAnswered && (
            <div className="text-center text-white/30 text-sm">
              ✅ Ya participaste hoy · Vuelve mañana para la siguiente pregunta
            </div>
          )}
        </div>
      )}
    </div>
  )
}
