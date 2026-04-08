"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTodasLasOrgs } from "@/lib/supabase/admin-queries";
import type { OrgStats } from "@/types/voting";

export default function SuperadminDashboardPage() {
  const [orgs, setOrgs] = useState<OrgStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTodasLasOrgs().then((data) => {
      setOrgs(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Todas las organizaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">{orgs.length} organización{orgs.length !== 1 ? "es" : ""} registrada{orgs.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/superadmin/orgs/nueva"
          className="bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + Nueva organización
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No hay organizaciones todavía.</p>
          <p className="text-sm">Creá una o esperá que se registren via /registro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition-all flex flex-col gap-4"
            >
              {/* Org identity */}
              <div className="flex items-center gap-3">
                {org.logo_url ? (
                  <img src={org.logo_url} alt={org.nombre} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: org.color_primario }}
                  >
                    {org.nombre.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 truncate">{org.nombre}</h2>
                  <p className="text-xs text-slate-400 font-mono">/org/{org.slug}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-xl py-2">
                  <p className="text-lg font-bold text-slate-900">{org.total_elecciones}</p>
                  <p className="text-xs text-slate-400">Elecciones</p>
                </div>
                <div className="bg-green-50 rounded-xl py-2">
                  <p className="text-lg font-bold text-green-700">{org.elecciones_activas}</p>
                  <p className="text-xs text-slate-400">Activas</p>
                </div>
                <div className="bg-blue-50 rounded-xl py-2">
                  <p className="text-lg font-bold text-blue-700">{org.total_admins}</p>
                  <p className="text-xs text-slate-400">Admins</p>
                </div>
              </div>

              {/* Actions */}
              <Link
                href={`/org/${org.slug}/admin/dashboard`}
                className="w-full text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-colors"
              >
                Ir al panel →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
