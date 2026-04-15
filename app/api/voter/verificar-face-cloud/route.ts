import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { RekognitionClient, CompareFacesCommand } from "@aws-sdk/client-rekognition";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verificarConRekognition(
  frente: string, // base64 foto frente DNI
  selfie: string  // base64 selfie
): Promise<{ ok: boolean; score?: number; error?: string }> {
  const accessKeyId     = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region          = process.env.AWS_REGION ?? "us-east-1";

  // Mock de desarrollo: si no hay credenciales AWS configuradas
  if (!accessKeyId || !secretAccessKey) {
    await new Promise((r) => setTimeout(r, 1500));
    return { ok: true, score: 0.95 };
  }

  try {
    const client = new RekognitionClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    const { FaceMatches } = await client.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: Buffer.from(frente, "base64") },
        TargetImage: { Bytes: Buffer.from(selfie, "base64") },
        SimilarityThreshold: 80,
      })
    );

    const score = FaceMatches?.[0]?.Similarity ?? 0;

    return score >= 80
      ? { ok: true, score: score / 100 }
      : {
          ok: false,
          error: "Las caras no coinciden. Asegurate de que la foto del DNI y la selfie sean claras y estén bien iluminadas.",
          score: score / 100,
        };
  } catch (err) {
    console.error("[verificar-face-cloud] Error AWS Rekognition:", err);
    return { ok: false, error: "No se pudo conectar con el servicio de verificación." };
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

    if (!vtRow || vtRow.usado || vtRow.metodo !== "face_cloud") {
      return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 400 });
    }

    if (new Date(vtRow.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: "El tiempo de verificación expiró." }, { status: 400 });
    }

    // Verificar con AWS Rekognition (o mock si no hay credenciales)
    const resultado = await verificarConRekognition(frente_dni, selfie);

    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, error: resultado.error ?? "Verificación biométrica fallida." },
        { status: 400 }
      );
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
