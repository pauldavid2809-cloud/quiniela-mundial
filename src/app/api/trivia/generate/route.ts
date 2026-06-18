import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const getCaracasDateString = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(new Date())
  return `${year}-${month}-${day}`
}

export async function POST() {
  try {
    // 1. Authenticate user
    const clientDb = createClient()
    const { data: { user } } = await clientDb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const todayStr = getCaracasDateString()
    const adminDb = createAdminClient()

    // 2. Check if user already generated a question today
    const { data: existingQ } = await adminDb
      .from('trivia_questions')
      .select('id')
      .eq('created_by', user.id)
      .gte('created_at', `${todayStr}T00:00:00-04:00`)
      .lte('created_at', `${todayStr}T23:59:59-04:00`)
      .limit(1)
      .maybeSingle()

    if (existingQ) {
      return NextResponse.json({ error: 'Ya has generado tu pregunta del día de hoy.' }, { status: 400 })
    }

    // 3. Select random subtopic for variety
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

    // 4. Retrieve recent questions to avoid repeats
    let previousQuestionsText = ''
    try {
      const { data: recentQs } = await adminDb
        .from('trivia_questions')
        .select('question')
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (recentQs && recentQs.length > 0) {
        previousQuestionsText = recentQs.map(q => `- ${q.question}`).join('\n')
      }
    } catch (dbError) {
      console.error('Error fetching recent questions:', dbError)
    }

    // 5. Query OpenRouter API
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY no configurado' }, { status: 500 })
    }

    const apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
    const prompt = `Genera UNA pregunta de trivia única y exclusivamente relacionada con la historia de la Copa Mundial de la FIFA.

Para asegurar que sea variada, enfócate preferentemente en este subtema o área: ${randomSubtopic}.

La pregunta debe ser interesante, con dificultad variada (de media a alta), y referirse estrictamente al contexto de los Mundiales de la FIFA. Evita a toda costa preguntas genéricas de fútbol de clubes (como Champions League, Copa Libertadores, ligas europeas, etc.) o jugadores en sus clubes; todo debe estar relacionado con la Copa del Mundo.

${previousQuestionsText ? `IMPORTANTE: Para evitar repeticiones, NO debes generar ninguna pregunta idéntica ni muy similar a las siguientes preguntas que ya existen en la base de datos:\n${previousQuestionsText}` : ''}

CRÍTICO: Verifica minuciosamente la veracidad histórica de la pregunta y las opciones antes de responder. Asegúrate al 100% de que la opción que indiques como correcta en "correct_answer" sea inequívocamente la única correcta según los hechos históricos de la Copa Mundial de la FIFA (por ejemplo, ten extremo cuidado con las selecciones debutantes, las fechas, los mundiales del siglo XX vs siglo XXI, y estadísticas de goleadores).

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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Error de IA' }, { status: response.status || 500 })
    }

    const text = data.choices?.[0]?.message?.content || ''
    const parsed = JSON.parse(text.trim())

    const required = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']
    for (const field of required) {
      if (!parsed[field]) {
        return NextResponse.json({ error: `Campo faltante en respuesta: ${field}` }, { status: 500 })
      }
    }

    // Normalize correct_answer
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

    // 6. Save question to database via admin client
    const { data: newQ, error: insertError } = await adminDb
      .from('trivia_questions')
      .insert({
        question: parsed.question,
        option_a: parsed.option_a,
        option_b: parsed.option_b,
        option_c: parsed.option_c,
        option_d: parsed.option_d,
        correct_answer: parsed.correct_answer,
        created_by: user.id,
        is_active: true,
        active_date: null // Null bypasses the UNIQUE active_date constraint
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting user trivia:', insertError)
      return NextResponse.json({ error: 'Error al guardar la trivia en base de datos: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json(newQ)
  } catch (error: any) {
    console.error('generate-trivia API Error:', error)
    return NextResponse.json({ error: error?.message || 'Error al generar la pregunta' }, { status: 500 })
  }
}
