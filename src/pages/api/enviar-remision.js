// Archivo: src/pages/api/enviar-remision.js
// Envía la remisión de despacho al cliente. A Mónica (finanzas) y a Joseph les llega aparte
// un resumen de cómo pagó el cliente: abono, medios de pago, saldo y lo cobrado en el despacho.
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM || 'Mr. Chester Sofás <pedidos@envios.mrchester.com.co>'
const COPIAS = ['bensour81@hotmail.com', 'josephtoledo@gmail.com']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MEDIO = { efectivo: 'Efectivo', transferencia: 'Transferencia bancaria', tarjeta_credito: 'Tarjeta crédito', tarjeta_debito: 'Tarjeta débito', nequi: 'Nequi', daviplata: 'Daviplata' }
const CANAL = { tienda_85: 'Tienda 85', whatsapp: 'WhatsApp', instagram: 'Instagram', falabella: 'Falabella', web: 'Página web', shopify: 'Página web' }
const medio = m => MEDIO[m] || (m ? String(m) : 'Sin registrar')
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function fecha(iso) { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}` }

function html(r, c) {
  const td = 'padding:12px 0;border-bottom:1px solid #f0ebe0;font-family:Arial,sans-serif;'
  const fila = (k, v, extra = '') => `<tr><td style="${td}font-size:13px;color:#888;width:42%;">${k}</td><td style="${td}font-size:14px;color:#1a1a1a;${extra}">${v}</td></tr>`
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Remisión ${esc(r.numero)}</title></head>
<body style="margin:0;padding:0;background:#f4f1eb;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 16px;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
  <tr><td style="background:#1a1a1a;padding:34px 40px 26px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#C9A84C;font-size:30px;font-weight:700;letter-spacing:6px;font-family:Georgia,serif;">MR. CHESTER</h1>
    <p style="margin:6px 0 0;color:#C9A84C;font-size:11px;letter-spacing:4px;font-family:Arial,sans-serif;">SOFÁS QUE HABLAN DE TI.</p>
  </td></tr>
  <tr><td style="background:#C9A84C;padding:12px 40px;text-align:center;">
    <p style="margin:0;color:#1a1a1a;font-size:12px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;">REMISIÓN DE DESPACHO</p>
  </td></tr>
  <tr><td style="background:#fff;padding:40px;">
    <h2 style="margin:0 0 14px;color:#1a1a1a;font-size:22px;font-family:Georgia,serif;font-weight:normal;">${esc((c?.nombre || '').split(' ')[0])}, ¡tu pedido fue entregado!</h2>
    <p style="color:#555;font-size:14px;line-height:1.8;margin:0 0 26px;font-family:Arial,sans-serif;">Gracias por confiar en <strong>Mr. Chester</strong>. Esta es la remisión de tu entrega.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;"><tr>
      <td style="background:#1a1a1a;border-left:4px solid #C9A84C;padding:18px 24px;border-radius:4px;text-align:center;">
        <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;">REMISIÓN</p>
        <p style="margin:6px 0 0;color:#fff;font-size:32px;font-weight:700;font-family:Georgia,serif;letter-spacing:2px;">${esc(r.numero)}</p>
      </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${fila('Cliente', esc(c?.nombre || '—'), 'font-weight:600;')}
      ${c?.cedula ? fila(c.tipo_documento === 'NIT' ? 'NIT' : 'Cédula', esc(c.cedula + (c.tipo_documento === 'NIT' && c.dv ? '-' + c.dv : ''))) : ''}
      ${c?.direccion ? fila('Dirección', esc(c.direccion + (c.ciudad ? ', ' + c.ciudad : ''))) : ''}
      ${(r.items || []).map(i => fila(esc(i.numero), `<strong>${esc(i.tipo_sofa)}</strong>${i.cantidad > 1 ? ' × ' + i.cantidad : ''}<br><span style="color:#888;font-size:12px;">Tela: ${esc(i.material)}</span>`)).join('')}
      ${fila('Fecha de entrega', fecha(r.fecha), 'font-weight:600;')}
      ${fila('Entregó', esc(r.entregado_por || '—'))}
      ${r.observaciones ? fila('Observaciones', esc(r.observaciones)) : ''}
      ${fila('Valor total', pesos(r.total), 'font-size:18px;color:#C9A84C;font-family:Georgia,serif;font-weight:700;')}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#2f7a4c;border-radius:8px;margin-bottom:26px;"><tr>
      <td style="padding:16px 20px;text-align:center;color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;">✓ PAGADO ${pesos(r.pagado)} · PAZ Y SALVO</td>
    </tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-left:3px solid #C9A84C;"><tr><td style="padding:16px 20px;font-family:Arial,sans-serif;">
      <p style="margin:0 0 8px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-weight:700;">GARANTÍA</p>
      <p style="margin:0;color:#555;font-size:13px;line-height:1.7;">Tu sofá tiene <strong>5 años de garantía</strong> sobre estructura y defectos de fabricación. Si necesitas algo, escríbenos al WhatsApp 320 277 4320 con el número de esta remisión.</p>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#111;padding:20px 40px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 4px;color:#C9A84C;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;">MR. CHESTER EXPORT S.A.S.</p>
    <p style="margin:0;color:#555;font-size:11px;font-family:Arial,sans-serif;">Fábrica: Cra 99 #155-21 · Centro de Experiencia: Cra 19A #85-69, Bogotá</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

// Correo para finanzas: cómo se pagó cada producto de este despacho
function htmlFinanzas(r, c, f, estadoCliente) {
  const pedidos = f?.pedidos || [], pagos = f?.pagos || []
  const td = 'padding:8px 10px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;'
  const th = 'padding:8px 10px;background:#f4f1eb;font-family:Arial,sans-serif;font-size:11px;color:#666;text-align:left;letter-spacing:1px;'
  const der = 'text-align:right;white-space:nowrap;'
  let total = 0, inicial = 0, despues = 0, enDespacho = 0
  const bloques = pedidos.map(p => {
    const pv = Number(p.precio_venta || 0), ab = Number(p.abono || 0)
    const suyos = pagos.filter(x => x.pedido_id === p.id)
    const sumaPagos = suyos.reduce((a, x) => a + Number(x.valor || 0), 0)
    const abonoVenta = Math.max(0, ab - sumaPagos) // lo que se pagó al hacer la venta
    const saldoVenta = Math.max(0, pv - abonoVenta)
    total += pv; inicial += abonoVenta; despues += sumaPagos
    suyos.forEach(x => { if (String(x.fecha) === String(r.fecha).slice(0, 10)) enDespacho += Number(x.valor || 0) })
    const notaPago = String(p.observaciones || '').split(/\n|·/).map(t => t.trim()).filter(t => /pag|abon|saldo|cuota|mercado ?pago|wompi|transfer|nequi|bancolombia|tarjeta|link/i.test(t)).join(' · ')
    const filas = [
      `<tr><td style="${td}">${p.fecha_pedido ? fecha(p.fecha_pedido) : '—'}</td><td style="${td}">Abono al hacer la venta</td><td style="${td}">${esc(medio(p.medio_pago))}</td><td style="${td}${der}">${pesos(abonoVenta)}</td></tr>`,
      ...suyos.map(x => `<tr><td style="${td}">${fecha(x.fecha)}</td><td style="${td}">${String(x.fecha) === String(r.fecha).slice(0, 10) ? '<b>Pago del saldo en el despacho</b>' : 'Pago posterior'}${x.nota ? ' · ' + esc(x.nota) : ''}</td><td style="${td}">${esc(medio(x.medio_pago))}</td><td style="${td}${der}">${pesos(x.valor)}</td></tr>`),
    ].join('')
    return `
      <p style="margin:22px 0 6px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;"><b>${esc(p.numero)} · ${esc(p.tipo_sofa)}${p.cantidad > 1 ? ' × ' + p.cantidad : ''}</b>
        <span style="color:#888;font-size:12px;"> · ${esc(CANAL[p.canal] || p.canal || 'canal sin registrar')}${p.factura_iva ? ' · con factura IVA' : ''}</span></p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;border-collapse:separate;">
        <tr><td style="${td}">Valor de venta</td><td style="${td}${der}" colspan="3"><b>${pesos(pv)}</b></td></tr>
        <tr><td style="${td}">Saldo que quedó después de la venta</td><td style="${td}${der}" colspan="3">${pesos(saldoVenta)}</td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <tr><th style="${th}">FECHA</th><th style="${th}">PAGO</th><th style="${th}">MEDIO</th><th style="${th}${der}">VALOR</th></tr>${filas}
        <tr><td style="${td}" colspan="3"><b>Pagado en total</b></td><td style="${td}${der}"><b>${pesos(ab)}</b></td></tr>
      </table>
      ${notaPago ? `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#555;">📝 ${esc(notaPago)}</p>` : ''}`
  }).join('')
  const pagado = inicial + despues, saldo = Math.max(0, total - pagado)
  const caja = (k, v, color = '#1a1a1a') => `<td style="padding:10px;text-align:center;font-family:Arial,sans-serif;"><div style="font-size:11px;color:#888;letter-spacing:1px;">${k}</div><div style="font-size:18px;font-weight:700;color:${color};margin-top:4px;">${v}</div></td>`
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Despacho ${esc(r.numero)}</title></head>
<body style="margin:0;padding:0;background:#f4f1eb;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:28px 12px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:8px;">
  <tr><td style="background:#1a1a1a;padding:20px 28px;border-radius:8px 8px 0 0;">
    <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;">FINANZAS · DESPACHO</p>
    <p style="margin:6px 0 0;color:#fff;font-size:20px;font-family:Georgia,serif;">${esc(r.numero)} · ${esc(c?.nombre || 'Sin cliente')}</p>
    <p style="margin:4px 0 0;color:#bbb;font-size:12px;font-family:Arial,sans-serif;">Despachado el ${fecha(r.fecha)} · entregó ${esc(r.entregado_por || '—')}${c?.cedula ? ' · ' + (c.tipo_documento === 'NIT' ? 'NIT ' : 'CC ') + esc(c.cedula) : ''}</p>
  </td></tr>
  <tr><td style="padding:18px 28px 6px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:6px;"><tr>
      ${caja('VALOR TOTAL', pesos(total))}${caja('ABONO EN LA VENTA', pesos(inicial))}${caja('COBRADO EN DESPACHO', pesos(enDespacho), '#2f7a4c')}${caja('SALDO HOY', pesos(saldo), saldo > 0 ? '#b42318' : '#2f7a4c')}
    </tr></table>
    ${saldo > 0 ? `<p style="margin:10px 0 0;padding:10px;background:#fdecea;color:#b42318;font-family:Arial,sans-serif;font-size:13px;border-radius:6px;">⚠️ Se despachó con saldo pendiente de <b>${pesos(saldo)}</b>.</p>` : `<p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#2f7a4c;">✓ Paz y salvo.</p>`}
  </td></tr>
  <tr><td style="padding:0 28px 24px;">${bloques || '<p style="font-family:Arial,sans-serif;font-size:13px;color:#888;">No se encontraron los pagos de este despacho.</p>'}
    <p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888;">Remisión al cliente: ${estadoCliente}</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { remision, cliente, finanzas } = req.body || {}
  if (!remision?.numero) return res.status(200).json({ ok: false, error: 'Sin datos' })
  const cuerpo = html(remision, cliente)
  const subject = `Remisión ${remision.numero} — tu pedido Mr. Chester fue entregado`

  async function enviar(to, subj, body) {
    try {
      const { error } = await resend.emails.send({ from: FROM, to, subject: subj, html: body })
      return error ? { ok: false, error: error.message || String(error) } : { ok: true }
    } catch (e) { return { ok: false, error: e.message } }
  }

  let cliente_ok = false, error = null
  if (cliente?.email) { const r = await enviar([cliente.email], subject, cuerpo); cliente_ok = r.ok; error = r.error || null }
  const estadoCliente = cliente_ok ? '✅ enviada al cliente' : cliente?.email ? '⚠️ no le llegó al cliente: ' + esc(error) : 'el cliente no tiene correo'
  const copias = finanzas
    ? await enviar(COPIAS, `[Finanzas · Despacho] ${remision.numero} · ${cliente?.nombre || ''} · ${pesos(remision.total)}`, htmlFinanzas(remision, cliente, finanzas, estadoCliente))
    : await enviar(COPIAS, `[Despacho] ${remision.numero} · ${cliente?.nombre || ''} · ${pesos(remision.total)}`, `<p style="font-family:Arial,sans-serif;font-size:13px;background:#fff3cd;padding:10px;margin:0;">Copia de despacho · ${esc(cliente?.nombre)} · ${estadoCliente}</p>` + cuerpo)
  res.status(200).json({ ok: cliente_ok || !cliente?.email, cliente_ok, copias_ok: copias.ok, error })
}
