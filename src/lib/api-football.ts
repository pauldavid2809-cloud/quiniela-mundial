// =============================================
// API: worldcup26.ir
// 100% gratuita, sin API key, open source
// =============================================

const WC_GAMES_URL = 'https://worldcup26.ir/get/games'

export interface ApiGame {
  _id: string
  id: string
  home_team_id: string
  away_team_id: string
  home_score: string
  away_score: string
  home_scorers: string
  away_scorers: string
  group: string
  matchday: string
  local_date: string // format "MM/DD/YYYY HH:MM"
  persian_date: string
  stadium_id: string
  finished: string // "TRUE" or "FALSE"
  time_elapsed: string // "finished" or "notstarted" or live minute
  type: string // "group", "r32", "r16", "qf", "sf", "third", "final"
  home_team_name_en?: string
  home_team_name_fa?: string
  away_team_name_en?: string
  away_team_name_fa?: string
  home_team_label?: string
  away_team_label?: string
}

// ISO 3166-1 alpha-2 mapping by country name for FlagCDN
const ISO_MAP: Record<string, string> = {
  // Original
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr',
  'Czech Republic': 'cz', 'Brazil': 'br', 'Argentina': 'ar',
  'France': 'fr', 'Germany': 'de', 'Spain': 'es', 'England': 'gb-eng',
  'Portugal': 'pt', 'Netherlands': 'nl', 'Belgium': 'be',
  'Uruguay': 'uy', 'Colombia': 'co', 'Japan': 'jp',
  'Morocco': 'ma', 'Senegal': 'sn', 'Nigeria': 'ng',
  'Cameroon': 'cm', 'Ghana': 'gh', 'Egypt': 'eg',
  'Saudi Arabia': 'sa', 'Iran': 'ir', 'Australia': 'au',
  'USA': 'us', 'Canada': 'ca', 'Ecuador': 'ec',
  'Peru': 'pe', 'Chile': 'cl', 'Venezuela': 've',
  'Switzerland': 'ch', 'Croatia': 'hr', 'Serbia': 'rs',
  'Denmark': 'dk', 'Poland': 'pl', 'Ukraine': 'ua',
  'Turkey': 'tr', 'Austria': 'at', 'Sweden': 'se',
  'Hungary': 'hu', 'Greece': 'gr', 'Romania': 'ro',
  'Slovakia': 'sk', 'Slovenia': 'si', 'Albania': 'al',
  'Qatar': 'qa', 'Tunisia': 'tn', "Côte d'Ivoire": 'ci',
  'Mali': 'ml', 'Guinea': 'gn', 'DR Congo': 'cd',
  'Iraq': 'iq', 'Uzbekistan': 'uz', 'New Zealand': 'nz',
  'Panama': 'pa', 'Honduras': 'hn', 'Costa Rica': 'cr',
  'Jamaica': 'jm', 'Haiti': 'ht',

  // Additional from worldcup26.ir
  'Algeria': 'dz',
  'Bosnia and Herzegovina': 'ba',
  'Cape Verde': 'cv',
  'Curaçao': 'cw',
  'Democratic Republic of the Congo': 'cd',
  'Ivory Coast': 'ci',
  'Jordan': 'jo',
  'Norway': 'no',
  'Paraguay': 'py',
  'Scotland': 'gb-sct',
  'United States': 'us'
}

const TEAM_TRANSLATION: Record<string, string> = {
  // Original
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
  "Côte d'Ivoire": 'Costa de Marfil',
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

  // Additional from worldcup26.ir
  'Algeria': 'Argelia',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'Cape Verde': 'Cabo Verde',
  'Curaçao': 'Curazao',
  'Democratic Republic of the Congo': 'RD Congo',
  'Ivory Coast': 'Costa de Marfil',
  'Jordan': 'Jordania',
  'Norway': 'Noruega',
  'Paraguay': 'Paraguay',
  'Scotland': 'Escocia',
  'United States': 'EE. UU.'
}

