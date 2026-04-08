"use client";

import { useState, useTransition, useEffect } from "react";
import Papa from "papaparse";
import { hashDni } from "@/lib/crypto";
import { upsertPadron, getPadronStats, getMesasEleccion } from "@/lib/supabase/admin-queries";
import type { EstructuraNode } from "@/types/voting";

interface Props {
  eleccionId: number;
  limiteVotantes?: number | null;
}

interface Stats {
  total: number;
  votaron: number;
}

type Stage = "idle" | "parsing" | "hashing" | "uploading" | "done" | "error";

export default function PadronUploader({ eleccionId, limiteVotantes }: Props) {
  const [stage,    setStage]    = useState<Stage>("idle");
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [mesas,    setMesas]    = useState<EstructuraNode[]>([]);
  const [progress, setProgress] = useState(0);
  const [message,  setMessage]  = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getPadronStats(eleccionId).then(setStats);
    getMesasEleccion(eleccionId).then(setMesas);
  }, [eleccionId]);

  const tieneMesas = mesas.length > 0;

  // Mapa nombre/código → id para matching del CSV
  const mesaMap = new Map<string, number>();
  for (const m of mesas) {
    mesaMap.set(m.nombre.toLowerCase().trim(), m.id);
    if (m.codigo) mesaMap.set(m.codigo.toLowerCase().trim(), m.id);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    startTransition(async () => {
      setStage("parsing");
      setMessage(null);
      setProgress(0);

      // 1. Parsear CSV — soporta columnas: dni | dni,email | dni,email,mesa | dni,,mesa
      const parseResult = await new Promise<{
        dnis: string[];
        emails: (string | null)[];
        mesaNombres: (string | null)[];
      }>((resolve, reject) => {
        Papa.parse<string[]>(file, {
          skipEmptyLines: true,
          complete: (results) => {
            const dnis: string[] = [];
            const emails: (string | null)[] = [];
            const mesaNombres: (string | null)[] = [];

            for (const row of results.data) {
              const dni = String(row[0] ?? "").trim();
              if (!/^\d{6,10}$/.test(dni)) continue;
              dnis.push(dni);

              const email = row[1] ? String(row[1]).trim() : null;
              emails.push(email && email.includes("@") ? email : null);

              const mesa = row[2] ? String(row[2]).trim() : null;
              mesaNombres.push(mesa || null);
            }
            resolve({ dnis, emails, mesaNombres });
          },
          error: (err) => reject(err),
        });
      });

      if (parseResult.dnis.length === 0) {
        setStage("error");
        setMessage("El CSV no contiene DNIs válidos.");
        return;
      }

      // Verificar límite de votantes del plan
      if (limiteVotantes != null && parseResult.dnis.length > limiteVotantes) {
        setStage("error");
        setMessage(
          `El CSV tiene ${parseResult.dnis.length.toLocaleString()} DNIs pero el plan actual permite hasta ${limiteVotantes.toLocaleString()} votantes. Reducí el archivo o suscribite para continuar.`
        );
        return;
      }

      // 2. Hashear DNIs en el navegador (nunca salen del cliente)
      setStage("hashing");
      const { dnis, emails, mesaNombres } = parseResult;
      const total = dnis.length;
      const hashes: string[] = [];

      const CHUNK = 200;
      for (let i = 0; i < total; i += CHUNK) {
        const chunk = dnis.slice(i, i + CHUNK);
        const chunkHashes = await Promise.all(chunk.map((d) => hashDni(d, eleccionId)));
        hashes.push(...chunkHashes);
        setProgress(Math.round(((i + CHUNK) / total) * 100));
      }
      setProgress(100);

      // 3. Resolver mesa_ids desde los nombres/códigos del CSV
      const mesaIds: (number | null)[] = mesaNombres.map((nombre) => {
        if (!nombre) return null;
        return mesaMap.get(nombre.toLowerCase()) ?? null;
      });

      const conMesa   = mesaIds.filter((id) => id !== null).length;
      const sinMesa   = mesaNombres.filter((n) => n !== null && !mesaMap.has(n.toLowerCase())).length;

      // 4. Upsert
      setStage("uploading");
      const hasEmails = emails.some((e) => e !== null);
      const hasMesas  = mesaIds.some((id) => id !== null);

      const result = await upsertPadron(
        eleccionId,
        hashes,
        hasEmails ? emails : undefined,
        hasMesas  ? mesaIds : undefined
      );

      if (result.error) {
        setStage("error");
        setMessage(`Error al subir el padrón: ${result.error}`);
        return;
      }

      const newStats = await getPadronStats(eleccionId);
      setStats(newStats);
      setStage("done");

      const parts = [`✓ ${total.toLocaleString()} DNIs procesados`];
      if (hasEmails)  parts.push(`${emails.filter(Boolean).length} con email`);
      if (hasMesas)   parts.push(`${conMesa} asignados a mesa`);
      if (sinMesa > 0) parts.push(`⚠️ ${sinMesa} con mesa no encontrada (verificá el nombre o código)`);
      setMessage(parts.join(" · ") + ". Padrón actualizado.");
    });
  }

  const isProcessing = ["parsing","hashing","uploading"].includes(stage) || isPending;
  const stageLabel: Record<Stage, string> = {
    idle:      "",
    parsing:   "Leyendo CSV...",
    hashing:   `Hasheando DNIs en el navegador... ${progress}%`,
    uploading: "Subiendo padrón a la base de datos...",
    done:      "",
    error:     "",
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stats actuales */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Padrón total
              {limiteVotantes != null && (
                <span className={`ml-1 ${stats.total >= limiteVotantes ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                  / {limiteVotantes.toLocaleString()}
                </span>
              )}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.votaron.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">Ya votaron</p>
          </div>
        </div>
      )}

      {/* Aviso límite de votantes */}
      {limiteVotantes != null && stats && stats.total >= limiteVotantes && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Límite de padrón alcanzado.</span>{" "}
          El plan de prueba permite hasta {limiteVotantes.toLocaleString()} votantes. Suscribite para ampliar el límite.
        </div>
      )}

      {/* Instrucciones */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-2">Formato del CSV</p>
        <p className="text-xs mb-2">
          Los DNIs se hashean <strong>en tu navegador</strong> antes de subir — nunca salen de tu dispositivo.
          {tieneMesas && " La columna mesa debe coincidir con el nombre o código de una mesa creada en la pestaña Estructura."}
        </p>

        {/* Formato sin mesas */}
        <div className="mb-2">
          <p className="text-xs font-semibold mb-1">Sin estructura electoral:</p>
          <pre className="text-xs bg-amber-100 rounded px-2 py-1.5">{`dni,email (opcional)

12345678,juan@example.com
87654321,maria@example.com
11111111`}</pre>
        </div>

        {/* Formato con mesas */}
        {tieneMesas && (
          <div>
            <p className="text-xs font-semibold mb-1">Con estructura electoral (columna mesa):</p>
            <pre className="text-xs bg-amber-100 rounded px-2 py-1.5">{`dni,email,mesa

12345678,juan@example.com,Mesa 1
87654321,maria@example.com,M02
11111111,,Sede Norte`}</pre>
            <p className="text-xs mt-2 text-amber-700">
              Mesas disponibles: {mesas.map((m) => (
                <span key={m.id} className="font-mono bg-amber-200 rounded px-1 mx-0.5">
                  {m.nombre}{m.codigo ? ` (${m.codigo})` : ""}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>

      {/* Upload */}
      <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
        isProcessing
          ? "border-slate-200 bg-slate-50 cursor-not-allowed"
          : "border-slate-300 hover:border-blue-400 hover:bg-blue-50"
      }`}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={isProcessing}
          className="hidden"
        />
        <span className="text-3xl mb-2">📄</span>
        <span className="text-sm font-medium text-slate-700">
          {isProcessing ? stageLabel[stage] : "Seleccioná el archivo CSV"}
        </span>
        <span className="text-xs text-slate-400 mt-1">
          {isProcessing ? "" : "Hacé clic o arrastrá el archivo aquí"}
        </span>
      </label>

      {stage === "hashing" && (
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {message && (
        <p className={`text-sm rounded-xl px-4 py-3 ${
          stage === "error"
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-green-50 border border-green-200 text-green-700"
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}
