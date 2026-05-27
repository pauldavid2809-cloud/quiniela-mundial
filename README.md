# 🏆 Quiniela Mundial 2026

App de quiniela para el FIFA World Cup 2026. Construida con Next.js 14, Supabase y API-Football.

---

## ⚡ Setup en 5 pasos

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Copia el archivo de ejemplo y rellena los valores:
```bash
cp .env.local.example .env.local
```

El archivo `.env.local` debe tener:
```env
NEXT_PUBLIC_SUPABASE_URL=https://sdvlaeulvohfpfqaypiw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  (tu anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...      (service role key de Supabase → Settings → API)
API_FOOTBALL_KEY=bd704e5dc0a7a8b3d3a7465b4b3908d3
CRON_SECRET=pon_aqui_un_secreto_largo
ANTHROPIC_API_KEY=sk-ant-...               (de console.anthropic.com)
```

### 3. Crear las tablas en Supabase
1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. Entra a **SQL Editor**
3. Pega y ejecuta todo el contenido de `supabase/schema.sql`

### 4. Crear el usuario admin
1. En Supabase → **Authentication → Users** → "Add user"
2. Email: `admin@quiniela2026.com`
3. Password: `Admin2026!` (o el que prefieras)
4. Copia el UUID que aparece
5. En SQL Editor ejecuta:
```sql
UPDATE public.profiles SET is_admin = TRUE WHERE id = 'PEGA-AQUI-EL-UUID';
```

### 5. Correr en local
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000)

---

## 🚀 Deploy en Vercel

1. Sube el proyecto a GitHub
2. En Vercel: **New Project** → importa el repo
3. Agrega todas las variables de entorno (las mismas del `.env.local`)
4. Deploy ✅

El cron job en `vercel.json` actualizará los resultados automáticamente cada 3 horas.

---

## 📋 Flujo de uso

### Como Admin:
1. Entra con `admin@quiniela2026.com`
2. Ve a **⚙️ Admin → ⚽ Partidos**
3. Clic en **"Importar todos los partidos"** — esto carga los 104 partidos del mundial
4. Ve a **🧠 Trivia** para crear la pregunta del día (o generar con IA)
5. Ve a **🔓 Fases** para desbloquear fases eliminatorias cuando avance el torneo

### Como Usuario:
1. Regístrate con correo y contraseña
2. Ve a **⚽ Quiniela** → predice quién gana cada partido
3. Ve a **🧠 Trivia** → responde la pregunta del día (¡10 segundos!)
4. Ve a **🏅 Ranking** → ve tu posición vs los demás

---

## 🏅 Sistema de puntos

| Fase | Puntos por acierto |
|------|-------------------|
| Fase de Grupos | 1 pt |
| 32avos de Final | 2 pts |
| Octavos de Final | 3 pts |
| Cuartos de Final | 4 pts |
| Semifinales | 5 pts |
| Gran Final | 6 pts |
| Trivia diaria | 3 pts |

---

## 🔒 Fases bloqueadas

Las fases eliminatorias están **bloqueadas por defecto**. El admin las desbloquea manualmente desde el panel cuando se conocen los clasificados. Solo la Fase de Grupos está desbloqueada desde el inicio.

---

## 🛠️ Stack técnico

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Estilos**: Tailwind CSS + CSS personalizado
- **Base de datos**: Supabase (PostgreSQL + Auth)
- **API resultados**: API-Football (api-sports.io)
- **Trivia IA**: Anthropic Claude API
- **Deploy**: Vercel (con cron jobs)
- **Fuentes**: Bebas Neue + Rajdhani (Google Fonts)

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── auth/
│   │   ├── login/          → Página de login
│   │   └── register/       → Página de registro
│   ├── dashboard/
│   │   ├── page.tsx        → Quiniela principal
│   │   ├── ranking/        → Tabla de posiciones
│   │   └── trivia/         → Trivia diaria
│   ├── admin/
│   │   ├── page.tsx        → Panel admin
│   │   ├── partidos/       → Gestión de partidos
│   │   ├── fases/          → Desbloquear fases
│   │   └── trivia/         → Crear preguntas
│   └── api/
│       ├── sync-matches/   → Importar partidos de API
│       ├── update-results/ → Actualizar resultados (cron)
│       └── generate-trivia/→ Generar pregunta con IA
├── components/
│   ├── NavBar.tsx
│   ├── QuinielaClient.tsx
│   └── MatchCard.tsx
└── lib/
    ├── supabase/
    │   ├── client.ts       → Cliente browser
    │   └── server.ts       → Cliente servidor
    └── api-football.ts     → Integración API Football
```
