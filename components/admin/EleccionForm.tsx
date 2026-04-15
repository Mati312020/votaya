"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEleccion, actualizarEleccion } from "@/lib/supabase/admin-queries";
import type { Eleccion, EstadoEleccion, VerificacionIdentidad } from "@/types/voting";

interface Props {
  eleccion?: Eleccion;
  /** Called with the new election id to compute the redirect path. Defaults to /admin/elecciones/:id */
  redirectAfterCreate?: (id: number) => string;
}

function toLocalDatetimeValue(iso: string) {
  // Convierte ISO UTC → hora local del browser para el input datetime-local
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(localDatetime: string) {
  return new Date(localDatetime).toISOString();
}

export default function EleccionForm({ eleccion, redirectAfterCreate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState(eleccion?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(eleccion?.descripcion ?? "");
  const [slug, setSlug] = useState(eleccion?.slug ?? "");
  const [estado, setEstado] = useState<EstadoEleccion>(eleccion?.estado ?? "borrador");
  const [fechaInicio, setFechaInicio] = useState(
    eleccion ? toLocalDatetimeValue(eleccion.fecha_inicio) : ""
  );
  const [fechaFin, setFechaFin] = useState(
    eleccion ? toLocalDatetimeValue(eleccion.fecha_fin) : ""
  );
  const [votoReemplazable, setVotoReemplazable] = useState(
    eleccion?.voto_reemplazable ?? false
  );
  const [verificacionIdentidad, setVerificacionIdentidad] = useState<VerificacionIdentidad>(
    eleccion?.verificacion_identidad ?? "ninguna"
  );

  // Auto-generar slug desde titulo
  function handleTituloChange(val: string) {
    setTitulo(val);
    if (!eleccion) {
      setSlug(
        val
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fechaInicio || !fechaFin) {
      setError("Las fechas son requeridas.");
      return;
    }

    startTransition(async () => {
      if (eleccion) {
        // Editar
        const ok = await actualizarEleccion(eleccion.id, {
          titulo,
          descripcion: descripcion || null,
          estado,
          fecha_inicio: toIso(fechaInicio),
          fecha_fin: toIso(fechaFin),
          voto_reemplazable: votoReemplazable,
          verificacion_identidad: verificacionIdentidad,
        });
        if (!ok) { setError("Error al guardar. Verificá los datos."); return; }
        router.refresh();
      } else {
        // Crear
        const result = await crearEleccion({
          titulo,
          descripcion: descripcion || null,
          slug,
          estado,
          fecha_inicio: toIso(fechaInicio),
          fecha_fin: toIso(fechaFin),
          voto_reemplazable: votoReemplazable,
          resultados_visibles: false,
          verificacion_identidad: verificacionIdentidad,
        });
        if (!result) { setError("Error al crear la elección. ¿El slug ya existe?"); return; }
        const destination = redirectAfterCreate
          ? redirectAfterCreate(result.id)
          : `/admin/elecciones/${result.id}`;
        router.replace(destination);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Título *</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => handleTituloChange(e.target.value)}
          required
          placeholder="Ej: Elección de Comisión Directiva 2025"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">
          Slug (URL) {eleccion && <span className="text-slate-400 font-normal">— no editable</span>}
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => !eleccion && setSlug(e.target.value)}
          readOnly={!!eleccion}
          required
          placeholder="eleccion-directiva-2025"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:text-slate-400"
        />
        <p className="text-xs text-slate-400">URL pública: /e/{slug || "..."}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Descripción opcional de la elección..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Inicio *</label>
          <input
            type="datetime-local"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            required
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Fin *</label>
          <input
            type="datetime-local"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            required
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Estado</label>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoEleccion)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="borrador">Borrador</option>
          <option value="activa">Activa</option>
          <option value="cerrada">Cerrada</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={votoReemplazable}
          onChange={(e) => setVotoReemplazable(e.target.checked)}
          className="w-4 h-4 rounded text-blue-600"
        />
        <span className="text-sm text-slate-700">
          Voto reemplazable{" "}
          <span className="text-slate-400 font-normal">(el votante puede cambiar su voto antes de que cierre)</span>
        </span>
      </label>

      {/* Verificación de identidad */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">
          Verificación de identidad del votante
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {([
            { value: "ninguna",    icon: "🔓", label: "Sin verificación",         desc: "Solo se valida que el DNI esté en el padrón" },
            { value: "dni_qr",    icon: "📷", label: "QR del DNI",               desc: "El votante escanea el código de barras trasero de su DNI físico" },
            { value: "otp_email", icon: "✉️", label: "Código por email",         desc: "Se envía un código de 6 dígitos al email registrado en el padrón" },
            { value: "face_cloud",  icon: "🤳", label: "Biométrica (AWS)",         desc: "Foto del DNI + selfie comparadas con AWS Rekognition. Requiere credenciales AWS." },
            { value: "face_client", icon: "🧠", label: "Biométrica offline",       desc: "Foto del DNI + selfie comparadas en el dispositivo del votante. Sin APIs externas." },
            { value: "renaper",    icon: "🪪", label: "RENAPER (solo mock)",       desc: "Foto del DNI + selfie contra el Registro Nacional. Requiere habilitación oficial.", pendiente: true },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVerificacionIdentidad(opt.value)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                verificacionIdentidad === opt.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base">{opt.icon}</span>
                <span className={`text-sm font-semibold ${verificacionIdentidad === opt.value ? "text-blue-700" : "text-slate-800"}`}>
                  {opt.label}
                </span>
                {"pendiente" in opt && opt.pendiente && (
                  <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                    ⏳ En habilitación
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
        {verificacionIdentidad === "face_cloud" && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Requiere <code>AWS_ACCESS_KEY_ID</code>, <code>AWS_SECRET_ACCESS_KEY</code> y <code>AWS_REGION</code> en el servidor.
            Las imágenes se procesan por AWS Rekognition y no son almacenadas. Costo: ~USD 0.002 por verificación.
          </p>
        )}
        {verificacionIdentidad === "face_client" && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            🔒 Máxima privacidad — las imágenes <strong>nunca salen del dispositivo del votante</strong>. La comparación facial
            se realiza en el browser con IA local (face-api.js). Sin costo por verificación. Los modelos (~7MB) se descargan
            desde CDN al iniciar la verificación.
          </p>
        )}
        {verificacionIdentidad === "otp_email" && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            El padrón debe incluir una columna <code>email</code>. Requiere <code>RESEND_API_KEY</code> en el servidor.
          </p>
        )}
        {verificacionIdentidad === "renaper" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex flex-col gap-1">
            <p className="text-xs font-semibold text-amber-800">⏳ Habilitación en proceso</p>
            <p className="text-xs text-amber-700">
              La integración con RENAPER requiere autorización institucional oficial (actualmente en trámite).
              Hasta entonces el sistema usa un <strong>mock de prueba</strong> que aprueba todas las verificaciones.
              No usar en elecciones reales hasta obtener la <code>RENAPER_API_KEY</code>.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors"
        >
          {isPending ? "Guardando..." : eleccion ? "Guardar cambios" : "Crear elección"}
        </button>
      </div>
    </form>
  );
}
