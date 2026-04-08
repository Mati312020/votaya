"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { getEleccionById, getListasAdmin } from "@/lib/supabase/admin-queries";
import EleccionAdminClient from "./EleccionAdminClient";
import type { Eleccion, Lista } from "@/types/voting";

export default function EleccionAdminPage() {
  const params = useParams<{ id: string }>();
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound404, setNotFound404] = useState(false);

  useEffect(() => {
    const eleccionId = parseInt(params.id, 10);
    if (isNaN(eleccionId)) { setNotFound404(true); return; }

    Promise.all([getEleccionById(eleccionId), getListasAdmin(eleccionId)]).then(
      ([e, l]) => {
        if (!e) { setNotFound404(true); return; }
        setEleccion(e);
        setListas(l);
        setLoading(false);
      }
    );
  }, [params.id]);

  if (notFound404) notFound();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <EleccionAdminClient eleccion={eleccion!} listasIniciales={listas} />;
}
