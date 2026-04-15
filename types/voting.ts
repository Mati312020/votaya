export type EstadoEleccion = "borrador" | "activa" | "cerrada";
export type VerificacionIdentidad = "ninguna" | "dni_qr" | "otp_email" | "renaper" | "face_cloud";

export interface Organizacion {
  id: number;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_primario: string;
  website: string | null;
  created_at: string;
  // Plan & trial
  plan: string;
  trial_expires_at: string | null;
  limite_votantes: number;
  limite_elecciones: number;
}

export interface OrgStats {
  id: number;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_primario: string;
  total_elecciones: number;
  elecciones_activas: number;
  total_admins: number;
}

export interface AdminConEmail {
  id: string;
  email: string;
  rol: string;
  created_at: string;
}

export interface Eleccion {
  id: number;
  org_id: number;
  titulo: string;
  descripcion: string | null;
  slug: string;
  estado: EstadoEleccion;
  fecha_inicio: string;
  fecha_fin: string;
  voto_reemplazable: boolean;
  resultados_visibles: boolean;
  verificacion_identidad: VerificacionIdentidad;
  created_at: string;
}

export interface Lista {
  id: number;
  eleccion_id: number;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  orden: number;
  metadata: ListaMetadata | null;
  grupo_padre_id: number | null;
  sublistas?: Lista[];
}

export interface ListaMetadata {
  slogan?: string;
  color?: string;
  color_texto?: string;
}

export interface ValidarDniResult {
  ok: boolean;
  // Sin verificación → token de voto directo
  token?: string;
  // Con verificación → token intermedio
  requiere_verificacion?: boolean;
  metodo?: VerificacionIdentidad;
  verificacion_token?: string;
  error?: "ya_voto" | "no_en_padron" | "eleccion_no_activa" | "desconocido";
}

export interface EmitirVotoResult {
  ok: boolean;
  voto_hash?: string;
  error?: "token_invalido" | "token_expirado" | "token_usado" | "desconocido";
}

// ── Admin types ───────────────────────────────────────────

export interface Admin {
  id: string;
  org_id: number;
  rol: "admin" | "superadmin";
  created_at: string;
}

export interface Participacion {
  total: number;
  votaron: number;
  porcentaje: number;
}

export interface ResultadoLista {
  lista_id: number;
  nombre: string;
  foto_url: string | null;
  color: string | null;
  votos: number;
}

export interface EleccionConStats extends Eleccion {
  participacion?: Participacion;
}

// ── Estructura Electoral ──────────────────────────────────────

export type NivelEstructura = "distrito" | "seccion" | "circuito" | "mesa";

export const NIVEL_LABEL: Record<NivelEstructura, string> = {
  distrito: "Distrito",
  seccion:  "Sección",
  circuito: "Circuito",
  mesa:     "Mesa",
};

// Hijo válido para cada nivel
export const NIVEL_HIJOS: Record<NivelEstructura, NivelEstructura[]> = {
  distrito: ["seccion", "circuito", "mesa"],
  seccion:  ["circuito", "mesa"],
  circuito: ["mesa"],
  mesa:     [],
};

export interface EstructuraNode {
  id: number;
  eleccion_id: number;
  padre_id: number | null;
  nivel: NivelEstructura;
  nombre: string;
  codigo: string | null;
  orden: number;
  path_nombre: string;      // calculado por la RPC (ej: "Buenos Aires / Sección 1")
  hijos?: EstructuraNode[]; // construido en el cliente
}

export interface ParticipacionMesa {
  mesa_id: number;
  mesa_nombre: string;
  mesa_codigo: string | null;
  path_nombre: string;
  total: number;
  votaron: number;
  porcentaje: number;
}
