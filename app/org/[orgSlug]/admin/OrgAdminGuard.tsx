"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type GuardState = "loading" | "allowed" | "forbidden";

export default function OrgAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams<{ orgSlug: string }>();
  const [state, setState] = useState<GuardState>("loading");

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/admin/login");
        return;
      }

      const { data: adminRows } = await supabase
        .from("admins")
        .select("rol, org_id, organizaciones(slug)")
        .eq("id", session.user.id);

      if (!adminRows || adminRows.length === 0) {
        router.replace("/admin/login");
        return;
      }

      // Superadmin can access any org
      const isSuperadmin = adminRows.some((a) => a.rol === "superadmin");
      if (isSuperadmin) {
        setState("allowed");
        return;
      }

      // Check if any of the admin rows matches the URL org slug
      // Supabase types FK joins as arrays even for many-to-one
      const hasAccess = adminRows.some((a) => {
        const raw = a.organizaciones as { slug: string }[] | { slug: string } | null;
        const org = Array.isArray(raw) ? raw[0] : raw;
        return org?.slug === params.orgSlug;
      });

      setState(hasAccess ? "allowed" : "forbidden");
    }

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/admin/login");
    });

    return () => subscription.unsubscribe();
  }, [params.orgSlug, router]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso denegado</h1>
          <p className="text-slate-500 mb-6">
            No tenés permisos para administrar esta organización.
          </p>
          <a
            href="/admin/login"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            Volver al login
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
