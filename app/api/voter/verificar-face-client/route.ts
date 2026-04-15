import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Esta route NO procesa imágenes — la comparación facial ocurre
// íntegramente en el browser del votante (face-api.js + TensorFlow.js).
// El servidor solo valida el verificacion_token y lo canjea por un voto_token.

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const { verificacion_token } = (await req.json()) as {
      verificacion_token: string;
    };

    if (!verificacion_token) {
      return NextResponse.json({ ok: false, error: "Token requerido." }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Validar verificacion_token
    const { data: vtRow } = await supabase
      .from("verificacion_tokens")
      .select("eleccion_id, dni_hash, metodo, expires_at, usado")
      .eq("token", verificacion_token)
      .single();

    if (!vtRow || vtRow.usado || vtRow.metodo !== "face_client") {
      return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
    }

    if (new Date(vtRow.expires_at) < new Date()) {
      return NextResponse.json(
        { ok: false, error: "El tiempo de verificación expiró. Volvé a ingresar tu DNI." },
        { status: 400 }
      );
    }

    // Canjear token de verificación por token de voto
    const { data, error } = await supabase.rpc("canjear_verificacion_token", {
      p_vtoken: verificacion_token,
    });

    if (error || !data?.ok) {
      return NextResponse.json({ ok: false, error: "Error al emitir token de voto." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, token: data.token });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno del servidor." }, { status: 500 });
  }
}
