-- ============================================================
-- Fase 6 — Verificación de identidad del votante
-- Métodos: dni_qr | otp_email | renaper | ninguna (default)
-- ============================================================

-- 1. Columnas nuevas en elecciones y padron_votantes
-- ============================================================
ALTER TABLE elecciones
  ADD COLUMN IF NOT EXISTS verificacion_identidad TEXT NOT NULL DEFAULT 'ninguna'
  CHECK (verificacion_identidad IN ('ninguna', 'dni_qr', 'otp_email', 'renaper'));

ALTER TABLE padron_votantes
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Tabla: verificacion_tokens (intermedio entre validar_dni y emitir_voto)
-- ============================================================
CREATE TABLE IF NOT EXISTS verificacion_tokens (
  id          BIGSERIAL PRIMARY KEY,
  token       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  eleccion_id INT  NOT NULL REFERENCES elecciones(id)  ON DELETE CASCADE,
  dni_hash    TEXT NOT NULL,
  metodo      TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  usado       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vtoken_token ON verificacion_tokens (token) WHERE NOT usado;

ALTER TABLE verificacion_tokens ENABLE ROW LEVEL SECURITY;
-- Sin políticas — solo accesible via SECURITY DEFINER functions

-- 3. Tabla: otp_tokens (códigos de un solo uso por email)
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_tokens (
  id          BIGSERIAL PRIMARY KEY,
  eleccion_id INT  NOT NULL REFERENCES elecciones(id) ON DELETE CASCADE,
  dni_hash    TEXT NOT NULL,
  code_hash   TEXT NOT NULL,            -- SHA-256 del código de 6 dígitos
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  intentos    INT  NOT NULL DEFAULT 0,
  usado       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
-- Sin políticas — solo accesible via SECURITY DEFINER functions

-- 4. Reemplazar validar_dni — devuelve verificacion_token si el método ≠ 'ninguna'
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
  v_padron    padron_votantes%ROWTYPE;
  v_eleccion  elecciones%ROWTYPE;
  v_token     UUID;
  v_vtoken    UUID;
BEGIN
  -- Buscar elección
  SELECT * INTO v_eleccion FROM elecciones WHERE id = p_eleccion_id;

  IF NOT FOUND OR v_eleccion.estado <> 'activa' THEN
    INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
    VALUES ('voter', v_eleccion.org_id, p_eleccion_id, 'voter.validation_failed', 'eleccion_no_activa');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'eleccion_no_activa');
  END IF;

  -- Buscar en padrón
  SELECT * INTO v_padron
  FROM padron_votantes
  WHERE eleccion_id = p_eleccion_id AND dni_hash = p_dni_hash;

  IF NOT FOUND THEN
    INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
    VALUES ('voter', v_eleccion.org_id, p_eleccion_id, 'voter.validation_failed', 'no_en_padron');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no_en_padron');
  END IF;

  IF v_padron.ya_voto THEN
    INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
    VALUES ('voter', v_eleccion.org_id, p_eleccion_id, 'voter.validation_failed', 'ya_voto');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'ya_voto');
  END IF;

  -- Invalidar tokens anteriores no usados
  UPDATE tokens_votacion
  SET usado = TRUE
  WHERE eleccion_id = p_eleccion_id AND dni_hash = p_dni_hash AND usado = FALSE;

  -- Sin verificación → emitir token de voto directo (comportamiento anterior)
  IF v_eleccion.verificacion_identidad = 'ninguna' THEN
    INSERT INTO tokens_votacion (eleccion_id, dni_hash)
    VALUES (p_eleccion_id, p_dni_hash)
    RETURNING token INTO v_token;

    INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result)
    VALUES ('voter', v_eleccion.org_id, p_eleccion_id, 'voter.dni_validated', 'ok');

    RETURN jsonb_build_object('ok', TRUE, 'token', v_token::TEXT);
  END IF;

  -- Con verificación → emitir verificacion_token intermedio
  -- Invalidar verificacion_tokens anteriores no usados
  UPDATE verificacion_tokens
  SET usado = TRUE
  WHERE eleccion_id = p_eleccion_id AND dni_hash = p_dni_hash AND usado = FALSE;

  INSERT INTO verificacion_tokens (eleccion_id, dni_hash, metodo)
  VALUES (p_eleccion_id, p_dni_hash, v_eleccion.verificacion_identidad)
  RETURNING token INTO v_vtoken;

  INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result, metadata)
  VALUES ('voter', v_eleccion.org_id, p_eleccion_id, 'voter.dni_validated', 'requiere_verificacion',
          jsonb_build_object('metodo', v_eleccion.verificacion_identidad));

  RETURN jsonb_build_object(
    'ok', TRUE,
    'requiere_verificacion', TRUE,
    'metodo', v_eleccion.verificacion_identidad,
    'verificacion_token', v_vtoken::TEXT
  );
