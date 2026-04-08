import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const { verificacion_token, codigo } = (await req.json()) as {
      verificacion_token: string;
      codigo: string;
    };

    if (!verificacion_token || !codigo) {
      return NextResponse.json({ ok: false, error: "Datos incompletos." }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Validar verificacion_token
    const { data: vtRow } = await supabase
      .from("verificacion_tokens")
      .select("eleccion_id, dni_hash, metodo, expires_at, usado")
      .eq("token", verificacion_token)
      .single();

    if (!vtRow || vtRow.usado || vtRow.metodo !== "otp_email") {
      return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
    }

    if (new Date(vtRow.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "El tiempo de verificación expiró." }, { status: 400 });
    }

    // Verificar OTP
    const codeHash = createHash("sha256").update(codigo.trim()).digest("hex");

    const { data, error } = await supabase.rpc("verificar_otp", {
      p_eleccion_id: vtRow.eleccion_id,
      p_dni_hash:    vtRow.dni_hash,
      p_code_hash:   codeHash,
    });

    if (error || !data?.ok) {
      const msgs: Record<string, string> = {
        otp_incorrecto:      `Código incorrecto. Te quedan ${data?.intentos_restantes ?? "?"} intentos.`,
        otp_expirado:        "El código expiró. Solicitá uno nuevo.",
        demasiados_intentos: "Demasiados intentos fallidos. Solicitá un nuevo código.",
        otp_no_encontrado:   "No se encontró un código activo. Solicitá uno nuevo.",
      };
      return NextResponse.json({
        ok: false,
        error: msgs[data?.error ?? ""] ?? "Código incorrecto."
      }, { status: 400 });
    }

    // Canjear verificacion_token por token de voto real
    const { data: canjeData, error: canjeError } = await supabase.rpc("canjear_verificacion_token", {
      p_vtoken: verificacion_token,
    });

    if (canjeError || !canjeData?.ok) {
      return NextResponse.json({ ok: false, error: "Error al emitir token de voto." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, token: canjeData.token });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno del servidor." }, { status: 500 });
  }
}