const STADIUM_MAP: Record<string, string> = {
  '1': 'Estadio Azteca, Ciudad de México',
  '2': 'Estadio Akron, Guadalajara',
  '3': 'Estadio BBVA, Monterrey',
  '4': 'AT&T Stadium, Dallas',
  '5': 'NRG Stadium, Houston',
  '6': 'GEHA Field at Arrowhead Stadium, Kansas City',
  '7': 'Mercedes-Benz Stadium, Atlanta',
  '8': 'Hard Rock Stadium, Miami',
  '9': 'Gillette Stadium, Boston',
  '10': 'Lincoln Financial Field, Philadelphia',
  '11': 'MetLife Stadium, New York/New Jersey',
  '12': 'BMO Field, Toronto',
  '13': 'BC Place, Vancouver',
  '14': 'Lumen Field, Seattle',
  '15': 'Levi\'s Stadium, San Francisco Bay Area',
  '16': 'SoFi Stadium, Los Angeles',
}

function translateTeam(teamName?: string): string {
  if (!teamName) return ''
  return TEAM_TRANSLATION[teamName] || teamName
}

function getFlag(teamName?: string): string {
  if (!teamName) return ''
  const code = ISO_MAP[teamName]
  if (code) {
    return `https://flagcdn.com/w40/${code}.png`
  }
  return ''
}

function mapPhase(type: string): string {
  switch (type) {
    case 'group': return 'groups'
    case 'r32': return 'round32'
    case 'r16': return 'round16'
    case 'qf': return 'quarterfinals'
    case 'sf': return 'semifinals'
    case 'third': return 'final'
    case 'final': return 'final'
    default: return 'groups'
  }
}

function parseLocalDate(localDateStr: string): string | null {
  if (!localDateStr) return null
  try {
    const parts = localDateStr.split(' ')
    if (parts.length < 2) return null
    const dateParts = parts[0].split('/')
    if (dateParts.length < 3) return null
    const [month, day, year] = dateParts
    const time = parts[1]
    return `${year}-${month}-${day}T${time}:00.000Z`
  } catch {
    return null
  }
}

export async function fetchAllMatches() {
  try {
    const res = await fetch(WC_GAMES_URL, {
      next: { revalidate: 3600 },
      headers: { 'Accept': 'application/json' }
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    if (!data.games) return []

    return data.games.map((game: ApiGame) => transformApiGame(game))
  } catch (error) {
    console.error('Error fetching WC data:', error)
    return []
  }
}

export function transformApiGame(game: ApiGame) {
  const phase = mapPhase(game.type)
  const isStarted = game.finished === 'TRUE' || (game.time_elapsed && game.time_elapsed !== 'notstarted')
  
  // Use team names if available, otherwise fallback to labels for knockout matches
  const home_team = game.home_team_name_en ? translateTeam(game.home_team_name_en) : (game.home_team_label || '')
  const away_team = game.away_team_name_en ? translateTeam(game.away_team_name_en) : (game.away_team_label || '')

  const status = game.finished === 'TRUE' ? 'completed' : (game.time_elapsed === 'notstarted' ? 'scheduled' : 'live')

  return {
    api_id: parseInt(game.id) || Math.floor(Math.random() * 100000),
    home_team,
    away_team,
    home_flag: game.home_team_name_en ? getFlag(game.home_team_name_en) : '',
    away_flag: game.away_team_name_en ? getFlag(game.away_team_name_en) : '',
    phase,
    match_date: parseLocalDate(game.local_date),
    home_score: isStarted ? parseInt(game.home_score) : null,
    away_score: isStarted ? parseInt(game.away_score) : null,
    status,
    group_name: game.type === 'group' && game.group ? `Grupo ${game.group}` : null,
    venue: STADIUM_MAP[game.stadium_id] || null,
  }
}

export async function fetchRecentMatches() {
  const all = await fetchAllMatches()
  return all.filter(m => m.status === 'completed' || m.status === 'live')
}

export function getMatchResult(homeScore: number, awayScore: number): 'home' | 'draw' | 'away' {
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  return 'draw'
}
