"use client";

import { useEffect, useState, useTransition, useCallback, useRef } from "react";
import { getAuditLog, getAuditLogAll } from "@/lib/supabase/admin-queries";
import type { AuditEntry } from "@/lib/supabase/admin-queries";

// ── Mapeo visual ──────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { icon: string; label: (e: AuditEntry) => string; color: string; bg: string }> = {
  // ── Organización ─────────────────────────────────────────
  "org.created":                 { icon: "🏢", color: "text-blue-700",   bg: "bg-blue-50",   label: (e) => `Organización creada: ${e.metadata?.nombre ?? "—"} (/${e.metadata?.slug ?? "?"}) — ${e.metadata?.origen === "superadmin" ? "por superadmin" : "self-service"}` },
  "org.updated":                 { icon: "✏️", color: "text-slate-600",  bg: "bg-slate-50",  label: () => "Organización actualizada" },
  // ── Admins ───────────────────────────────────────────────
  "admin.login":                 { icon: "🔑", color: "text-green-700",  bg: "bg-green-50",  label: (e) => `Login exitoso: ${e.metadata?.email ?? e.actor_email ?? "—"}` },
  "admin.login_failed":          { icon: "🚫", color: "text-red-600",    bg: "bg-red-50",    label: (e) => `Intento de login fallido: ${e.metadata?.email ?? "—"}` },
  "admin.logout":                { icon: "🚪", color: "text-slate-500",  bg: "bg-slate-50",  label: (e) => `Logout: ${e.actor_email ?? "—"}` },
  "admin.created":               { icon: "👤", color: "text-blue-700",   bg: "bg-blue-50",   label: (e) => `Admin creado: ${e.metadata?.email ?? e.entity_id ?? "—"}` },
  "admin.invited":               { icon: "📩", color: "text-purple-700", bg: "bg-purple-50", label: (e) => `Admin invitado: ${e.metadata?.email ?? e.entity_id ?? "—"}` },
  // ── Elecciones ───────────────────────────────────────────
  "eleccion.created":            { icon: "🗳️", color: "text-blue-700",   bg: "bg-blue-50",   label: (e) => `Elección creada: ${e.metadata?.titulo ?? e.entity_id ?? "—"}` },
  "eleccion.updated":            { icon: "✏️", color: "text-slate-600",  bg: "bg-slate-50",  label: (e) => `Elección actualizada: ${e.metadata?.titulo ?? e.entity_id ?? "—"}` },
  "eleccion.estado_changed":     { icon: "🔄", color: "text-amber-700",  bg: "bg-amber-50",  label: (e) => `Estado cambiado: ${e.metadata?.from ?? e.metadata?.estado ?? "?"} ${e.metadata?.to ? `→ ${e.metadata.to}` : ""}${e.metadata?.forzado ? " (forzado)" : ""}` },
  "eleccion.resultados_viewed":  { icon: "👁️", color: "text-slate-600",  bg: "bg-slate-50",  label: (e) => `Resultados visualizados: ${e.metadata?.titulo ?? "—"}` },
  "eleccion.resultados_revealed":{ icon: "🔓", color: "text-green-700",  bg: "bg-green-50",  label: () => "Resultados revelados públicamente" },
  "eleccion.resultados_hidden":  { icon: "🔒", color: "text-slate-600",  bg: "bg-slate-50",  label: () => "Resultados ocultados" },
  // ── Padrón y listas ──────────────────────────────────────
  "padron.uploaded":             { icon: "📋", color: "text-blue-700",   bg: "bg-blue-50",   label: (e) => `Padrón cargado (${e.metadata?.count ?? "?"} registros)` },
  "lista.created":               { icon: "➕", color: "text-green-700",  bg: "bg-green-50",  label: (e) => `Lista creada: ${e.metadata?.nombre ?? e.entity_id ?? "—"}` },
  "lista.updated":               { icon: "✏️", color: "text-slate-600",  bg: "bg-slate-50",  label: (e) => `Lista actualizada: ${e.metadata?.nombre ?? e.entity_id ?? "—"}` },
  "lista.deleted":               { icon: "🗑️", color: "text-red-600",    bg: "bg-red-50",    label: (e) => `Lista eliminada: ${e.metadata?.nombre ?? e.entity_id ?? "—"}` },
  // ── Votantes ─────────────────────────────────────────────
  "voter.dni_validated":         { icon: "✅", color: "text-green-700",  bg: "bg-green-50",  label: (e) => e.result === "requiere_verificacion" ? "DNI validado — requiere verificación de identidad" : "DNI validado — acceso habilitado" },
  "voter.vote_cast":             { icon: "🗳️", color: "text-blue-700",   bg: "bg-blue-50",   label: (e) => `Voto emitido — recibo: ${e.entity_id ?? "—"}` },
  "voter.validation_failed":     { icon: "❌", color: "text-red-600",    bg: "bg-red-50",    label: (e) => `Validación fallida: ${RESULT_LABEL[e.result ?? ""] ?? e.result ?? "—"}` },
  "voter.identity_verified":     { icon: "🪪", color: "text-green-700",  bg: "bg-green-50",  label: (e) => `Identidad verificada (${e.metadata?.metodo ?? "—"})` },
};

