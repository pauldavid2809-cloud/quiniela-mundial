import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(req: Request) {
  try {
    // 1. Initialize Supabase Client
    let supabase;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (serviceRoleKey) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    } else {
      // Fallback: Login as admin
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await client.auth.signInWithPassword({
        email: process.env.ADMIN_EMAIL!,
        password: process.env.ADMIN_PASSWORD!
      })
      if (error || !data.session) {
        throw new Error('Admin auth fallback failed: ' + error?.message)
      }
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`
            }
          }
        }
      )
    }

    // 2. Determine Venezuela current date
    const todayStr = getCaracasDateString()

    // 3. Check if trivia already exists for today
    const { data: existing } = await supabase
      .from('trivia_questions')
      .select('id')
      .eq('active_date', todayStr)
      .single()

    if (existing) {
      return NextResponse.json({ message: `La trivia para hoy (${todayStr}) ya existe.` })
    }

    // 4. Query Groq API
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY no configurado en variables de entorno' }, { status: 500 })
    }

    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions'

    const prompt = `Genera una pregunta de trivia única, verídica, histórica y muy interesante en español sobre la historia de los mundiales de fútbol de la FIFA. 
    Debe ser de opción múltiple con 4 opciones. La respuesta correcta debe ser clara e inequívoca.
    Devuelve estrictamente un objeto JSON con el siguiente formato exacto sin agregar explicaciones fuera del JSON:
    {
      "question": "La pregunta...",
      "option_a": "Opción A",
      "option_b": "Opción B",
      "option_c": "Opción C",
      "option_d": "Opción D",
      "correct_answer": "a"
    }
    Nota: correct_answer debe ser obligatoriamente una de las letras minúsculas: 'a', 'b', 'c' o 'd'.`

    const response = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_object',
        },
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq API Error:', errText)
      return NextResponse.json({ error: 'Error al consultar API de Groq' }, { status: 500 })
    }

    const resJson = await response.json()
    const textResult = resJson?.choices?.[0]?.message?.content
    if (!textResult) {
      return NextResponse.json({ error: 'Respuesta vacía de Groq' }, { status: 500 })
    }

    // 5. Parse and Validate JSON
    const parsed = JSON.parse(textResult.trim())
    if (!parsed.question || !parsed.option_a || !parsed.option_b || !parsed.option_c || !parsed.option_d || !parsed.correct_answer) {
      throw new Error('Formato de datos de Groq incompleto: ' + textResult)
    }

    const correct = parsed.correct_answer.toLowerCase()
    if (!['a', 'b', 'c', 'd'].includes(correct)) {
      throw new Error('Respuesta correcta inválida: ' + correct)
    }

    // 6. Insert into database
    const { error: insertError } = await supabase
      .from('trivia_questions')
      .insert({
        question: parsed.question,
        option_a: parsed.option_a,
        option_b: parsed.option_b,
        option_c: parsed.option_c,
        option_d: parsed.option_d,
        correct_answer: correct,
        active_date: todayStr,
        is_active: true
      })

    if (insertError) {
      console.error('Error al insertar trivia:', insertError)
      return NextResponse.json({ error: 'Error al guardar la trivia en base de datos: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Trivia generada e insertada con éxito para hoy (${todayStr})`,
      trivia: parsed
    })
  } catch (error: any) {
    console.error('generate-trivia API Error:', error)
    return NextResponse.json({ error: error?.message || 'Error interno del servidor' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
