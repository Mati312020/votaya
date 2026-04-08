"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { getEleccionById, getListasAdmin, getEstructuraElectoral, getOrgBySlug } from "@/lib/supabase/admin-queries";
import OrgEleccionAdminClient from "./OrgEleccionAdminClient";
import type { Eleccion, Lista, EstructuraNode, Organizacion } from "@/types/voting";

export default function OrgEleccionAdminPage() {
  const params = useParams<{ orgSlug: string; id: string }>();

  const [eleccion,    setEleccion]    = useState<Eleccion | null>(null);
  const [listas,      setListas]      = useState<Lista[]>([]);
  const [estructura,  setEstructura]  = useState<EstructuraNode[]>([]);
  const [org,         setOrg]         = useState<Organizacion | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound404, setNotFound404] = useState(false);

  useEffect(() => {
    const eleccionId = parseInt(params.id, 10);
    if (isNaN(eleccionId)) { setNotFound404(true); return; }

    Promise.all([
      getEleccionById(eleccionId),
      getListasAdmin(eleccionId),
      getEstructuraElectoral(eleccionId),
      getOrgBySlug(params.orgSlug),
    ]).then(([e, l, est, o]) => {
      if (!e) { setNotFound404(true); return; }
      setEleccion(e);
      setListas(l);
      setEstructura(est);
      setOrg(o);
      setLoading(false);
    });
  }, [params.id, params.orgSlug]);

  if (notFound404) notFound();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <OrgEleccionAdminClient
      eleccion={eleccion!}
      listasIniciales={listas}
      estructuraInicial={estructura}
      orgSlug={params.orgSlug}
      limiteVotantes={org?.limite_votantes ?? null}
    />
  );
}
