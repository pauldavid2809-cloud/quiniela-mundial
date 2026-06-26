import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getMatchResult } from '@/lib/api-football'

export async function GET(request: NextRequest) {
  try {
    const adminDb = createAdminClient()
    
    // Parse query params
    const { searchParams } = new URL(request.url)
    const usernameParam = searchParams.get('username') || 'arcelp'
    const shouldFix = searchParams.get('fix') === 'true'
    
    // Find the profile (handling optional @ prefix case-insensitively)
    const usernameClean = usernameParam.trim()
    const { data: profiles, error: pError } = await adminDb
      .from('profiles')
      .select('*')
      .or(`username.ilike.${usernameClean},username.ilike.@${usernameClean}`)
    
    if (pError) throw pError
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: false, error: `Usuario '${usernameClean}' no encontrado` })
    }

    const profile = profiles[0]
    const userId = profile.id

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
      .eq('user_id', userId)

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
      .eq('user_id', userId)

    if (tError) throw tError

    // Fetch phases to get points values
    const { data: phases, error: phError } = await adminDb
      .from('phases')
      .select('name, points_value')
    
    if (phError) throw phError
    
    const phasePoints: Record<string, number> = {}
    phases?.forEach((p: any) => {
      phasePoints[p.name] = p.points_value
    })

    const auditedPredictions: any[] = []
    const predictionFixes: any[] = []
    
    // Audit predictions
    for (const pred of predictions || []) {
      const match = pred.matches as any
      if (!match || match.status !== 'completed') {
        auditedPredictions.push({
          id: pred.id,
          teams: match ? `${match.home_team} vs ${match.away_team}` : 'Desconocido',
          status: match ? match.status : 'Desconocido',
          userPrediction: pred.prediction,
          userPredictedScore: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
          storedCorrect: pred.is_correct,
          storedPoints: pred.points_earned,
          comment: 'Partido no completado o sin datos de partido'
        })
        continue
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

      if (!isConsistent && shouldFix) {
        // Apply fix to predictions
        const { error: updError } = await adminDb
          .from('predictions')
          .update({
            is_correct: expectedCorrect,
            points_earned: expectedPoints
          })
          .eq('id', pred.id)

        if (updError) {
          predictionFixes.push({ id: pred.id, error: updError.message })
        } else {
          predictionFixes.push({
            id: pred.id,
            teams: `${match.home_team} vs ${match.away_team}`,
            oldCorrect: pred.is_correct,
            newCorrect: expectedCorrect,
            oldPoints: pred.points_earned,
            newPoints: expectedPoints
          })
          pred.is_correct = expectedCorrect
          pred.points_earned = expectedPoints
        }
      }

      auditedPredictions.push({
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
      })
    }

    const auditedTrivia: any[] = []
    const triviaFixes: any[] = []

    // Audit trivia answers
    for (const ans of triviaAnswers || []) {
      const q = ans.trivia_questions as any
      if (!q) {
        auditedTrivia.push({
          id: ans.id,
          questionId: ans.question_id,
          userAnswer: ans.answer,
          storedCorrect: ans.is_correct,
          storedPoints: ans.points_earned,
          comment: 'Detalles de la pregunta no encontrados'
        })
        continue
      }

      const expectedCorrect = ans.answer === q.correct_answer
      const expectedPoints = expectedCorrect ? 1 : 0
      const isConsistent = ans.is_correct === expectedCorrect && ans.points_earned === expectedPoints

      if (!isConsistent && shouldFix) {
        // Apply fix to trivia answers
        const { error: updError } = await adminDb
          .from('trivia_answers')
          .update({
            is_correct: expectedCorrect,
            points_earned: expectedPoints
          })
          .eq('id', ans.id)

        if (updError) {
          triviaFixes.push({ id: ans.id, error: updError.message })
        } else {
          triviaFixes.push({
            id: ans.id,
            questionId: ans.question_id,
            oldCorrect: ans.is_correct,
            newCorrect: expectedCorrect,
            oldPoints: ans.points_earned,
            newPoints: expectedPoints
          })
          ans.is_correct = expectedCorrect
          ans.points_earned = expectedPoints
        }
      }

      auditedTrivia.push({
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
      })
    }

    // Recalculate total points if requested or if fixes were applied
    let rpcRecalculated = false
    let rpcErrorMsg = null
    if (shouldFix && (predictionFixes.length > 0 || triviaFixes.length > 0)) {
      const { error: rpcError } = await adminDb.rpc('recalculate_user_points', {
        p_user_id: userId
      })
      if (!rpcError) {
        rpcRecalculated = true
        // Refresh profile data
        const { data: updatedProfile } = await adminDb
          .from('profiles')
          .select('total_points')
          .eq('id', userId)
          .single()
        if (updatedProfile) {
          profile.total_points = updatedProfile.total_points
        }
      } else {
        rpcErrorMsg = rpcError.message
      }
    }

    const totalPredictionPoints = auditedPredictions.reduce((acc, p) => acc + (p.storedPoints || 0), 0)
    const totalTriviaPoints = auditedTrivia.reduce((acc, t) => acc + (t.storedPoints || 0), 0)
    const calculatedPoints = totalPredictionPoints + totalTriviaPoints
    
    const hasDiscrepancy = calculatedPoints !== profile.total_points || 
      auditedPredictions.some(p => p.isConsistent === false) ||
      auditedTrivia.some(t => t.isConsistent === false)

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
        storedTotalPoints: profile.total_points,
        isConsistent: !hasDiscrepancy,
        fixesApplied: shouldFix ? {
          predictionsCount: predictionFixes.length,
          predictions: predictionFixes,
          triviaCount: triviaFixes.length,
          trivia: triviaFixes,
          rpcRecalculated,
          rpcErrorMsg
        } : null
      },
      predictions: auditedPredictions,
      trivia: auditedTrivia
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
