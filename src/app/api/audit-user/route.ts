import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getMatchResult } from '@/lib/api-football'

export async function GET() {
  try {
    const adminDb = createAdminClient()
    
    // Find the profile of barbozs20_ (handling optional @ prefix case-insensitively)
    const { data: profiles, error: pError } = await adminDb
      .from('profiles')
      .select('*')
      .or('username.ilike.barbozs20_,username.ilike.@barbozs20_')
    
    if (pError) throw pError
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' })
    }

    const profile = profiles[0]

    // Fetch predictions with match details
    const { data: predictions, error: prError } = await adminDb
      .from('predictions')
      .select(`
        id,
        prediction,
        predicted_home_score,
        predicted_away_score,
        is_correct,
        points_earned,
        match_id,
        matches (
          home_team,
          away_team,
          home_score,
          away_score,
          status,
          phase
        )
      `)
      .eq('user_id', profile.id)

    if (prError) throw prError

    // Fetch trivia answers with question details
    const { data: triviaAnswers, error: tError } = await adminDb
      .from('trivia_answers')
      .select(`
        id,
        answer,
        is_correct,
        points_earned,
        question_id,
        trivia_questions (
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer
        )
      `)
      .eq('user_id', profile.id)

    if (tError) throw tError

    // Fetch phases to get points values
    const { data: phases } = await adminDb
      .from('phases')
      .select('name, points_value')
    
    const phasePoints: Record<string, number> = {}
    phases?.forEach((p: any) => {
      phasePoints[p.name] = p.points_value
    })

    // Audit predictions
    const auditedPredictions = (predictions || []).map((pred: any) => {
      const match = pred.matches
      if (!match || match.status !== 'completed') {
        return {
          id: pred.id,
          teams: match ? `${match.home_team} vs ${match.away_team}` : 'Desconocido',
          status: match ? match.status : 'Desconocido',
          userPrediction: pred.prediction,
          userPredictedScore: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
          storedCorrect: pred.is_correct,
          storedPoints: pred.points_earned,
          comment: 'Partido no completado'
        }
      }

      const matchResult = getMatchResult(match.home_score, match.away_score)
      const pointsValue = phasePoints[match.phase] || 1
      const expectedCorrect = pred.prediction === matchResult
      const expectedExact = expectedCorrect &&
        pred.predicted_home_score !== null &&
        pred.predicted_away_score !== null &&
        pred.predicted_home_score === match.home_score &&
        pred.predicted_away_score === match.away_score

      const expectedPoints = expectedCorrect
        ? (pointsValue + (expectedExact ? 2 : 0))
        : 0

      const isConsistent = pred.is_correct === expectedCorrect && pred.points_earned === expectedPoints

      return {
        id: pred.id,
        teams: `${match.home_team} vs ${match.away_team}`,
        status: match.status,
        phase: match.phase,
        actualScore: `${match.home_score}-${match.away_score}`,
        userPrediction: pred.prediction,
        userPredictedScore: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
        storedCorrect: pred.is_correct,
        expectedCorrect,
        storedPoints: pred.points_earned,
        expectedPoints,
        isConsistent
      }
    })

    // Audit trivia answers
    const auditedTrivia = (triviaAnswers || []).map((ans: any) => {
      const q = ans.trivia_questions
      if (!q) {
        return {
          id: ans.id,
          questionId: ans.question_id,
          userAnswer: ans.answer,
          storedCorrect: ans.is_correct,
          storedPoints: ans.points_earned,
          comment: 'Detalles de la pregunta no encontrados'
        }
      }

      const expectedCorrect = ans.answer === q.correct_answer
      const expectedPoints = expectedCorrect ? 1 : 0
      const isConsistent = ans.is_correct === expectedCorrect && ans.points_earned === expectedPoints

      return {
        id: ans.id,
        questionId: ans.question_id,
        questionText: q.question,
        userAnswer: ans.answer,
        correctAnswer: q.correct_answer,
        storedCorrect: ans.is_correct,
        expectedCorrect,
        storedPoints: ans.points_earned,
        expectedPoints,
        isConsistent
      }
    })

    const totalPredictionPoints = auditedPredictions.reduce((acc, p) => acc + (p.storedPoints || 0), 0)
    const totalTriviaPoints = auditedTrivia.reduce((acc, t) => acc + (t.storedPoints || 0), 0)
    const calculatedPoints = totalPredictionPoints + totalTriviaPoints

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        storedTotalPoints: profile.total_points
      },
      summary: {
        totalPredictionPoints,
        totalTriviaPoints,
        calculatedPoints,
        isConsistent: calculatedPoints === profile.total_points
      },
      predictions: auditedPredictions,
      trivia: auditedTrivia
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
