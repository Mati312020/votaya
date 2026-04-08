/**
 * Genera hashes de DNIs para el padrón de prueba.
 * Uso: npx ts-node supabase/seed-padron.ts
 *
 * Requiere que NEXT_PUBLIC_VOTE_PEPPER esté en .env.local
 * y que la elección con id=1 exista en Supabase.
 */
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local manualmente
const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const PEPPER = envVars["NEXT_PUBLIC_VOTE_PEPPER"] ?? "";

// DNIs de prueba
const dnis = ["12345678", "87654321", "11111111"];

// Cambiar por el ID real de tu elección de prueba
const ELECCION_ID = 1;

function hashDni(dni: string, eleccionId: number): string {
  const input = `${dni.trim()}${eleccionId}${PEPPER}`;
  return createHash("sha256").update(input).digest("hex");
}

console.log("-- Hashes para el padrón de prueba (eleccion_id =", ELECCION_ID, ")");
console.log("-- Copiar en el INSERT de supabase/schema.sql\n");

for (const dni of dnis) {
  const hash = hashDni(dni, ELECCION_ID);
  console.log(`DNI ${dni} → '${hash}',`);
}

console.log("\n-- SQL listo para copiar:");
console.log(
  `INSERT INTO padron_votantes (eleccion_id, dni_hash) VALUES`
);
for (const dni of dnis) {
  const hash = hashDni(dni, ELECCION_ID);
  console.log(`  (${ELECCION_ID}, '${hash}'),`);
}
