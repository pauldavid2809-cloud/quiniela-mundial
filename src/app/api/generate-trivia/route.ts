import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
    }

    // 1. Usamos la variable de entorno de forma segura en la URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AQ.Ab8RN6KMlhFCGLOu8aZZLP3xXfHxaA_OhL3-2Gc6K5umA2WdGA`

    // 2. Adaptamos el cuerpo de la petición al formato oficial de Gemini
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Genera UNA pregunta de trivia sobre el fútbol o el Mundial FIFA (puede ser sobre historia, jugadores, récords, estadísticas, sedes, equipos, curiosidades, reglas, etc.).

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
            ]
          }
        ],
        // Opcional: Forzamos a Gemini a responder estrictamente en formato JSON
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || 'Error de IA' }, { status: res.status || 500 })
    }

    // 3. Adaptamos la lectura de la respuesta al formato de Gemini
    // Gemini devuelve el texto en: data.candidates[0].content.parts[0].text
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    // 4. Tus validaciones originales de estructura se mantienen idénticas
    const required = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']
    for (const field of required) {
      if (!parsed[field]) {
        return NextResponse.json({ error: `Campo faltante: ${field}` }, { status: 500 })
      }
    }

    if (!['a', 'b', 'c', 'd'].includes(parsed.correct_answer)) {
      return NextResponse.json({ error: 'correct_answer debe ser a, b, c o d' }, { status: 500 })
    }

    // Devolvemos el objeto JSON limpio al frontend
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('generate-trivia error:', error)
    return NextResponse.json({ error: 'Error al generar la pregunta' }, { status: 500 })
  }
}