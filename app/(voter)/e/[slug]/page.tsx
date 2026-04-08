import { notFound } from "next/navigation";
import { getEleccionBySlug } from "@/lib/supabase/queries";
import DniEntryClient from "./DniEntryClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EleccionPage({ params }: Props) {
  const { slug } = await params;
  const eleccion = await getEleccionBySlug(slug);

  if (!eleccion) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-blue-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              {eleccion.titulo}
            </h1>
            {eleccion.descripcion && (
              <p className="text-sm text-slate-500 mt-2">{eleccion.descripcion}</p>
            )}
          </div>

          <DniEntryClient eleccionId={eleccion.id} slug={slug} orgColor={eleccion.org_color} />
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          VotaYa — Sistema de votación seguro y transparente
        </p>
      </div>
    </main>
  );
}
