"use client";

import { useState, useTransition } from "react";
import {
  crearLista,
  actualizarLista,
  eliminarLista,
  uploadFotoLista,
} from "@/lib/supabase/admin-queries";
import type { Lista } from "@/types/voting";

interface Props {
  eleccionId: number;
  listas: Lista[];
  onRefresh: () => void;
}

const COLORES_PRESET = [
  { label: "Azul", color: "#1e40af", texto: "#ffffff" },
  { label: "Verde", color: "#166534", texto: "#ffffff" },
  { label: "Rojo", color: "#991b1b", texto: "#ffffff" },
  { label: "Naranja", color: "#9a3412", texto: "#ffffff" },
  { label: "Violeta", color: "#6b21a8", texto: "#ffffff" },
  { label: "Gris", color: "#374151", texto: "#ffffff" },
];

interface FormState {
  nombre: string;
  descripcion: string;
  slogan: string;
  color: string;
  color_texto: string;
}

const DEFAULT_FORM: FormState = {
  nombre: "",
  descripcion: "",
  slogan: "",
  color: "#1e40af",
  color_texto: "#ffffff",
};

export default function ListasManager({ eleccionId, listas, onRefresh }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startEdit(lista: Lista) {
    setEditingId(lista.id);
    setShowNew(false);
    setForm({
      nombre: lista.nombre,
      descripcion: lista.descripcion ?? "",
      slogan: lista.metadata?.slogan ?? "",
      color: lista.metadata?.color ?? "#1e40af",
      color_texto: lista.metadata?.color_texto ?? "#ffffff",
    });
    setFotoFile(null);
    setError(null);
  }

  function startNew() {
    setEditingId(null);
    setShowNew(true);
    setForm(DEFAULT_FORM);
    setFotoFile(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setShowNew(false);
    setError(null);
  }

  function handleGuardar() {
    setError(null);
    if (!form.nombre.trim()) { setError("El nombre es requerido."); return; }

    startTransition(async () => {
      const metadata = {
        slogan: form.slogan || undefined,
        color: form.color,
        color_texto: form.color_texto,
      };

      if (showNew) {
        // Crear
        const lista = await crearLista({
          eleccion_id: eleccionId,
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          foto_url: null,
          orden: listas.length + 1,
          metadata,
          grupo_padre_id: null,
        });
        if (!lista) { setError("Error al crear la lista."); return; }

        // Subir foto si hay
        if (fotoFile) {
          const url = await uploadFotoLista(fotoFile, eleccionId, lista.id);
          if (url) await actualizarLista(lista.id, { foto_url: url });
        }
      } else if (editingId !== null) {
        // Actualizar
        const updates: Partial<Lista> = { nombre: form.nombre, descripcion: form.descripcion || null, metadata };
        if (fotoFile) {
          const url = await uploadFotoLista(fotoFile, eleccionId, editingId);
          if (url) updates.foto_url = url;
        }
        await actualizarLista(editingId, updates);
      }

      setShowNew(false);
      setEditingId(null);
      onRefresh();
    });
  }

  function handleEliminar(id: number, nombre: string) {
    if (!confirm("¿Eliminar esta lista? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      await eliminarLista(id, nombre, eleccionId);
      onRefresh();
    });
  }

  const FormPanel = (
    <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Nombre *</label>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Lista Azul"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Descripción</label>
        <textarea
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          rows={2}
          placeholder="Descripción breve..."
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Slogan</label>
        <input
          type="text"
          value={form.slogan}
          onChange={(e) => setForm({ ...form, slogan: e.target.value })}
          placeholder="Por un club más grande"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Color de la lista</label>
        <div className="flex gap-2 flex-wrap">
          {COLORES_PRESET.map((c) => (
            <button
              key={c.color}
              type="button"
              onClick={() => setForm({ ...form, color: c.color, color_texto: c.texto })}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c.color,
                borderColor: form.color === c.color ? "#1e40af" : "transparent",
              }}
              title={c.label}
            />
          ))}
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="w-7 h-7 rounded-full border border-slate-300 cursor-pointer"
            title="Color personalizado"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Foto (opcional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={cancelEdit}
          className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleGuardar}
          disabled={isPending}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{listas.length} lista(s) configurada(s)</p>
        {!showNew && editingId === null && (
          <button
            onClick={startNew}
            className="text-sm text-blue-700 hover:text-blue-900 font-medium"
          >
            + Agregar lista
          </button>
        )}
      </div>

      {showNew && FormPanel}

      <div className="flex flex-col gap-2">
        {listas.map((lista) => (
          <div key={lista.id}>
            <div
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3"
              style={{ borderLeftColor: lista.metadata?.color ?? "#e2e8f0", borderLeftWidth: 4 }}
            >
              {lista.foto_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lista.foto_url}
                  alt={lista.nombre}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{lista.nombre}</p>
                {lista.metadata?.slogan && (
                  <p className="text-xs text-slate-400 truncate">{lista.metadata.slogan}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => startEdit(lista)}
                  className="text-xs text-slate-400 hover:text-blue-600 px-2 py-1 rounded"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleEliminar(lista.id, lista.nombre)}
                  className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded"
                >
                  Eliminar
                </button>
              </div>
            </div>
            {editingId === lista.id && <div className="mt-2">{FormPanel}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
