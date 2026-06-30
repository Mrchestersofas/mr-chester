// Archivo: src/pages/api/enviar-confirmacion.js
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { pedido, cliente } = req.body

  if (!cliente?.email && !pedido) {
    return res.status(200).json({ ok: false, motivo: 'Sin datos' })
  }

  const fechaFormateada = new Date(pedido.fecha_entrega + 'T00:00:00')
    .toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  const precioFormateado = Number(pedido.precio_venta).toLocaleString('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmación de Pedido - Mr. Chester</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f1eb;font-family:Georgia,serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1eb;padding:40px 20px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <tr>
    <td style="background-color:#1a1a1a;padding:40px 40px 30px;text-align:center;border-radius:8px 8px 0 0;">
      <div style="margin-bottom:8px;">
        <svg width="60" height="45" viewBox="0 0 100 75" xmlns="http://www.w3.org/2000/svg">
          <path d="M10,60 L10,30 L30,50 L50,10 L70,50 L90,30 L90,60 Z" fill="none" stroke="#C9A84C" stroke-width="3" stroke-linejoin="round"/>
          <circle cx="10" cy="30" r="5" fill="#C9A84C"/>
          <circle cx="50" cy="10" r="5" fill="#C9A84C"/>
          <circle cx="90" cy="30" r="5" fill="#C9A84C"/>
          <rect x="10" y="60" width="80" height="6" rx="3" fill="#C9A84C"/>
          <rect x="20" y="68" width="60" height="4" rx="2" fill="#C9A84C"/>
        </svg>
      </div>
      <h1 style="margin:0;color:#C9A84C;font-size:32px;font-weight:700;letter-spacing:6px;font-family:Georgia,serif;">MR. CHESTER</h1>
      <p style="margin:6px 0 0;color:#C9A84C;font-size:11px;letter-spacing:4px;font-family:Arial,sans-serif;">SOFÁS QUE HABLAN DE TI.</p>
      <div style="width:60px;height:1px;background:#C9A84C;margin:16px auto 0;"></div>
    </td>
  </tr>

  <tr>
    <td style="background-color:#C9A84C;padding:12px 40px;text-align:center;">
      <p style="margin:0;color:#1a1a1a;font-size:12px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;">CONFIRMACIÓN DE PEDIDO</p>
    </td>
  </tr>

  <tr>
    <td style="background-color:#ffffff;padding:50px 40px 40px;">

      <p style="margin:0 0 6px;color:#888;font-size:13px;font-family:Arial,sans-serif;">Estimado/a,</p>
      <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:22px;font-family:Georgia,serif;font-weight:normal;">Su pedido ha sido recibido con éxito.</h2>
      <p style="color:#555;font-size:14px;line-height:1.8;margin:0 0 32px;font-family:Arial,sans-serif;">
        Gracias por confiar en <strong>Mr. Chester</strong>. A continuación encontrará el resumen de su orden.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="background-color:#1a1a1a;border-left:4px solid #C9A84C;padding:20px 24px;border-radius:4px;text-align:center;">
            <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;">NÚMERO DE PEDIDO</p>
            <p style="margin:8px 0 0;color:#ffffff;font-size:36px;font-weight:700;font-family:Georgia,serif;letter-spacing:2px;">${pedido.numero}</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 12px;color:#1a1a1a;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;border-bottom:1px solid #C9A84C;padding-bottom:8px;">DETALLE DE LA ORDEN</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;width:45%;">Cliente</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:600;">${cliente?.nombre || '—'}</td>
        </tr>
        ${cliente?.cedula ? `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Cédula</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${cliente.cedula}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Producto</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${pedido.tipo_sofa}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Material / Color</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${pedido.material}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Cantidad</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${pedido.cantidad} unidad(es)</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Fecha estimada de entrega</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:600;">${fechaFormateada}</td>
        </tr>
        ${pedido.observaciones ? `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Observaciones</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${pedido.observaciones}</td>
        </tr>` : ''}
        ${cliente?.direccion ? `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Dirección de entrega</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">${cliente.direccion}${cliente.ciudad ? ', ' + cliente.ciudad : ''}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Valor total</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:22px;color:#C9A84C;font-family:Georgia,serif;font-weight:700;">${precioFormateado}</td>
        </tr>
        ${pedido.abono ? `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:13px;color:#888;font-family:Arial,sans-serif;">Abono recibido</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0ebe0;font-size:14px;color:#2d6a4f;font-family:Arial,sans-serif;font-weight:600;">$${Number(pedido.abono).toLocaleString('es-CO')}${pedido.medio_pago ? ' · ' + pedido.medio_pago.replace('_', ' ') : ''}</td>
        </tr>
        <tr>
          <td style="padding:16px 0 0;font-size:13px;color:#888;font-family:Arial,sans-serif;font-weight:700;">Saldo pendiente</td>
          <td style="padding:16px 0 0;font-size:18px;color:#c0392b;font-family:Georgia,serif;font-weight:700;">$${(Number(pedido.precio_venta) - Number(pedido.abono)).toLocaleString('es-CO')}</td>
        </tr>` : `
        <tr>
          <td style="padding:16px 0 0;font-size:13px;color:#888;font-family:Arial,sans-serif;font-weight:700;">Saldo pendiente</td>
          <td style="padding:16px 0 0;font-size:18px;color:#c0392b;font-family:Georgia,serif;font-weight:700;">${precioFormateado}</td>
        </tr>`}
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-left:3px solid #C9A84C;padding:20px 24px;margin-bottom:32px;border-radius:0 4px 4px 0;">
        <tr>
          <td>
            <p style="margin:0 0 10px;color:#1a1a1a;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;font-weight:700;">📦 INFORMACIÓN IMPORTANTE DE ENTREGA</p>
            <p style="margin:0 0 6px;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• La producción inicia tras confirmar el pago del anticipo.</p>
            <p style="margin:0 0 6px;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• El valor del envío <strong>no está incluido</strong> en el precio, salvo indicación expresa.</p>
            <p style="margin:0 0 6px;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• Pedidos fuera de Bogotá: hasta <strong>7 días hábiles</strong> adicionales por transportadora.</p>
            <p style="margin:0;color:#555;font-size:13px;font-family:Arial,sans-serif;line-height:1.7;">• Verifique previamente que el producto pueda ingresar al inmueble.</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 12px;color:#1a1a1a;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;border-bottom:1px solid #C9A84C;padding-bottom:8px;">TÉRMINOS Y CONDICIONES</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr><td style="padding:4px 0;font-size:12px;color:#777;font-family:Arial,sans-serif;line-height:1.7;">1. Todos nuestros productos son fabricados bajo pedido y conforme a las especificaciones aprobadas.</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#777;font-family:Arial,sans-serif;line-height:1.7;">2. No se aceptan cambios en diseño, medidas, color o tela una vez iniciada la producción.</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#777;font-family:Arial,sans-serif;line-height:1.7;">3. El saldo total debe estar cancelado antes del despacho.</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#777;font-family:Arial,sans-serif;line-height:1.7;">4. Pueden existir variaciones de hasta ±3 cm en medidas finales por ser fabricación artesanal.</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#777;font-family:Arial,sans-serif;line-height:1.7;">5. Garantía de <strong>5 años</strong> sobre estructura y defectos de fabricación.</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#777;font-family:Arial,sans-serif;line-height:1.7;">6. Por ser producto personalizado, no aplica retracto ni devoluciones por cambio de preferencia.</td></tr>
      </table>

    </td>
  </tr>

  <tr>
    <td style="background-color:#1a1a1a;padding:32px 40px;">
      <p style="margin:0 0 20px;color:#C9A84C;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;font-weight:700;text-align:center;">CONTÁCTENOS</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:0 10px;">
            <p style="margin:0 0 4px;color:#C9A84C;font-size:18px;">📱</p>
            <p style="margin:0 0 4px;color:#ffffff;font-size:12px;font-family:Arial,sans-serif;font-weight:600;">WhatsApp Pedidos</p>
            <p style="margin:0;color:#aaa;font-size:12px;font-family:Arial,sans-serif;">320 277 4320</p>
          </td>
          <td style="text-align:center;padding:0 10px;border-left:1px solid #333;border-right:1px solid #333;">
            <p style="margin:0 0 4px;color:#C9A84C;font-size:18px;">📍</p>
            <p style="margin:0 0 4px;color:#ffffff;font-size:12px;font-family:Arial,sans-serif;font-weight:600;">Centro de Experiencia</p>
            <p style="margin:0;color:#aaa;font-size:12px;font-family:Arial,sans-serif;">Cra 19A #85-69, Bogotá</p>
          </td>
          <td style="text-align:center;padding:0 10px;">
            <p style="margin:0 0 4px;color:#C9A84C;font-size:18px;">📸</p>
            <p style="margin:0 0 4px;color:#ffffff;font-size:12px;font-family:Arial,sans-serif;font-weight:600;">Instagram</p>
            <p style="margin:0;color:#aaa;font-size:12px;font-family:Arial,sans-serif;">@mrchestersofas</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background-color:#111;padding:20px 40px;text-align:center;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 4px;color:#C9A84C;font-size:11px;letter-spacing:2px;font-family:Arial,sans-serif;">MR. CHESTER EXPORT S.A.S.</p>
      <p style="margin:0 0 4px;color:#555;font-size:11px;font-family:Arial,sans-serif;">Fábrica: Calle 161 #92-21, Bogotá · Centro de Experiencia: Cra 19A #85-69, Bogotá</p>
      <p style="margin:8px 0 0;color:#444;font-size:11px;font-family:Arial,sans-serif;">Este es un correo automático de confirmación. Por favor no responda a este mensaje.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`

  // Destinatarios: cliente (si tiene email) + siempre josephtoledo@gmail.com
  const destinatarios = ['josephtoledo@gmail.com']
  if (cliente?.email && cliente.email !== 'josephtoledo@gmail.com') {
    destinatarios.unshift(cliente.email)
  }

  try {
    await resend.emails.send({
      from: 'Mr. Chester Sofás <onboarding@resend.dev>',
      to: destinatarios,
      subject: `Confirmación de pedido ${pedido.numero} — Mr. Chester Sofás`,
      html
    })
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Error enviando email:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}