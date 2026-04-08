"use client";

import { useState, useTransition } from "react";
import { normalizarDni, validarFormatoDni, hashDni } from "@/lib/crypto";
import { validarDni } from "@/lib/supabase/queries";

import type { VerificacionIdentidad } from "@/types/voting";

interface Props {
  eleccionId: number;
  slug: string;
  onSuccess: (token: string) => void;
  onRequiereVerificacion?: (metodo: VerificacionIdentidad, verificacionToken: string) => void;
  orgColor?: string;
}

export default function DniForm({ eleccionId, slug, onSuccess, onRequiereVerificacion, orgColor }: Props) {
  const [dni, setDni] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = normalizarDni(e.target.value);
    setDni(valor);
    setError(null);
  }

  // onInput captura autofill y sugerencias del teclado móvil que a veces
  // no disparan el onChange sintético de React en browsers Android
  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const valor = normalizarDni((e.target as HTMLInputElement).value);
    setDni(valor);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Fallback: leer el valor real del DOM por si el estado React quedó
    // desincronizado con lo que el browser mostró via autofill/historial
    const inputEl = (e.target as HTMLFormElement).querySelector("input");
    const dniEfectivo = normalizarDni(inputEl?.value ?? dni);

    if (!validarFormatoDni(dniEfectivo)) {
      setError("El DNI debe tener entre 6 y 8 dígitos.");
      return;
    }

    startTransition(async () => {
      const hash = await hashDni(dniEfectivo, eleccionId);
      const result = await validarDni(eleccionId, hash);

      if (!result.ok) {
        const mensajes: Record<string, string> = {
          ya_voto: "Este DNI ya emitió su voto en esta elección.",
          no_en_padron: "El DNI ingresado no figura en el padrón.",
          eleccion_no_activa: "Esta elección no está activa en este momento.",
          desconocido: "Ocurrió un error. Por favor intentá de nuevo.",
        };
        setError(mensajes[result.error ?? "desconocido"]);
        return;
      }

      if (result.requiere_verificacion && result.metodo && result.verificacion_token) {
        onRequiereVerificacion?.(result.metodo, result.verificacion_token);
        return;
      }

      onSuccess(result.token!);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="dni"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Número de DNI
        </label>
        <input
          id="dni"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          value={dni}
          onChange={handleChange}
          onInput={handleInput}
          placeholder="Ej: 30123456"
          disabled={isPending}
          className="w-full text-3xl font-bold tracking-widest text-center border-2 border-slate-300 rounded-xl px-4 py-4 focus:outline-none focus:border-blue-600 disabled:opacity-50"
          autoComplete="off"
        />
      </div>

      {error && (
        <p role="alert" className="text-red-600 text-sm text-center font-medium">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full text-white font-bold text-lg py-4 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: orgColor ?? "#1d4ed8" }}
      >
        {isPending ? "Verificando..." : "Ingresar a votar →"}
      </button>

      <p className="text-xs text-center text-slate-500">
        Tu DNI nunca abandona este dispositivo. Solo se envía un código de verificación.
      </p>
    </form>
  );
}
