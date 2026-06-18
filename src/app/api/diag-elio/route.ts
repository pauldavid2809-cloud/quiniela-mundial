import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const adminDb = createAdminClient()
    
    // Find Elio Barboza's profile
    const { data: profile, error: pError } = await adminDb
      .from('profiles')
      .select('*')
      .eq('username', 'barbozs20_')
      .single()
    
    if (pError) throw pError

    // Fetch all trivia answers with question details
    const { data: triviaAnswers, error: tError } = await adminDb
      .from('trivia_answers')
      .select(`
        id,
        answer,
        is_correct,
        points_earned,
        question_id,
        trivia_questions (
          id,
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          created_at
        )
      `)
      .eq('user_id', profile.id)
      .order('question_id', { ascending: false })

    if (tError) throw tError

    // Check for recently corrected questions (like 85 and 120)
    const { data: correctedQuestions } = await adminDb
      .from('trivia_questions')
      .select('*')
      .in('id', [85, 120])

    // Get prediction points sum
    const { data: preds } = await adminDb
      .from('predictions')
      .select('points_earned')
      .eq('user_id', profile.id)

    const predSum = (preds || []).reduce((acc: number, curr: any) => acc + (curr.points_earned || 0), 0)
    const triviaSum = (triviaAnswers || []).reduce((acc: number, curr: any) => acc + (curr.points_earned || 0), 0)

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        totalPoints: profile.total_points
      },
      pointsSummary: {
        predictionPoints: predSum,
        triviaPoints: triviaSum,
        calculatedTotal: predSum + triviaSum
      },
      triviaAnswers,
      correctedQuestions
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
