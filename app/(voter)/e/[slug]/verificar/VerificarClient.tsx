"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VerificarQR from "./metodos/VerificarQR";
import VerificarOTP from "./metodos/VerificarOTP";
import VerificarRenaper from "./metodos/VerificarRenaper";

interface Props {
  slug: string;
  metodo: "dni_qr" | "otp_email" | "renaper";
}

export default function VerificarClient({ slug, metodo }: Props) {
  const router = useRouter();
  const [verificacionToken, setVerificacionToken] = useState<string | null>(null);

  useEffect(() => {
    const vt = sessionStorage.getItem(`vtoken_${slug}`);
    if (!vt) {
      router.replace(`/e/${slug}`);
      return;
    }
    setVerificacionToken(vt);
  }, [slug, router]);

  function handleSuccess(token: string) {
    sessionStorage.removeItem(`vtoken_${slug}`);
    sessionStorage.setItem(`voto_token_${slug}`, token);
    router.replace(`/e/${slug}/votar`);
  }

  if (!verificacionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const metodoLabels = {
    dni_qr:    { icon: "📷", titulo: "Verificación con DNI" },
    otp_email: { icon: "✉️", titulo: "Verificación por email" },
    renaper:   { icon: "🪪", titulo: "Verificación biométrica" },
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
              <span className="text-2xl">{metodoLabels[metodo].icon}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{metodoLabels[metodo].titulo}</h1>
            <p className="text-sm text-slate-500 mt-1">Paso 2 de 3 — Verificación de identidad</p>
          </div>

          {metodo === "dni_qr" && (
            <VerificarQR slug={slug} verificacionToken={verificacionToken} onSuccess={handleSuccess} />
          )}
          {metodo === "otp_email" && (
            <VerificarOTP slug={slug} verificacionToken={verificacionToken} onSuccess={handleSuccess} />
          )}
          {metodo === "renaper" && (
            <VerificarRenaper slug={slug} verificacionToken={verificacionToken} onSuccess={handleSuccess} />
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          VotaYa — Sistema de votación seguro y transparente
        </p>
      </div>
    </main>
  );
}
