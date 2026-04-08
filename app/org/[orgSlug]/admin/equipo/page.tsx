"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { getAdminsOrg, getOrgBySlug } from "@/lib/supabase/admin-queries";
import type { AdminConEmail } from "@/types/voting";

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EquipoPage() {
  const params = useParams<{ orgSlug: string }>();
  const [admins, setAdmins] = useState<AdminConEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<number | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const org = await getOrgBySlug(params.orgSlug);
      if (org) {
        setOrgId(org.id);
        const list = await getAdminsOrg(org.id);
        setAdmins(list);
      }
      setLoading(false);
    }
    load();
  }, [params.orgSlug]);

  function handleInvitar(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);

    if (!orgId) return;
    if (password.length < 8) {
      setFormMsg({ type: "error", text: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/admin/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, orgId }),
      });
      const data = await res.json();

      if (!data.ok) {
        setFormMsg({ type: "error", text: data.error ?? "Error al invitar." });
        return;
      }

      setFormMsg({ type: "ok", text: `${email} fue agregado como administrador.` });
      setEmail("");
      setPassword("");

      // Refresh list
      const list = await getAdminsOrg(orgId);
      setAdmins(list);
    });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Equipo</h1>

      {/* Current admins */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Administradores actuales</h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No se encontraron administradores.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.email}</p>
                  <p className="text-xs text-slate-400">Desde {formatFecha(a.created_at)}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  a.rol === "superadmin"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {a.rol}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Invitar nuevo administrador</h2>

        <form onSubmit={handleInvitar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="nuevo@admin.com"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Contraseña temporal</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400">El nuevo admin deberá cambiarla luego de su primer acceso.</p>
          </div>

          {formMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg border ${
              formMsg.type === "ok"
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-red-600 bg-red-50 border-red-200"
            }`}>
              {formMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || !orgId}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
          >
            {isPending ? "Invitando..." : "Invitar administrador"}
          </button>
        </form>
      </div>
    </div>
  );
}
