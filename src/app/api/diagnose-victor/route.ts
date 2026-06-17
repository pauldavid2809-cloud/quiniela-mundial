import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const adminDb = createAdminClient()
    
    // Fetch details for questions 33, 95, 120
    const { data: questions, error: qError } = await adminDb
      .from('trivia_questions')
      .select('*')
      .in('id', [33, 95, 120])
    
    if (qError) throw qError

    return NextResponse.json({ success: true, questions })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