END;
$$;

-- 5. canjear_verificacion_token — llamado por las API routes server-side
--    Valida que el verificacion_token sea válido y emite el token de voto real
-- ============================================================
CREATE OR REPLACE FUNCTION canjear_verificacion_token(
  p_vtoken UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vt        verificacion_tokens%ROWTYPE;
  v_token     UUID;
  v_org_id    INT;
BEGIN
  SELECT * INTO v_vt
  FROM verificacion_tokens
  WHERE token = p_vtoken
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token_invalido');
  END IF;

  IF v_vt.usado THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token_usado');
  END IF;

  IF v_vt.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'token_expirado');
  END IF;

  -- Marcar verificacion_token como usado
  UPDATE verificacion_tokens SET usado = TRUE WHERE token = p_vtoken;

  -- Emitir token de voto real
  INSERT INTO tokens_votacion (eleccion_id, dni_hash)
  VALUES (v_vt.eleccion_id, v_vt.dni_hash)
  RETURNING token INTO v_token;

  SELECT org_id INTO v_org_id FROM elecciones WHERE id = v_vt.eleccion_id;

  INSERT INTO audit_log (actor_type, org_id, eleccion_id, event_type, result, metadata)
  VALUES ('voter', v_org_id, v_vt.eleccion_id, 'voter.identity_verified', 'ok',
          jsonb_build_object('metodo', v_vt.metodo));

  RETURN jsonb_build_object('ok', TRUE, 'token', v_token::TEXT);
END;
$$;

-- 6. guardar_otp / verificar_otp — para el método otp_email
-- ============================================================
CREATE OR REPLACE FUNCTION guardar_otp(
  p_eleccion_id INT,
  p_dni_hash    TEXT,
  p_code_hash   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invalidar OTPs anteriores no usados para este DNI en esta elección
  UPDATE otp_tokens
  SET usado = TRUE
  WHERE eleccion_id = p_eleccion_id AND dni_hash = p_dni_hash AND usado = FALSE;

  INSERT INTO otp_tokens (eleccion_id, dni_hash, code_hash)
  VALUES (p_eleccion_id, p_dni_hash, p_code_hash);
END;
$$;

CREATE OR REPLACE FUNCTION verificar_otp(
  p_eleccion_id INT,
  p_dni_hash    TEXT,
  p_code_hash   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp otp_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_otp
  FROM otp_tokens
  WHERE eleccion_id = p_eleccion_id
    AND dni_hash = p_dni_hash
    AND usado = FALSE
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'otp_no_encontrado');
  END IF;

  IF v_otp.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'otp_expirado');
  END IF;

  IF v_otp.intentos >= 5 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'demasiados_intentos');
  END IF;

  IF v_otp.code_hash <> p_code_hash THEN
    UPDATE otp_tokens SET intentos = intentos + 1 WHERE id = v_otp.id;
    RETURN jsonb_build_object('ok', FALSE, 'error', 'otp_incorrecto',
                              'intentos_restantes', 5 - v_otp.intentos - 1);
  END IF;

  UPDATE otp_tokens SET usado = TRUE WHERE id = v_otp.id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- 7. get_email_padron — para que la API route pueda leer el email del votante
-- ============================================================
CREATE OR REPLACE FUNCTION get_email_padron(
  p_eleccion_id INT,
  p_dni_hash    TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM padron_votantes
  WHERE eleccion_id = p_eleccion_id AND dni_hash = p_dni_hash;
  RETURN v_email;
END;
$$;

-- 8. Grants
-- ============================================================
GRANT EXECUTE ON FUNCTION canjear_verificacion_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION guardar_otp                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verificar_otp              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_email_padron           TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Fase 8 — Verificación biométrica con AWS Rekognition
-- Agrega 'face_cloud' al constraint de verificacion_identidad
-- ============================================================
ALTER TABLE elecciones DROP CONSTRAINT IF EXISTS elecciones_verificacion_identidad_check;
ALTER TABLE elecciones ADD CONSTRAINT elecciones_verificacion_identidad_check
  CHECK (verificacion_identidad IN ('ninguna','dni_qr','otp_email','renaper','face_cloud'));
