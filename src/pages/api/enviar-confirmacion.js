import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { pedido, cliente } = req.body
  if (!cliente?.email) return res.status(200).json({ ok: false, motivo: 'Cliente sin email' })
  const fechaFormateada = new Date(pedido.fecha_entrega + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const precioFormateado = Number(pedido.precio_venta).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
  try {
    await resend.emails.send({
      from: 'Mr. Chester Sofás <onboarding@resend.dev>',
      to: cliente.email,
      subject: `Confirmación de pedido ${pedido.numero} — Mr. Chester Sofás`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px"><div style="background:#6d28d9;padding:32px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px">🛋️ Mr. Chester Sofás</h1><p style="color:#ddd6fe;margin:8px 0 0;font-size:14px">Fábrica de sofás a medida</p></div><div style="background:#fff;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px"><h2 style="color:#111827;margin:0 0 16px">¡Tu pedido fue recibido!</h2><p style="color:#374151;margin:0 0 24px">Gracias por confiar en nosotros. Aquí está el resumen:</p><div style="background:#f5f3ff;border:2px solid #6d28d9;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px"><p style="margin:0;color:#6d28d9;font-size:13px;font-weight:600">NÚMERO DE PEDIDO</p><p style="margin:6px 0 0;color:#4c1d95;font-size:32px;font-weight:700">${pedido.numero}</p></div><table width="100%" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse"><tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;background:#f9fafb;width:40%">Cliente</td><td style="padding:12px 16px;font-size:14px;color:#111827">${cliente.nombre}</td></tr>${cliente.cedula ? `<tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-top:1px solid #e5e7eb">Cédula</td><td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb">${cliente.cedula}</td></tr>` : ''}<tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-top:1px solid #e5e7eb">Producto</td><td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb">${pedido.tipo_sofa}</td></tr><tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-top:1px solid #e5e7eb;background:#f9fafb">Material</td><td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;background:#f9fafb">${pedido.material}</td></tr><tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-top:1px solid #e5e7eb">Fecha entrega</td><td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #e5e7eb">${fechaFormateada}</td></tr><tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;border-top:1px solid #e5e7eb;background:#f9fafb">Valor total</td><td style="padding:12px 16px;font-size:16px;color:#6d28d9;font-weight:700;border-top:1px solid #e5e7eb;background:#f9fafb">${precioFormateado}</td></tr></table><p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0">Este es un correo automático, no respondas a este mensaje.</p></div></div>`
    })
    res.status(200).json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
}