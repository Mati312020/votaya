import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Llama a RENAPER o al mock (si RENAPER_API_KEY no está configurada)
async function verificarConRenaper(
  frente: string,   // base64 foto frente DNI
  selfie: string    // base64 selfie
): Promise<{ ok: boolean; score?: number; error?: string }> {
  const apiKey = process.env.RENAPER_API_KEY;

  if (!apiKey) {
    // Mock de desarrollo: simula una respuesta exitosa con delay de 1.5s
    await new Promise((r) => setTimeout(r, 1500));
    // En mock, aceptar siempre (para testing)
    return { ok: true, score: 0.95 };
  }

  // Integración real con RENAPER API
  // Endpoint oficial: https://api.renaper.gob.ar/v1/biometria/comparar
  // Documentación disponible previa habilitación institucional
  try {
    const res = await fetch("https://api.renaper.gob.ar/v1/biometria/comparar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ frente_dni: frente, selfie }),
    });

    if (!res.ok) {
      return { ok: false, error: "Error en la consulta a RENAPER." };
    }

    const data = await res.json();
    const score = data.similitud ?? data.score ?? 0;
    // Umbral mínimo de similitud biométrica
    return score >= 0.7
      ? { ok: true, score }
      : { ok: false, error: "La verificación biométrica no fue exitosa.", score };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servicio de RENAPER." };
  }
}

export async function POST(req: Request) {
  try {
    const { verificacion_token, frente_dni, selfie } = (await req.json()) as {
      verificacion_token: string;
      frente_dni: string;
      selfie: string;
    };

    if (!verificacion_token || !frente_dni || !selfie) {
      return NextResponse.json({ ok: false, error: "Datos incompletos." }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Validar verificacion_token
    const { data: vtRow } = await supabase
      .from("verificacion_tokens")
      .select("eleccion_id, dni_hash, metodo, expires_at, usado")
      .eq("token", verificacion_token)
      .single();

    if (!vtRow || vtRow.usado || vtRow.metodo !== "renaper") {
      return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
    }

    if (new Date(vtRow.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "El tiempo de verificación expiró." }, { status: 400 });
    }

    // Verificar con RENAPER (o mock)
    const renaperResult = await verificarConRenaper(frente_dni, selfie);

    if (!renaperResult.ok) {
      return NextResponse.json({ ok: false, error: renaperResult.error ?? "Verificación fallida." }, { status: 400 });
    }

    // Canjear verificacion_token por token de voto real
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
