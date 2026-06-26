// Archivo: src/pages/api/resumen-diario.js
// Cron: todos los días a las 8am Colombia (13:00 UTC)

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const fmt   = (n) => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

  // 1. Materiales bajo mínimo
  const { data: materiales } = await supabase.from('materiales').select('*').eq('tipo', 'stock').order('proveedor')
  const alertas = (materiales || []).filter(m => m.stock_actual < m.stock_minimo)

  // 2. Pedidos activos
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('*, cliente:clientes(nombre)')
    .in('estado', ['pendiente', 'estructura', 'tapizado', 'costura', 'control_calidad'])
    .order('fecha_entrega', { ascending: true })

  // 3. Agrupar alertas por proveedor
  const porProveedor = {}
  for (const m of alertas) {
    const prov = m.proveedor || 'Sin proveedor'
    if (!porProveedor[prov]) porProveedor[prov] = []
    const cantComprar = m.stock_minimo - m.stock_actual
    porProveedor[prov].push({ ...m, cant_comprar: cantComprar, subtotal: cantComprar * m.costo_unitario })
  }

  const totalGeneral = alertas.reduce((s, m) => {
    const cant = m.stock_minimo - m.stock_actual
    return s + cant * m.costo_unitario
  }, 0)

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 20px;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:#1a1a1a;padding:32px 40px 24px;text-align:center;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;color:#C9A84C;font-size:26px;font-weight:700;letter-spacing:4px;">MR. CHESTER</h1>
      <p style="margin:6px 0 0;color:#C9A84C;font-size:10px;letter-spacing:3px;">SOFÁS QUE HABLAN DE TI.</p>
      <div style="width:40px;height:1px;background:#C9A84C;margin:12px auto 0;"></div>
    </td>
  </tr>

  <tr>
    <td style="background:#C9A84C;padding:10px 40px;text-align:center;">
      <p style="margin:0;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;">📋 RESUMEN DIARIO · ORDEN DE COMPRA · 8:00 AM</p>
    </td>
  </tr>

  <tr>
    <td style="background:#fff;padding:40px;">
      <p style="margin:0 0 28px;color:#888;font-size:13px;text-transform:capitalize;">${fecha}</p>

      <!-- Tarjetas resumen -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
        <tr>
          <td style="text-align:center;padding:16px;background:#f9f6f0;border-radius:8px;width:25%;">
            <p style="margin:0;font-size:26px;font-weight:700;color:#6d28d9;">${pedidos?.length || 0}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888;">Pedidos activos</p>
          </td>
          <td style="width:10px;"></td>
          <td style="text-align:center;padding:16px;background:${alertas.length > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;width:25%;">
            <p style="margin:0;font-size:26px;font-weight:700;color:${alertas.length > 0 ? '#dc2626' : '#16a34a'};">${alertas.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888;">Items a comprar</p>
          </td>
          <td style="width:10px;"></td>
          <td style="text-align:center;padding:16px;background:#f9f6f0;border-radius:8px;width:25%;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#C9A84C;">${fmt(totalGeneral)}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888;">Total a invertir</p>
          </td>
          <td style="width:10px;"></td>
          <td style="text-align:center;padding:16px;background:#f9f6f0;border-radius:8px;width:25%;">
            <p style="margin:0;font-size:26px;font-weight:700;color:#1a1a1a;">${Object.keys(porProveedor).length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888;">Proveedores</p>
          </td>
        </tr>
      </table>

      ${alertas.length === 0 ? `
      <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:20px 24px;border-radius:0 8px 8px 0;margin-bottom:32px;">
        <p style="margin:0;color:#16a34a;font-size:15px;font-weight:600;">✓ Inventario completo — No hay compras pendientes hoy</p>
      </div>` : `

      <!-- Órdenes por proveedor -->
      <p style="margin:0 0 20px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #C9A84C;padding-bottom:8px;">🛒 ÓRDENES DE COMPRA POR PROVEEDOR</p>

      ${Object.entries(porProveedor).map(([prov, items]) => {
        const totalProv = items.reduce((s, i) => s + i.subtotal, 0)
        return `
        <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <div style="background:#1a1a1a;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <p style="margin:0;color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:1px;">${prov.toUpperCase()}</p>
              <p style="margin:2px 0 0;color:#888;font-size:11px;">${items.length} material(es)</p>
            </div>
            <p style="margin:0;color:#fff;font-size:15px;font-weight:700;">${fmt(totalProv)}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr style="background:#f9f6f0;">
              <th style="padding:10px 16px;font-size:11px;color:#666;text-align:left;font-weight:600;">MATERIAL</th>
              <th style="padding:10px 16px;font-size:11px;color:#666;text-align:center;font-weight:600;">STOCK ACTUAL</th>
              <th style="padding:10px 16px;font-size:11px;color:#666;text-align:center;font-weight:600;">MÍNIMO</th>
              <th style="padding:10px 16px;font-size:11px;color:#666;text-align:center;font-weight:600;">A COMPRAR</th>
              <th style="padding:10px 16px;font-size:11px;color:#666;text-align:right;font-weight:600;">COSTO UNIT.</th>
              <th style="padding:10px 16px;font-size:11px;color:#666;text-align:right;font-weight:600;">SUBTOTAL</th>
            </tr>
            ${items.map((m, i) => `
            <tr style="border-top:1px solid #f0ebe0;background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
              <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;font-weight:600;">
                ${m.stock_actual === 0 ? '<span style="color:#dc2626;margin-right:4px;">🚨</span>' : '<span style="margin-right:4px;">⚠️</span>'}${m.nombre}
                <span style="color:#999;font-size:11px;margin-left:4px;">(${m.unidad})</span>
              </td>
              <td style="padding:12px 16px;font-size:13px;color:${m.stock_actual === 0 ? '#dc2626' : '#d97706'};font-weight:600;text-align:center;">${m.stock_actual}</td>
              <td style="padding:12px 16px;font-size:13px;color:#555;text-align:center;">${m.stock_minimo}</td>
              <td style="padding:12px 16px;font-size:14px;color:#1a1a1a;font-weight:700;text-align:center;">${m.cant_comprar} ${m.unidad}</td>
              <td style="padding:12px 16px;font-size:13px;color:#555;text-align:right;">${fmt(m.costo_unitario)}</td>
              <td style="padding:12px 16px;font-size:13px;color:#C9A84C;font-weight:700;text-align:right;">${fmt(m.subtotal)}</td>
            </tr>`).join('')}
            <tr style="border-top:2px solid #C9A84C;background:#f9f6f0;">
              <td colspan="5" style="padding:12px 16px;font-size:13px;color:#1a1a1a;font-weight:700;text-align:right;">TOTAL ${prov.toUpperCase()}</td>
              <td style="padding:12px 16px;font-size:15px;color:#C9A84C;font-weight:700;text-align:right;">${fmt(totalProv)}</td>
            </tr>
          </table>
        </div>`
      }).join('')}

      <!-- Total general -->
      <div style="background:#1a1a1a;padding:20px 24px;border-radius:8px;margin-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#888;font-size:13px;">Total proveedores: <b style="color:#fff;">${Object.keys(porProveedor).length}</b></td>
            <td style="color:#888;font-size:13px;text-align:center;">Total ítems: <b style="color:#fff;">${alertas.length}</b></td>
            <td style="text-align:right;">
              <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:1px;">INVERSIÓN TOTAL</p>
              <p style="margin:4px 0 0;color:#fff;font-size:24px;font-weight:700;">${fmt(totalGeneral)}</p>
            </td>
          </tr>
        </table>
      </div>`}

      <!-- Pedidos activos -->
      ${pedidos && pedidos.length > 0 ? `
      <p style="margin:0 0 12px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #C9A84C;padding-bottom:8px;">🛋️ PEDIDOS EN PRODUCCIÓN (${pedidos.length})</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr style="background:#f9f6f0;">
          <th style="padding:10px 12px;font-size:11px;color:#666;text-align:left;">PEDIDO</th>
          <th style="padding:10px 12px;font-size:11px;color:#666;text-align:left;">CLIENTE</th>
          <th style="padding:10px 12px;font-size:11px;color:#666;text-align:left;">PRODUCTO</th>
          <th style="padding:10px 12px;font-size:11px;color:#666;text-align:left;">ESTADO</th>
          <th style="padding:10px 12px;font-size:11px;color:#666;text-align:right;">ENTREGA</th>
        </tr>
        ${pedidos.map((p, i) => {
          const dias = Math.ceil((new Date(p.fecha_entrega) - new Date()) / (1000 * 60 * 60 * 24))
          const color = dias < 0 ? '#dc2626' : dias <= 3 ? '#d97706' : '#555'
          return `
          <tr style="border-top:1px solid #f0ebe0;background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
            <td style="padding:10px 12px;font-size:13px;color:#6d28d9;font-weight:700;">${p.numero}</td>
            <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${p.cliente?.nombre || '—'}</td>
            <td style="padding:10px 12px;font-size:13px;color:#555;">${p.tipo_sofa}</td>
            <td style="padding:10px 12px;font-size:12px;color:#555;text-transform:capitalize;">${p.estado.replace('_', ' ')}</td>
            <td style="padding:10px 12px;font-size:13px;color:${color};font-weight:600;text-align:right;">
              ${dias < 0 ? '⚠️ Vencido' : dias === 0 ? '🔴 Hoy' : `${dias} días`}
            </td>
          </tr>`
        }).join('')}
      </table>` : ''}

      <div style="background:#f9f6f0;border-left:3px solid #C9A84C;padding:16px 20px;border-radius:0 6px 6px 0;">
        <p style="margin:0;color:#555;font-size:13px;">
          Ver sistema completo: <a href="https://mrchester-produccion.vercel.app" style="color:#6d28d9;font-weight:600;">mrchester-produccion.vercel.app</a>
        </p>
      </div>
    </td>
  </tr>

  <tr>
    <td style="background:#111;padding:20px 40px;text-align:center;border-radius:0 0 8px 8px;">
      <p style="margin:0;color:#C9A84C;font-size:10px;letter-spacing:2px;">MR. CHESTER EXPORT S.A.S.</p>
      <p style="margin:4px 0 0;color:#444;font-size:11px;">Resumen automático diario · Sistema ERP · ${fecha}</p>
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
      subject: `📋 Orden de compra del día — ${fecha} · Mr. Chester`,
      html,
    })
    res.status(200).json({ ok: true, alertas: alertas.length, pedidos: pedidos?.length || 0, total: totalGeneral })
  } catch (error) {
    console.error('Error enviando resumen:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}