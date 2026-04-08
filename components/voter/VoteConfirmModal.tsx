"use client";

import type { Lista } from "@/types/voting";

interface Props {
  lista: Lista;
  onConfirmar: () => void;
  onCancelar: () => void;
  isPending: boolean;
}

export default function VoteConfirmModal({
  lista,
  onConfirmar,
  onCancelar,
  isPending,
}: Props) {
  const color = lista.metadata?.color ?? "#1e40af";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-6">
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3"
              style={{ backgroundColor: `${color}20` }}
            >
              <svg
                className="w-8 h-8"
                style={{ color }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              ¿Confirmás tu voto?
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Esta acción no se puede deshacer.
            </p>
          </div>

          <div
            className="rounded-xl p-4 mb-6 border-2"
            style={{ borderColor: color, backgroundColor: `${color}08` }}
          >
            <p className="font-bold text-lg text-slate-900 text-center">{lista.nombre}</p>
            {lista.metadata?.slogan && (
              <p className="text-sm text-center mt-1" style={{ color }}>
                "{lista.metadata.slogan}"
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancelar}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl border-2 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Volver
            </button>
            <button
              onClick={onConfirmar}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {isPending ? "Emitiendo..." : "Confirmar voto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
