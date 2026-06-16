import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getMatchResult } from '@/lib/api-football'

export async function GET() {
  try {
    const adminDb = createAdminClient()
    const diagnostics: any = {
      userDiscrepancies: [],
      predictionDiscrepancies: [],
      matchesSummary: [],
    }

    // 1. Fetch profiles
    const { data: profiles, error: pError } = await adminDb
      .from('profiles')
      .select('id, username, display_name, total_points')
    if (pError) throw pError

    // 2. Fetch phases to get points values
    const { data: phases, error: phError } = await adminDb
      .from('phases')
      .select('name, points_value')
    if (phError) throw phError
    const phasePoints: Record<string, number> = {}
    phases.forEach((p: any) => {
      phasePoints[p.name] = p.points_value
    })

    // 3. Check profile points calculations
    for (const profile of profiles || []) {
      const { data: preds } = await adminDb
        .from('predictions')
        .select('points_earned')
        .eq('user_id', profile.id)
      
      const { data: trivia } = await adminDb
        .from('trivia_answers')
        .select('points_earned')
        .eq('user_id', profile.id)

      const predSum = (preds || []).reduce((acc: number, curr: any) => acc + (curr.points_earned || 0), 0)
      const triviaSum = (trivia || []).reduce((acc: number, curr: any) => acc + (curr.points_earned || 0), 0)
      const calculatedTotal = predSum + triviaSum

      if (profile.total_points !== calculatedTotal) {
        diagnostics.userDiscrepancies.push({
          username: profile.username,
          displayName: profile.display_name,
          userId: profile.id,
          profilePoints: profile.total_points,
          calculatedPoints: calculatedTotal,
          predictionPoints: predSum,
          triviaPoints: triviaSum,
        })
      }
    }

    // 4. Fetch all completed matches
    const { data: matches, error: mError } = await adminDb
      .from('matches')
      .select('*')
      .eq('status', 'completed')
    if (mError) throw mError

    // 5. Verify prediction calculations for each completed match
    for (const match of matches || []) {
      const { data: predictions } = await adminDb
        .from('predictions')
        .select('*')
        .eq('match_id', match.id)

      const matchResult = getMatchResult(match.home_score, match.away_score)
      const pointsValue = phasePoints[match.phase] || 1

      diagnostics.matchesSummary.push({
        id: match.id,
        teams: `${match.home_team} vs ${match.away_team}`,
        score: `${match.home_score}-${match.away_score}`,
        phase: match.phase,
        predictionsCount: predictions?.length || 0,
      })

      for (const pred of predictions || []) {
        const expectedCorrect = pred.prediction === matchResult
        const expectedExact = expectedCorrect &&
          pred.predicted_home_score !== null &&
          pred.predicted_away_score !== null &&
          pred.predicted_home_score === match.home_score &&
          pred.predicted_away_score === match.away_score

        const expectedPoints = expectedCorrect
          ? (pointsValue + (expectedExact ? 2 : 0))
          : 0

        if (pred.is_correct !== expectedCorrect || pred.points_earned !== expectedPoints) {
          diagnostics.predictionDiscrepancies.push({
            predictionId: pred.id,
            userId: pred.user_id,
            matchId: pred.match_id,
            teams: `${match.home_team} vs ${match.away_team}`,
            actualScore: `${match.home_score}-${match.away_score}`,
            userPrediction: pred.prediction,
            userPredictedScore: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
            storedCorrect: pred.is_correct,
            expectedCorrect,
            storedPoints: pred.points_earned,
            expectedPoints,
          })
        }
      }
    }

    return NextResponse.json({ success: true, diagnostics })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
