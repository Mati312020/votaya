import { notFound } from "next/navigation";
import { getEleccionBySlug, getListasByEleccion } from "@/lib/supabase/queries";
import VotarClient from "./VotarClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function VotarPage({ params }: Props) {
  const { slug } = await params;
  const eleccion = await getEleccionBySlug(slug);

  if (!eleccion) notFound();

  const listas = await getListasByEleccion(eleccion.id);

  if (listas.length === 0) notFound();

  return (
    <main className="min-h-screen p-4 pb-8">
      <div className="max-w-md mx-auto">
        <div className="py-6 text-center">
          <h1 className="text-lg font-bold text-slate-900">{eleccion.titulo}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Seleccioná la lista de tu preferencia
          </p>
        </div>

        <VotarClient slug={slug} listas={listas} />

        <p className="text-center text-xs text-slate-400 mt-8">
          VotaYa — Tu voto es secreto y anónimo
        </p>
      </div>
    </main>
  );
}
