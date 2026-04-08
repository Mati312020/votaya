-- ============================================================
-- VOTAYA — Migraciones Fase 2 y 3
-- RPCs para resultados y participación
-- ============================================================

CREATE OR REPLACE FUNCTION get_resultados(p_eleccion_id INT)
RETURNS TABLE(lista_id INT, nombre TEXT, foto_url TEXT, color TEXT, votos BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    l.id,
    l.nombre,
    l.foto_url,
    l.metadata->>'color' AS color,
    COUNT(u.id) AS votos
  FROM listas l
  LEFT JOIN urna u ON u.lista_id = l.id AND u.eleccion_id = p_eleccion_id
  WHERE l.eleccion_id = p_eleccion_id
    AND EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = p_eleccion_id AND e.estado IN ('activa', 'cerrada')
    )
  GROUP BY l.id, l.nombre, l.foto_url, l.metadata
  ORDER BY l.orden ASC;
$func$;

CREATE OR REPLACE FUNCTION get_participacion(p_eleccion_id INT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'votaron', COUNT(*) FILTER (WHERE ya_voto = TRUE),
    'porcentaje', ROUND(
      COUNT(*) FILTER (WHERE ya_voto = TRUE) * 100.0 / NULLIF(COUNT(*), 0),
      1
    )
  )
  FROM padron_votantes
  WHERE eleccion_id = p_eleccion_id
    AND EXISTS (
      SELECT 1 FROM elecciones e
      WHERE e.id = p_eleccion_id AND e.estado IN ('activa', 'cerrada')
    );
$func$;

GRANT EXECUTE ON FUNCTION public.get_resultados(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_participacion(INT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
