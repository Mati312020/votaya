import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const { verificacion_token } = (await req.json()) as { verificacion_token: string };

    if (!verificacion_token) {
      return NextResponse.json({ ok: false, error: "Token faltante." }, { status: 400 });
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

    // Obtener email del padrón
    const { data: emailData } = await supabase.rpc("get_email_padron", {
      p_eleccion_id: vtRow.eleccion_id,
      p_dni_hash: vtRow.dni_hash,
    });

    if (!emailData) {
      return NextResponse.json({
        ok: false,
        error: "No hay email registrado para este DNI en el padrón. Contactá al administrador."
      }, { status: 400 });
    }

    // Generar código OTP de 6 dígitos
    const code = String(randomInt(100000, 999999));
    const codeHash = createHash("sha256").update(code).digest("hex");

    // Guardar hash del OTP en DB
    await supabase.rpc("guardar_otp", {
      p_eleccion_id: vtRow.eleccion_id,
      p_dni_hash: vtRow.dni_hash,
      p_code_hash: codeHash,
    });

    // Enviar email con Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // En desarrollo sin RESEND configurado, loguear el código
      console.log(`[DEV] OTP para ${emailData}: ${code}`);
    } else {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);

      const emailMasked = emailData.replace(/(.{2}).+(@.+)/, "$1***$2");

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "VotaYa <noreply@votaya.app>",
        to: emailData,
        subject: "Tu código de verificación — VotaYa",
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
            <h2 style="color:#1e40af;margin-bottom:8px">VotaYa</h2>
            <p style="color:#475569;margin-bottom:24px">Tu código de verificación para votar es:</p>
            <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
              <span style="font-size:40px;font-weight:bold;letter-spacing:8px;color:#1e293b">${code}</span>
            </div>
            <p style="color:#94a3b8;font-size:12px">Este código expira en 10 minutos. No lo compartas con nadie.</p>
          </div>
        `,
      });
    }

    // Enmascarar email para la respuesta (privacidad)
    const emailMasked = emailData.replace(/(.{2}).+(@.+)/, "$1***$2");
    return NextResponse.json({ ok: true, email_masked: emailMasked });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Error interno del servidor." }, { status: 500 });
  }
}
