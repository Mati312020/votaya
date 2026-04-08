import { supabase } from "./client";
import type {
  Eleccion,
  Lista,
  ValidarDniResult,
  EmitirVotoResult,
} from "@/types/voting";

export interface EleccionPublica extends Eleccion {
  org_color: string;
  org_nombre: string;
  org_logo: string | null;
}

export async function getEleccionBySlug(
  slug: string
): Promise<EleccionPublica | null> {
  const { data, error } = await supabase
    .from("elecciones")
    .select("*, organizaciones(nombre, logo_url, color_primario)")
    .eq("slug", slug)
    .eq("estado", "activa")
    .single();

  if (error || !data) return null;

  const org = (data as { organizaciones?: { nombre: string; logo_url: string | null; color_primario: string } | null }).organizaciones;

  return {
    ...(data as Eleccion),
    org_color: org?.color_primario ?? "#1e40af",
    org_nombre: org?.nombre ?? "",
    org_logo: org?.logo_url ?? null,
  };
}

export async function getListasByEleccion(
  eleccionId: number
): Promise<Lista[]> {
  const { data, error } = await supabase
    .from("listas")
    .select("*")
    .eq("eleccion_id", eleccionId)
    .is("grupo_padre_id", null)
    .order("orden", { ascending: true });

  if (error || !data) return [];
  return data as Lista[];
}

export async function validarDni(
  eleccionId: number,
  dniHash: string
): Promise<ValidarDniResult> {
  const { data, error } = await supabase.rpc("validar_dni", {
    p_eleccion_id: eleccionId,
    p_dni_hash: dniHash,
  });

  if (error) {
    return { ok: false, error: "desconocido" };
  }

  return data as ValidarDniResult;
}

export async function emitirVoto(
  token: string,
  listaId: number
): Promise<EmitirVotoResult> {
  const { data, error } = await supabase.rpc("emitir_voto", {
    p_token: token,
    p_lista_id: listaId,
  });

  if (error) {
    return { ok: false, error: "desconocido" };
  }

  return data as EmitirVotoResult;
}
