import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col justify-between text-white relative overflow-hidden">
      {/* Background glow and decor */}
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[120%] aspect-square bg-gradient-to-b from-gold-500/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Navbar / Top log */}
      <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <img src="/logo-seminario.png" alt="Logo Seminario" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
          <span className="font-display text-2xl font-bold tracking-widest gold-shimmer">QUINIELA 2026</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/dashboard" className="btn-gold px-5 py-2 text-sm leading-none flex items-center">
              ENTRAR AL PANEL
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="text-white/60 hover:text-gold-500 text-sm font-semibold tracking-wide uppercase transition-colors">
                Iniciar Sesión
              </Link>
              <Link href="/auth/register" className="btn-gold px-5 py-2 text-sm leading-none flex items-center">
                REGISTRARSE
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero section */}
      <main className="max-w-7xl mx-auto w-full px-6 py-12 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 z-10">
        <div className="flex-1 space-y-6 text-center lg:text-left max-w-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-950/20 border border-gold-500/20 text-gold-400 text-xs font-bold uppercase tracking-widest">
              🇨🇦 🇲🇽 🇺🇸 FIFA WORLD CUP 2026
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-semibold uppercase tracking-wider">
              🏛️ Coord. de Cultura del Seminario
            </div>
          </div>
          
          <h1 className="font-display text-5xl sm:text-7xl text-white tracking-wide leading-none">
            VIVE LA EMOCIÓN DEL <br />
            <span className="gold-shimmer">MUNDIAL 2026</span>
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto lg:mx-0">
            Predice los marcadores exactos de los 104 partidos del mundial de fútbol más grande de la historia. Responde trivias diarias de IA y compite con amigos por el trono del ranking.
          </p>

          {/* Seminario Logo Card Integration */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/5 max-w-md mx-auto lg:mx-0 hover:border-white/10 transition-colors">
            <img src="/logo-seminario.png" alt="Seminario Logo" className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
            <div className="text-left">
              <div className="text-white/40 text-[9px] uppercase tracking-widest font-semibold leading-none mb-1">Una iniciativa de la</div>
              <div className="text-gold-500 font-display text-base font-bold tracking-wide uppercase">Coordinación de Cultura</div>
              <div className="text-white/80 text-[11px] font-medium leading-none mt-1">Seminario Mayor</div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            {user ? (
              <Link href="/dashboard" className="btn-gold text-lg px-8 py-3.5 w-full sm:w-auto text-center">
                IR A MIS PREDICCIONES
              </Link>
            ) : (
              <>
                <Link href="/auth/register" className="btn-gold text-lg px-8 py-3.5 w-full sm:w-auto text-center">
                  CREAR MI CUENTA GRATIS
                </Link>
                <Link href="/auth/login" className="btn-ghost text-lg px-8 py-3 w-full sm:w-auto text-center">
                  INICIAR SESIÓN
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature Grid / Cards */}
        <div className="flex-1 w-full max-w-md sm:max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card p-5 border-white/5 hover:border-gold-500/30 transition-all">
            <div className="text-3xl mb-3">⚽</div>
            <h3 className="font-display text-lg text-white font-bold tracking-wide">PREDICCIONES</h3>
            <p className="text-white/45 text-xs mt-1">
              Acierta quién gana o si hay empate en cada partido para acumular 1 punto en tu casillero.
            </p>
          </div>

          <div className="glass-card p-5 border-white/5 hover:border-gold-500/30 transition-all">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-display text-lg text-amber-400 font-bold tracking-wide">MARCADOR EXACTO</h3>
            <p className="text-white/45 text-xs mt-1">
              ¿Eres un experto táctico? Si adivinas los goles exactos de ambos equipos, sumas un total de **3 puntos** por el partido.
            </p>
          </div>

          <div className="glass-card p-5 border-white/5 hover:border-gold-500/30 transition-all">
            <div className="text-3xl mb-3">🧠</div>
            <h3 className="font-display text-lg text-white font-bold tracking-wide">TRIVIA DIARIA</h3>
            <p className="text-white/45 text-xs mt-1">
              Una pregunta aleatoria y única de IA sobre la historia de los mundiales cada día. ¡Responde en 10 segundos!
            </p>
          </div>

          <div className="glass-card p-5 border-white/5 hover:border-gold-500/30 transition-all">
            <div className="text-3xl mb-3">🏆</div>
            <h3 className="font-display text-lg text-gold-500 font-bold tracking-wide">TABLA DE POSICIONES</h3>
            <p className="text-white/45 text-xs mt-1">
              Sigue tu progreso en tiempo real dentro del ranking contra toda la comunidad y consolídate como el campeón mundial.
            </p>
          </div>
        </div>
      </main>

      {/* Rules Section */}
      <section className="max-w-7xl mx-auto w-full px-6 py-12 border-t border-white/5 z-10">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl tracking-wide text-white uppercase">REGLAS DEL JUEGO</h2>
          <p className="text-white/50 text-sm mt-1">Conoce cómo sumar puntos y competir en la Quiniela</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">⚽</span>
                <h3 className="font-display text-xl font-bold tracking-wide">1. PUNTOS POR FASE</h3>
              </div>
              <p className="text-white/50 text-xs leading-relaxed mb-4">
                Por acertar al ganador (o empate) de un partido, recibirás los puntos base asignados a la fase correspondiente:
              </p>
              <ul className="space-y-1.5 text-xs text-white/70">
                <li className="flex justify-between border-b border-white/5 pb-1">
                  <span>Fase de Grupos:</span> <span className="text-gold-500 font-bold">1 punto</span>
                </li>
                <li className="flex justify-between border-b border-white/5 pb-1">
                  <span>32avos de Final:</span> <span className="text-gold-500 font-bold">2 puntos</span>
                </li>
                <li className="flex justify-between border-b border-white/5 pb-1">
                  <span>Octavos de Final:</span> <span className="text-gold-500 font-bold">3 puntos</span>
                </li>
                <li className="flex justify-between border-b border-white/5 pb-1">
                  <span>Cuartos de Final:</span> <span className="text-gold-500 font-bold">4 puntos</span>
                </li>
                <li className="flex justify-between border-b border-white/5 pb-1">
                  <span>Semifinales:</span> <span className="text-gold-500 font-bold">5 puntos</span>
                </li>
                <li className="flex justify-between pb-1">
                  <span>Gran Final:</span> <span className="text-gold-500 font-bold">6 puntos</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 2 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🎯</span>
                <h3 className="font-display text-xl font-bold tracking-wide text-amber-500">2. BONO DE MARCADOR</h3>
              </div>
              <p className="text-white/50 text-xs leading-relaxed mb-4">
                Si además de acertar al ganador, predices el **marcador exacto de goles** de ambos equipos en el partido, recibirás una bonificación:
              </p>
              <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg text-center mb-4">
                <span className="font-display text-3xl font-bold text-amber-400">+2 PUNTOS EXTRA</span>
                <span className="block text-[10px] text-white/50 mt-1">Sumados sobre los puntos base de la fase</span>
              </div>
              <p className="text-white/40 text-[10px] italic">
                Ejemplo: Aciertas el marcador exacto en Octavos (3 pts base + 2 pts bono = 5 pts en total).
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🧠</span>
                <h3 className="font-display text-xl font-bold tracking-wide">3. TRIVIA & BLOQUEOS</h3>
              </div>
              <p className="text-white/50 text-xs leading-relaxed mb-3">
                <strong className="text-white">Trivia Diaria:</strong> Cada día tendrás una pregunta única de IA sobre la historia de los mundiales. Tienes 10 segundos para responder.
              </p>
              <div className="bg-white/5 p-2 rounded text-center text-xs font-semibold text-gold-500 mb-4">
                Pregunta correcta = 1 punto
              </div>
              <p className="text-white/50 text-xs leading-relaxed">
                <strong className="text-white">Bloqueo de Fases:</strong> Las predicciones de cada fase se cierran automáticamente en cuanto comienza el **primer partido** de esa respectiva fase.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="p-6 text-center border-t border-white/5 bg-black/20 text-white/40 text-xs z-10 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-3">
        <div>
          © {new Date().getFullYear()} Quiniela Mundial 2026. Todos los derechos reservados. No oficial.
        </div>
        <div className="flex items-center gap-2">
          <span>Diseñado y promovido por la</span>
          <span className="text-gold-500 font-semibold">Coordinación de Cultura del Seminario</span>
        </div>
      </footer>
    </div>
  )
}
