"use client";

import { useRouter } from "next/navigation";
import DniForm from "@/components/voter/DniForm";
import type { VerificacionIdentidad } from "@/types/voting";

interface Props {
  eleccionId: number;
  slug: string;
  orgColor?: string;
  verificacionIdentidad?: VerificacionIdentidad;
}

export default function DniEntryClient({ eleccionId, slug, orgColor, verificacionIdentidad }: Props) {
  const router = useRouter();

  function handleSuccess(token: string) {
    sessionStorage.setItem(`voto_token_${slug}`, token);
    router.replace(`/e/${slug}/votar`);
  }

  function handleRequiereVerificacion(metodo: VerificacionIdentidad, verificacionToken: string) {
    sessionStorage.setItem(`vtoken_${slug}`, verificacionToken);
    router.replace(`/e/${slug}/verificar?m=${metodo}`);
  }

  return (
    <DniForm
      eleccionId={eleccionId}
      slug={slug}
      onSuccess={handleSuccess}
      onRequiereVerificacion={handleRequiereVerificacion}
      orgColor={orgColor}
    />
  );
}
