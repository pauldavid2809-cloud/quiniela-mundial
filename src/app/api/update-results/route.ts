import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchLiveAndRecentMatches, transformMatch, getMatchResult } from '@/lib/api-football'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  // Optional cron secret check
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const apiMatches = await fetchLiveAndRecentMatches()

    if (!apiMatches.length) {
      return NextResponse.json({ message: 'No hay partidos recientes para actualizar' })
    }

    let updatedMatches = 0
    let updatedPredictions = 0
    const affectedUsers = new Set<string>()

    for (const apiMatch of apiMatches) {
      const match = transformMatch(apiMatch)

      // Update match in DB
      const { data: dbMatch, error: matchError } = await supabase
        .from('matches')
        .update({
          home_score: match.home_score,
          away_score: match.away_score,
          status: match.status,
          updated_at: new Date().toISOString(),
        })
        .eq('api_id', match.api_id)
        .select('id, phase')
        .single()

      if (matchError || !dbMatch) continue
      updatedMatches++

      // Only process predictions for completed matches
      if (match.status === 'completed' && match.home_score !== null && match.away_score !== null) {
        const result = getMatchResult(match.home_score, match.away_score)

        // Get phase points value
        const { data: phase } = await supabase
          .from('phases')
          .select('points_value')
          .eq('name', dbMatch.phase)
          .single()

        const pointsValue = phase?.points_value || 1

        // Get all predictions for this match that haven't been evaluated yet
        const { data: predictions } = await supabase
          .from('predictions')
          .select('id, user_id, prediction')
          .eq('match_id', dbMatch.id)
          .is('is_correct', null) // Only unevaluated

        if (predictions) {
          for (const pred of predictions) {
            const isCorrect = pred.prediction === result
            const pointsEarned = isCorrect ? pointsValue : 0

            await supabase
              .from('predictions')
              .update({ is_correct: isCorrect, points_earned: pointsEarned })
              .eq('id', pred.id)

            affectedUsers.add(pred.user_id)
            updatedPredictions++
          }
        }
      }
    }

    // Recalculate total points for affected users
    for (const userId of affectedUsers) {
      await supabase.rpc('recalculate_user_points', { p_user_id: userId })
    }

    return NextResponse.json({
      message: `${updatedMatches} partidos actualizados, ${updatedPredictions} predicciones evaluadas, ${affectedUsers.size} usuarios recalculados`,
      updatedMatches,
      updatedPredictions,
      affectedUsers: affectedUsers.size,
    })
  } catch (error) {
    console.error('update-results error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Also allow GET for Vercel cron
export async function GET(req: NextRequest) {
  return POST(req)
}
