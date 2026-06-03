import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY no configurada' }, { status: 500 })
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions'

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: `Genera UNA pregunta de trivia sobre el fútbol o el Mundial FIFA (puede ser sobre historia, jugadores, récords, estadísticas, sedes, equipos, curiosidades, reglas, etc.).

La pregunta debe ser interesante, de dificultad media, y que los fanáticos del fútbol puedan contestar.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin comillas de código, exactamente en este formato:
{
  "question": "¿Pregunta aquí?",
  "option_a": "Primera opción",
  "option_b": "Segunda opción",
  "option_c": "Tercera opción",
  "option_d": "Cuarta opción",
  "correct_answer": "a"
}

Solo una de las opciones (a, b, c o d) debe ser la correcta. Las otras tres deben ser plausibles pero incorrectas.`
          }
        ],
        response_format: {
          type: 'json_object'
        },
        temperature: 0.7,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || 'Error de IA' }, { status: res.status || 500 })
    }

    const text = data.choices?.[0]?.message?.content || ''
    const parsed = JSON.parse(text.trim())

    const required = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']
    for (const field of required) {
      if (!parsed[field]) {
        return NextResponse.json({ error: `Campo faltante: ${field}` }, { status: 500 })
      }
    }

    // Normalizar correct_answer (ej: "option_a" -> "a", "A" -> "a")
    if (typeof parsed.correct_answer === 'string') {
      const cleanAns = parsed.correct_answer.toLowerCase().trim()
      if (cleanAns === 'a' || cleanAns === 'option_a' || cleanAns.endsWith('_a') || cleanAns.endsWith(' a')) {
        parsed.correct_answer = 'a'
      } else if (cleanAns === 'b' || cleanAns === 'option_b' || cleanAns.endsWith('_b') || cleanAns.endsWith(' b')) {
        parsed.correct_answer = 'b'
      } else if (cleanAns === 'c' || cleanAns === 'option_c' || cleanAns.endsWith('_c') || cleanAns.endsWith(' c')) {
        parsed.correct_answer = 'c'
      } else if (cleanAns === 'd' || cleanAns === 'option_d' || cleanAns.endsWith('_d') || cleanAns.endsWith(' d')) {
        parsed.correct_answer = 'd'
      }
    }

    if (!['a', 'b', 'c', 'd'].includes(parsed.correct_answer)) {
      return NextResponse.json({ error: 'correct_answer debe ser a, b, c o d' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('generate-trivia error:', error)
    return NextResponse.json({ error: 'Error al generar la pregunta' }, { status: 500 })
  }
}