import { supabase } from "./client";
import type {
  Eleccion,
  Lista,
  Organizacion,
  OrgStats,
  AdminConEmail,
  Participacion,
  ResultadoLista,
  EstructuraNode,
  NivelEstructura,
  ParticipacionMesa,
} from "@/types/voting";

// ── Organización helpers ──────────────────────────────────

export async function getAdminCurrentOrg(): Promise<Organizacion | null> {
  const { data, error } = await supabase
    .from("admins")
    .select("org_id, organizaciones(*)")
    .single();

  if (error || !data) return null;
  // Supabase types FK relations as arrays; for many-to-one the array has one element
  const row = data as { organizaciones: Organizacion[] | Organizacion };
  const org = Array.isArray(row.organizaciones)
    ? row.organizaciones[0]
    : row.organizaciones;
  return org ?? null;
}

export async function getOrgBySlug(slug: string): Promise<Organizacion | null> {
  const { data, error } = await supabase
    .from("organizaciones")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Organizacion;
}

// ── Superadmin RPCs ───────────────────────────────────────

export async function getTodasLasOrgs(): Promise<OrgStats[]> {
  const { data, error } = await supabase.rpc("get_todas_las_orgs");
  if (error || !data) return [];
  return (data as OrgStats[]).map((r) => ({
    ...r,
    total_elecciones: Number(r.total_elecciones),
    elecciones_activas: Number(r.elecciones_activas),
    total_admins: Number(r.total_admins),
  }));
}

export async function superadminCrearOrg(
  nombre: string,
  slug: string,
  color: string
): Promise<{ ok: boolean; org_id?: number; error?: string }> {
  const { data, error } = await supabase.rpc("superadmin_crear_org", {
    p_nombre: nombre,
    p_slug: slug,
    p_color: color,
  });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; org_id?: number; error?: string };
}

export async function registrarOrganizacion(
  nombre: string,
  slug: string,
  color: string
): Promise<{ ok: boolean; slug?: string; org_id?: number; error?: string }> {
  const { data, error } = await supabase.rpc("registrar_organizacion", {
    p_nombre: nombre,
    p_slug: slug,
    p_color: color,
  });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; slug?: string; org_id?: number; error?: string };
}

export async function getAdminsOrg(orgId?: number): Promise<AdminConEmail[]> {
  const { data, error } = await supabase.rpc("get_admins_org", {
    p_org_id: orgId ?? null,
  });
  if (error || !data) return [];
  return data as AdminConEmail[];
}

// ── Auditoría ─────────────────────────────────────────────

export interface AuditEntry {
  id: number;
  created_at: string;
  actor_type: "admin" | "voter" | "system";
  actor_id: string | null;
  actor_email: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  result: string | null;
  metadata: Record<string, unknown> | null;
}

// Tipos de actor disponibles para filtrado
export type ActorType = AuditEntry["actor_type"];

export async function logAdminEvent(
  eventType: string,
  opts?: {
    eleccionId?: number;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.rpc("log_admin_event", {
    p_event_type:  eventType,
    p_eleccion_id: opts?.eleccionId  ?? null,
    p_entity_type: opts?.entityType  ?? null,
    p_entity_id:   opts?.entityId    ?? null,
    p_metadata:    opts?.metadata    ?? null,
  });
}

export async function getAuditLog(opts?: {
  eleccionId?: number;
  limit?: number;
  offset?: number;
}): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc("get_audit_log", {
    p_eleccion_id: opts?.eleccionId ?? null,
    p_limit:       opts?.limit      ?? 200,
    p_offset:      opts?.offset     ?? 0,
  });
  if (error || !data) return [];
  return data as AuditEntry[];
}

export async function getAuditLogAll(eleccionId?: number): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc("get_audit_log_all", {
    p_eleccion_id: eleccionId ?? null,
  });
  if (error || !data) return [];
  return data as AuditEntry[];
}

// ── Elecciones ────────────────────────────────────────────

export async function getEleccionesAdmin(orgId?: number): Promise<Eleccion[]> {
  let query = supabase.from("elecciones").select("*");
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Eleccion[];
}

export async function getEleccionById(id: number): Promise<Eleccion | null> {
  const { data, error } = await supabase
    .from("elecciones")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Eleccion;
}

export async function crearEleccion(
  eleccion: Omit<Eleccion, "id" | "org_id" | "created_at">
): Promise<{ id: number } | null> {
  const { data: adminData } = await supabase
    .from("admins")
    .select("org_id")
    .single();

  if (!adminData) return null;

  const { data, error } = await supabase
    .from("elecciones")
    .insert({ ...eleccion, org_id: adminData.org_id })
    .select("id")
    .single();

  if (error || !data) return null;

  await supabase.rpc("log_admin_event", {
    p_event_type:  "eleccion.created",
    p_eleccion_id: data.id,
    p_entity_type: "eleccion",
    p_entity_id:   String(data.id),
    p_metadata:    {
      titulo:                eleccion.titulo,
      estado:                eleccion.estado,
      verificacion_identidad: eleccion.verificacion_identidad ?? "ninguna",
      fecha_inicio:          eleccion.fecha_inicio,
      fecha_fin:             eleccion.fecha_fin,
    },
  });

  return { id: data.id };
}

