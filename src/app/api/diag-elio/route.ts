import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const adminDb = createAdminClient()
    const results: any = {
      questionBefore: null,
      questionAfter: null,
      updatedAnswers: [],
      recalculatedUsers: []
    }

    // 1. Get question 127 before update
    const { data: qBefore } = await adminDb
      .from('trivia_questions')
      .select('*')
      .eq('id', 127)
      .single()
    results.questionBefore = qBefore

    // 2. Update the trivia question's correct answer to 'd'
    const { data: qAfter, error: qError } = await adminDb
      .from('trivia_questions')
      .update({ correct_answer: 'd' })
      .eq('id', 127)
      .select()
      .single()
    
    if (qError) throw qError
    results.questionAfter = qAfter

    // 3. Get all answers for question 127
    const { data: answers, error: aError } = await adminDb
      .from('trivia_answers')
      .select('*')
      .eq('question_id', 127)

    if (aError) throw aError

    const affectedUsers = new Set<string>()

    // 4. Update correctness and points for all answers
    for (const ans of answers || []) {
      const isCorrectNow = ans.answer === 'd'
      const pointsEarnedNow = isCorrectNow ? 1 : 0

      if (ans.is_correct !== isCorrectNow || ans.points_earned !== pointsEarnedNow) {
        await adminDb
          .from('trivia_answers')
          .update({
            is_correct: isCorrectNow,
            points_earned: pointsEarnedNow
          })
          .eq('id', ans.id)

        results.updatedAnswers.push({
          answerId: ans.id,
          userId: ans.user_id,
          userAnswer: ans.answer,
          oldCorrect: ans.is_correct,
          newCorrect: isCorrectNow,
          oldPoints: ans.points_earned,
          newPoints: pointsEarnedNow
        })

        affectedUsers.add(ans.user_id)
      }
    }

    // 5. Recalculate points for all affected users
    for (const userId of Array.from(affectedUsers)) {
      const { error: rpcError } = await adminDb.rpc('recalculate_user_points', {
        p_user_id: userId
      })
      if (!rpcError) {
        const { data: profile } = await adminDb
          .from('profiles')
          .select('username, display_name, total_points')
          .eq('id', userId)
          .single()

        results.recalculatedUsers.push({
          userId,
          username: profile?.username,
          displayName: profile?.display_name,
          newTotalPoints: profile?.total_points
        })
      } else {
        results.recalculatedUsers.push({ userId, error: rpcError.message })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
