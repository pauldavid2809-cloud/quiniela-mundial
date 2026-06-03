-- =============================================
-- QUINIELA MUNDIAL 2026 - Supabase Schema
-- Ejecuta esto en el SQL Editor de Supabase
-- =============================================

-- 1. PROFILES (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfiles visibles para todos los usuarios autenticados"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id);

CREATE POLICY "Insertar perfil propio"
  ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. FASES
CREATE TABLE IF NOT EXISTS public.phases (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  is_unlocked BOOLEAN DEFAULT FALSE,
  points_value INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT INTO public.phases (name, display_name, is_unlocked, points_value, sort_order) VALUES
  ('groups',       'Fase de Grupos',     TRUE,  1, 1),
  ('round32',      '32avos de Final',    FALSE, 2, 2),
  ('round16',      'Octavos de Final',   FALSE, 3, 3),
  ('quarterfinals','Cuartos de Final',   FALSE, 4, 4),
  ('semifinals',   'Semifinales',        FALSE, 5, 5),
  ('final',        'Gran Final',         FALSE, 6, 6)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fases visibles para todos" ON public.phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admin puede modificar fases" ON public.phases FOR UPDATE TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- 3. PARTIDOS
CREATE TABLE IF NOT EXISTS public.matches (
  id SERIAL PRIMARY KEY,
  api_id INTEGER UNIQUE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_flag TEXT,
  away_flag TEXT,
  phase TEXT NOT NULL REFERENCES public.phases(name),
  match_date TIMESTAMPTZ,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed')),
  group_name TEXT,
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partidos visibles para todos" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admin puede insertar partidos" ON public.matches FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Solo admin puede actualizar partidos" ON public.matches FOR UPDATE TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- 4. PREDICCIONES
CREATE TABLE IF NOT EXISTS public.predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  prediction TEXT NOT NULL CHECK (prediction IN ('home', 'draw', 'away')),
  predicted_home_score INTEGER,
  predicted_away_score INTEGER,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias predicciones"
  ON public.predictions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propias predicciones"
  ON public.predictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus predicciones (antes del partido)"
  ON public.predictions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Service role puede actualizar todas (para el cron de resultados)
CREATE POLICY "Service role puede todo en predictions"
  ON public.predictions FOR ALL TO service_role USING (true);

-- 5. PREGUNTAS DE TRIVIA
CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  active_date DATE UNIQUE,
  is_active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trivia activa visible para todos" ON public.trivia_questions FOR SELECT TO authenticated
  USING (is_active = true OR (SELECT is_admin FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Solo admin puede gestionar trivia" ON public.trivia_questions FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- 6. RESPUESTAS DE TRIVIA
CREATE TABLE IF NOT EXISTS public.trivia_answers (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL CHECK (answer IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

ALTER TABLE public.trivia_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus propias respuestas"
  ON public.trivia_answers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuarios insertan sus respuestas"
  ON public.trivia_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 7. FUNCIÓN PARA RECALCULAR PUNTOS TOTALES
CREATE OR REPLACE FUNCTION public.recalculate_user_points(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  pred_points INTEGER;
  trivia_points INTEGER;
BEGIN
  SELECT COALESCE(SUM(points_earned), 0) INTO pred_points
  FROM public.predictions WHERE user_id = p_user_id;

  SELECT COALESCE(SUM(points_earned), 0) INTO trivia_points
  FROM public.trivia_answers WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET total_points = pred_points + trivia_points
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. ADMIN SERVICE POLICIES (para API routes con service_role)
CREATE POLICY "Service role total access profiles" ON public.profiles FOR ALL TO service_role USING (true);
CREATE POLICY "Service role total access matches" ON public.matches FOR ALL TO service_role USING (true);
CREATE POLICY "Service role total access trivia" ON public.trivia_questions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role total access trivia_answers" ON public.trivia_answers FOR ALL TO service_role USING (true);
CREATE POLICY "Service role total access phases" ON public.phases FOR ALL TO service_role USING (true);

-- =============================================
-- CREAR ADMIN MANUALMENTE (ejecuta después de crear el usuario en Auth)
-- Reemplaza 'TU-USER-ID-AQUI' con el ID del usuario admin@quiniela2026.com
-- UPDATE public.profiles SET is_admin = TRUE WHERE id = 'TU-USER-ID-AQUI';
-- =============================================
