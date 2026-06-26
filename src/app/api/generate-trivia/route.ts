import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
    }

    // 1. Obtener las últimas preguntas guardadas para evitar duplicados
    let previousQuestionsText = ''
    try {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('trivia_questions')
        .select('question')
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (data && data.length > 0) {
        previousQuestionsText = data.map(q => `- ${q.question}`).join('\n')
      }
    } catch (dbError) {
      console.error('Error al obtener preguntas previas para evitar duplicados:', dbError)
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    // Creamos una lista de subtemas aleatorios para inyectar variedad en cada llamada
    const subtopics = [
      'Goleadores históricos de los Mundiales (Klose, Ronaldo, Pelé, Fontaine, etc.)',
      'Ediciones antiguas y curiosidades (Uruguay 1930, Italia 1934, Suiza 1954, etc.)',
      'Mundiales recientes (Sudáfrica 2010, Brasil 2014, Rusia 2018, Qatar 2022)',
      'Récords del Mundial (jugador más joven, gol más rápido, más partidos jugados, etc.)',
      'Tarjetas rojas y amonestaciones famosas, polémicas o partidos con muchos goles',
      'Sedes históricas, mascotas oficiales del mundial o estadios icónicos',
      'Países debutantes o hazañas de selecciones revelación (ej. Marruecos 2022, Croacia 2018, Camerún 1990)',
      'Directores técnicos históricos, campeones múltiples o finales dramáticas'
    ]
    const randomSubtopic = subtopics[Math.floor(Math.random() * subtopics.length)]

    const prompt = `Genera UNA pregunta de trivia única y exclusivamente relacionada con la historia de la Copa Mundial de la FIFA.

Para asegurar que sea variada, enfócate preferentemente en este subtema o área: ${randomSubtopic}.

La pregunta debe ser interesante, con dificultad variada (de media a alta), y referirse estrictamente al contexto de los Mundiales de la FIFA. Evita a toda costa preguntas genéricas de fútbol de clubes o jugadores en sus clubes; todo debe estar relacionado con la Copa del Mundo.

CRÍTICO: Haz que la pregunta y las opciones sean muy breves, cortas y directas al grano. Evita preámbulos, descripciones o explicaciones innecesariamente largas en el enunciado de la pregunta y en las opciones de respuesta.

${previousQuestionsText ? `IMPORTANTE: Para evitar repeticiones, NO debes generar ninguna pregunta idéntica ni muy similar a las siguientes preguntas que ya existen en la base de datos:\n${previousQuestionsText}` : ''}

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

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ],
          }
        ],
        generationConfig: {
          temperature: 1.0, // Subimos la temperatura para forzar más creatividad y aleatoriedad
          responseMimeType: 'application/json',
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || 'Error de IA' }, { status: res.status || 500 })
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
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