// Archivo: src/pages/api/resumen-diario.js
// Cron: todos los días a las 8 a. m. Colombia (13:00 UTC). Correo a Joseph con:
// lo que toca comprar hoy (por proveedor) y los pedidos en producción.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { normalizar, linkSemanaJefe } from '@/lib/etapas'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM || 'Mr. Chester Sofás <pedidos@envios.mrchester.com.co>'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const num = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function hoyISO() { return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10) }
function fechaTexto(iso) { const d = new Date(iso + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` }
function totalProv(p) { return (p.insumos || []).reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0) + Number(p.costo_fijo || 0) }

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end()

  const hoy = hoyISO()
  const dia = new Date(hoy + 'T12:00:00Z').getUTCDay()

  const [{ data: provs }, { data: pedidos }] = await Promise.all([
    supabase.from('compra_proveedores').select('*, insumos:compra_insumos(*)').eq('activo', true).order('orden'),
    supabase.from('pedidos').select('*, cliente:clientes(nombre)')
      .in('estado', ['pendiente', 'estructura', 'tapizado', 'costura', 'control_calidad'])
      .order('fecha_entrega', { ascending: true }),
  ])
  // Los lunes: botón para mandarle a Luis (jefe de producción) la programación de la semana por WhatsApp
  let bloqueLuis = ''
  if (dia === 1) {
    const { data: prog } = await supabase.from('programacion_produccion')
      .select('*, pedido:pedidos(numero, tipo_sofa, material, cantidad, fecha_entrega, prioridad, estado)')
      .neq('etapa_actual', 'completado')
    const items = (prog || []).filter(f => f.pedido && !['entregado', 'cancelado'].includes(f.pedido.estado)).map(normalizar)
    const n = items.filter(it => it.dia >= hoy && it.dia <= new Date(new Date(hoy + 'T12:00:00Z').getTime() + 5 * 86400000).toISOString().slice(0, 10)).length
    bloqueLuis = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;"><tr>
        <td style="padding:18px 20px;text-align:center;">
          <p style="margin:0 0 6px;color:#166534;font-size:12px;letter-spacing:2px;font-weight:700;">📅 PROGRAMACIÓN DE LA SEMANA PARA LUIS</p>
          <p style="margin:0 0 14px;color:#166534;font-size:14px;">${n} pedido${n === 1 ? '' : 's'} programado${n === 1 ? '' : 's'} esta semana. Toca el botón y dale enviar en WhatsApp.</p>
          <a href="${linkSemanaJefe(items, hoy)}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:6px;">ENVIAR A LUIS POR WHATSAPP</a>
        </td></tr></table>`
  }

  const deHoy = (provs || []).filter(p => (p.dias || []).includes(dia))
    .map(p => ({ ...p, insumos: (p.insumos || []).filter(i => i.activo).sort((a, b) => a.orden - b.orden) }))
  const totalHoy = deHoy.reduce((s, p) => s + totalProv(p), 0)

  const bloqueCompras = deHoy.length === 0
    ? `<div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:18px 22px;margin-bottom:28px;"><p style="margin:0;color:#16a34a;font-size:15px;font-weight:600;">✓ Hoy no hay compras programadas</p></div>`
    : deHoy.map(p => `
      <div style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;"><tr>
          <td style="padding:12px 18px;color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:1px;">${esc(p.nombre).toUpperCase()}${p.contacto ? `<br><span style="color:#999;font-weight:400;letter-spacing:0;">${esc(p.contacto)}${p.whatsapp ? ' · ' + esc(p.whatsapp) : ''}</span>` : ''}</td>
          <td style="padding:12px 18px;color:#fff;font-size:15px;font-weight:700;text-align:right;">${pesos(totalProv(p))}</td>
        </tr></table>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${p.insumos.map(i => `<tr style="border-top:1px solid #f0ebe0;">
            <td style="padding:9px 18px;font-size:13px;color:#1a1a1a;">${num(i.cantidad)} ${esc(i.unidad || '')} · ${esc(i.nombre)}</td>
            <td style="padding:9px 18px;font-size:13px;color:#555;text-align:right;">${pesos(i.precio * i.cantidad)}</td></tr>`).join('')}
          ${Number(p.costo_fijo) > 0 ? `<tr style="border-top:1px solid #f0ebe0;"><td style="padding:9px 18px;font-size:13px;color:#555;">${esc(p.costo_fijo_nombre || 'Transporte')}</td><td style="padding:9px 18px;font-size:13px;color:#555;text-align:right;">${pesos(p.costo_fijo)}</td></tr>` : ''}
        </table>
      </div>`).join('') + `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;margin-bottom:28px;"><tr>
        <td style="padding:16px 20px;color:#C9A84C;font-size:12px;letter-spacing:2px;font-weight:700;">TOTAL COMPRAS DE HOY</td>
        <td style="padding:16px 20px;color:#fff;font-size:22px;font-weight:700;text-align:right;">${pesos(totalHoy)}</td>
      </tr></table>
      <p style="margin:0 0 28px;text-align:center;"><a href="https://mrchester-produccion.vercel.app/compras" style="display:inline-block;background:#C9A84C;color:#1a1a1a;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:6px;">PEDIR DESDE EL ERP</a></p>`

  const bloquePedidos = pedidos && pedidos.length ? `
      <p style="margin:0 0 12px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;border-bottom:2px solid #C9A84C;padding-bottom:8px;">🛋️ PEDIDOS EN PRODUCCIÓN (${pedidos.length})</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${pedidos.map(p => {
          const dias = Math.ceil((new Date(p.fecha_entrega + 'T12:00:00Z') - new Date(hoy + 'T12:00:00Z')) / 86400000)
          const color = dias < 0 ? '#dc2626' : dias <= 3 ? '#d97706' : '#555'
          return `<tr style="border-top:1px solid #f0ebe0;">
            <td style="padding:9px 6px;font-size:13px;font-weight:700;">${esc(p.numero)}</td>
            <td style="padding:9px 6px;font-size:13px;">${esc(p.cliente?.nombre || '—')}<br><span style="color:#888;font-size:12px;">${esc(p.tipo_sofa)}</span></td>
            <td style="padding:9px 6px;font-size:13px;color:${color};font-weight:600;text-align:right;">${dias < 0 ? '⚠️ Vencido' : dias === 0 ? '🔴 Hoy' : `${dias} días`}</td></tr>`
        }).join('')}
      </table>` : ''

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:30px 14px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
  <tr><td style="background:#1a1a1a;padding:26px 30px 20px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#C9A84C;font-size:24px;font-weight:700;letter-spacing:4px;font-family:Georgia,serif;">MR. CHESTER</h1>
  </td></tr>
  <tr><td style="background:#C9A84C;padding:10px 30px;text-align:center;">
    <p style="margin:0;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;">🛒 HOY TOCA COMPRAR · ${fechaTexto(hoy).toUpperCase()}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:30px;">${bloqueLuis}${bloqueCompras}${bloquePedidos}</td></tr>
  <tr><td style="background:#111;padding:16px 30px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="margin:0;color:#888;font-size:11px;">Resumen automático · ERP Mr. Chester</p>
  </td></tr>
</table></td></tr></table></body></html>`

  const asunto = deHoy.length
    ? `🛒 Hoy toca comprar: ${deHoy.map(p => p.nombre).join(', ')} · ${pesos(totalHoy)}`
    : `📋 Resumen del ${fechaTexto(hoy)} · sin compras programadas`
  try {
    const { error } = await resend.emails.send({ from: FROM, to: ['josephtoledo@gmail.com'], subject: asunto, html })
    if (error) throw new Error(error.message || String(error))
    res.status(200).json({ ok: true, proveedores: deHoy.length, total: totalHoy })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
