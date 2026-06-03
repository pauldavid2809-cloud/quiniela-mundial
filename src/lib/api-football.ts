// =============================================
// API: openfootball/worldcup.json (GitHub)
// 100% gratuita, sin API key, open source
// =============================================

const WC_JSON_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

export interface OpenMatch {
  num?: number
  date: string
  time?: string
  team1: string
  team2: string
  group?: string
  ground?: string
  round?: string
  score?: {
    ft: [number, number]
    et?: [number, number]
    p?: [number, number]
  }
}

export interface OpenWCData {
  name: string
  rounds?: Array<{
    name: string
    matches: OpenMatch[]
  }>
  matches?: OpenMatch[]
}

// Flag emoji mapping by country name
const FLAG_MAP: Record<string, string> = {
  'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷',
  'Czech Republic': '🇨🇿', 'Brazil': '🇧🇷', 'Argentina': '🇦🇷',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 'Japan': '🇯🇵',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Nigeria': '🇳🇬',
  'Cameroon': '🇨🇲', 'Ghana': '🇬🇭', 'Egypt': '🇪🇬',
  'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷', 'Australia': '🇦🇺',
  'USA': '🇺🇸', 'Canada': '🇨🇦', 'Ecuador': '🇪🇨',
  'Peru': '🇵🇪', 'Chile': '🇨🇱', 'Venezuela': '🇻🇪',
  'Switzerland': '🇨🇭', 'Croatia': '🇭🇷', 'Serbia': '🇷🇸',
  'Denmark': '🇩🇰', 'Poland': '🇵🇱', 'Ukraine': '🇺🇦',
  'Turkey': '🇹🇷', 'Austria': '🇦🇹', 'Sweden': '🇸🇪',
  'Hungary': '🇭🇺', 'Greece': '🇬🇷', 'Romania': '🇷🇴',
  'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮', 'Albania': '🇦🇱',
  'Qatar': '🇶🇦', 'Tunisia': '🇹🇳', 'Côte d\'Ivoire': '🇨🇮',
  'Mali': '🇲🇱', 'Guinea': '🇬🇳', 'DR Congo': '🇨🇩',
  'Iraq': '🇮🇶', 'Uzbekistan': '🇺🇿', 'New Zealand': '🇳🇿',
  'Panama': '🇵🇦', 'Honduras': '🇭🇳', 'Costa Rica': '🇨🇷',
  'Jamaica': '🇯🇲', 'Haiti': '🇭🇹',
}

const TEAM_TRANSLATION: Record<string, string> = {
  'Mexico': 'México',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Czech Republic': 'República Checa',
  'Brazil': 'Brasil',
  'Argentina': 'Argentina',
  'France': 'Francia',
  'Germany': 'Alemania',
  'Spain': 'España',
  'England': 'Inglaterra',
  'Portugal': 'Portugal',
  'Netherlands': 'Países Bajos',
  'Belgium': 'Bélgica',
  'Uruguay': 'Uruguay',
  'Colombia': 'Colombia',
  'Japan': 'Japón',
  'Morocco': 'Marruecos',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigeria',
  'Cameroon': 'Camerún',
  'Ghana': 'Ghana',
  'Egypt': 'Egipto',
  'Saudi Arabia': 'Arabia Saudita',
  'Iran': 'Irán',
  'Australia': 'Australia',
  'USA': 'EE. UU.',
  'Canada': 'Canadá',
  'Ecuador': 'Ecuador',
  'Peru': 'Perú',
  'Chile': 'Chile',
  'Venezuela': 'Venezuela',
  'Switzerland': 'Suiza',
  'Croatia': 'Croacia',
  'Serbia': 'Serbia',
  'Denmark': 'Dinamarca',
  'Poland': 'Polonia',
  'Ukraine': 'Ucrania',
  'Turkey': 'Turquía',
  'Austria': 'Austria',
  'Sweden': 'Suecia',
  'Hungary': 'Hungría',
  'Romania': 'Rumania',
  'Slovakia': 'Eslovaquia',
  'Slovenia': 'Eslovenia',
  'Albania': 'Albania',
  'Qatar': 'Catar',
  'Tunisia': 'Túnez',
  'Côte d\'Ivoire': 'Costa de Marfil',
  'Mali': 'Mali',
  'Guinea': 'Guinea',
  'DR Congo': 'RD Congo',
  'Iraq': 'Irak',
  'Uzbekistan': 'Uzbekistán',
  'New Zealand': 'Nueva Zelanda',
  'Panama': 'Panamá',
  'Honduras': 'Honduras',
  'Costa Rica': 'Costa Rica',
  'Jamaica': 'Jamaica',
  'Haiti': 'Haití',
}

