"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import EleccionForm from "@/components/admin/EleccionForm";
import ListasManager from "@/components/admin/ListasManager";
import PadronUploader from "@/components/admin/PadronUploader";
import QREleccion from "@/components/admin/QREleccion";
import { getListasAdmin, actualizarEleccion } from "@/lib/supabase/admin-queries";
import type { Eleccion, Lista } from "@/types/voting";

type Tab = "detalles" | "listas" | "padron" | "qr";

const TABS: { id: Tab; label: string }[] = [
  { id: "detalles", label: "Detalles" },
  { id: "listas", label: "Listas" },
  { id: "padron", label: "Padrón" },
  { id: "qr", label: "QR / Enlace" },
];

const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-600",
  activa: "bg-green-100 text-green-700",
  cerrada: "bg-red-100 text-red-600",
};

interface Props {
  eleccion: Eleccion;
  listasIniciales: Lista[];
}

export default function EleccionAdminClient({ eleccion: eleccionInicial, listasIniciales }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("detalles");
  const [listas, setListas] = useState<Lista[]>(listasIniciales);
  const [resultadosVisibles, setResultadosVisibles] = useState(eleccionInicial.resultados_visibles);
  const [isPendingReveal, startRevealTransition] = useTransition();
  const [, startListasTransition] = useTransition();

  function refreshListas() {
    startListasTransition(async () => {
      const fresh = await getListasAdmin(eleccionInicial.id);
      setListas(fresh);
    });
  }

  function handleToggleResultados() {
    const nuevoValor = !resultadosVisibles;
    startRevealTransition(async () => {
      await actualizarEleccion(eleccionInicial.id, { resultados_visibles: nuevoValor });
      setResultadosVisibles(nuevoValor);
    });
  }

  const esCerrada = eleccionInicial.estado === "cerrada";
  const esActiva = eleccionInicial.estado === "activa";

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/dashboard"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-1"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">{eleccionInicial.titulo}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[eleccionInicial.estado]}`}>
                {eleccionInicial.estado}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-xs text-slate-400">/e/{eleccionInicial.slug}</span>
              {(esActiva || esCerrada) && (
                <Link
                  href={`/resultados/${eleccionInicial.slug}`}
                  target="_blank"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver resultados →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Botón revelar resultados — solo relevante cuando hay datos */}
        {(esActiva || esCerrada) && (
          <button
            onClick={handleToggleResultados}
            disabled={isPendingReveal}
            className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-xl border transition-colors disabled:opacity-60 ${
              resultadosVisibles
                ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title={resultadosVisibles ? "Resultados públicos visibles. Clic para ocultarlos." : "Los resultados están ocultos. Clic para revelarlos."}
          >
            {isPendingReveal ? "..." : resultadosVisibles ? "🔓 Resultados visibles" : "🔒 Revelar resultados"}
          </button>
        )}
      </div>

      {/* Banner informativo según estado de visibilidad */}
      {(esActiva || esCerrada) && !resultadosVisibles && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
          <span>
            {esActiva
              ? "Los votantes ven solo el porcentaje de participación. Los resultados por lista están ocultos."
              : "Elección cerrada. Los resultados se revelarán automáticamente 5 minutos después del cierre, o podés hacerlo ahora."}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        {activeTab === "detalles" && (
          <EleccionForm eleccion={eleccionInicial} />
        )}

        {activeTab === "listas" && (
          <ListasManager
            eleccionId={eleccionInicial.id}
            listas={listas}
            onRefresh={refreshListas}
          />
        )}

        {activeTab === "padron" && (
          <PadronUploader eleccionId={eleccionInicial.id} />
        )}

        {activeTab === "qr" && (
          <QREleccion slug={eleccionInicial.slug} titulo={eleccionInicial.titulo} />
        )}
      </div>
    </div>
  );
}
