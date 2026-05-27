const API_KEY = process.env.API_FOOTBALL_KEY!
const BASE_URL = 'https://v3.football.api-sports.io'
const WORLD_CUP_LEAGUE_ID = 1
const SEASON = 2026

const headers = {
  'x-apisports-key': API_KEY,
}

export interface APIMatch {
  fixture: {
    id: number
    date: string
    status: { short: string; long: string }
    venue: { name: string; city: string }
  }
  league: { round: string }
  teams: {
    home: { id: number; name: string; logo: string }
    away: { id: number; name: string; logo: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

function mapPhase(round: string): string {
  const r = round.toLowerCase()
  if (r.includes('group')) return 'groups'
  if (r.includes('32') || r.includes('round of 32')) return 'round32'
  if (r.includes('16') || r.includes('round of 16')) return 'round16'
  if (r.includes('quarter')) return 'quarterfinals'
  if (r.includes('semi')) return 'semifinals'
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'final'
  return 'groups'
}

function mapStatus(apiStatus: string): 'scheduled' | 'live' | 'completed' {
  const live = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE']
  const done = ['FT', 'AET', 'PEN']
  if (live.includes(apiStatus)) return 'live'
  if (done.includes(apiStatus)) return 'completed'
  return 'scheduled'
}

export async function fetchAllMatches(): Promise<APIMatch[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${SEASON}`,
      { headers, next: { revalidate: 3600 } }
    )
    const data = await res.json()
    return data.response || []
  } catch (error) {
    console.error('Error fetching matches:', error)
    return []
  }
}

export async function fetchLiveAndRecentMatches(): Promise<APIMatch[]> {
  try {
    // Fetch live matches
    const liveRes = await fetch(
      `${BASE_URL}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${SEASON}&live=all`,
      { headers }
    )
    const liveData = await liveRes.json()

    // Fetch last 10 completed
    const recentRes = await fetch(
      `${BASE_URL}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${SEASON}&last=10`,
      { headers }
    )
    const recentData = await recentRes.json()

    const all = [...(liveData.response || []), ...(recentData.response || [])]
    // Dedup by fixture id
    const seen = new Set()
    return all.filter(m => {
      if (seen.has(m.fixture.id)) return false
      seen.add(m.fixture.id)
      return true
    })
  } catch (error) {
    console.error('Error fetching live/recent matches:', error)
    return []
  }
}

export function transformMatch(m: APIMatch) {
  const phase = mapPhase(m.league.round)
  const score = m.score.fulltime
  const groupMatch = m.league.round.match(/group\s+([a-z])/i)
  const groupName = groupMatch ? `Grupo ${groupMatch[1].toUpperCase()}` : null

  return {
    api_id: m.fixture.id,
    home_team: m.teams.home.name,
    away_team: m.teams.away.name,
    home_flag: m.teams.home.logo,
    away_flag: m.teams.away.logo,
    phase,
    match_date: m.fixture.date,
    home_score: score.home,
    away_score: score.away,
    status: mapStatus(m.fixture.status.short),
    group_name: groupName,
    venue: m.fixture.venue.name,
  }
}

export function getMatchResult(homeScore: number, awayScore: number): 'home' | 'draw' | 'away' {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}