function translateTeam(teamName: string): string {
  return TEAM_TRANSLATION[teamName] || teamName
}

function getFlag(teamName: string): string {
  return FLAG_MAP[teamName] || '🏳️'
}

function mapPhase(roundName: string): string {
  const r = roundName.toLowerCase()
  if (r.includes('group') || r.includes('matchday') || r.includes('grupo')) return 'groups'
  if (r.includes('round of 32') || r.includes('32') || r.includes('treintaidosavo')) return 'round32'
  if (r.includes('round of 16') || r.includes('16') || r.includes('octavo')) return 'round16'
  if (r.includes('quarter') || r.includes('cuarto')) return 'quarterfinals'
  if (r.includes('semi')) return 'semifinals'
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter') && !r.includes('16') && !r.includes('32')) return 'final'
  return 'groups'
}

function parseMatchDate(dateStr: string, timeStr?: string): string | null {
  try {
    const date = dateStr // format: "2026-06-11"
    const time = timeStr || '00:00'
    // Remove timezone indicators for parsing
    const cleanTime = time.replace(/\s*UTC.*/i, '').trim()
    return `${date}T${cleanTime}:00.000Z`
  } catch {
    return null
  }
}

function getStatus(match: OpenMatch): 'scheduled' | 'live' | 'completed' {
  if (match.score && (match.score.ft[0] !== undefined || match.score.ft[1] !== undefined)) {
    return 'completed'
  }
  // Check if match date is in the past
  if (match.date) {
    const matchDate = new Date(match.date)
    if (matchDate < new Date()) return 'completed'
  }
  return 'scheduled'
}

function extractGroupName(roundName: string, match: OpenMatch): string | null {
  // Try from round name: "Group A", "Matchday 1 - Group A", etc.
  const groupMatch = roundName.match(/group\s+([a-l])/i)
  if (groupMatch) return `Grupo ${groupMatch[1].toUpperCase()}`

  // Try from match.group field
  if (match.group) {
    const mg = match.group.match(/([a-l])/i)
    if (mg) return `Grupo ${mg[1].toUpperCase()}`
  }

  return null
}

export async function fetchAllMatches() {
  try {
    const res = await fetch(WC_JSON_URL, {
      next: { revalidate: 3600 },
      headers: { 'Accept': 'application/json' }
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data: OpenWCData = await res.json()
    const matches: ReturnType<typeof transformOpenMatch>[] = []

    // Handle both formats: rounds[] or matches[]
    if (data.rounds) {
      for (const round of data.rounds) {
        for (const match of round.matches) {
          matches.push(transformOpenMatch(match, round.name))
        }
      }
    } else if (data.matches) {
      for (const match of data.matches) {
        matches.push(transformOpenMatch(match, match.round || 'Group Stage'))
      }
    }

    return matches
  } catch (error) {
    console.error('Error fetching WC data:', error)
    return []
  }
}

export function transformOpenMatch(match: OpenMatch, roundName: string) {
  const phase = mapPhase(roundName)
  const groupName = phase === 'groups' ? extractGroupName(roundName, match) : null
  const status = getStatus(match)

  return {
    api_id: match.num || Math.floor(Math.random() * 100000),
    home_team: translateTeam(match.team1),
    away_team: translateTeam(match.team2),
    home_flag: getFlag(match.team1),
    away_flag: getFlag(match.team2),
    phase,
    match_date: parseMatchDate(match.date, match.time),
    home_score: match.score?.ft[0] ?? null,
    away_score: match.score?.ft[1] ?? null,
    status,
    group_name: groupName,
    venue: match.ground || null,
  }
}

export async function fetchRecentMatches() {
  // Same source — filter to recent/completed
  const all = await fetchAllMatches()
  return all.filter(m => m.status === 'completed' || m.status === 'live')
}

export function getMatchResult(homeScore: number, awayScore: number): 'home' | 'draw' | 'away' {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}
