import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// El cliente extrae el DNI del PDF417 y lo envía aquí junto con el verificacion_token.
// El servidor verifica que el DNI extraído coincide con el hash del token.
export async function POST(req: Request) {
  try {
    const { verificacion_token, dni_extraido } = (await req.json()) as {
      verificacion_token: string;
      dni_extraido: string;
    };

    if (!verificacion_token || !dni_extraido) {
      return NextResponse.json({ ok: false, error: "Datos incompletos." }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Leer el verificacion_token para obtener el dni_hash y eleccion_id
    const { data: vtRow } = await supabase
      .from("verificacion_tokens")
      .select("token, eleccion_id, dni_hash, metodo, expires_at, usado")
      .eq("token", verificacion_token)
      .single();

    if (!vtRow || vtRow.usado) {
      return NextResponse.json({ ok: false, error: "Token inválido o ya utilizado." }, { status: 400 });
    }

    if (new Date(vtRow.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "El tiempo de verificación expiró. Ingresá tu DNI nuevamente." }, { status: 400 });
    }

    if (vtRow.metodo !== "dni_qr") {
      return NextResponse.json({ ok: false, error: "Método de verificación incorrecto." }, { status: 400 });
    }

    // Hashear el DNI extraído del QR y comparar con el hash del padrón
    // Usamos la misma función de hash que el cliente
    const { createHash } = await import("crypto");
    const pepper = process.env.NEXT_PUBLIC_VOTE_PEPPER ?? "";
    const input = `${dni_extraido.trim()}${vtRow.eleccion_id}${pepper}`;
    const dniHash = createHash("sha256").update(input).digest("hex");

    if (dniHash !== vtRow.dni_hash) {
      return NextResponse.json({
        ok: false,
        error: "El DNI escaneado no coincide con el DNI ingresado."
      }, { status: 400 });
    }

    // Canjear el verificacion_token por el token de voto real
    const { data, error } = await supabase.rpc("canjear_verificacion_token", {
      p_vtoken: verificacion_token,
    });

    if (error || !data?.ok) {
      return NextResponse.json({ ok: false, error: data?.error ?? "Error al verificar." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, token: data.token });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno del servidor." }, { status: 500 });
  }
}
