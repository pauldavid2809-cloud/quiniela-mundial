import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllMatches, transformMatch } from '@/lib/api-football'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const matches = await fetchAllMatches()

    if (!matches.length) {
      return NextResponse.json({ error: 'No se obtuvieron partidos de la API' }, { status: 400 })
    }

    let inserted = 0
    let updated = 0
    let errors = 0

    for (const apiMatch of matches) {
      const match = transformMatch(apiMatch)

      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('api_id', match.api_id)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('matches')
          .update({ ...match, updated_at: new Date().toISOString() })
          .eq('api_id', match.api_id)
        if (error) errors++
        else updated++
      } else {
        const { error } = await supabase.from('matches').insert(match)
        if (error) errors++
        else inserted++
      }
    }

    return NextResponse.json({
      message: `✅ ${inserted} partidos importados, ${updated} actualizados, ${errors} errores`,
      inserted, updated, errors, total: matches.length,
    })
  } catch (error) {
    console.error('sync-matches error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
