// Archivo: src/pages/api/aviso-despacho.js
// Lo llama la base de datos (Supabase) cuando un pedido pasa a la etapa "despacho".
// Le manda al cliente un correo avisando que su sofá está listo, con copia a Joseph.
// La función reclamar_aviso_despacho garantiza que cada pedido se avise una sola vez.
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const FROM = process.env.RESEND_FROM || 'Mr. Chester Sofás <pedidos@envios.mrchester.com.co>'
const COPIA = 'josephtoledo@gmail.com'
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fecha(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return `${d} de ${MES[m - 1]} de ${y}`
}

function esc(t) {
  return String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function correo(p) {
  const nombre = esc((p.nombre || '').split(' ')[0] || 'Hola')
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Tu sofá está listo - Mr. Chester</title></head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1eb;padding:40px 20px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <tr><td style="background-color:#1a1a1a;padding:36px 40px 28px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#C9A84C;font-size:32px;font-weight:700;letter-spacing:6px;font-family:Georgia,serif;">MR. CHESTER</h1>
    <p style="margin:6px 0 0;color:#C9A84C;font-size:11px;letter-spacing:4px;font-family:Arial,sans-serif;">SOFÁS QUE HABLAN DE TI.</p>
  </td></tr>

  <tr><td style="background-color:#C9A84C;padding:12px 40px;text-align:center;">
    <p style="margin:0;color:#1a1a1a;font-size:12px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;">TU SOFÁ ESTÁ LISTO</p>
  </td></tr>

  <tr><td style="background-color:#ffffff;padding:44px 40px 36px;">
    <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:24px;font-family:Georgia,serif;font-weight:normal;">${nombre}, ¡tu sofá ya está listo! 🎉</h2>
    <p style="color:#555;font-size:15px;line-height:1.8;margin:0 0 28px;font-family:Arial,sans-serif;">
      Terminamos de fabricarlo y pasó nuestro control de calidad. Ahora está listo para despacho.
      <strong>Muy pronto te contactaremos para coordinar el día y la hora de entrega.</strong>
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;width:45%;">Pedido</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:600;">${esc(p.numero)}</td></tr>
      <tr><td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Producto</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${esc(p.sofa)}${p.cantidad > 1 ? ' × ' + p.cantidad : ''}</td></tr>
      ${p.material ? `<tr><td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Tela</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${esc(p.material)}</td></tr>` : ''}
      ${p.fecha_entrega ? `<tr><td style="padding:12px 0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Fecha estimada de entrega</td>
          <td style="padding:12px 0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:600;">${fecha(p.fecha_entrega)}</td></tr>` : ''}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-left:3px solid #C9A84C;margin-bottom:28px;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 8px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;font-weight:700;">ANTES DE LA ENTREGA</p>
        <p style="margin:0 0 6px;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• Recuerda que el saldo debe estar cancelado antes del despacho.</p>
        <p style="margin:0;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• Verifica que el sofá pueda ingresar por puertas, escaleras y ascensor.</p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;">
      <tr><td style="padding:26px 24px;text-align:center;">
        <a href="https://seguimiento.mrchester.com.co" style="display:inline-block;background:#C9A84C;color:#1a1a1a;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;padding:14px 28px;border-radius:6px;">VER EL ESTADO DE MI SOFÁ</a>
        <p style="margin:12px 0 0;color:#aaa;font-size:12px;font-family:Arial,sans-serif;">¿Preguntas? WhatsApp Pedidos: 320 277 4320</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background-color:#111;padding:20px 40px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 4px;color:#C9A84C;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;">MR. CHESTER EXPORT S.A.S.</p>
    <p style="margin:0;color:#555;font-size:11px;font-family:Arial,sans-serif;">Centro de Experiencia: Cra 19A #85-69, Bogotá</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const pedidoId = req.body?.pedido_id
  if (!pedidoId) return res.status(200).json({ ok: false, motivo: 'Falta pedido_id' })

  const { data: p, error } = await supabase.rpc('reclamar_aviso_despacho', { p_pedido: pedidoId })
  if (error) return res.status(200).json({ ok: false, motivo: error.message })
  if (!p) return res.status(200).json({ ok: false, motivo: 'No está en despacho o ya se avisó' })

  const html = correo(p)
  const subject = `¡Tu sofá está listo! Pedido ${p.numero} — Mr. Chester`
  let cliente_ok = false
  let detalle = 'El cliente no tiene correo registrado.'

  if (p.email) {
    try {
      const { error: e } = await resend.emails.send({ from: FROM, to: [p.email], subject, html })
      cliente_ok = !e
      detalle = e ? (e.message || String(e)) : `Enviado a ${p.email}`
    } catch (e) { detalle = e.message }
  }

  // Copia a Joseph, diciendo si al cliente sí le llegó
  try {
    const nota = `<p style="font-family:Arial,sans-serif;font-size:13px;background:#fff3cd;padding:10px;margin:0;">Aviso automático de despacho · ${esc(p.nombre)} · ${cliente_ok ? '✅ ' : '⚠️ No se pudo enviar al cliente: '}${esc(detalle)}</p>`
    await resend.emails.send({ from: FROM, to: [COPIA], subject: `[Copia] ${subject}`, html: nota + html })
  } catch (e) { /* la copia no es crítica */ }

  res.status(200).json({ ok: cliente_ok, detalle })
}
