import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchRecentMatches, getMatchResult } from '@/lib/api-football'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    // 1. Fetch recent matches from API (bypass cache)
    const recentMatches = await fetchRecentMatches(true)

    if (!recentMatches.length) {
      return NextResponse.json({ message: 'No hay partidos completados aún' })
    }

    // 2. Fetch all DB matches in a single query
    const { data: dbMatches, error: dbMatchesError } = await supabase
      .from('matches')
      .select('id, phase, status, home_score, away_score, home_team, away_team')

    if (dbMatchesError || !dbMatches) {
      throw new Error('Error al obtener partidos de la base de datos')
    }

    const dbMatchMap = new Map<string, any>()
    for (const dbMatch of dbMatches) {
      const key = `${dbMatch.home_team}_${dbMatch.away_team}`
      dbMatchMap.set(key, dbMatch)
    }

    // 3. Fetch all phases once to get points values
    const { data: phases, error: phasesError } = await supabase
      .from('phases')
      .select('name, points_value')

    if (phasesError || !phases) {
      throw new Error('Error al obtener fases de la base de datos')
    }

    const phasePoints: Record<string, number> = {}
    phases.forEach((p: any) => {
      phasePoints[p.name] = p.points_value
    })

    let updatedMatches = 0
    let updatedPredictions = 0
    const affectedUsers = new Set<string>()

    for (const match of recentMatches) {
      if (match.home_score === null || match.away_score === null) continue

      const key = `${match.home_team}_${match.away_team}`
      const dbMatch = dbMatchMap.get(key)

      if (!dbMatch) continue

      const scoreChanged = dbMatch.home_score !== match.home_score || dbMatch.away_score !== match.away_score
      const statusChanged = dbMatch.status !== match.status

      // If nothing changed, skip this match entirely
      if (!scoreChanged && !statusChanged) continue

      // Update match record with current score and status ('live' or 'completed')
      await supabase
        .from('matches')
        .update({
          home_score: match.home_score,
          away_score: match.away_score,
          status: match.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbMatch.id)

      updatedMatches++

      // Evaluate predictions ONLY when the match is completed
      if (match.status === 'completed') {
        const result = getMatchResult(match.home_score, match.away_score)
        const pointsValue = phasePoints[dbMatch.phase] || 1

        const { data: predictions } = await supabase
          .from('predictions')
          .select('id, user_id, prediction, predicted_home_score, predicted_away_score, is_correct, points_earned')
          .eq('match_id', dbMatch.id)

        const checkedPredictions: any[] = []
        let predictionsNeedUpdate = false

        if (predictions) {
          for (const pred of predictions) {
            const isCorrect = pred.prediction === result
            const isExactScore = isCorrect && 
              pred.predicted_home_score !== null && 
              pred.predicted_away_score !== null && 
              pred.predicted_home_score === match.home_score && 
              pred.predicted_away_score === match.away_score
              
            const pointsEarned = isCorrect 
              ? (pointsValue + (isExactScore ? 2 : 0)) 
              : 0

            const needsUpdate = pred.is_correct !== isCorrect || pred.points_earned !== pointsEarned
            if (needsUpdate) {
              predictionsNeedUpdate = true
            }
            checkedPredictions.push({ pred, isCorrect, pointsEarned, needsUpdate })
          }
        }

        // Update predictions in parallel if any need update
        if (predictionsNeedUpdate) {
          const updatePromises = checkedPredictions
            .filter(item => item.needsUpdate)
            .map(item => {
              affectedUsers.add(item.pred.user_id)
              updatedPredictions++
              return supabase
                .from('predictions')
                .update({
                  is_correct: item.isCorrect,
                  points_earned: item.pointsEarned,
                })
                .eq('id', item.pred.id)
            })

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises)
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
  } catch (error: any) {
    console.error('update-results error:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}