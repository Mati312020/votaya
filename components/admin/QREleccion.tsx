"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

interface Props {
  slug: string;
  titulo: string;
}

function getBaseUrl(): string {
  // 1. Variable de entorno configurada explícitamente (desarrollo local o producción)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  // 2. Fallback: origen del browser (funciona en producción sin la var)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

export default function QREleccion({ slug, titulo }: Props) {
  const [copied, setCopied] = useState(false);

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/e/${slug}`;

  const isLocalhost = baseUrl.includes("localhost");

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {isLocalhost && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">⚠️ URL apunta a localhost</p>
          <p className="text-xs mt-0.5">
            El QR generado usa <code className="bg-amber-100 px-1 rounded">localhost</code> y no va a funcionar al escanearlo desde otro dispositivo. Configurá{" "}
            <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_BASE_URL</code> en <code className="bg-amber-100 px-1 rounded">.env.local</code> con la IP de tu red o el dominio de producción.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center gap-4">
        <QRCodeSVG
          value={url}
          size={220}
          level="M"
          includeMargin
          className="rounded-xl"
        />
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">{titulo}</p>
          <p className="text-xs text-slate-400 font-mono mt-0.5 break-all">{url}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-sm text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors"
        >
          {copied ? "✓ Copiado" : "Copiar URL"}
        </button>
        <button
          onClick={() => window.print()}
          className="text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 rounded-xl transition-colors"
        >
          Imprimir QR
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center max-w-xs">
        Compartí este QR con los votantes. Al escanearlo irán directamente a la pantalla de votación.
      </p>
    </div>
  );
}
