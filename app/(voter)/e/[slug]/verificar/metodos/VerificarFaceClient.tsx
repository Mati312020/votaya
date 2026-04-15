"use client";

import { useEffect, useRef, useState, useTransition } from "react";

// Los modelos de face-api.js (~7MB) se cargan desde jsDelivr CDN.
// Se usa import() dinámico para garantizar que solo corra en el browser.
const MODELS_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

// Umbral de distancia euclídea entre descriptores faciales.
// < 0.5 → alta confianza (misma persona). < 0.6 → confianza media.
const DISTANCIA_UMBRAL = 0.5;

interface Props {
  slug: string;
  verificacionToken: string;
  onSuccess: (token: string) => void;
}

type Stage =
  | "cargando_modelos"
  | "instrucciones"
  | "foto_dni"
  | "foto_dni_error"
  | "selfie"
  | "comparando"
  | "error"
  | "enviando";

export default function VerificarFaceClient({ verificacionToken, onSuccess }: Props) {
  const [stage,      setStage]      = useState<Stage>("cargando_modelos");
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [modelPct,   setModelPct]   = useState(0);
  const [isPending,  startTransition] = useTransition();

  // Descriptores faciales (Float32Array de 128 dimensiones)
  const descriptor1Ref = useRef<Float32Array | null>(null); // DNI
  const descriptor2Ref = useRef<Float32Array | null>(null); // selfie

  const dniInputRef    = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // ── Cargar modelos al montar ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function cargarModelos() {
      try {
        // Import dinámico: solo se ejecuta en browser
        const faceapi = await import("face-api.js");

        // Los tres modelos necesarios para reconocimiento facial
        const modelos = [
          faceapi.nets.tinyFaceDetector,    // detección rápida (~190KB)
          faceapi.nets.faceLandmark68Net,   // 68 landmarks (~350KB)
          faceapi.nets.faceRecognitionNet,  // descriptor 128D (~6.2MB)
        ];

        for (let i = 0; i < modelos.length; i++) {
          if (cancelled) return;
          await modelos[i].loadFromUri(MODELS_URL);
          setModelPct(Math.round(((i + 1) / modelos.length) * 100));
        }

        if (!cancelled) setStage("instrucciones");
      } catch {
        if (!cancelled) {
          setStage("error");
          setErrorMsg("No se pudieron cargar los modelos de verificación. Verificá tu conexión a internet.");
        }
      }
    }

    cargarModelos();
    return () => { cancelled = true; };
  }, []);

  // ── Procesar una imagen y extraer descriptor facial ─────────
  async function extraerDescriptor(file: File): Promise<Float32Array | null> {
    const faceapi = await import("face-api.js");

    // Crear un elemento img en memoria (no se renderiza en el DOM)
    const url = URL.createObjectURL(file);
    const img  = document.createElement("img");
    await new Promise<void>((res, rej) => {
      img.onload  = () => res();
      img.onerror = () => rej(new Error("Imagen inválida"));
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const deteccion = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    return deteccion?.descriptor ?? null;
  }

  // ── Handler foto DNI ────────────────────────────────────────
  async function handleFotoDni(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setStage("comparando"); // reutilizamos spinner mientras extrae
    const desc = await extraerDescriptor(file);

    if (!desc) {
      setStage("foto_dni_error");
      return;
    }

    descriptor1Ref.current = desc;
    setStage("selfie");
  }

  // ── Handler selfie y comparación ───────────────────────────
  async function handleSelfie(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setStage("comparando");

    const desc = await extraerDescriptor(file);
    if (!desc) {
      setErrorMsg("No se detectó ninguna cara en la selfie. Intentá con mejor iluminación.");
      setStage("error");
      return;
    }
    descriptor2Ref.current = desc;

    // Comparar descriptores localmente — nada sale del dispositivo
    const faceapi  = await import("face-api.js");
    const distancia = faceapi.euclideanDistance(descriptor1Ref.current!, desc);

    if (distancia > DISTANCIA_UMBRAL) {
      setErrorMsg(
        `Las caras no coinciden (distancia: ${distancia.toFixed(2)}, umbral: ${DISTANCIA_UMBRAL}). Asegurate de tener buena iluminación y que la foto del DNI sea legible.`
      );
      setStage("error");
      return;
    }

    // Comparación exitosa → canjear token en el servidor
    setStage("enviando");
    startTransition(async () => {
      const res = await fetch("/api/voter/verificar-face-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificacion_token: verificacionToken }),
      });
      const data = await res.json();

      if (!data.ok) {
        setStage("error");
        setErrorMsg(data.error ?? "Error al completar la verificación.");
        return;
      }

      onSuccess(data.token);
    });
  }

  function reiniciar() {
    descriptor1Ref.current = null;
    descriptor2Ref.current = null;
    setErrorMsg(null);
    setStage("instrucciones");
  }

  // ── Estados de UI ───────────────────────────────────────────

  if (stage === "cargando_modelos") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-700 font-semibold text-sm">Cargando modelos de IA…</p>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${modelPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          Esto ocurre solo la primera vez · {modelPct}%
        </p>
      </div>
    );
  }

  if (stage === "instrucciones") {
    return (
      <div className="flex flex-col gap-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex flex-col gap-2">
          <p className="font-semibold">🔒 Verificación 100% privada</p>
          <p className="text-xs">
            Las fotos <strong>nunca salen de tu dispositivo</strong>. La comparación facial
            se realiza localmente con IA. Ningún servidor recibe tus imágenes.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex flex-col gap-2">
          <p className="font-semibold">¿Cómo funciona?</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Tomá una foto del <strong>frente de tu DNI</strong></li>
            <li>Tomá una <strong>selfie de tu cara</strong> bien iluminada</li>
            <li>La IA compara las caras en tu dispositivo y confirma tu identidad</li>
          </ol>
        </div>
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
          <p className="text-xs text-slate-500 mt-1">La cara debe ser visible y sin reflejos</p>
        </div>
        <input ref={dniInputRef} type="file" accept="image/*" onChange={handleFotoDni} className="hidden" />
        <button
          onClick={() => dniInputRef.current?.click()}
          className="w-full py-6 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl text-blue-600 font-semibold flex flex-col items-center gap-2 transition-colors"
        >
          <span className="text-3xl">🪪</span>
          <span>Foto del DNI</span>
          <span className="text-xs font-normal text-blue-400">cámara o archivo</span>
        </button>
      </div>
    );
  }

  if (stage === "foto_dni_error") {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">No se detectó ninguna cara en el DNI</p>
          <p className="text-xs">Asegurate de que la foto muestre claramente la cara de la foto del documento, sin reflejos ni partes cortadas.</p>
        </div>
        <input ref={dniInputRef} type="file" accept="image/*" onChange={handleFotoDni} className="hidden" />
        <button
          onClick={() => dniInputRef.current?.click()}
          className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl"
        >
          Tomar otra foto del DNI
        </button>
        <button onClick={reiniciar} className="text-sm text-slate-500 hover:text-slate-700 text-center">
          Volver al inicio
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
          <p className="text-xs text-slate-500 mt-1">Mirá a la cámara, en un lugar bien iluminado</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <span className="text-green-600">✓</span>
          <span className="text-sm text-green-700">Cara del DNI detectada correctamente</span>
        </div>
        <input ref={selfieInputRef} type="file" accept="image/*" onChange={handleSelfie} className="hidden" />
        <button
          onClick={() => selfieInputRef.current?.click()}
          className="w-full py-6 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl text-blue-600 font-semibold flex flex-col items-center gap-2 transition-colors"
        >
          <span className="text-3xl">🤳</span>
          <span>Foto de tu cara</span>
          <span className="text-xs font-normal text-blue-400">cámara o archivo</span>
        </button>
      </div>
    );
  }

  if (stage === "comparando" || stage === "enviando") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-700 font-semibold">
          {stage === "comparando" ? "Analizando imagen…" : "Verificando identidad…"}
        </p>
        <p className="text-xs text-slate-400 text-center">
          {stage === "comparando"
            ? "Detectando cara en el dispositivo. No se envía nada al servidor."
            : "Completando el proceso de verificación."}
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
        onClick={reiniciar}
        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
      >
        Intentar nuevamente
      </button>
    </div>
  );
}
