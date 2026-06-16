import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const adminDb = createAdminClient()
    const results: any = {}

    // 1. Get Ricardo Marquez profile
    const { data: profileBefore } = await adminDb
      .from('profiles')
      .select('*')
      .eq('username', 'ricardomarquezc')
      .single()
    results.profileBefore = profileBefore

    // 2. Get trivia question 85 details
    const { data: questionBefore } = await adminDb
      .from('trivia_questions')
      .select('*')
      .eq('id', 85)
      .single()
    results.questionBefore = questionBefore

    // 3. Get trivia answers for question 85
    const { data: answersBefore } = await adminDb
      .from('trivia_answers')
      .select('*')
      .eq('question_id', 85)
    results.answersBefore = answersBefore

    // 4. Update the trivia question's correct answer to 'c'
    const { data: questionAfterUpdate, error: qError } = await adminDb
      .from('trivia_questions')
      .update({ correct_answer: 'c' })
      .eq('id', 85)
      .select()
    results.questionAfterUpdate = questionAfterUpdate
    results.qError = qError

    // 5. Update Ricardo's answer to correct
    if (profileBefore) {
      const { data: answerAfterUpdate, error: aError } = await adminDb
        .from('trivia_answers')
        .update({
          answer: 'c',
          is_correct: true,
          points_earned: 1
        })
        .eq('question_id', 85)
        .eq('user_id', profileBefore.id)
        .select()
      results.answerAfterUpdate = answerAfterUpdate
      results.aError = aError

      // 6. Explicitly call recalculate_user_points
      const { error: rpcError } = await adminDb.rpc('recalculate_user_points', {
        p_user_id: profileBefore.id
      })
      results.rpcError = rpcError
    }

    // 7. Get Ricardo Marquez profile after fix
    const { data: profileAfter } = await adminDb
      .from('profiles')
      .select('*')
      .eq('username', 'ricardomarquezc')
      .single()
    results.profileAfter = profileAfter

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
