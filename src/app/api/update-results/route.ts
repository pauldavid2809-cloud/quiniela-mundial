import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchRecentMatches, getMatchResult } from '@/lib/api-football'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    const recentMatches = await fetchRecentMatches()

    if (!recentMatches.length) {
      return NextResponse.json({ message: 'No hay partidos completados aún' })
    }

    let updatedMatches = 0
    let updatedPredictions = 0
    const affectedUsers = new Set<string>()

    for (const match of recentMatches) {
      if (match.home_score === null || match.away_score === null) continue

      const { data: dbMatch } = await supabase
        .from('matches')
        .select('id, phase, status, home_score, away_score')
        .eq('home_team', match.home_team)
        .eq('away_team', match.away_team)
        .single()

      if (!dbMatch) continue

      const scoreChanged = dbMatch.home_score !== match.home_score || dbMatch.away_score !== match.away_score

      // Skip match only if it was already marked as completed and scores haven't changed
      if (dbMatch.status === 'completed' && !scoreChanged) continue

      await supabase
        .from('matches')
        .update({
          home_score: match.home_score,
          away_score: match.away_score,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbMatch.id)

      updatedMatches++

      const result = getMatchResult(match.home_score, match.away_score)

      const { data: phase } = await supabase
        .from('phases')
        .select('points_value')
        .eq('name', dbMatch.phase)
        .single()

      const pointsValue = phase?.points_value || 1

      const { data: predictions } = await supabase
        .from('predictions')
        .select('id, user_id, prediction, predicted_home_score, predicted_away_score, is_correct, points_earned')
        .eq('match_id', dbMatch.id)

      if (predictions) {
        for (const pred of predictions) {
          const isCorrect = pred.prediction === result
          
          // Exact score prediction bonus of +2 points
          const isExactScore = isCorrect && 
            pred.predicted_home_score !== null && 
            pred.predicted_away_score !== null && 
            pred.predicted_home_score === match.home_score && 
            pred.predicted_away_score === match.away_score
            
          const pointsEarned = isCorrect 
            ? (pointsValue + (isExactScore ? 2 : 0)) 
            : 0

          // Update only if results changed or weren't evaluated yet
          if (pred.is_correct !== isCorrect || pred.points_earned !== pointsEarned) {
            await supabase
              .from('predictions')
              .update({
                is_correct: isCorrect,
                points_earned: pointsEarned,
              })
              .eq('id', pred.id)

            affectedUsers.add(pred.user_id)
            updatedPredictions++
          }
        }
      }
    }

    for (const userId of Array.from(affectedUsers)) {
      await supabase.rpc('recalculate_user_points', { p_user_id: userId })
    }

    return NextResponse.json({
      message: `${updatedMatches} partidos actualizados, ${updatedPredictions} predicciones evaluadas`,
      updatedMatches,
      updatedPredictions,
      affectedUsers: affectedUsers.size,
    })
  } catch (error) {
    console.error('update-results error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}