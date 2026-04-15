"use client";

import { useRef, useState, useTransition } from "react";

interface Props {
  slug: string;
  verificacionToken: string;
  onSuccess: (token: string) => void;
}

type Stage = "instrucciones" | "foto_dni" | "selfie" | "procesando" | "error";

export default function VerificarFaceCloud({ verificacionToken, onSuccess }: Props) {
  const [stage,    setStage]    = useState<Stage>("instrucciones");
  const [frenteDni, setFrenteDni] = useState<string | null>(null);
  const [selfie,   setSelfie]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const frenteInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Solo el contenido base64, sin el prefijo data:image/...;base64,
        const result = (reader.result as string).split(",")[1];
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFrenteDni(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setFrenteDni(b64);
    setStage("selfie");
  }

  async function handleSelfie(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setSelfie(b64);
  }

  function handleVerificar() {
    if (!frenteDni || !selfie) return;
    setErrorMsg(null);

    startTransition(async () => {
      setStage("procesando");
      const res = await fetch("/api/voter/verificar-face-cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificacion_token: verificacionToken,
          frente_dni: frenteDni,
          selfie,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setStage("error");
        setErrorMsg(data.error ?? "La verificación no fue exitosa.");
        return;
      }

      onSuccess(data.token);
    });
  }

  if (stage === "instrucciones") {
    return (
      <div className="flex flex-col gap-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex flex-col gap-2">
          <p className="font-semibold">¿Cómo funciona?</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Tomá una foto del <strong>frente de tu DNI</strong></li>
            <li>Tomá una <strong>selfie de tu cara</strong> en un lugar bien iluminado</li>
            <li>El sistema compara biométricamente ambas imágenes con IA</li>
          </ol>
        </div>
        <p className="text-xs text-slate-500 text-center">
          Las imágenes se transmiten encriptadas. No son almacenadas en ningún servidor.
        </p>
        <button
          onClick={() => setStage("foto_dni")}
          className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors"
        >
          🪪 Comenzar verificación
        </button>
      </div>
    );
  }

  if (stage === "foto_dni") {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">Paso 1 de 2</p>
          <p className="text-base font-semibold text-slate-900">Foto del frente de tu DNI</p>
          <p className="text-xs text-slate-500 mt-1">Asegurate de que sea legible y sin reflejos</p>
        </div>

        <input
          ref={frenteInputRef}
          type="file"
          accept="image/*"
          onChange={handleFrenteDni}
          className="hidden"
        />

        <button
          onClick={() => frenteInputRef.current?.click()}
          className="w-full py-6 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl text-blue-600 font-semibold transition-colors flex flex-col items-center gap-2"
        >
          <span className="text-3xl">🪪</span>
          <span>Foto del DNI</span>
          <span className="text-xs font-normal text-blue-400">cámara o archivo</span>
        </button>
      </div>
    );
  }

  if (stage === "selfie") {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">Paso 2 de 2</p>
          <p className="text-base font-semibold text-slate-900">Selfie de tu cara</p>
          <p className="text-xs text-slate-500 mt-1">Mirá a la cámara, en un lugar iluminado</p>
        </div>

        {frenteDni && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <span className="text-green-600 text-lg">✓</span>
            <span className="text-sm text-green-700">Foto del DNI capturada</span>
          </div>
        )}

        <input
          ref={selfieInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelfie}
          className="hidden"
        />

        <button
          onClick={() => selfieInputRef.current?.click()}
          className={`w-full py-6 border-2 border-dashed rounded-xl font-semibold transition-colors flex flex-col items-center gap-2 ${
            selfie
              ? "border-green-400 bg-green-50 text-green-700"
              : "border-blue-300 hover:border-blue-500 text-blue-600"
          }`}
        >
          <span className="text-3xl">{selfie ? "✅" : "🤳"}</span>
          <span>{selfie ? "Foto capturada — cambiar" : "Foto de tu cara"}</span>
          {!selfie && <span className="text-xs font-normal text-blue-400">cámara o archivo</span>}
        </button>

        {selfie && (
          <button
            onClick={handleVerificar}
            disabled={isPending}
            className="w-full py-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold rounded-xl transition-colors"
          >
            Verificar identidad →
          </button>
        )}
      </div>
    );
  }

  if (stage === "procesando") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-700 font-semibold">Verificando identidad...</p>
        <p className="text-xs text-slate-400 text-center">
          Comparando tu foto con la del documento. Esto puede demorar unos segundos.
        </p>
      </div>
    );
  }

  // Error
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        {errorMsg}
      </div>
      <button
        onClick={() => {
          setStage("instrucciones");
          setErrorMsg(null);
          setFrenteDni(null);
          setSelfie(null);
        }}
        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
      >
        Intentar nuevamente
      </button>
    </div>
  );
}
