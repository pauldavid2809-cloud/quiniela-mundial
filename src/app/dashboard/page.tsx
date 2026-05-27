import { createClient } from '@/lib/supabase/server'
import QuinielaClient from '@/components/QuinielaClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get phases
  const { data: phases } = await supabase
    .from('phases')
    .select('*')
    .order('sort_order')

  // Get all matches
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true })

  // Get user predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user!.id)

  return (
    <QuinielaClient
      phases={phases || []}
      matches={matches || []}
      predictions={predictions || []}
      userId={user!.id}
    />
  )
}
