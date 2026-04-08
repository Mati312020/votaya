"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import EleccionForm from "@/components/admin/EleccionForm";
import ListasManager from "@/components/admin/ListasManager";
import PadronUploader from "@/components/admin/PadronUploader";
import QREleccion from "@/components/admin/QREleccion";
import AuditLog from "@/components/admin/AuditLog";
import EstructuraElectoralBuilder from "@/components/admin/EstructuraElectoralBuilder";
import { getListasAdmin, actualizarEleccion, logAdminEvent, getEstructuraElectoral } from "@/lib/supabase/admin-queries";
import type { Eleccion, Lista, EstructuraNode } from "@/types/voting";

type Tab = "detalles" | "listas" | "estructura" | "padron" | "qr" | "auditoria";

const TABS: { id: Tab; label: string }[] = [
  { id: "detalles",   label: "Detalles" },
  { id: "listas",     label: "Listas" },
  { id: "estructura", label: "Estructura" },
  { id: "padron",     label: "Padrón" },
  { id: "qr",         label: "QR / Enlace" },
  { id: "auditoria",  label: "Auditoría" },
];

const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-600",
  activa: "bg-green-100 text-green-700",
  cerrada: "bg-red-100 text-red-600",
};

interface Props {
  eleccion: Eleccion;
  listasIniciales: Lista[];
  estructuraInicial: EstructuraNode[];
  orgSlug: string;
}

export default function OrgEleccionAdminClient({ eleccion: eleccionInicial, listasIniciales, estructuraInicial, orgSlug }: Props) {
  const base = `/org/${orgSlug}/admin`;
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
      await logAdminEvent(
        nuevoValor ? "eleccion.resultados_revealed" : "eleccion.resultados_hidden",
        { eleccionId: eleccionInicial.id }
      );
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
            href={`${base}/dashboard`}
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

        {(esActiva || esCerrada) && (
          <button
            onClick={handleToggleResultados}
            disabled={isPendingReveal}
            className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-xl border transition-colors disabled:opacity-60 ${
              resultadosVisibles
                ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {isPendingReveal ? "..." : resultadosVisibles ? "🔓 Resultados visibles" : "🔒 Revelar resultados"}
          </button>
        )}
      </div>

      {(esActiva || esCerrada) && !resultadosVisibles && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          {esActiva
            ? "Los votantes ven solo el porcentaje de participación. Los resultados por lista están ocultos."
            : "Elección cerrada. Los resultados se revelarán automáticamente 5 minutos después del cierre, o podés hacerlo ahora."}
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
        {activeTab === "estructura" && (
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-800">Estructura electoral</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Definí la jerarquía Distrito → Sección → Circuito → Mesa. Luego asignás cada votante a una mesa en el CSV del padrón.
                Los resultados se desglosan por mesa en la pantalla pública.
              </p>
            </div>
            <EstructuraElectoralBuilder
              eleccionId={eleccionInicial.id}
              nodos={estructuraInicial}
            />
          </div>
        )}
        {activeTab === "padron" && (
          <PadronUploader eleccionId={eleccionInicial.id} />
        )}
        {activeTab === "qr" && (
          <QREleccion slug={eleccionInicial.slug} titulo={eleccionInicial.titulo} />
        )}
        {activeTab === "auditoria" && (
          <AuditLog eleccionId={eleccionInicial.id} title={`Auditoría — ${eleccionInicial.titulo}`} />
        )}
      </div>
    </div>
  );
}
