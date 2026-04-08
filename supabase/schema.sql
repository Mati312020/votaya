-- ============================================================
-- VOTAYA — Schema multi-tenant completo
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- --------------------------------------------------------
-- 1. TABLAS
-- --------------------------------------------------------

-- Organizaciones: cada tenant es una organización
CREATE TABLE IF NOT EXISTS organizaciones (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admins: vincula auth.uid() de Supabase Auth a una organización
-- Un usuario puede administrar una sola org (ampliar con roles si se necesita)
CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      INT NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  rol         TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'superadmin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elecciones (
  id                 SERIAL PRIMARY KEY,
  org_id             INT NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  titulo             TEXT NOT NULL,
  descripcion        TEXT,
  slug               TEXT NOT NULL UNIQUE,
  estado             TEXT NOT NULL DEFAULT 'borrador'
                       CHECK (estado IN ('borrador', 'activa', 'cerrada')),
  fecha_inicio       TIMESTAMPTZ NOT NULL,
  fecha_fin          TIMESTAMPTZ NOT NULL,
  voto_reemplazable  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listas (
  id              SERIAL PRIMARY KEY,
  eleccion_id     INT NOT NULL REFERENCES elecciones(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  foto_url        TEXT,
  orden           INT NOT NULL DEFAULT 0,
  metadata        JSONB,
  grupo_padre_id  INT REFERENCES listas(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS padron_votantes (
  id          SERIAL PRIMARY KEY,
  eleccion_id INT NOT NULL REFERENCES elecciones(id) ON DELETE CASCADE,
  dni_hash    TEXT NOT NULL,
  ya_voto     BOOLEAN NOT NULL DEFAULT FALSE,
  votado_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (eleccion_id, dni_hash)
);

CREATE TABLE IF NOT EXISTS tokens_votacion (
  id          SERIAL PRIMARY KEY,
  eleccion_id INT NOT NULL REFERENCES elecciones(id) ON DELETE CASCADE,
  dni_hash    TEXT NOT NULL,
  token       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  usado       BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Urna: votos anónimos. NO hay FK al votante (ni padron, ni tokens).
CREATE TABLE IF NOT EXISTS urna (
  id          SERIAL PRIMARY KEY,
  eleccion_id INT NOT NULL REFERENCES elecciones(id) ON DELETE CASCADE,
  lista_id    INT NOT NULL REFERENCES listas(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- 2. FUNCIÓN HELPER MULTI-TENANT
-- --------------------------------------------------------

-- Retorna el org_id del admin autenticado (auth.uid())
-- Usada en las RLS policies para evitar joins repetidos
CREATE OR REPLACE FUNCTION get_admin_org_id()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM admins WHERE id = auth.uid() LIMIT 1;
$$;

-- --------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- --------------------------------------------------------

ALTER TABLE organizaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE elecciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE padron_votantes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_votacion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE urna              ENABLE ROW LEVEL SECURITY;

-- ── organizaciones ──────────────────────────────────────
-- Admin solo ve y edita su propia organización
CREATE POLICY "org_admin_select" ON organizaciones
  FOR SELECT USING (id = get_admin_org_id());

CREATE POLICY "org_admin_update" ON organizaciones
  FOR UPDATE USING (id = get_admin_org_id());

-- ── admins ───────────────────────────────────────────────
-- Cada admin solo ve su propio registro
CREATE POLICY "admins_self" ON admins
  FOR SELECT USING (id = auth.uid());

-- ── elecciones ───────────────────────────────────────────
-- Lectura pública: cualquier visitante puede leer elecciones activas
CREATE POLICY "elecciones_lectura_publica" ON elecciones
  FOR SELECT USING (estado = 'activa');

-- Lectura admin: el admin ve TODAS las de su org (borrador, activa, cerrada)
CREATE POLICY "elecciones_admin_select" ON elecciones
  FOR SELECT USING (org_id = get_admin_org_id());

-- CRUD admin: solo dentro de su org
CREATE POLICY "elecciones_admin_insert" ON elecciones
  FOR INSERT WITH CHECK (org_id = get_admin_org_id());

CREATE POLICY "elecciones_admin_update" ON elecciones
  FOR UPDATE USING (org_id = get_admin_org_id());

CREATE POLICY "elecciones_admin_delete" ON elecciones
  FOR DELETE USING (org_id = get_admin_org_id());

-- ── listas ───────────────────────────────────────────────
-- Lectura pública: listas de elecciones activas
CREATE POLICY "listas_lectura_publica" ON listas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = listas.eleccion_id AND e.estado = 'activa'
    )
  );

-- CRUD admin: solo listas de elecciones de su org
CREATE POLICY "listas_admin_select" ON listas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = listas.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

CREATE POLICY "listas_admin_insert" ON listas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = listas.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

CREATE POLICY "listas_admin_update" ON listas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = listas.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

CREATE POLICY "listas_admin_delete" ON listas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = listas.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

-- ── padron_votantes ──────────────────────────────────────
-- Admin puede ver y gestionar el padrón de su org
CREATE POLICY "padron_admin_select" ON padron_votantes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = padron_votantes.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

CREATE POLICY "padron_admin_insert" ON padron_votantes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = padron_votantes.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

CREATE POLICY "padron_admin_delete" ON padron_votantes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = padron_votantes.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

-- ── tokens_votacion ──────────────────────────────────────
-- Sin acceso directo — solo via RPC SECURITY DEFINER
-- (no se crean policies de SELECT/INSERT para anon/authenticated)

-- ── urna ─────────────────────────────────────────────────
-- Admin puede ver conteos agregados de su org (para resultados)
CREATE POLICY "urna_admin_select" ON urna
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = urna.eleccion_id AND e.org_id = get_admin_org_id()
    )
  );

-- --------------------------------------------------------
-- 4. RPCs
-- --------------------------------------------------------

-- validar_dni: verifica DNI hash en padrón y genera token de un solo uso
CREATE OR REPLACE FUNCTION validar_dni(
  p_eleccion_id INT,
  p_dni_hash    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_padron  padron_votantes%ROWTYPE;
  v_token   UUID;
BEGIN
  -- Verificar que la elección esté activa
  IF NOT EXISTS (
    SELECT 1 FROM elecciones WHERE id = p_eleccion_id AND estado = 'activa'
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'eleccion_no_activa');
  END IF;

  -- Buscar en padrón
  SELECT * INTO v_padron
  FROM padron_votantes
  WHERE eleccion_id = p_eleccion_id AND dni_hash = p_dni_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no_en_padron');
  END IF;

  IF v_padron.ya_voto THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'ya_voto');
  END IF;

  -- Invalidar tokens anteriores no usados para este dni_hash en esta elección
  UPDATE tokens_votacion
  SET usado = TRUE
  WHERE eleccion_id = p_eleccion_id
    AND dni_hash = p_dni_hash
    AND usado = FALSE;

  -- Generar nuevo token
  INSERT INTO tokens_votacion (eleccion_id, dni_hash)
  VALUES (p_eleccion_id, p_dni_hash)
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('ok', TRUE, 'token', v_token::TEXT);
END;
$$;

-- emitir_voto: transacción atómica con SELECT FOR UPDATE anti race-condition
CREATE OR REPLACE FUNCTION emitir_voto(
  p_token    UUID,
  p_lista_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token     tokens_votacion%ROWTYPE;
  v_lista     listas%ROWTYPE;
  v_voto_hash TEXT;
BEGIN
  -- Bloquear fila del token para evitar race condition
  SELECT * INTO v_token
  FROM tokens_votacion
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token_invalido');
  END IF;

  IF v_token.usado THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token_usado');
  END IF;

  IF v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token_expirado');
  END IF;

  -- Verificar que la lista pertenece a la elección del token
  SELECT * INTO v_lista
  FROM listas
  WHERE id = p_lista_id AND eleccion_id = v_token.eleccion_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token_invalido');
  END IF;

  -- Marcar token como usado
  UPDATE tokens_votacion SET usado = TRUE WHERE token = p_token;

  -- Marcar votante en padrón
  UPDATE padron_votantes
  SET ya_voto = TRUE, votado_at = NOW()
  WHERE eleccion_id = v_token.eleccion_id AND dni_hash = v_token.dni_hash;

  -- Insertar voto anónimo en urna (sin ningún dato del votante)
  INSERT INTO urna (eleccion_id, lista_id)
  VALUES (v_token.eleccion_id, p_lista_id);

  -- Hash verificador del ticket (no contiene identidad del votante)
  -- md5() es nativo de PostgreSQL, no requiere la extensión pgcrypto
  v_voto_hash := UPPER(SUBSTRING(
    md5('voto:' || v_token.eleccion_id::TEXT || ':' || p_lista_id::TEXT || ':' || NOW()::TEXT),
    1, 16
  ));

  RETURN jsonb_build_object('ok', TRUE, 'voto_hash', v_voto_hash);
END;
$$;

-- --------------------------------------------------------
-- 5. GRANTS — exponer RPCs al REST API de Supabase (PostgREST)
-- --------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.validar_dni(INT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_voto(UUID, INT) TO anon, authenticated;

-- Recargar el schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- --------------------------------------------------------
-- 6. SEED DATA (para testing)
-- --------------------------------------------------------

-- Organización de prueba
INSERT INTO organizaciones (nombre, slug) VALUES
  ('Club Atlético Demo', 'club-atletico-demo')
ON CONFLICT (slug) DO NOTHING;

-- Elección activa de prueba
INSERT INTO elecciones (org_id, titulo, descripcion, slug, estado, fecha_inicio, fecha_fin)
VALUES (
  (SELECT id FROM organizaciones WHERE slug = 'club-atletico-demo'),
  'Elección de Comisión Directiva 2024',
  'Votación para elegir las autoridades del club para el período 2024-2026',
  'comision-directiva-2024',
  'activa',
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '7 days'
)
ON CONFLICT (slug) DO NOTHING;

-- Listas candidatas
INSERT INTO listas (eleccion_id, nombre, descripcion, orden, metadata)
VALUES
  (
    (SELECT id FROM elecciones WHERE slug = 'comision-directiva-2024'),
    'Lista Azul',
    'Continuidad y crecimiento del club.',
    1,
    '{"slogan": "Por un club más grande", "color": "#1e40af", "color_texto": "#ffffff"}'
  ),
  (
    (SELECT id FROM elecciones WHERE slug = 'comision-directiva-2024'),
    'Lista Verde',
    'Renovación y transparencia.',
    2,
    '{"slogan": "Cambio con responsabilidad", "color": "#166534", "color_texto": "#ffffff"}'
  ),
  (
    (SELECT id FROM elecciones WHERE slug = 'comision-directiva-2024'),
    'Lista Roja',
    'Deporte accesible para todos.',
    3,
    '{"slogan": "El club es de todos", "color": "#991b1b", "color_texto": "#ffffff"}'
  )
ON CONFLICT DO NOTHING;

-- Padrón de prueba con hashes reales
-- Pepper: "votaya_pepper_2024_changeme" | Elección ID: 1
-- DNI 12345678 | DNI 87654321 | DNI 11111111
INSERT INTO padron_votantes (eleccion_id, dni_hash)
SELECT
  (SELECT id FROM elecciones WHERE slug = 'comision-directiva-2024'),
  hash_val
FROM (VALUES
  ('97befa396257ffde37ba33f65bc8718adb19023fbb43a043b880d9fc5d1333a9'),
  ('854b2434ed1308005c14318ae3026cb36a12dee21dc2dce27a7809c5b7baae84'),
  ('fdaec60108e57d4ae8fb1ccd43ee27464815b64003d24f268edabce61acbfc4d')
) AS t(hash_val)
ON CONFLICT DO NOTHING;
