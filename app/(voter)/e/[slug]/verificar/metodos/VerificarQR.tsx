"use client";

import { useRef, useState, useTransition } from "react";

interface Props {
  slug: string;
  verificacionToken: string;
  onSuccess: (token: string) => void;
}

// Formato PDF417 del DNI argentino:
// @APELLIDOS@NOMBRES@SEXO@NUMERO_DNI@TRAMITE@FECHA_NAC@FECHA_VTO
function extraerDniDeBarcode(raw: string): string | null {
  if (!raw) return null;
  const partes = raw.split("@").filter(Boolean);
  if (partes.length >= 4) {
    const candidato = partes[3].replace(/\D/g, "");
    if (/^\d{6,8}$/.test(candidato)) return candidato;
  }
  // Fallback: primer bloque con formato DNI
  for (const p of partes) {
    const limpio = p.replace(/\D/g, "");
    if (/^\d{6,8}$/.test(limpio)) return limpio;
  }
  return null;
}

type Stage = "instrucciones" | "procesando" | "error";

export default function VerificarQR({ verificacionToken, onSuccess }: Props) {
  const [stage, setStage] = useState<Stage>("instrucciones");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Mostrar preview de la foto capturada
    const url = URL.createObjectURL(file);
    setPreview(url);
    setErrorMsg(null);
    setStage("procesando");

    startTransition(async () => {
      try {
        // Cargar ZXing dinámicamente
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        const reader = new BrowserMultiFormatReader();

        // Crear img element con la foto para que ZXing la decodifique
        const img = document.createElement("img");
        img.src = url;
        await new Promise<void>((res) => { img.onload = () => res(); });

        let rawText: string;
        try {
          const result = await Promise.resolve(reader.decodeFromImageElement(img));
          rawText = result.getText();
        } catch {
          URL.revokeObjectURL(url);
          setPreview(null);
          setStage("error");
          setErrorMsg("No se encontró un código de barras en la imagen. Asegurate de enfocar bien el código del dorso del DNI e intentá de nuevo.");
          return;
        }

        URL.revokeObjectURL(url);

        const dniExtraido = extraerDniDeBarcode(rawText);
        if (!dniExtraido) {
          setPreview(null);
          setStage("error");
          setErrorMsg("El código escaneado no es un DNI argentino válido. Asegurate de fotografiar el código de barras del dorso del DNI.");
          return;
        }

        // Enviar al servidor para validar contra el hash del padrón
        const res = await fetch("/api/voter/verificar-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verificacion_token: verificacionToken,
            dni_extraido: dniExtraido,
          }),
        });
        const data = await res.json();

        if (!data.ok) {
          setPreview(null);
          setStage("error");
          setErrorMsg(data.error ?? "Error en la verificación.");
          return;
        }

        onSuccess(data.token);
      } catch {
        setPreview(null);
        setStage("error");
        setErrorMsg("Error al procesar la imagen. Intentá de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">¿Dónde está el código de barras?</p>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-start gap-2">
            <span className="mt-0.5">🪪</span>
            <span><strong>DNI nuevo</strong> (MERCOSUR, desde 2018) — el código está en el <strong>frente</strong>, esquina inferior derecha.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5">📄</span>
            <span><strong>DNI anterior</strong> — el código está en el <strong>dorso</strong>.</span>
          </div>
        </div>
        <p className="text-xs mt-2 text-blue-600">Tomá la foto con buena iluminación y sin reflejos sobre el código.</p>
      </div>

      {/* Preview de la foto */}
      {preview && stage === "procesando" && (
        <div className="relative rounded-xl overflow-hidden border border-slate-200">
          <img src={preview} alt="Foto del código" className="w-full object-contain max-h-48" />
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-blue-700">Leyendo código...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {stage === "error" && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Input oculto — capture="environment" abre la cámara trasera en mobile sin HTTPS */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFoto}
        className="hidden"
      />

      {/* Botón principal */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="w-full py-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
      >
        <span>📷</span>
        <span>{stage === "error" ? "Tomar otra foto" : "Fotografiar código de barras"}</span>
      </button>

      <p className="text-xs text-center text-slate-400">
        El código se lee localmente en tu dispositivo — no se sube la imagen al servidor.
      </p>
    </div>
  );
}
