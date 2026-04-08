-- ============================================================
-- VOTAYA — Migraciones Fase 4 (Multi-tenant SaaS)
-- ============================================================

-- 1. Branding en organizaciones
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS color_primario TEXT NOT NULL DEFAULT '#1e40af';
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS website TEXT;

-- 2. Helper: detectar superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid() AND rol = 'superadmin'
  )
$$;

-- 3. RPC: registro self-service de organización
CREATE OR REPLACE FUNCTION registrar_organizacion(
  p_nombre TEXT,
  p_slug   TEXT,
  p_color  TEXT DEFAULT '#1e40af'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id INT;
BEGIN
  -- Validar slug único
  IF EXISTS (SELECT 1 FROM organizaciones WHERE slug = p_slug) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug_taken');
  END IF;

  -- Crear organización
  INSERT INTO organizaciones (nombre, slug, color_primario)
  VALUES (p_nombre, p_slug, p_color)
  RETURNING id INTO v_org_id;

  -- Vincular usuario autenticado como admin
  INSERT INTO admins (id, org_id, rol)
  VALUES (auth.uid(), v_org_id, 'admin');

  RETURN jsonb_build_object('ok', true, 'slug', p_slug, 'org_id', v_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_organizacion(TEXT, TEXT, TEXT) TO authenticated;

-- 4. RPC: superadmin — listar todas las orgs con stats
CREATE OR REPLACE FUNCTION get_todas_las_orgs()
RETURNS TABLE(
  id               INT,
  nombre           TEXT,
  slug             TEXT,
  logo_url         TEXT,
  color_primario   TEXT,
  total_elecciones BIGINT,
  elecciones_activas BIGINT,
  total_admins     BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.nombre,
    o.slug,
    o.logo_url,
    o.color_primario,
    COUNT(DISTINCT e.id)                                          AS total_elecciones,
    COUNT(DISTINCT e.id) FILTER (WHERE e.estado = 'activa')      AS elecciones_activas,
    COUNT(DISTINCT a.id)                                          AS total_admins
  FROM organizaciones o
  LEFT JOIN elecciones e ON e.org_id = o.id
  LEFT JOIN admins a ON a.org_id = o.id
  WHERE is_superadmin()
  GROUP BY o.id, o.nombre, o.slug, o.logo_url, o.color_primario
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_todas_las_orgs() TO authenticated;

-- 5. RPC: superadmin — crear org manualmente
CREATE OR REPLACE FUNCTION superadmin_crear_org(
  p_nombre TEXT,
  p_slug   TEXT,
  p_color  TEXT DEFAULT '#1e40af'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id INT;
BEGIN
  IF NOT is_superadmin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado');
  END IF;

  IF EXISTS (SELECT 1 FROM organizaciones WHERE slug = p_slug) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug_taken');
  END IF;

  INSERT INTO organizaciones (nombre, slug, color_primario)
  VALUES (p_nombre, p_slug, p_color)
  RETURNING id INTO v_org_id;

  RETURN jsonb_build_object('ok', true, 'org_id', v_org_id, 'slug', p_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION superadmin_crear_org(TEXT, TEXT, TEXT) TO authenticated;

-- 6. RPC: listar admins de una org (para panel de equipo)
CREATE OR REPLACE FUNCTION get_admins_org(p_org_id INT DEFAULT NULL)
RETURNS TABLE(id UUID, email TEXT, rol TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, u.email, a.rol, a.created_at
  FROM admins a
  JOIN auth.users u ON u.id = a.id
  WHERE a.org_id = COALESCE(p_org_id, get_admin_org_id())
    AND (get_admin_org_id() = a.org_id OR is_superadmin());
$$;

GRANT EXECUTE ON FUNCTION get_admins_org(INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
