"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEleccionesAdmin, getAdminCurrentOrg, getPadronStats } from "@/lib/supabase/admin-queries";
import type { Eleccion } from "@/types/voting";

const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-600",
  activa: "bg-green-100 text-green-700",
  cerrada: "bg-red-100 text-red-600",
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  activa: "Activa",
  cerrada: "Cerrada",
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const [elecciones, setElecciones] = useState<Eleccion[]>([]);
  const [stats, setStats] = useState<Record<number, { total: number; votaron: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const org = await getAdminCurrentOrg();
      const data = await getEleccionesAdmin(org?.id);
      setElecciones(data);
      setLoading(false);

      const entries = await Promise.all(
        data.map(async (e) => {
          const s = await getPadronStats(e.id);
          return [e.id, s] as const;
        })
      );
      setStats(Object.fromEntries(entries));
    }
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Elecciones</h1>
        <Link
          href="/admin/elecciones/nueva"
          className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + Nueva elección
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : elecciones.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No hay elecciones todavía.</p>
          <p className="text-sm">Creá una para comenzar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {elecciones.map((e) => {
            const s = stats[e.id];
            const pct = s && s.total > 0
              ? Math.round((s.votaron / s.total) * 100)
              : 0;

            return (
              <Link
                key={e.id}
                href={`/admin/elecciones/${e.id}`}
                className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900 leading-tight">{e.titulo}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatFecha(e.fecha_inicio)} → {formatFecha(e.fecha_fin)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_BADGE[e.estado]}`}>
                    {ESTADO_LABEL[e.estado]}
                  </span>
                </div>

                {s && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {s.votaron}/{s.total} votaron ({pct}%)
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
