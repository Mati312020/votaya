"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminNav() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/admin/dashboard" className="text-lg font-black text-blue-700 tracking-tight">
          VotaYa
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Elecciones
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-red-600 transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
