# VotaYa — Sistema de Votación Digital (PWA)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 + Tailwind CSS 4 (App Router) |
| Backend / DB | Supabase (PostgreSQL + RPC + RLS + Realtime) |
| Auth | Supabase Auth (solo admins) |
| Hashing | SHA-256 via SubtleCrypto (browser nativo) |
| PWA | next-pwa 5.x (service worker + manifest) |
| Deploy target | Vercel (frontend) + Supabase hosted (DB) |

---

## Seguridad — Decisiones clave

- **DNI nunca viaja al servidor.** Se hashea en el browser con `SubtleCrypto`:
  ```
  hash = SHA-256(dni + eleccion_id + PEPPER)
  ```
- **Token de un solo uso** generado por RPC tras validar el DNI — guardado en `sessionStorage` (se borra al cerrar el tab).
- **Urna sin FK al votante** — la tabla `urna` no tiene ninguna relación trazable al padrón ni al token. Anonimato garantizado.
- **RPC atómica con `SELECT FOR UPDATE`** — evita race conditions en doble-tap o reintentos rápidos de red.
- **Salt por elección** — el mismo DNI produce hashes distintos en cada elección, imposibilitando correlación entre elecciones.

---

## Fase 1 — Flujo del Votante ✅ COMPLETADA

### Archivos creados

```
voting-pwa/
├── app/
│   ├── layout.tsx                          ✅ Root layout (español, Tailwind)
│   ├── manifest.ts                         ✅ PWA manifest nativo Next.js 16
│   ├── page.tsx                            ✅ Home — landing con link al admin
│   └── (voter)/e/[slug]/
│       ├── page.tsx                        ✅ Pantalla 1: entrada de DNI
│       ├── DniEntryClient.tsx              ✅ Guarda token en sessionStorage + redirect
│       ├── votar/
│       │   ├── page.tsx                    ✅ Pantalla 2: selección de lista
│       │   └── VotarClient.tsx             ✅ Interactividad + modal de confirmación
│       └── gracias/
│           └── page.tsx                    ✅ Pantalla 3: ticket verificador
├── components/voter/
│   ├── DniForm.tsx                         ✅ Formulario DNI con validación
│   ├── ListaCard.tsx                       ✅ Card de lista con color y slogan
│   ├── VoteConfirmModal.tsx                ✅ Modal de confirmación del voto
│   └── VoteTicket.tsx                      ✅ Ticket con hash verificador
├── lib/
│   ├── crypto.ts                           ✅ hashDni() + hashVoto() + normalizarDni()
│   └── supabase/
│       ├── client.ts                       ✅ Cliente Supabase singleton
│       └── queries.ts                      ✅ getEleccionBySlug, getListas, validarDni, emitirVoto
├── types/
│   └── voting.ts                           ✅ Interfaces TypeScript completas
├── supabase/
│   ├── schema.sql                          ✅ Tablas + RLS + 2 RPCs + seed data
│   └── seed-padron.ts                      ✅ Script para generar hashes del padrón
├── next.config.ts                          ✅ Configurado con next-pwa (webpack mode)
├── .env.local                              ✅ Variables de entorno (rellenar con valores reales)
└── package.json                            ✅ Script dev con --webpack (compatibilidad next-pwa)
```

### Flujo implementado

```
Votante escanea QR / abre link
        ↓
/e/[slug] — Ingresa DNI
        ↓ hash en browser
RPC validar_dni → genera token de 30min
        ↓ token guardado en sessionStorage
/e/[slug]/votar — Elige lista → modal confirmar
        ↓
RPC emitir_voto (SELECT FOR UPDATE)
  → marca token como usado
  → marca padron.ya_voto = true
  → inserta en urna (sin FK al votante)
        ↓ limpia sessionStorage
/e/[slug]/gracias — Ticket con hash verificador
```

---

## Fase 2 — Panel Admin ✅ COMPLETADA

### Archivos creados

```
app/admin/
├── layout.tsx                          ✅ Layout con AdminGuard + AdminNav
├── AdminGuard.tsx                      ✅ Auth check client-side (redirect a login si no hay sesión)
├── AdminNav.tsx                        ✅ Barra de navegación con logout
├── login/page.tsx                      ✅ Login con email/password (Supabase Auth)
├── dashboard/page.tsx                  ✅ Lista de elecciones + barra de participación
└── elecciones/
    ├── nueva/page.tsx                  ✅ Formulario para crear elección
    └── [id]/
        ├── page.tsx                    ✅ Carga datos (client-side para tener sesión auth)
        └── EleccionAdminClient.tsx     ✅ Tabs: Detalles | Listas | Padrón | QR

components/admin/
├── EleccionForm.tsx                    ✅ CRUD elección (crea/edita, auto-slug)
├── ListasManager.tsx                   ✅ CRUD listas + upload foto a Supabase Storage
├── PadronUploader.tsx                  ✅ CSV → hash en browser → upsert en DB
└── QREleccion.tsx                      ✅ QR code con URL de votación + copiar/imprimir

lib/supabase/
└── admin-queries.ts                    ✅ Queries autenticadas: CRUD elecciones/listas/padrón/resultados

supabase/
└── migrations_fase2.sql                ✅ RPCs get_resultados + get_participacion
```