const RESULT_LABEL: Record<string, string> = {
  no_en_padron:        "DNI no está en el padrón",
  ya_voto:             "El votante ya emitió su voto",
  eleccion_no_activa:  "La elección no está activa",
  requiere_verificacion: "Requiere verificación de identidad",
};

// ── Utilidades ────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatTimeShort(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function entryLabel(entry: AuditEntry): string {
  const cfg = EVENT_CONFIG[entry.event_type];
  return cfg ? cfg.label(entry) : entry.event_type;
}

function actorLabel(entry: AuditEntry): string {
  if (entry.actor_type === "admin" && entry.actor_email) return entry.actor_email;
  if (entry.actor_type === "admin" && entry.metadata?.email) return String(entry.metadata.email);
  if (entry.actor_type === "voter") return "votante anónimo";
  if (entry.actor_type === "system") return "sistema";
  return entry.actor_type;
}

// ── Exportadores ──────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(entries: AuditEntry[]) {
  const header = ["ID", "Fecha y hora", "Actor", "Email actor", "Evento", "Resultado", "Entidad", "ID entidad", "Metadata"];
  const rows = entries.map((e) => [
    e.id,
    formatTimeShort(e.created_at),
    e.actor_type,
    e.actor_email ?? "",
    e.event_type,
    e.result ?? "",
    e.entity_type ?? "",
    e.entity_id ?? "",
    e.metadata ? JSON.stringify(e.metadata) : "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

  downloadBlob([header.join(","), ...rows].join("\r\n"), "auditoria.csv", "text/csv;charset=utf-8;");
}

function exportTXT(entries: AuditEntry[]) {
  const lines = entries.map((e) =>
    `[${formatTimeShort(e.created_at)}] [${e.actor_type.toUpperCase()}] ${actorLabel(e)} | ${entryLabel(e)}${e.result ? ` (${e.result})` : ""}`
  );
  downloadBlob(lines.join("\n"), "auditoria.txt", "text/plain;charset=utf-8;");
}

function exportPDF(entries: AuditEntry[], orgName = "VotaYa") {
  const rows = entries.map((e) => `
    <tr>
      <td>${formatTimeShort(e.created_at)}</td>
      <td>${e.actor_type}</td>
      <td>${e.actor_email ?? (e.actor_type === "voter" ? "anónimo" : "—")}</td>
      <td>${entryLabel(e)}</td>
      <td>${e.result ?? "—"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Log de Auditoría — ${orgName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 20mm; color: #1e293b; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    p.sub { font-size: 10px; color: #64748b; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    @media print { body { margin: 10mm; } }
  </style></head><body>
  <h1>Log de Auditoría — ${orgName}</h1>
  <p class="sub">Generado el ${new Date().toLocaleString("es-AR")} · ${entries.length} registros</p>
  <table>
    <thead><tr><th>Fecha y hora</th><th>Actor</th><th>Email</th><th>Evento</th><th>Resultado</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };<\/script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── Fila de evento ────────────────────────────────────────────

function EventRow({ entry }: { entry: AuditEntry }) {
  const cfg = EVENT_CONFIG[entry.event_type] ?? {
    icon: "•",
    color: "text-slate-500",
    bg: "bg-white",
    label: () => entry.event_type,
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className={`text-base leading-none mt-0.5 select-none w-6 text-center flex-shrink-0`}>
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${cfg.color} leading-snug`}>{cfg.label(entry)}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-slate-400 tabular-nums">{formatTime(entry.created_at)}</span>
          {entry.actor_type === "admin" && !!(entry.actor_email ?? entry.metadata?.email) && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
              {entry.actor_email ?? String(entry.metadata?.email)}
            </span>
          )}
          {entry.actor_type === "voter" && (
            <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded italic">
              votante anónimo
            </span>
          )}
          {entry.actor_type === "system" && (
            <span className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">
              sistema
            </span>
          )}
          {entry.result && entry.result !== "ok" && entry.result !== "requiere_verificacion" && (
            <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
              {RESULT_LABEL[entry.result] ?? entry.result}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs font-mono text-slate-300 flex-shrink-0 hidden sm:block">#{entry.id}</span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

interface Props {
  eleccionId?: number;
  title?: string;
}

const LIMIT = 100;

export default function AuditLog({ eleccionId, title = "Registro de auditoría" }: Props) {
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [offset, setOffset]     = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [filter, setFilter]     = useState("");
  const [actorFilter, setActorFilter] = useState<"all" | "admin" | "voter" | "system">("all");
  const [exporting, startExport] = useTransition();
  const [, startLoad]            = useTransition();
  const allEntriesRef            = useRef<AuditEntry[]>([]);  // caché para export

  const load = useCallback((newOffset = 0) => {
    startLoad(async () => {
      setLoading(true);
      const data = await getAuditLog({ eleccionId, limit: LIMIT + 1, offset: newOffset });
      setHasMore(data.length > LIMIT);
      setEntries(data.slice(0, LIMIT));
      setOffset(newOffset);
      setLoading(false);
    });
  }, [eleccionId]);

  useEffect(() => { load(0); }, [load]);

  // Filtrado local (sobre la página actual)
  const filtered = entries.filter((e) => {
    const matchActor = actorFilter === "all" || e.actor_type === actorFilter;
    if (!matchActor) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      e.event_type.toLowerCase().includes(q) ||
      (e.actor_email ?? "").toLowerCase().includes(q) ||
      entryLabel(e).toLowerCase().includes(q) ||
      (e.result ?? "").toLowerCase().includes(q) ||
      (e.entity_id ?? "").toLowerCase().includes(q)
    );
  });

  // Agrupar por fecha
  const grouped: { date: string; entries: AuditEntry[] }[] = [];
  for (const entry of filtered) {
    const date = new Date(entry.created_at).toLocaleDateString("es-AR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
    const last = grouped[grouped.length - 1];
    if (last?.date === date) last.entries.push(entry);
    else grouped.push({ date, entries: [entry] });
  }

  // Exportar: carga todos los registros (sin paginación) y descarga
  async function handleExport(fmt: "csv" | "txt" | "pdf") {
    startExport(async () => {
      // Reusar caché si ya se cargó antes
      if (allEntriesRef.current.length === 0) {
        allEntriesRef.current = await getAuditLogAll(eleccionId);
      }
      const all = allEntriesRef.current;
      if (fmt === "csv")  exportCSV(all);
      if (fmt === "txt")  exportTXT(all);
      if (fmt === "pdf")  exportPDF(all);
    });
  }

  const statsAdmin = entries.filter(e => e.actor_type === "admin").length;
  const statsVoter = entries.filter(e => e.actor_type === "voter").length;

  return (
    <div className="flex flex-col gap-4">

      {/* Barra superior: título + exportar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {!loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {entries.length} eventos cargados · {statsAdmin} admin · {statsVoter} votante
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { allEntriesRef.current = []; load(0); }}
            className="text-xs text-blue-600 hover:underline px-2 py-1"
          >
            ↻ Actualizar
          </button>
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting || loading}
              className="px-2.5 py-1.5 hover:bg-slate-50 text-slate-600 font-medium disabled:opacity-40 transition-colors border-r border-slate-200"
              title="Descargar CSV"
            >
              {exporting ? "…" : "CSV"}
            </button>
            <button
              onClick={() => handleExport("txt")}
              disabled={exporting || loading}
              className="px-2.5 py-1.5 hover:bg-slate-50 text-slate-600 font-medium disabled:opacity-40 transition-colors border-r border-slate-200"
              title="Descargar TXT"
            >
              TXT
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting || loading}
              className="px-2.5 py-1.5 hover:bg-slate-50 text-slate-600 font-medium disabled:opacity-40 transition-colors"
              title="Imprimir / Guardar PDF"
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="search"
          placeholder="Buscar evento, email, recibo..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
          {(["all", "admin", "voter", "system"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActorFilter(v)}
              className={`px-3 py-1.5 transition-colors border-r border-slate-200 last:border-0 ${
                actorFilter === v
                  ? "bg-blue-700 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {v === "all" ? "Todos" : v === "admin" ? "Admins" : v === "voter" ? "Votantes" : "Sistema"}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          {entries.length === 0 ? (
            <>
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm font-medium">No hay eventos registrados todavía.</p>
              <p className="text-xs mt-1">Los eventos aparecerán aquí a medida que ocurran.</p>
            </>
          ) : (
            <>
              <p className="text-sm">No hay eventos que coincidan con el filtro.</p>
              <button onClick={() => { setFilter(""); setActorFilter("all"); }} className="text-xs text-blue-600 hover:underline mt-1">
                Limpiar filtros
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {grouped.map((group) => (
            <div key={group.date}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 capitalize">
                {group.date}
                <span className="ml-2 font-normal normal-case text-slate-300">({group.entries.length})</span>
              </p>
              <div className="bg-white border border-slate-200 rounded-xl px-4">
                {group.entries.map((entry) => (
                  <EventRow key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}

          {/* Paginación */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => load(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              ← Anteriores
            </button>
            <span className="text-xs text-slate-400">
              {offset + 1}–{offset + filtered.length}
            </span>
            <button
              onClick={() => load(offset + LIMIT)}
              disabled={!hasMore}
              className="text-sm text-blue-600 hover:underline disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Más eventos →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
