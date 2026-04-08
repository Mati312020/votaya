"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type GuardState = "loading" | "allowed" | "forbidden";

export default function SuperadminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("loading");

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/admin/login");
        return;
      }

      const { data } = await supabase
        .from("admins")
        .select("rol")
        .eq("id", session.user.id)
        .eq("rol", "superadmin")
        .maybeSingle();

      setState(data ? "allowed" : "forbidden");
    }

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/admin/login");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso restringido</h1>
          <p className="text-slate-500 mb-6">Esta área requiere permisos de superadministrador.</p>
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
