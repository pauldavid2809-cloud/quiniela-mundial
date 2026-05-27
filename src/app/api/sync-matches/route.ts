import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllMatches } from '@/lib/api-football'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(_req: NextRequest) {
  try {
    const matches = await fetchAllMatches()

    if (!matches.length) {
      return NextResponse.json({ error: 'No se obtuvieron partidos' }, { status: 400 })
    }

    let inserted = 0
    let updated = 0
    let errors = 0

    for (const match of matches) {
      // Use home+away+date as unique key since api_id might not be reliable
      const uniqueKey = `${match.home_team}_${match.away_team}_${match.match_date?.split('T')[0]}`

      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('home_team', match.home_team)
        .eq('away_team', match.away_team)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('matches')
          .update({ ...match, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) errors++
        else updated++
      } else {
        const { error } = await supabase.from('matches').insert(match)
        if (error) { console.error('Insert error:', error.message); errors++ }
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
