"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Credenciales incorrectas. Verificá tu email y contraseña.");
        // Log intento fallido (función pública restringida a eventos de auth)
        await supabase.rpc("log_auth_event", {
          p_event_type: "admin.login_failed",
          p_email:      email,
          p_org_id:     null,
        });
        return;
      }

      // Determine where to redirect based on role
      const { data: admins } = await supabase
        .from("admins")
        .select("rol, org_id, organizaciones(slug)")
        .eq("id", authData.user!.id);

      if (!admins || admins.length === 0) {
        setError("Tu usuario no tiene permisos de administrador.");
        await supabase.auth.signOut();
        return;
      }

      const isSuperadmin = admins.some((a) => a.rol === "superadmin");
      const adminRow = admins[0] as { rol: string; org_id: number; organizaciones: { slug: string }[] | { slug: string } | null };
      const orgArr = adminRow.organizaciones;
      const orgItem = Array.isArray(orgArr) ? orgArr[0] : orgArr;

      // Log login exitoso
      await supabase.rpc("log_auth_event", {
        p_event_type: "admin.login",
        p_email:      email,
        p_org_id:     isSuperadmin ? null : (adminRow.org_id ?? null),
      });

      // Superadmin → /superadmin/dashboard
      if (isSuperadmin) {
        router.replace("/superadmin/dashboard");
        return;
      }

      // Regular admin → /org/[slug]/admin/dashboard
      const slug = orgItem?.slug;
      if (slug) {
        router.replace(`/org/${slug}/admin/dashboard`);
      } else {
        router.replace("/admin/dashboard");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl font-black text-blue-700 tracking-tight mb-1">VotaYa</div>
          <p className="text-slate-500 text-sm">Panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5 transition-colors"
          >
            {isPending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
