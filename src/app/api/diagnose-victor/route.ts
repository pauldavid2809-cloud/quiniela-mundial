import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const adminDb = createAdminClient()
    
    // Find all profiles containing 'victor' in username or display_name
    const { data: profiles, error: pError } = await adminDb
      .from('profiles')
      .select('*')
      .or('username.ilike.%victor%,display_name.ilike.%victor%')
    
    if (pError) throw pError

    const results: any[] = []

    for (const profile of profiles || []) {
      // Find their answer to question 85 (the corrected trivia question)
      const { data: q85Answer } = await adminDb
        .from('trivia_answers')
        .select('*')
        .eq('user_id', profile.id)
        .eq('question_id', 85)
        .single()

      // Fetch all their trivia answers that are marked incorrect
      const { data: incorrectAnswers } = await adminDb
        .from('trivia_answers')
        .select(`
          id,
          question_id,
          answer,
          is_correct,
          points_earned,
          trivia_questions (
            question,
            correct_answer
          )
        `)
        .eq('user_id', profile.id)
        .eq('is_correct', false)

      results.push({
        profile,
        q85Answer,
        incorrectAnswers
      })
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
