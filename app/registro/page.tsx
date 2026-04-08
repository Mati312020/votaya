"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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

export default function RegistroPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#1e40af");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleNombreChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNombre(val);
    setSlug(toSlug(val));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !slug.trim() || !email.trim() || !password) {
      setError("Completá todos los campos.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    startTransition(async () => {
      // 1. Create user + org server-side (service role confirms email automatically)
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nombre: nombre.trim(), slug: slug.trim(), color }),
      });
      const data = await res.json();

      if (!data.ok) {
        const msgs: Record<string, string> = {
          slug_taken: "Ese identificador ya está en uso. Elegí otro.",
          email_taken: "Ya existe una cuenta con ese email. Intentá iniciar sesión.",
        };
        setError(msgs[data.error] ?? data.error ?? "Error al crear la organización.");
        return;
      }

      // 2. Sign in (user is already confirmed by the API route)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Organización creada. Podés ingresar desde /admin/login.");
        return;
      }

      router.replace(`/org/${data.slug}/admin/dashboard`);
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-black text-blue-700 tracking-tight">VotaYa</a>
          <p className="text-slate-500 text-sm mt-1">Crear nueva organización</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5">
          {/* Nombre org */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Nombre de la organización</label>
            <input
              type="text"
              value={nombre}
              onChange={handleNombreChange}
              placeholder="Ej: Club Atlético Demo"
              required
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Slug */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Identificador único (slug)</label>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
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
            <p className="text-xs text-slate-400">Solo letras, números y guiones.</p>
          </div>

          {/* Color */}
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
                title="Color personalizado"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Email admin */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Email del administrador</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@tuorg.com"
              required
              autoComplete="email"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              autoComplete="new-password"
              minLength={8}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Preview */}
          <div
            className="rounded-xl p-4 flex items-center gap-3 text-white"
            style={{ backgroundColor: color }}
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">
              {nombre.charAt(0) || "O"}
            </div>
            <div>
              <p className="font-semibold text-sm">{nombre || "Mi organización"}</p>
              <p className="text-xs opacity-75">/org/{slug || "mi-org"}/admin</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm"
            style={{ backgroundColor: color }}
          >
            {isPending ? "Creando organización..." : "Crear organización →"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">
          ¿Ya tenés cuenta?{" "}
          <a href="/admin/login" className="text-blue-600 underline">
            Iniciar sesión
          </a>
        </p>
      </div>
    </main>
  );
}
