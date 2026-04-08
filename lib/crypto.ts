"use client";

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Genera un hash SHA-256 del DNI.
 *
 * Usa SubtleCrypto (nativo del browser) en contextos seguros (HTTPS / localhost).
 * Cae a @noble/hashes (pure-JS, output idéntico) en HTTP local durante desarrollo.
 *
 * Formula: SHA-256(dni_normalizado + eleccion_id + pepper)
 * - El pepper hace que el hash sea único por instalación
 * - El eleccion_id hace que el mismo DNI produzca hashes distintos en cada elección
 */
export async function hashDni(
  dni: string,
  eleccionId: number
): Promise<string> {
  const pepper = process.env.NEXT_PUBLIC_VOTE_PEPPER ?? "";
  const input = `${dni.trim()}${eleccionId}${pepper}`;
  const data = new TextEncoder().encode(input);

  // SubtleCrypto solo disponible en contextos seguros (HTTPS / localhost)
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const buffer = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback pure-JS para HTTP local en desarrollo (mismo output que SubtleCrypto)
  return bytesToHex(sha256(data));
}

/**
 * Genera un hash del contenido del voto para el ticket verificador.
 * No contiene información sobre el votante.
 */
export async function hashVoto(
  eleccionId: number,
  listaId: number,
  timestamp: string
): Promise<string> {
  const input = `voto:${eleccionId}:${listaId}:${timestamp}`;
  const data = new TextEncoder().encode(input);

  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const buffer = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16)
      .toUpperCase();
  }

  return bytesToHex(sha256(data)).slice(0, 16).toUpperCase();
}

export function normalizarDni(dni: string): string {
  return dni.replace(/\D/g, "").slice(0, 8);
}

export function validarFormatoDni(dni: string): boolean {
  const normalizado = normalizarDni(dni);
  return normalizado.length >= 6 && normalizado.length <= 8;
}
