import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Lazily initialized so env var is read at request time, not build time
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const { email, password, orgId } = (await req.json()) as {
      email: string;
      password: string;
      orgId: number;
    };

    if (!email || !password || !orgId) {
      return NextResponse.json({ ok: false, error: "Faltan datos requeridos." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // 1. Create user in Supabase Auth
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !user) {
      return NextResponse.json(
        { ok: false, error: createError?.message ?? "No se pudo crear el usuario." },
        { status: 400 }
      );
    }

    // 2. Insert into admins table
    const { error: insertError } = await supabaseAdmin
      .from("admins")
      .insert({ id: user.id, org_id: orgId, rol: "admin" });

    if (insertError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    // 3. Audit log — admin invited (service role inserts directly)
    await supabaseAdmin.from("audit_log").insert({
      actor_type:  "system",
      org_id:      orgId,
      event_type:  "admin.invited",
      entity_type: "admin",
      entity_id:   user.id,
      metadata:    { email, rol: "admin" },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
