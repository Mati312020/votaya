"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getOrgBySlug } from "@/lib/supabase/admin-queries";
import type { Organizacion } from "@/types/voting";

export default function OrgAdminNav() {
  const params = useParams<{ orgSlug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [org, setOrg] = useState<Organizacion | null>(null);

  const base = `/org/${params.orgSlug}/admin`;

  useEffect(() => {
    getOrgBySlug(params.orgSlug).then(setOrg);
  }, [params.orgSlug]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  function isActive(path: string) {
    return pathname.startsWith(path);
  }

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Org identity */}
          <div className="flex items-center gap-2">
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.nombre} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: org?.color_primario ?? "#1e40af" }}
              >
                {org?.nombre.charAt(0) ?? "O"}
              </div>
            )}
            <span className="font-semibold text-slate-900 text-sm hidden sm:block">
              {org?.nombre ?? params.orgSlug}
            </span>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1 ml-2">
            <Link
              href={`${base}/dashboard`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(`${base}/dashboard`)
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Elecciones
            </Link>
            <Link
              href={`${base}/equipo`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(`${base}/equipo`)
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Equipo
            </Link>
            <Link
              href={`${base}/auditoria`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive(`${base}/auditoria`)
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Auditoría
            </Link>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-sm text-slate-500 hover:text-red-600 transition-colors"
        >
          Salir
        </button>
      </div>
    </nav>
  );
}