### Configuración en Supabase
- **Storage**: bucket `lista-fotos` creado (público para lectura, autenticado para write)
- **RPCs**: `get_resultados(p_eleccion_id)` y `get_participacion(p_eleccion_id)` — SECURITY DEFINER, GRANT a anon+authenticated
- **RLS**: política `elecciones_lectura_cerrada` para la página de resultados

### Primer admin: crear usuario en Supabase

1. Ir a **Supabase Dashboard → Authentication → Users → Add user**
2. Crear usuario con email y contraseña
3. Ejecutar en SQL Editor:

```sql
INSERT INTO admins (id, org_id, rol)
VALUES (
  '<UUID del usuario creado>',
  (SELECT id FROM organizaciones WHERE slug = 'club-atletico-demo'),
  'admin'
);
```

---

## Fase 3 — Resultados en tiempo real ✅ COMPLETADA

### Archivos creados

```
app/(voter)/resultados/[slug]/
├── page.tsx                            ✅ Server Component que verifica la elección
└── ResultadosClient.tsx                ✅ Gráficos Recharts + Supabase Realtime
```

### Características
- **Supabase Realtime** en tabla `urna` — cada INSERT dispara refetch de resultados agregados
- **BarChart horizontal** de Recharts con colores de cada lista
- **Barra de participación** (votaron / total padrón)
- Disponible para elecciones `activa` (en vivo) y `cerrada` (resultados finales)
- Badge "En vivo" con animación pulse cuando la elección está activa

### Fase 4 — Multi-tenant (SaaS)
- [ ] Onboarding de organizaciones (registro self-service)
- [ ] Activar RLS con `org_id` para aislamiento de tenants
- [ ] Panel de superadmin
- [ ] Subdominios o slugs por organización

### Mejoras / Nice-to-have
- [ ] Voto reemplazable (modificar RPC para `UPDATE` en urna cuando `voto_reemplazable = true`)
- [ ] Biometría / selfie para validación extra
- [ ] Modo accesibilidad (fuente grande, alto contraste)
- [ ] Página `not-found.tsx` personalizada
- [ ] Iconos PWA reales (`/public/icon-192.png` y `/public/icon-512.png`)

---

## Requisitos para pruebas

### 1. Crear proyecto en Supabase

Ir a [supabase.com](https://supabase.com), crear un proyecto nuevo y copiar:
- **URL del proyecto** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Completar `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_VOTE_PEPPER=votaya_pepper_2024_changeme
```

> **Importante:** Cambiar el valor de `NEXT_PUBLIC_VOTE_PEPPER` por una cadena aleatoria y **no modificarla nunca después** — si cambia, todos los hashes del padrón quedan inválidos.

### 3. Ejecutar el schema en Supabase

Ir a **SQL Editor** en Supabase y ejecutar el contenido de `supabase/schema.sql`.

Esto crea:
- Tablas: `organizaciones`, `elecciones`, `listas`, `padron_votantes`, `tokens_votacion`, `urna`
- RLS policies
- RPCs: `validar_dni` y `emitir_voto`
- Seed data: 1 organización + 1 elección activa + 3 listas (con padrón de hashes placeholder)

### 4. Generar hashes del padrón de prueba

Requiere `ts-node` instalado globalmente: `npm install -g ts-node`

```bash
npx ts-node supabase/seed-padron.ts
```

El script imprime los hashes reales para los DNIs de prueba (`12345678`, `87654321`, `11111111`) usando el pepper de `.env.local`.

Copiar el SQL generado y ejecutarlo en Supabase para **reemplazar los hashes placeholder** del seed.

### 5. Correr el proyecto

```bash
npm run dev
```

Abrir `http://localhost:3000/e/comision-directiva-2024`

### 6. Verificación manual del flujo

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1 | Navegar a `/e/comision-directiva-2024` | Pantalla de entrada DNI con título de la elección |
| 2 | Ingresar DNI `12345678` | Redirige a `/e/.../votar` |
| 3 | Seleccionar "Lista Azul" → confirmar | Redirige a `/e/.../gracias?h=XXXXXXXXXXXXXXXX` |
| 4 | Verificar en Supabase | `tokens_votacion.usado = true`, `padron_votantes.ya_voto = true`, nuevo registro en `urna` |
| 5 | Volver a `/e/...` e ingresar `12345678` | Error: "Este DNI ya emitió su voto" |
| 6 | Ingresar DNI `99999999` (no en padrón) | Error: "El DNI ingresado no figura en el padrón" |
| 7 | Verificar que `urna` no tiene FK al votante | La fila en `urna` solo tiene `eleccion_id` y `lista_id` |
