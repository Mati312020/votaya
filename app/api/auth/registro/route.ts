import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(req: Request) {
  try {
    const { email, password, nombre, slug, color } = (await req.json()) as {
      email: string;
      password: string;
      nombre: string;
      slug: string;
      color: string;
    };

    if (!email || !password || !nombre || !slug) {
      return NextResponse.json({ ok: false, error: "Faltan datos requeridos." }, { status: 400 });
    }

    const cleanSlug = toSlug(slug);
    if (!cleanSlug) {
      return NextResponse.json({ ok: false, error: "Identificador inválido." }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // 1. Check slug availability
    const { data: existing } = await supabaseAdmin
      .from("organizaciones")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: false, error: "slug_taken" }, { status: 409 });
    }

    // 2. Create user with email already confirmed (service role bypasses email flow)
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !user) {
      const msg = createError?.message ?? "No se pudo crear el usuario.";
      // Surface duplicate email error clearly
      const isTaken = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered");
      return NextResponse.json(
        { ok: false, error: isTaken ? "email_taken" : msg },
        { status: 400 }
      );
    }

    // 3. Insert organization
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("organizaciones")
      .insert({ nombre: nombre.trim(), slug: cleanSlug, color_primario: color })
      .select("id")
      .single();

    if (orgError || !orgData) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json(
        { ok: false, error: orgError?.message ?? "Error al crear la organización." },
        { status: 500 }
      );
    }

    // 4. Link user as admin of the new org
    const { error: adminError } = await supabaseAdmin
      .from("admins")
      .insert({ id: user.id, org_id: orgData.id, rol: "admin" });

    if (adminError) {
      // Rollback
      await supabaseAdmin.from("organizaciones").delete().eq("id", orgData.id);
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json(
        { ok: false, error: adminError.message },
        { status: 500 }
      );
    }

    // 5. Audit log — org + admin created (service role inserts directly)
    await supabaseAdmin.from("audit_log").insert([
      {
        actor_type:  "system",
        actor_id:    user.id,
        org_id:      orgData.id,
        event_type:  "org.created",
        entity_type: "organizacion",
        entity_id:   String(orgData.id),
        metadata:    { nombre: nombre.trim(), slug: cleanSlug, origen: "self_service", email },
      },
      {
        actor_type:  "system",
        actor_id:    user.id,
        org_id:      orgData.id,
        event_type:  "admin.created",
        entity_type: "admin",
        entity_id:   user.id,
        metadata:    { email, rol: "admin", origen: "self_service" },
      },
    ]);

    return NextResponse.json({ ok: true, slug: cleanSlug });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Error interno del servidor." }, { status: 500 });
  }
}
