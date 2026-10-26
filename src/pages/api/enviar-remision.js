// Archivo: src/pages/api/enviar-remision.js
// Envía la remisión de despacho al cliente, con copia a Mónica (finanzas) y a Joseph.
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM || 'Mr. Chester Sofás <pedidos@envios.mrchester.com.co>'
const COPIAS = ['bensour81@hotmail.com', 'josephtoledo@gmail.com']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
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
    <p style="margin:0;color:#555;font-size:11px;font-family:Arial,sans-serif;">Fábrica: Calle 161 #92-21 · Centro de Experiencia: Cra 19A #85-69, Bogotá</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { remision, cliente } = req.body || {}
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
  const nota = `<p style="font-family:Arial,sans-serif;font-size:13px;background:#fff3cd;padding:10px;margin:0;">Copia de despacho · ${esc(cliente?.nombre)} · ${cliente_ok ? '✅ enviada al cliente' : cliente?.email ? '⚠️ no llegó al cliente: ' + esc(error) : 'el cliente no tiene correo'}</p>`
  const copias = await enviar(COPIAS, `[Despacho] ${remision.numero} · ${cliente?.nombre || ''} · ${pesos(remision.total)}`, nota + cuerpo)
  res.status(200).json({ ok: cliente_ok || !cliente?.email, cliente_ok, copias_ok: copias.ok, error })
}
