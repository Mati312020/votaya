import { notFound } from "next/navigation";
import { getEleccionBySlug } from "@/lib/supabase/queries";
import VoteTicket from "@/components/voter/VoteTicket";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ h?: string }>;
}

export default async function GraciasPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { h: votoHash } = await searchParams;

  const eleccion = await getEleccionBySlug(slug);

  // Si no hay hash o la elección no existe, redirigir
  if (!votoHash || !eleccion) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <VoteTicket
          votoHash={votoHash}
          tituloEleccion={eleccion.titulo}
          slug={slug}
        />
      </div>
    </main>
  );
}
