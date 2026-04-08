"use client";

import { useEffect, useState, useTransition } from "react";

interface Props {
  slug: string;
  verificacionToken: string;
  onSuccess: (token: string) => void;
}

export default function VerificarOTP({ verificacionToken, onSuccess }: Props) {
  const [stage, setStage] = useState<"solicitando" | "ingresando" | "error">("solicitando");
  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Solicitar OTP automáticamente al montar
  useEffect(() => {
    solicitarOtp();
  }, []);

  function solicitarOtp() {
    setStage("solicitando");
    setErrorMsg(null);
    setCodigo("");

    startTransition(async () => {
      const res = await fetch("/api/voter/solicitar-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificacion_token: verificacionToken }),
      });
      const data = await res.json();

      if (!data.ok) {
        setStage("error");
        setErrorMsg(data.error ?? "Error al enviar el código.");
        return;
      }

      setEmailMasked(data.email_masked);
      setStage("ingresando");
    });
  }

  function handleVerificar(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (codigo.length !== 6) {
      setErrorMsg("El código debe tener 6 dígitos.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/voter/verificar-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificacion_token: verificacionToken, codigo }),
      });
      const data = await res.json();

      if (!data.ok) {
        setErrorMsg(data.error ?? "Código incorrecto.");
        return;
      }

      onSuccess(data.token);
    });
  }

  if (stage === "solicitando") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600">Enviando código de verificación...</p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {errorMsg}
        </div>
        <button
          onClick={solicitarOtp}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleVerificar} className="flex flex-col gap-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Se envió un código de 6 dígitos a{" "}
        <span className="font-semibold font-mono">{emailMasked}</span>
        . Revisá tu casilla de email.
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700 text-center">
          Ingresá el código
        </label>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          disabled={isPending}
          className="text-4xl font-bold tracking-[0.4em] text-center border-2 border-slate-300 rounded-xl px-4 py-4 focus:outline-none focus:border-blue-600 disabled:opacity-50"
          autoComplete="one-time-code"
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600 text-center">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={isPending || codigo.length !== 6}
        className="w-full py-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
      >
        {isPending ? "Verificando..." : "Confirmar código →"}
      </button>

      <button
        type="button"
        onClick={solicitarOtp}
        disabled={isPending}
        className="text-sm text-slate-500 hover:text-blue-600 underline text-center"
      >
        No recibí el código — reenviar
      </button>
    </form>
  );
}
