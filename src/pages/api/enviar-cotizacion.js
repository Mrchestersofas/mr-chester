// Archivo: src/pages/api/enviar-cotizacion.js
// Envía la cotización al cliente por correo, con copia a Joseph.
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM || 'Mr. Chester Sofás <pedidos@envios.mrchester.com.co>'
const COPIA = 'josephtoledo@gmail.com'
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function hoyBogota(d) { return new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10) }
function fecha(iso) { const [y, m, d] = iso.split('-').map(Number); return `${d} de ${MES[m - 1]} de ${y}` }
function venceEl(c) {
  const base = new Date(hoyBogota(new Date(c.created_at || Date.now())) + 'T12:00:00Z')
  base.setUTCDate(base.getUTCDate() + Number(c.vigencia_dias || 8))
  return base.toISOString().slice(0, 10)
}

function html(c, cliente) {
  const td = 'padding:14px 0;border-bottom:1px solid #f0ebe0;font-family:Arial,sans-serif;'
  const filas = (c.items || []).map(it => `
        <tr>
          <td style="${td}font-size:14px;color:#1a1a1a;">
            <strong>${esc(it.referencia)}</strong>${it.cantidad > 1 ? ` × ${it.cantidad}` : ''}
            ${it.tela ? `<br><span style="color:#888;font-size:12px;">Tela: ${esc(it.tela)}</span>` : ''}
            ${it.detalle ? `<br><span style="color:#888;font-size:12px;">${esc(it.detalle)}</span>` : ''}
            ${it.cantidad > 1 ? `<br><span style="color:#888;font-size:12px;">${pesos(it.precio)} c/u</span>` : ''}
          </td>
          <td style="${td}font-size:14px;color:#1a1a1a;text-align:right;vertical-align:top;white-space:nowrap;">${pesos(it.precio * it.cantidad)}</td>
        </tr>`).join('')
  const subtotal = (c.items || []).reduce((s, it) => s + it.precio * it.cantidad, 0)
  const desc = Number(c.descuento) > 0

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Cotización ${esc(c.numero)} - Mr. Chester</title></head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1eb;padding:40px 20px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <tr><td style="background-color:#1a1a1a;padding:36px 40px 28px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#C9A84C;font-size:32px;font-weight:700;letter-spacing:6px;font-family:Georgia,serif;">MR. CHESTER</h1>
    <p style="margin:6px 0 0;color:#C9A84C;font-size:11px;letter-spacing:4px;font-family:Arial,sans-serif;">SOFÁS QUE HABLAN DE TI.</p>
  </td></tr>
  <tr><td style="background-color:#C9A84C;padding:12px 40px;text-align:center;">
    <p style="margin:0;color:#1a1a1a;font-size:12px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;">COTIZACIÓN</p>
  </td></tr>

  <tr><td style="background-color:#ffffff;padding:44px 40px 36px;">
    <p style="margin:0 0 6px;color:#888;font-size:13px;font-family:Arial,sans-serif;">Hola ${esc((cliente?.nombre || '').split(' ')[0])},</p>
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:22px;font-family:Georgia,serif;font-weight:normal;">Gracias por tu interés en Mr. Chester.</h2>
    <p style="color:#555;font-size:14px;line-height:1.8;margin:0 0 28px;font-family:Arial,sans-serif;">Esta es la cotización que preparamos para ti. Cada pieza se fabrica a mano, a tu medida.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="background-color:#1a1a1a;border-left:4px solid #C9A84C;padding:18px 24px;border-radius:4px;text-align:center;">
        <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;">COTIZACIÓN</p>
        <p style="margin:6px 0 0;color:#ffffff;font-size:32px;font-weight:700;font-family:Georgia,serif;letter-spacing:2px;">${esc(c.numero)}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 4px;color:#1a1a1a;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;border-bottom:1px solid #C9A84C;padding-bottom:8px;">DETALLE</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">${filas}
      ${desc ? `
        <tr><td style="${td}font-size:13px;color:#888;">Subtotal</td><td style="${td}font-size:14px;color:#1a1a1a;text-align:right;">${pesos(subtotal)}</td></tr>
        <tr><td style="${td}font-size:13px;color:#888;">Descuento</td><td style="${td}font-size:14px;color:#2d6a4f;text-align:right;font-weight:600;">− ${pesos(c.descuento)}</td></tr>` : ''}
      <tr>
        <td style="padding:18px 0 0;font-size:13px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:700;letter-spacing:2px;">TOTAL</td>
        <td style="padding:18px 0 0;font-size:24px;color:#C9A84C;font-family:Georgia,serif;font-weight:700;text-align:right;">${pesos(c.total)}</td>
      </tr>
    </table>
    <p style="margin:6px 0 28px;color:#888;font-size:12px;font-family:Arial,sans-serif;text-align:right;">Precios en pesos colombianos</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fbf6e9;border-radius:6px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;text-align:center;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
        ⏳ Esta cotización es válida hasta el <strong>${fecha(venceEl(c))}</strong>
      </td></tr>
    </table>

    ${c.observaciones ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-left:3px solid #C9A84C;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;font-weight:700;">OBSERVACIONES</p>
        <p style="margin:0;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">${esc(c.observaciones).replace(/\n/g, '<br>')}</p>
      </td></tr>
    </table>` : ''}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-left:3px solid #C9A84C;margin-bottom:28px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;font-weight:700;">TEN EN CUENTA</p>
        <p style="margin:0 0 6px;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• La producción inicia al confirmar el pedido con el anticipo.</p>
        <p style="margin:0 0 6px;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• El valor del envío <strong>no está incluido</strong>, salvo indicación expresa.</p>
        <p style="margin:0;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• Garantía de <strong>5 años</strong> sobre estructura y defectos de fabricación.</p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;">
      <tr><td style="padding:26px 24px;text-align:center;">
        <p style="margin:0 0 14px;color:#ffffff;font-size:15px;font-family:Arial,sans-serif;line-height:1.6;">¿Quieres confirmarla o ajustar algo?</p>
        <a href="https://wa.me/573202774320?text=${encodeURIComponent(`Hola, quiero confirmar la cotización ${c.numero}`)}" style="display:inline-block;background:#C9A84C;color:#1a1a1a;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;padding:14px 28px;border-radius:6px;">ESCRÍBENOS POR WHATSAPP</a>
        <p style="margin:12px 0 0;color:#aaa;font-size:12px;font-family:Arial,sans-serif;">WhatsApp Pedidos: 320 277 4320</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background-color:#111;padding:20px 40px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 4px;color:#C9A84C;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;">MR. CHESTER EXPORT S.A.S.</p>
    <p style="margin:0;color:#555;font-size:11px;font-family:Arial,sans-serif;">Centro de Experiencia: Cra 19A #85-69, Bogotá · Instagram @mrchestersofas</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { cotizacion, cliente } = req.body || {}
  if (!cotizacion?.numero) return res.status(200).json({ ok: false, error: 'Sin datos' })

  const cuerpo = html(cotizacion, cliente)
  const subject = `Cotización ${cotizacion.numero} — Mr. Chester Sofás`

  async function enviar(to, subj, body) {
    try {
      const { error } = await resend.emails.send({ from: FROM, to: [to], subject: subj, html: body })
      return error ? { ok: false, error: error.message || String(error) } : { ok: true }
    } catch (e) { return { ok: false, error: e.message } }
  }

  let cliente_ok = false, error = null
  if (cliente?.email) {
    const r = await enviar(cliente.email, subject, cuerpo)
    cliente_ok = r.ok; error = r.error || null
  }
  const nota = `<p style="font-family:Arial,sans-serif;font-size:13px;background:#fff3cd;padding:10px;margin:0;">Copia · ${esc(cliente?.nombre)} · ${cliente_ok ? '✅ enviada a ' + esc(cliente.email) : cliente?.email ? '⚠️ no se pudo enviar al cliente: ' + esc(error) : 'el cliente no tiene correo'}</p>`
  const copia = await enviar(COPIA, `[Copia] ${subject}`, nota + cuerpo)

  res.status(200).json({ ok: cliente_ok || !cliente?.email, cliente_ok, copia_ok: copia.ok, error })
}
