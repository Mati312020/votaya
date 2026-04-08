import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Eleccion } from "@/types/voting";
import ResultadosClient from "./ResultadosClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ResultadosPage({ params }: Props) {
  const { slug } = await params;

  // Resultados son públicos para elecciones activas o cerradas
  const { data, error } = await supabase
    .from("elecciones")
    .select("*")
    .eq("slug", slug)
    .in("estado", ["activa", "cerrada"])
    .single();

  if (error || !data) notFound();

  return <ResultadosClient eleccion={data as Eleccion} />;
}
