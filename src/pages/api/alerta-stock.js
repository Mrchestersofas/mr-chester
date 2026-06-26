// Archivo: src/pages/api/alerta-stock.js
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { alertas } = req.body

  if (!alertas || alertas.length === 0) {
    return res.status(200).json({ ok: false, motivo: 'Sin alertas' })
  }

  const criticos = alertas.filter(m => m.stock_actual === 0)
  const bajos    = alertas.filter(m => m.stock_actual > 0)

  const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const hora  = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  const fmt   = (n) => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 20px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <tr>
    <td style="background:#1a1a1a;padding:32px 40px 24px;text-align:center;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;color:#C9A84C;font-size:26px;font-weight:700;letter-spacing:4px;">MR. CHESTER</h1>
      <p style="margin:6px 0 0;color:#C9A84C;font-size:10px;letter-spacing:3px;">SOFÁS QUE HABLAN DE TI.</p>
      <div style="width:40px;height:1px;background:#C9A84C;margin:12px auto 0;"></div>
    </td>
  </tr>

  <tr>
    <td style="background:${criticos.length > 0 ? '#dc2626' : '#d97706'};padding:10px 40px;text-align:center;">
      <p style="margin:0;color:#fff;font-size:11px;letter-spacing:2px;font-weight:700;">
        ${criticos.length > 0 ? '🚨 ALERTA CRÍTICA — MATERIALES EN CERO' : '⚠️ ALERTA — STOCK POR DEBAJO DEL MÍNIMO'}
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#fff;padding:40px;">
      <p style="margin:0 0 6px;color:#888;font-size:13px;">Fecha: ${fecha} · ${hora}</p>
      <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:20px;font-weight:normal;">
        ${criticos.length > 0
          ? `<b style="color:#dc2626">${criticos.length} material(es)</b> con stock en CERO`
          : `<b style="color:#d97706">${alertas.length} material(es)</b> por debajo del mínimo`
        }
      </h2>
      <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 28px;">
        El sistema detectó que los siguientes materiales de bodega requieren reposición urgente:
      </p>

      ${criticos.length > 0 ? `
      <p style="margin:0 0 10px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #dc2626;padding-bottom:6px;">🚨 EN CERO — COMPRA URGENTE</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr style="background:#fef2f2;">
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Material</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Stock actual</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Mínimo</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Costo unit.</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Proveedor</th>
        </tr>
        ${criticos.map(m => `
        <tr style="border-top:1px solid #fee2e2;">
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;font-weight:600;">${m.nombre}</td>
          <td style="padding:10px 12px;font-size:13px;color:#dc2626;font-weight:700;">0 ${m.unidad}</td>
          <td style="padding:10px 12px;font-size:13px;color:#555;">${m.stock_minimo} ${m.unidad}</td>
          <td style="padding:10px 12px;font-size:13px;color:#C9A84C;font-weight:600;">${fmt(m.costo_unitario)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#555;">${m.proveedor || '—'}</td>
        </tr>`).join('')}
      </table>` : ''}

      ${bajos.length > 0 ? `
      <p style="margin:0 0 10px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #d97706;padding-bottom:6px;">⚠️ BAJO MÍNIMO</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr style="background:#fffbeb;">
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Material</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Stock actual</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Mínimo</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Costo unit.</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Proveedor</th>
        </tr>
        ${bajos.map(m => `
        <tr style="border-top:1px solid #fde68a;">
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;font-weight:600;">${m.nombre}</td>
          <td style="padding:10px 12px;font-size:13px;color:#d97706;font-weight:700;">${m.stock_actual} ${m.unidad}</td>
          <td style="padding:10px 12px;font-size:13px;color:#555;">${m.stock_minimo} ${m.unidad}</td>
          <td style="padding:10px 12px;font-size:13px;color:#C9A84C;font-weight:600;">${fmt(m.costo_unitario)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#555;">${m.proveedor || '—'}</td>
        </tr>`).join('')}
      </table>` : ''}

      <div style="background:#f9f6f0;border-left:3px solid #C9A84C;padding:16px 20px;border-radius:0 6px 6px 0;">
        <p style="margin:0;color:#555;font-size:13px;line-height:1.7;">
          Ingresa al sistema para gestionar las compras:
          <a href="https://mrchester-produccion.vercel.app/compras" style="color:#6d28d9;font-weight:600;">mrchester-produccion.vercel.app/compras</a>
        </p>
      </div>
    </td>
  </tr>

  <tr>
    <td style="background:#111;padding:20px 40px;text-align:center;border-radius:0 0 8px 8px;">
      <p style="margin:0;color:#C9A84C;font-size:10px;letter-spacing:2px;">MR. CHESTER EXPORT S.A.S.</p>
      <p style="margin:4px 0 0;color:#444;font-size:11px;">Este es un correo automático del sistema ERP.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`

  try {
    await resend.emails.send({
      from: 'Mr. Chester ERP <onboarding@resend.dev>',
      to: ['josephtoledo@gmail.com'],
      subject: `${criticos.length > 0 ? '🚨 URGENTE' : '⚠️ Alerta'} — Stock bajo en bodega · Mr. Chester`,
      html,
    })
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Error enviando alerta:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}
