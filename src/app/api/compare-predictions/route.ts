import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const groupPhaseDeadline = new Date('2026-06-15T14:39:43Z').getTime()

const isMatchLocked = (m: any, phases: any[]) => {
  const phaseInfo = phases.find(p => p.name === m.phase)
  if (phaseInfo && !phaseInfo.is_unlocked && m.phase !== 'groups' && m.phase !== 'round32') {
    return true
  }

  const currentTime = new Date().getTime()
  if (m.phase === 'groups') {
    if (currentTime >= groupPhaseDeadline) return true
    if (m.status === 'completed') return true
    if (m.status === 'scheduled') return false
  }

  if (m.status === 'completed' || m.status === 'live') return true
  if (!m.match_date) return false
  const matchTime = new Date(m.match_date).getTime()
  const gracePeriodDuration = 60 * 60 * 1000 // 1 hour grace period
  return currentTime >= matchTime + gracePeriodDuration
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get('userId')
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // 1. Authenticate user making the request
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Initialize admin client to read target user's predictions (bypassing RLS)
  const adminDb = createAdminClient()

  // 3. Fetch phases, matches, and target user's predictions
  const [phasesRes, matchesRes, predsRes] = await Promise.all([
    adminDb.from('phases').select('*'),
    adminDb.from('matches').select('*'),
    adminDb.from('predictions').select('*').eq('user_id', targetUserId)
  ])

  if (phasesRes.error || matchesRes.error || predsRes.error) {
    console.error('Database error in compare-predictions:', {
      phases: phasesRes.error,
      matches: matchesRes.error,
      predictions: predsRes.error
    })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const phases = phasesRes.data || []
  const matches = matchesRes.data || []
  const predictions = predsRes.data || []

  // 4. Sanitize predictions of target user (censor unlocked ones)
  const sanitized = predictions.map(p => {
    const match = matches.find(m => m.id === p.match_id)
    const locked = match ? isMatchLocked(match, phases) : false
    
    if (!locked) {
      return {
        id: p.id,
        match_id: p.match_id,
        prediction: null,
        predicted_home_score: null,
        predicted_away_score: null,
        points_earned: 0,
        is_correct: null
      }
    }
    return p
  })

  return NextResponse.json(sanitized)
}