export async function actualizarEleccion(
  id: number,
  updates: Partial<Pick<Eleccion, "titulo" | "descripcion" | "estado" | "fecha_inicio" | "fecha_fin" | "voto_reemplazable" | "resultados_visibles" | "verificacion_identidad">>
): Promise<boolean> {
  const { error } = await supabase
    .from("elecciones")
    .update(updates)
    .eq("id", id);

  if (!error) {
    // Elegir evento según qué cambió
    const eventType = updates.estado
      ? "eleccion.estado_changed"
      : updates.resultados_visibles !== undefined
        ? (updates.resultados_visibles ? "eleccion.resultados_revealed" : "eleccion.resultados_hidden")
        : "eleccion.updated";

    await supabase.rpc("log_admin_event", {
      p_event_type:  eventType,
      p_eleccion_id: id,
      p_entity_type: "eleccion",
      p_entity_id:   String(id),
      p_metadata:    updates,
    });
  }

  return !error;
}

// ── Listas ────────────────────────────────────────────────

export async function getListasAdmin(eleccionId: number): Promise<Lista[]> {
  const { data, error } = await supabase
    .from("listas")
    .select("*")
    .eq("eleccion_id", eleccionId)
    .order("orden", { ascending: true });

  if (error || !data) return [];
  return data as Lista[];
}

export async function crearLista(
  lista: Omit<Lista, "id" | "created_at" | "sublistas">
): Promise<Lista | null> {
  const { data, error } = await supabase
    .from("listas")
    .insert(lista)
    .select()
    .single();

  if (error || !data) return null;

  await supabase.rpc("log_admin_event", {
    p_event_type:  "lista.created",
    p_eleccion_id: lista.eleccion_id,
    p_entity_type: "lista",
    p_entity_id:   String(data.id),
    p_metadata:    { nombre: lista.nombre },
  });

  return data as Lista;
}

export async function actualizarLista(
  id: number,
  updates: Partial<Omit<Lista, "id" | "eleccion_id" | "sublistas">>,
  eleccionId?: number
): Promise<boolean> {
  const { error } = await supabase
    .from("listas")
    .update(updates)
    .eq("id", id);

  if (!error) {
    await supabase.rpc("log_admin_event", {
      p_event_type:  "lista.updated",
      p_eleccion_id: eleccionId ?? null,
      p_entity_type: "lista",
      p_entity_id:   String(id),
      p_metadata:    { nombre: updates.nombre, ...updates },
    });
  }

  return !error;
}

export async function eliminarLista(id: number, nombre?: string, eleccionId?: number): Promise<boolean> {
  const { error } = await supabase
    .from("listas")
    .delete()
    .eq("id", id);

  if (!error) {
    await supabase.rpc("log_admin_event", {
      p_event_type:  "lista.deleted",
      p_eleccion_id: eleccionId ?? null,
      p_entity_type: "lista",
      p_entity_id:   String(id),
      p_metadata:    nombre ? { nombre } : null,
    });
  }

  return !error;
}

