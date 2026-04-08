-- ============================================================
-- Fase 5 — Auditoría completa del sistema
-- ============================================================
-- Principio de privacidad:
--   • Acciones de admins: trazables (actor_id = auth.uid())
--   • Acciones de votantes: anónimas (actor_id = NULL, sin DNI, sin lista_id)
--   • El voto_hash en voter.vote_cast es el recibo que el votante ya posee
-- ============================================================

-- 1. Tabla audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('admin', 'voter', 'system')),
  actor_id     UUID,                                          -- NULL para eventos de votantes
  org_id       INT  REFERENCES organizaciones(id) ON DELETE CASCADE,
  eleccion_id  INT  REFERENCES elecciones(id)     ON DELETE SET NULL,
  event_type   TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,                                          -- ID del objeto afectado (flexible)
  result       TEXT,                                         -- 'ok', 'ya_voto', 'no_en_padron', etc.
  metadata     JSONB
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id      ON audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_eleccion_id ON audit_log (eleccion_id, created_at DESC);

-- 2. RLS — admins solo leen su org; nadie puede escribir desde la app
-- ============================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_read" ON audit_log
  FOR SELECT USING (
    org_id = get_admin_org_id()
    OR is_superadmin()
  );
-- Sin política INSERT/UPDATE/DELETE — solo funciones SECURITY DEFINER escriben

-- 3. log_admin_event() — llamada desde la aplicación para acciones de admins
-- ============================================================
CREATE OR REPLACE FUNCTION log_admin_event(
  p_event_type  TEXT,
  p_eleccion_id INT    DEFAULT NULL,
  p_entity_type TEXT   DEFAULT NULL,
  p_entity_id   TEXT   DEFAULT NULL,
  p_metadata    JSONB  DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id INT;
BEGIN
  SELECT org_id INTO v_org_id
  FROM admins WHERE id = auth.uid() LIMIT 1;

  INSERT INTO audit_log
    (actor_type, actor_id, org_id, eleccion_id, event_type, entity_type, entity_id, metadata)
  VALUES
    ('admin', auth.uid(), v_org_id, p_eleccion_id, p_event_type, p_entity_type, p_entity_id, p_metadata);
END;
$$;

-- 4. Reemplazar validar_dni — agrega logging de intentos (sin DNI, sin identidad)
-- ============================================================
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
  v_org_id  INT;
BEGIN
  SELECT org_id INTO v_org_id FROM elecciones WHERE id = p_eleccion_id;

  -- Verificar que la elección esté activa
  IF NOT EXISTS (
    SELECT 1 FROM elecciones WHERE id = p_eleccion_id AND estado = 'activa'
  ) THEN
    INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
    VALUES ('voter', v_org_id, p_eleccion_id, 'voter.validation_failed', 'eleccion_no_activa');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'eleccion_no_activa');
  END IF;

  -- Buscar en padrón
  SELECT * INTO v_padron
  FROM padron_votantes
  WHERE eleccion_id = p_eleccion_id AND dni_hash = p_dni_hash;

  IF NOT FOUND THEN
    INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
    VALUES ('voter', v_org_id, p_eleccion_id, 'voter.validation_failed', 'no_en_padron');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no_en_padron');
  END IF;

  IF v_padron.ya_voto THEN
    INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
    VALUES ('voter', v_org_id, p_eleccion_id, 'voter.validation_failed', 'ya_voto');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'ya_voto');
  END IF;

  -- Invalidar tokens anteriores no usados
  UPDATE tokens_votacion
  SET usado = TRUE
  WHERE eleccion_id = p_eleccion_id
    AND dni_hash = p_dni_hash
    AND usado = FALSE;

  -- Generar nuevo token
  INSERT INTO tokens_votacion (eleccion_id, dni_hash)
  VALUES (p_eleccion_id, p_dni_hash)
  RETURNING token INTO v_token;

  -- Log validación exitosa (sin DNI hash)
  INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
  VALUES ('voter', v_org_id, p_eleccion_id, 'voter.dni_validated', 'ok');

  RETURN jsonb_build_object('ok', TRUE, 'token', v_token::TEXT);
END;
$$;

-- 5. Reemplazar emitir_voto — agrega logging del voto (sin lista_id, sin identidad)
-- ============================================================
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
  v_org_id    INT;
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

  SELECT org_id INTO v_org_id FROM elecciones WHERE id = v_token.eleccion_id;

  -- Marcar token como usado
  UPDATE tokens_votacion SET usado = TRUE WHERE token = p_token;

  -- Marcar votante en padrón
  UPDATE padron_votantes
  SET ya_voto = TRUE, votado_at = NOW()
  WHERE eleccion_id = v_token.eleccion_id AND dni_hash = v_token.dni_hash;

  -- Insertar voto anónimo en urna (sin ningún dato del votante)
  INSERT INTO urna (eleccion_id, lista_id)
  VALUES (v_token.eleccion_id, p_lista_id);

  -- Hash verificador del ticket
  v_voto_hash := UPPER(SUBSTRING(
    md5('voto:' || v_token.eleccion_id::TEXT || ':' || p_lista_id::TEXT || ':' || NOW()::TEXT),
    1, 16
  ));

  -- Log del voto: solo el recibo (sin lista_id, sin identidad del votante)
  INSERT INTO audit_log
    (actor_type, org_id, eleccion_id, event_type, entity_type, entity_id)
  VALUES
    ('voter', v_org_id, v_token.eleccion_id, 'voter.vote_cast', 'voto', v_voto_hash);

  RETURN jsonb_build_object('ok', TRUE, 'voto_hash', v_voto_hash);
END;
$$;

-- 6. get_audit_log() — lectura paginada con email del actor
-- ============================================================
CREATE OR REPLACE FUNCTION get_audit_log(
  p_eleccion_id INT   DEFAULT NULL,
  p_limit       INT   DEFAULT 100,
  p_offset      INT   DEFAULT 0
)
RETURNS TABLE (
  id          BIGINT,
  created_at  TIMESTAMPTZ,
  actor_type  TEXT,
  actor_id    UUID,
  actor_email TEXT,
  event_type  TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  result      TEXT,
  metadata    JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id INT;
BEGIN
  IF NOT is_superadmin() THEN
    SELECT admins.org_id INTO v_org_id FROM admins WHERE id = auth.uid() LIMIT 1;
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'no_autorizado';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.created_at,
    al.actor_type,
    al.actor_id,
    u.email::TEXT        AS actor_email,
    al.event_type,
    al.entity_type,
    al.entity_id,
    al.result,
    al.metadata
  FROM audit_log al
  LEFT JOIN auth.users u ON u.id = al.actor_id
  WHERE
    (v_org_id IS NULL OR al.org_id = v_org_id)
    AND (p_eleccion_id IS NULL OR al.eleccion_id = p_eleccion_id)
  ORDER BY al.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- 7. Grants
-- ============================================================
GRANT EXECUTE ON FUNCTION log_admin_event  TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_log    TO authenticated;

NOTIFY pgrst, 'reload schema';
