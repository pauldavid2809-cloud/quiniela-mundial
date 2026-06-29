import { createClient } from '@/lib/supabase/server'
import RankingClient from '@/components/RankingClient'

export const revalidate = 60 // revalidate every minute

export default async function RankingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch ranking
  const { data: ranking } = await supabase
    .from('profiles')
    .select('id, username, display_name, total_points')
    .order('total_points', { ascending: false })
    .limit(50)

  // Fetch phases
  const { data: phases } = await supabase
    .from('phases')
    .select('*')
    .order('sort_order', { ascending: true })

  // Fetch matches
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true })

  // Fetch current user predictions
  let userPredictions: any[] = []
  if (user) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
    userPredictions = preds || []
  }

  // Get user's own points and absolute rank
  let userRank = -1
  let userProfile: any = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, total_points')
      .eq('id', user.id)
      .single()
    if (profile) {
      userProfile = profile
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('total_points', profile.total_points)
      userRank = (count ?? 0) + 1
    }
  }

  return (
    <RankingClient
      phases={phases || []}
      ranking={ranking || []}
      currentUser={user}
      userRank={userRank}
      userProfile={userProfile}
      initialMatches={matches || []}
      initialUserPredictions={userPredictions}
    />
  )
}
