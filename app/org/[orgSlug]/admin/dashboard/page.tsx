"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  getEleccionesAdmin,
  getOrgBySlug,
  getPadronStats,
  actualizarEleccion,
  logAdminEvent,
} from "@/lib/supabase/admin-queries";
import type { Eleccion } from "@/types/voting";

const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-600",
  activa:   "bg-green-100 text-green-700",
  cerrada:  "bg-red-100 text-red-600",
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  activa:   "Activa",
  cerrada:  "Cerrada",
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function getResultadosUrl(slug: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
  return `${base}/resultados/${slug}`;
}

function getVotacionUrl(slug: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
  return `${base}/e/${slug}`;
}

// ── Modal compartir (genérico) ────────────────────────────────
function ModalCompartir({
  eleccion,
  onClose,
  titulo,
  descripcion,
  getUrl,
}: {
  eleccion: Eleccion;
  onClose: () => void;
  titulo: string;
  descripcion: string;
  getUrl: (slug: string) => string;
}) {
  const [copiado, setCopiado] = useState(false);
  const url = getUrl(eleccion.slug);

  function copiar() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{titulo}</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{descripcion}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* QR */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block">
            <QRCodeSVG value={url} size={180} />
          </div>
        </div>

        <p className="text-xs text-center text-slate-500">
          Escaneá para abrir en otro dispositivo o pantalla
        </p>

        {/* URL texto */}
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 text-xs font-mono border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 truncate"
          />
          <button
            onClick={copiar}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              copiado
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            {copiado ? "✓ Copiado" : "Copiar"}
          </button>
        </div>

        <div className="flex gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Abrir en pantalla →
          </a>
          <button
            onClick={() => {
              const w = window.open("", "_blank");
              if (!w) return;
              w.document.write(`<!DOCTYPE html><html><head><title>${eleccion.titulo}</title>
                <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#f8fafc;gap:20px;}
                h2{font-size:1.25rem;color:#1e293b;text-align:center;max-width:320px;}
                p{font-size:.85rem;color:#64748b;word-break:break-all;text-align:center;max-width:320px;}
                @media print{body{padding:20mm;}}</style></head>
                <body>
                  <h2>${eleccion.titulo}</h2>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}" width="280" height="280" alt="QR votación"/>
                  <p>${url}</p>
                  <script>window.onload=()=>window.print();</script>
                </body></html>`);
              w.document.close();
            }}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors whitespace-nowrap"
            title="Imprimir QR"
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de elección ─────────────────────────────────────────
function EleccionCard({
  eleccion,
  stats,
  base,
  onCerrar,
}: {
  eleccion: Eleccion;
  stats?: { total: number; votaron: number };
  base: string;
  onCerrar: (e: Eleccion) => void;
}) {
  const router = useRouter();
  const [modalCompartir, setModalCompartir] = useState(false);
  const [modalVotacion, setModalVotacion] = useState(false);
  const pct = stats && stats.total > 0 ? Math.round((stats.votaron / stats.total) * 100) : 0;
  const esActiva = eleccion.estado === "activa";
  const tieneResultados = eleccion.estado === "activa" || eleccion.estado === "cerrada";

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-200 hover:shadow-sm transition-all flex flex-col gap-3">

        {/* Header clickeable → detalle */}
        <div
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => router.push(`${base}/elecciones/${eleccion.id}`)}
        >
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 leading-tight">{eleccion.titulo}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatFecha(eleccion.fecha_inicio)} → {formatFecha(eleccion.fecha_fin)}
            </p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${ESTADO_BADGE[eleccion.estado]}`}>
            {ESTADO_LABEL[eleccion.estado]}
          </span>
        </div>

        {/* Barra participación */}
        {stats && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {stats.votaron}/{stats.total} votaron ({pct}%)
            </span>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">

          {/* Ver resultados */}
          {tieneResultados && (
            <a
              href={`/resultados/${eleccion.slug}`}
              target="_blank"
              rel="noreferrer"
              onClick={(ev) => {
                ev.stopPropagation();
                logAdminEvent("eleccion.resultados_viewed", { eleccionId: eleccion.id, metadata: { titulo: eleccion.titulo } });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 rounded-lg text-xs font-medium transition-colors"
            >
              <span>📊</span> Ver resultados
            </a>
          )}

          {/* Compartir votación — solo elecciones activas o en borrador */}
          {(eleccion.estado === "activa" || eleccion.estado === "borrador") && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setModalVotacion(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 text-slate-600 hover:text-violet-700 rounded-lg text-xs font-medium transition-colors"
            >
              <span>🗳️</span> Compartir votación
            </button>
          )}

          {/* Compartir resultados */}
          {tieneResultados && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setModalCompartir(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-300 text-slate-600 hover:text-green-700 rounded-lg text-xs font-medium transition-colors"
            >
              <span>🔗</span> Compartir resultados
            </button>
          )}

          {/* Forzar cierre — solo activas */}
          {esActiva && (
            <button
              onClick={(ev) => { ev.stopPropagation(); onCerrar(eleccion); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 text-slate-600 hover:text-red-600 rounded-lg text-xs font-medium transition-colors ml-auto"
            >
              <span>⏹</span> Cerrar elección
            </button>
          )}
        </div>
      </div>

      {modalCompartir && (
        <ModalCompartir
          eleccion={eleccion}
          onClose={() => setModalCompartir(false)}
          titulo="Compartir resultados"
          descripcion={eleccion.titulo}
          getUrl={getResultadosUrl}
        />
      )}

      {modalVotacion && (
        <ModalCompartir
          eleccion={eleccion}
          onClose={() => setModalVotacion(false)}
          titulo="Compartir enlace de votación"
          descripcion={eleccion.titulo}
          getUrl={getVotacionUrl}
        />
      )}
    </>
  );
}

// ── Modal confirmar cierre (doble confirmación) ───────────────
function ModalCerrar({
  eleccion,
  onConfirm,
  onCancel,
  isPending,
}: {
  eleccion: Eleccion;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const CONFIRM_WORD = "CERRAR";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="text-center">
          <div className="text-4xl mb-2">⏹</div>
          <h2 className="font-bold text-slate-900 text-lg">Cerrar elección</h2>
          <p className="text-sm text-slate-500 mt-1">Esta acción es irreversible.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          <p className="font-semibold">{eleccion.titulo}</p>
          <p className="text-xs mt-0.5">La elección pasará al estado <strong>Cerrada</strong> y los votantes ya no podrán emitir su voto.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-slate-600">
            Escribí <strong className="font-mono text-red-600">{CONFIRM_WORD}</strong> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder={CONFIRM_WORD}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || confirmText !== CONFIRM_WORD}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {isPending ? "Cerrando..." : "Confirmar cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────
export default function OrgDashboardPage() {
  const params = useParams<{ orgSlug: string }>();
  const base = `/org/${params.orgSlug}/admin`;

  const [elecciones, setElecciones] = useState<Eleccion[]>([]);
  const [stats, setStats] = useState<Record<number, { total: number; votaron: number }>>({});
  const [loading, setLoading] = useState(true);
  const [eleccionACerrar, setEleccionACerrar] = useState<Eleccion | null>(null);
  const [isPendingCierre, startCierreTransition] = useTransition();

  async function load() {
    const org = await getOrgBySlug(params.orgSlug);
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

  useEffect(() => { load(); }, [params.orgSlug]);

  function handleConfirmarCierre() {
    if (!eleccionACerrar) return;
    startCierreTransition(async () => {
      await actualizarEleccion(eleccionACerrar.id, { estado: "cerrada" });
      await logAdminEvent("eleccion.estado_changed", {
        eleccionId: eleccionACerrar.id,
        metadata: { from: "activa", to: "cerrada", forzado: true, titulo: eleccionACerrar.titulo },
      });
      setEleccionACerrar(null);
      await load();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Elecciones</h1>
        <Link
          href={`${base}/elecciones/nueva`}
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
          {elecciones.map((e) => (
            <EleccionCard
              key={e.id}
              eleccion={e}
              stats={stats[e.id]}
              base={base}
              onCerrar={setEleccionACerrar}
            />
          ))}
        </div>
      )}

      {eleccionACerrar && (
        <ModalCerrar
          eleccion={eleccionACerrar}
          onConfirm={handleConfirmarCierre}
          onCancel={() => setEleccionACerrar(null)}
          isPending={isPendingCierre}
        />
      )}
    </div>
  );
}
