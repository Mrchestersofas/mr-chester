// Archivo: src/pages/api/resumen-diario.js
// Cron job que se ejecuta todos los días a las 8am (Colombia = UTC-5 = 13:00 UTC)

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  // Solo permite llamadas desde Vercel Cron o POST directo
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const fmt   = (n) => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

  // 1. Materiales bajo mínimo
  const { data: materiales } = await supabase.from('materiales').select('*').eq('tipo', 'stock').order('nombre')
  const alertas    = (materiales || []).filter(m => m.stock_actual < m.stock_minimo)
  const criticos   = alertas.filter(m => m.stock_actual === 0)
  const bajos      = alertas.filter(m => m.stock_actual > 0)

  // 2. Pedidos activos
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('*, cliente:clientes(nombre)')
    .in('estado', ['pendiente', 'estructura', 'tapizado', 'costura', 'control_calidad'])
    .order('fecha_entrega', { ascending: true })

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
    <td style="background:#C9A84C;padding:10px 40px;text-align:center;">
      <p style="margin:0;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;">📋 RESUMEN DIARIO DE OPERACIONES · 8:00 AM</p>
    </td>
  </tr>

  <tr>
    <td style="background:#fff;padding:40px;">
      <p style="margin:0 0 28px;color:#888;font-size:13px;text-transform:capitalize;">${fecha}</p>

      <!-- Resumen números -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="text-align:center;padding:16px;background:#f9f6f0;border-radius:8px;width:33%;">
            <p style="margin:0;font-size:28px;font-weight:700;color:#6d28d9;">${pedidos?.length || 0}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888;">Pedidos activos</p>
          </td>
          <td style="width:12px;"></td>
          <td style="text-align:center;padding:16px;background:${criticos.length > 0 ? '#fef2f2' : alertas.length > 0 ? '#fffbeb' : '#f0fdf4'};border-radius:8px;width:33%;">
            <p style="margin:0;font-size:28px;font-weight:700;color:${criticos.length > 0 ? '#dc2626' : alertas.length > 0 ? '#d97706' : '#16a34a'};">${alertas.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888;">Alertas de stock</p>
          </td>
          <td style="width:12px;"></td>
          <td style="text-align:center;padding:16px;background:#f9f6f0;border-radius:8px;width:33%;">
            <p style="margin:0;font-size:28px;font-weight:700;color:#C9A84C;">${fmt((pedidos || []).reduce((s, p) => s + Number(p.precio_venta), 0))}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888;">Valor en producción</p>
          </td>
        </tr>
      </table>

      <!-- Alertas de stock -->
      ${alertas.length > 0 ? `
      <p style="margin:0 0 10px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #C9A84C;padding-bottom:6px;">🛒 MATERIALES A COMPRAR HOY</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr style="background:#f9f6f0;">
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Material</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Stock</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Mínimo</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Costo unit.</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Proveedor</th>
        </tr>
        ${alertas.map(m => `
        <tr style="border-top:1px solid #f0ebe0;">
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;font-weight:600;">
            ${m.stock_actual === 0 ? '🚨 ' : '⚠️ '}${m.nombre}
          </td>
          <td style="padding:10px 12px;font-size:13px;color:${m.stock_actual === 0 ? '#dc2626' : '#d97706'};font-weight:700;">${m.stock_actual} ${m.unidad}</td>
          <td style="padding:10px 12px;font-size:13px;color:#555;">${m.stock_minimo} ${m.unidad}</td>
          <td style="padding:10px 12px;font-size:13px;color:#C9A84C;font-weight:600;">${fmt(m.costo_unitario)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#555;">${m.proveedor || '—'}</td>
        </tr>`).join('')}
      </table>` : `
      <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:16px 20px;border-radius:0 6px 6px 0;margin-bottom:28px;">
        <p style="margin:0;color:#16a34a;font-size:14px;font-weight:600;">✓ Inventario de stock en niveles correctos</p>
      </div>`}

      <!-- Pedidos activos -->
      ${pedidos && pedidos.length > 0 ? `
      <p style="margin:0 0 10px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #C9A84C;padding-bottom:6px;">🛋️ PEDIDOS EN PRODUCCIÓN</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr style="background:#f9f6f0;">
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Pedido</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Cliente</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Producto</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Estado</th>
          <th style="padding:10px 12px;font-size:12px;color:#666;text-align:left;">Entrega</th>
        </tr>
        ${pedidos.map(p => {
          const dias = Math.ceil((new Date(p.fecha_entrega) - new Date()) / (1000 * 60 * 60 * 24))
          const color = dias < 0 ? '#dc2626' : dias <= 3 ? '#d97706' : '#555'
          return `
          <tr style="border-top:1px solid #f0ebe0;">
            <td style="padding:10px 12px;font-size:13px;color:#6d28d9;font-weight:700;">${p.numero}</td>
            <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${p.cliente?.nombre || '—'}</td>
            <td style="padding:10px 12px;font-size:13px;color:#555;">${p.tipo_sofa}</td>
            <td style="padding:10px 12px;font-size:12px;color:#555;">${p.estado}</td>
            <td style="padding:10px 12px;font-size:13px;color:${color};font-weight:600;">
              ${dias < 0 ? 'Vencido' : dias === 0 ? 'Hoy' : `${dias} días`}
            </td>
          </tr>`
        }).join('')}
      </table>` : ''}

      <div style="background:#f9f6f0;border-left:3px solid #C9A84C;padding:16px 20px;border-radius:0 6px 6px 0;">
        <p style="margin:0;color:#555;font-size:13px;">
          Ver detalle completo en: <a href="https://mrchester-produccion.vercel.app" style="color:#6d28d9;font-weight:600;">mrchester-produccion.vercel.app</a>
        </p>
      </div>
    </td>
  </tr>

  <tr>
    <td style="background:#111;padding:20px 40px;text-align:center;border-radius:0 0 8px 8px;">
      <p style="margin:0;color:#C9A84C;font-size:10px;letter-spacing:2px;">MR. CHESTER EXPORT S.A.S.</p>
      <p style="margin:4px 0 0;color:#444;font-size:11px;">Resumen automático diario · Sistema ERP</p>
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
      subject: `📋 Resumen del día — ${fecha} · Mr. Chester`,
      html,
    })
    res.status(200).json({ ok: true, alertas: alertas.length, pedidos: pedidos?.length || 0 })
  } catch (error) {
    console.error('Error enviando resumen:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}
