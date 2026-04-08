"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { supabase } from "@/lib/supabase/client";
import {
  getResultados,
  getParticipacion,
  getParticipacionPorMesa,
  getResultadosPorMesa,
} from "@/lib/supabase/admin-queries";
import type { Eleccion, ResultadoLista, Participacion, ParticipacionMesa } from "@/types/voting";

interface Props {
  eleccion: Eleccion;
}

const FALLBACK_COLORS = ["#1e40af", "#166534", "#991b1b", "#9a3412", "#6b21a8", "#374151"];
const REVEAL_DELAY_MS = 5 * 60 * 1000; // 5 minutos

function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 1000);
        if (next === 0) clearInterval(id);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return { remaining, label: `${mins}:${String(secs).padStart(2, "0")}` };
}

// ── Vista de resultados por mesa ──────────────────────────
function MesaResultadosRow({
  mesa,
  eleccionId,
  mostrar,
}: {
  mesa: ParticipacionMesa;
  eleccionId: number;
  mostrar: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resMesa, setResMesa]   = useState<ResultadoLista[]>([]);
  const [loading,  setLoading]  = useState(false);

  async function toggleExpand() {
    if (!mostrar) return;
    if (!expanded && resMesa.length === 0) {
      setLoading(true);
      const data = await getResultadosPorMesa(eleccionId, mesa.mesa_id);
      setResMesa(data);
      setLoading(false);
    }
    setExpanded((v) => !v);
  }

  const totalMesa = resMesa.reduce((a, r) => a + r.votos, 0);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header de la mesa */}
      <div
        className={`flex items-center gap-3 p-4 ${mostrar ? "cursor-pointer hover:bg-slate-50" : ""} transition-colors`}
        onClick={toggleExpand}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{mesa.mesa_nombre}</p>
          {mesa.path_nombre !== mesa.mesa_nombre && (
            <p className="text-xs text-slate-400 truncate">{mesa.path_nombre}</p>
          )}
          {mesa.mesa_codigo && (
            <span className="text-xs font-mono text-slate-400">{mesa.mesa_codigo}</span>
          )}
        </div>
        {/* Barra de participación */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-20 bg-slate-100 rounded-full h-2 hidden sm:block">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${Math.min(mesa.porcentaje, 100)}%` }}
            />
          </div>
          <span className="text-sm font-bold text-blue-700 w-10 text-right tabular-nums">
            {mesa.porcentaje ?? 0}%
          </span>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {mesa.votaron}/{mesa.total}
          </span>
          {mostrar && (
            <span className="text-slate-300 ml-1">{expanded ? "▾" : "▸"}</span>
          )}
        </div>
      </div>

      {/* Resultados expandidos por mesa */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : resMesa.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">Sin votos en esta mesa.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {resMesa.map((r, i) => {
                const pct = totalMesa > 0 ? (r.votos / totalMesa) * 100 : 0;
                const color = r.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                return (
                  <div key={r.lista_id} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-slate-700 flex-1 truncate">{r.nombre}</span>
                    <span className="text-xs font-bold text-slate-800 tabular-nums">
                      {r.votos} <span className="font-normal text-slate-400">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultadosClient({ eleccion }: Props) {
  const [resultados,    setResultados]    = useState<ResultadoLista[]>([]);
  const [participacion, setParticipacion] = useState<Participacion | null>(null);
  const [mesas,         setMesas]         = useState<ParticipacionMesa[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [lastUpdate,    setLastUpdate]    = useState<Date>(new Date());

  // ── Lógica de visibilidad ──────────────────────────────
  // Mostrar resultados si:
  //   1. Admin lo reveló manualmente (resultados_visibles = true), O
  //   2. Han pasado 5 minutos desde fecha_fin
  const fechaFinMs = new Date(eleccion.fecha_fin).getTime();
  const revealAt = fechaFinMs + REVEAL_DELAY_MS;
  const { remaining: countdownMs, label: countdownLabel } = useCountdown(revealAt);

  const mostrarResultados =
    eleccion.resultados_visibles ||
    (eleccion.estado === "cerrada" && countdownMs === 0);

  const fetchData = useCallback(async () => {
    const [res, part, mesasData] = await Promise.all([
      getResultados(eleccion.id),
      getParticipacion(eleccion.id),
      getParticipacionPorMesa(eleccion.id),
    ]);
    setResultados(res);
    setParticipacion(part);
    setMesas(mesasData);
    setLoading(false);
    setLastUpdate(new Date());
  }, [eleccion.id]);

  useEffect(() => {
    fetchData();

    // Polling cada 10 s — funciona para todas las elecciones y sirve de fallback
    // cuando Realtime no está disponible (ej. TV con conexión inestable)
    const pollId = setInterval(fetchData, 10_000);

    // Realtime: suscribir cuando la elección está activa (actualizaciones inmediatas)
    if (eleccion.estado !== "activa") return () => clearInterval(pollId);

    const channel = supabase
      .channel(`urna-${eleccion.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "urna",
          filter: `eleccion_id=eq.${eleccion.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [eleccion.id, eleccion.estado, fetchData]);

  const totalVotos = resultados.reduce((acc, r) => acc + r.votos, 0);

  const chartData = resultados.map((r, i) => ({
    name: r.nombre.length > 18 ? r.nombre.slice(0, 18) + "…" : r.nombre,
    votos: r.votos,
    pct: totalVotos > 0 ? (r.votos / totalVotos) * 100 : 0,
    color: r.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barra de navegación */}
      <nav className="bg-white border-b border-slate-200 px-4 h-12 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
        >
          ← Volver
        </button>
        <span className="text-sm font-black text-blue-700">VotaYa</span>
        <a
          href="/admin/dashboard"
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Admin
        </a>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              {eleccion.titulo}
            </h1>
            {eleccion.estado === "activa" && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                En vivo
              </span>
            )}
            {eleccion.estado === "cerrada" && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                Cerrada
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Actualizado: {lastUpdate.toLocaleTimeString("es-AR")}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Participación — siempre visible */}
            {participacion && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Participación
                </h2>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-4xl font-black text-blue-700">
                      {participacion.porcentaje ?? 0}%
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {participacion.votaron.toLocaleString()} de {participacion.total.toLocaleString()} habilitados
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="bg-slate-100 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(participacion.porcentaje ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Resultados ocultos durante votación activa ── */}
            {eleccion.estado === "activa" && !mostrarResultados && (
              <>
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center mb-5">
                  <p className="text-3xl mb-3">🗳️</p>
                  <p className="font-semibold text-slate-700">Votación en curso</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Los resultados por lista se mostrarán al finalizar la elección.
                  </p>
                </div>
                {/* Participación por mesa visible incluso con resultados ocultos */}
                {mesas.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                      Participación por mesa
                    </h2>
                    <div className="flex flex-col gap-2">
                      {mesas.map((mesa) => (
                        <MesaResultadosRow
                          key={mesa.mesa_id}
                          mesa={mesa}
                          eleccionId={eleccion.id}
                          mostrar={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Countdown cuando la elección cerró pero aún no pasaron 5 min ── */}
            {eleccion.estado === "cerrada" && !mostrarResultados && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <p className="text-3xl mb-3">⏳</p>
                <p className="font-semibold text-slate-700">Elección finalizada</p>
                <p className="text-sm text-slate-400 mt-1">
                  Los resultados se publicarán en
                </p>
                <p className="text-4xl font-black text-blue-700 mt-3 tabular-nums">
                  {countdownLabel}
                </p>
              </div>
            )}

            {/* ── Resultados visibles ── */}
            {mostrarResultados && (
              <>
                {/* Gráfico de barras */}
                {totalVotos > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                      Votos por lista
                    </h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={120}
                          tick={{ fontSize: 13, fill: "#475569" }}
                        />
                        <Tooltip
                          formatter={(value, _name, props) => [
                            `${value} votos (${formatPct((props as { payload: { pct: number } }).payload.pct)})`,
                            "",
                          ]}
                          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                        />
                        <Bar dataKey="votos" radius={[0, 6, 6, 0]}>
                          {chartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Resultados por mesa (si la elección tiene estructura) */}
                {mesas.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Por mesa
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">
                      {mostrarResultados
                        ? "Hacé clic en una mesa para ver sus resultados."
                        : "Participación por mesa. Los resultados se mostrarán cuando se habiliten."}
                    </p>
                    <div className="flex flex-col gap-2">
                      {mesas.map((mesa) => (
                        <MesaResultadosRow
                          key={mesa.mesa_id}
                          mesa={mesa}
                          eleccionId={eleccion.id}
                          mostrar={mostrarResultados}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista detallada */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                    Detalle
                  </h2>
                  <div className="flex flex-col gap-3">
                    {resultados.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">
                        Todavía no hay votos registrados.
                      </p>
                    ) : (
                      resultados.map((r, i) => {
                        const pct = totalVotos > 0 ? (r.votos / totalVotos) * 100 : 0;
                        const color = r.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                        return (
                          <div key={r.lista_id} className="flex items-center gap-3">
                            {r.foto_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.foto_url}
                                alt={r.nombre}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline mb-1">
                                <span className="text-sm font-medium text-slate-900 truncate">
                                  {r.nombre}
                                </span>
                                <span className="text-sm font-bold text-slate-700 ml-2 whitespace-nowrap">
                                  {r.votos.toLocaleString()}{" "}
                                  <span className="text-xs font-normal text-slate-400">({formatPct(pct)})</span>
                                </span>
                              </div>
                              <div className="bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, backgroundColor: color }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
