"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import ListaCard from "@/components/voter/ListaCard";
import VoteConfirmModal from "@/components/voter/VoteConfirmModal";
import { emitirVoto } from "@/lib/supabase/queries";
import type { Lista } from "@/types/voting";

interface Props {
  slug: string;
  listas: Lista[];
}

export default function VotarClient({ slug, listas }: Props) {
  const router = useRouter();
  const [seleccionada, setSeleccionada] = useState<Lista | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Si no hay token en sessionStorage, redirigir al inicio
  useEffect(() => {
    const token = sessionStorage.getItem(`voto_token_${slug}`);
    if (!token) {
      router.replace(`/e/${slug}`);
    }
  }, [slug, router]);

  function handleSeleccionar(lista: Lista) {
    setSeleccionada(lista);
    setMostrarModal(true);
    setError(null);
  }

  function handleConfirmar() {
    const token = sessionStorage.getItem(`voto_token_${slug}`);
    if (!token || !seleccionada) return;

    startTransition(async () => {
      const result = await emitirVoto(token, seleccionada.id);

      if (!result.ok) {
        const mensajes: Record<string, string> = {
          token_invalido: "El token de votación no es válido. Reiniciá el proceso.",
          token_expirado: "El tiempo para votar expiró. Reiniciá el proceso.",
          token_usado: "Este token ya fue utilizado.",
          desconocido: "Ocurrió un error al emitir el voto. Intentá de nuevo.",
        };
        setError(mensajes[result.error ?? "desconocido"]);
        setMostrarModal(false);
        return;
      }

      // Limpiar token — el votante no puede volver atrás
      sessionStorage.removeItem(`voto_token_${slug}`);

      // Vibración táctil si el dispositivo lo soporta
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      router.replace(`/e/${slug}/gracias?h=${result.voto_hash}`);
    });
  }

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {listas.map((lista) => (
          <ListaCard
            key={lista.id}
            lista={lista}
            seleccionada={seleccionada?.id === lista.id}
            onSeleccionar={() => handleSeleccionar(lista)}
            disabled={isPending}
          />
        ))}
      </div>

      {mostrarModal && seleccionada && (
        <VoteConfirmModal
          lista={seleccionada}
          onConfirmar={handleConfirmar}
          onCancelar={() => setMostrarModal(false)}
          isPending={isPending}
        />
      )}
    </>
  );
}
