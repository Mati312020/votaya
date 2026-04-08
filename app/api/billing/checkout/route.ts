/**
 * POST /api/billing/checkout
 *
 * Proxy hacia el billing service centralizado.
 * VotaYa llama a este endpoint desde el cliente para iniciar el checkout de MP.
 *
 * Body: { planSlug, orgId, orgNombre, adminEmail }
 * Response: { checkoutUrl }
 */

import { NextRequest, NextResponse } from 'next/server'

const BILLING_URL = process.env.BILLING_SERVICE_URL ?? 'https://billing.bytecraft.com.ar'

export async function POST(req: NextRequest) {
  try {
    const { planSlug, orgId, orgNombre, adminEmail } = await req.json()

    if (!planSlug || !orgId || !adminEmail) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const res = await fetch(`${BILLING_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appSlug:     'votaya',
        planSlug,
        tenantRef:   String(orgId),
        tenantEmail: adminEmail,
        tenantName:  orgNombre ?? null,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[billing/checkout] Error del billing service:', err)
      return NextResponse.json({ error: 'Error al crear el link de pago' }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ checkoutUrl: data.checkoutUrl })
  } catch (err) {
    console.error('[billing/checkout] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