export async function uploadFotoLista(
  file: File,
  eleccionId: number,
  listaId: number
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${eleccionId}/${listaId}.${ext}`;

  const { error } = await supabase.storage
    .from("lista-fotos")
    .upload(path, file, { upsert: true });

  if (error) return null;

  const { data } = supabase.storage
    .from("lista-fotos")
    .getPublicUrl(path);

  return data.publicUrl;
}

// ── Padrón ────────────────────────────────────────────────

export async function upsertPadron(
  eleccionId: number,
  hashes: string[],
  emails?: (string | null)[],
  mesaIds?: (number | null)[]
): Promise<{ insertados: number; error: string | null }> {
  const rows = hashes.map((hash, i) => ({
    eleccion_id: eleccionId,
    dni_hash: hash,
    ...(emails   ? { email:   emails[i]   ?? null } : {}),
    ...(mesaIds  ? { mesa_id: mesaIds[i]  ?? null } : {}),
  }));

  // Insertamos en lotes de 500 para no exceder límites de PostgREST
  const BATCH = 500;
  let insertados = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("padron_votantes")
      .upsert(batch, { onConflict: "eleccion_id,dni_hash", ignoreDuplicates: true })
      .select("id");

    if (error) return { insertados, error: error.message };
    insertados += count ?? batch.length;
  }

  await supabase.rpc("log_admin_event", {
    p_event_type:  "padron.uploaded",
    p_eleccion_id: eleccionId,
    p_entity_type: "padron",
    p_entity_id:   String(eleccionId),
    p_metadata:    { count: hashes.length },
  });

  return { insertados, error: null };
}

export async function getPadronStats(
  eleccionId: number
): Promise<{ total: number; votaron: number }> {
  const { count: total } = await supabase
    .from("padron_votantes")
    .select("*", { count: "exact", head: true })
    .eq("eleccion_id", eleccionId);

  const { count: votaron } = await supabase
    .from("padron_votantes")
    .select("*", { count: "exact", head: true })
    .eq("eleccion_id", eleccionId)
    .eq("ya_voto", true);

  return { total: total ?? 0, votaron: votaron ?? 0 };
}

// ── Estructura Electoral ──────────────────────────────────

/** Devuelve el árbol plano de una elección; el cliente construye la jerarquía */
export async function getEstructuraElectoral(eleccionId: number): Promise<EstructuraNode[]> {
  const { data, error } = await supabase.rpc("get_estructura_electoral", {
    p_eleccion_id: eleccionId,
  });
  if (error || !data) return [];
  return data as EstructuraNode[];
}

/** Solo las mesas (hojas del árbol), útil para el selector del PadronUploader */
export async function getMesasEleccion(eleccionId: number): Promise<EstructuraNode[]> {
  const { data, error } = await supabase
    .from("estructura_electoral")
    .select("id, nombre, codigo, orden, padre_id, nivel, eleccion_id, path_nombre:nombre, created_at")
    .eq("eleccion_id", eleccionId)
    .eq("nivel", "mesa")
    .order("orden");
  if (error || !data) return [];
  return data as unknown as EstructuraNode[];
}

export async function crearNodoEstructura(
  eleccionId: number,
  nivel: NivelEstructura,
  nombre: string,
  padreId?: number | null,
  codigo?: string,
  orden?: number
): Promise<EstructuraNode | null> {
  const { data, error } = await supabase
    .from("estructura_electoral")
    .insert({ eleccion_id: eleccionId, nivel, nombre, padre_id: padreId ?? null, codigo: codigo ?? null, orden: orden ?? 0 })
    .select()
    .single();
  if (error || !data) return null;
  await supabase.rpc("log_admin_event", {
    p_event_type:  "estructura.created",
    p_eleccion_id: eleccionId,
    p_entity_type: "estructura",
    p_entity_id:   String(data.id),
    p_metadata:    { nivel, nombre, padre_id: padreId ?? null },
  });
  return data as unknown as EstructuraNode;
}

export async function actualizarNodoEstructura(
  id: number,
  updates: { nombre?: string; codigo?: string; orden?: number }
): Promise<boolean> {
  const { error } = await supabase
    .from("estructura_electoral")
    .update(updates)
    .eq("id", id);
  return !error;
}

export async function eliminarNodoEstructura(id: number): Promise<boolean> {
  const { error } = await supabase
    .from("estructura_electoral")
    .delete()
    .eq("id", id);
  return !error;
}

export async function getParticipacionPorMesa(
  eleccionId: number
): Promise<ParticipacionMesa[]> {
  const { data, error } = await supabase.rpc("get_participacion_por_mesa", {
    p_eleccion_id: eleccionId,
  });
  if (error || !data) return [];
  return (data as ParticipacionMesa[]).map((r) => ({
    ...r,
    mesa_id:    Number(r.mesa_id),
    total:      Number(r.total),
    votaron:    Number(r.votaron),
    porcentaje: Number(r.porcentaje),
  }));
}

export async function getResultadosPorMesa(
  eleccionId: number,
  mesaId: number
): Promise<ResultadoLista[]> {
  const { data, error } = await supabase.rpc("get_resultados_por_mesa", {
    p_eleccion_id: eleccionId,
    p_mesa_id:     mesaId,
  });
  if (error || !data) return [];
  return (data as ResultadoLista[]).map((r) => ({ ...r, votos: Number(r.votos) }));
}

// ── Resultados ────────────────────────────────────────────

export async function getResultados(
  eleccionId: number
): Promise<ResultadoLista[]> {
  const { data, error } = await supabase.rpc("get_resultados", {
    p_eleccion_id: eleccionId,
  });

  if (error || !data) return [];
  return (data as ResultadoLista[]).map((r) => ({
    ...r,
    votos: Number(r.votos),
  }));
}

export async function getParticipacion(
  eleccionId: number
): Promise<Participacion | null> {
  const { data, error } = await supabase.rpc("get_participacion", {
    p_eleccion_id: eleccionId,
  });

  if (error || !data) return null;
  return data as Participacion;
}
