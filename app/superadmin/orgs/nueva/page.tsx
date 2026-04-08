"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { superadminCrearOrg } from "@/lib/supabase/admin-queries";

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const COLORES = [
  { label: "Azul", value: "#1e40af" },
  { label: "Verde", value: "#15803d" },
  { label: "Rojo", value: "#b91c1c" },
  { label: "Violeta", value: "#7c3aed" },
  { label: "Naranja", value: "#c2410c" },
  { label: "Negro", value: "#1e293b" },
];

export default function SuperadminNuevaOrgPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#1e40af");

  function handleNombreChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNombre(val);
    setSlug(toSlug(val));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !slug.trim()) {
      setError("Completá nombre e identificador.");
      return;
    }

    startTransition(async () => {
      const result = await superadminCrearOrg(nombre.trim(), slug.trim(), color);

      if (!result.ok) {
        const msgs: Record<string, string> = {
          slug_taken: "Ese identificador ya está en uso.",
          no_autorizado: "No tenés permisos de superadmin.",
        };
        setError(msgs[result.error ?? ""] ?? result.error ?? "Error al crear.");
        return;
      }

      router.replace("/superadmin/dashboard");
    });
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/superadmin/dashboard"
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Nueva organización</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Nombre de la organización</label>
          <input
            type="text"
            value={nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Club Atlético Demo"
            required
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Identificador único (slug)</label>
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
            <span className="px-3 py-2 text-sm text-slate-400 bg-slate-50 border-r border-slate-300 whitespace-nowrap">
              /org/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(toSlug(e.target.value))}
              placeholder="club-atletico-demo"
              required
              className="flex-1 px-3 py-2 text-sm focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Color principal</label>
          <div className="flex gap-2 flex-wrap">
            {COLORES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  color === c.value ? "border-slate-900 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-9 h-9 rounded-full border border-slate-300 cursor-pointer p-0.5"
            />
          </div>
        </div>

        {/* Preview */}
        <div
          className="rounded-xl p-4 flex items-center gap-3 text-white"
          style={{ backgroundColor: color }}
        >
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">
            {nombre.charAt(0) || "O"}
          </div>
          <div>
            <p className="font-semibold text-sm">{nombre || "Nueva organización"}</p>
            <p className="text-xs opacity-75">/org/{slug || "nueva-org"}/admin</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {isPending ? "Creando..." : "Crear organización"}
        </button>
      </form>
    </div>
  );
}
