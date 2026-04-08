"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function SuperadminNav() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(path: string) {
    return pathname.startsWith(path);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-700">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black text-white tracking-tight">
            VotaYa <span className="text-purple-400 text-xs font-semibold ml-1">SUPERADMIN</span>
          </span>

          <div className="flex items-center gap-1 ml-4">
            <Link
              href="/superadmin/dashboard"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive("/superadmin/dashboard")
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Organizaciones
            </Link>
            <Link
              href="/superadmin/orgs/nueva"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive("/superadmin/orgs/nueva")
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              + Nueva org
            </Link>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-sm text-slate-400 hover:text-red-400 transition-colors"
        >
          Salir
        </button>
      </div>
    </nav>
  );
}
