"use client";

import type { Lista } from "@/types/voting";

interface Props {
  lista: Lista;
  seleccionada: boolean;
  onSeleccionar: () => void;
  disabled?: boolean;
}

export default function ListaCard({
  lista,
  seleccionada,
  onSeleccionar,
  disabled,
}: Props) {
  const color = lista.metadata?.color ?? "#1e40af";
  const colorTexto = lista.metadata?.color_texto ?? "#ffffff";

  return (
    <button
      onClick={onSeleccionar}
      disabled={disabled}
      className={`
        w-full text-left rounded-2xl border-2 overflow-hidden transition-all
        ${seleccionada ? "border-blue-600 shadow-lg scale-[1.02]" : "border-slate-200 hover:border-slate-400"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {/* Barra de color de la lista */}
      <div
        className="h-2"
        style={{ backgroundColor: color }}
      />

      <div className="p-4 flex gap-4 items-start">
        {lista.foto_url ? (
          <img
            src={lista.foto_url}
            alt={lista.nombre}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: color, color: colorTexto }}
          >
            {lista.nombre.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-lg leading-tight">
            {lista.nombre}
          </h3>
          {lista.metadata?.slogan && (
            <p className="text-sm font-medium mt-0.5" style={{ color }}>
              "{lista.metadata.slogan}"
            </p>
          )}
          {lista.descripcion && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
              {lista.descripcion}
            </p>
          )}
        </div>

        {seleccionada && (
          <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
