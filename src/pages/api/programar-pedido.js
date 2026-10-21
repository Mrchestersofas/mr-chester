// Archivo: src/pages/api/programar-pedido.js
// Se llama al registrar un pedido. Lo pone en la cola de fábrica y recalcula toda la programación
// por cupos (ver src/lib/planificador.js). Si la entrega real estimada se pasa de la prometida,
// avisa a Joseph por correo.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { cargarYPlanificar } from '@/lib/planificador'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM || 'Mr. Chester Sofás <pedidos@envios.mrchester.com.co>'
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fecha = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { pedido_id, numero_pedido } = req.body || {}
  if (!pedido_id) return res.status(400).json({ ok: false, error: 'Falta pedido_id' })

  try {
    const { data: ya } = await supabase.from('programacion_produccion').select('id').eq('pedido_id', pedido_id).maybeSingle()
    if (!ya) {
      const { error } = await supabase.from('programacion_produccion').insert({ pedido_id, etapa_actual: 'cola' })
      if (error) throw error
    }

    const { plan } = await cargarYPlanificar(supabase)
    const p = plan.find(x => x.pedido_id === pedido_id)

    if (p && p.estado === 'tarde') {
      try {
        await resend.emails.send({
          from: FROM,
          to: ['josephtoledo@gmail.com'],
          subject: `⚠️ ${numero_pedido || p.pedido.numero} no alcanza la fecha prometida · Mr. Chester`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px 16px">
            <div style="background:#dc2626;padding:18px;border-radius:8px 8px 0 0;text-align:center">
              <h2 style="color:#fff;margin:0;font-size:18px">⚠️ Riesgo de retraso</h2>
            </div>
            <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;color:#374151;font-size:14px;line-height:1.7">
              <p>El pedido <b>${p.pedido.numero}</b> (${p.pedido.tipo_sofa}, ${p.pedido.cliente?.nombre || ''}) se prometió para el <b>${fecha(p.prometida)}</b>.</p>
              <p>Con los cupos de la fábrica se fabrica el <b>${fecha(p.dia_inicio)}</b>, queda listo el <b>${fecha(p.listo)}</b> y la entrega real sería el <b style="color:#dc2626">${fecha(p.entrega_max)}</b>.</p>
              <p><a href="https://mrchester-produccion.vercel.app/programacion" style="color:#6d28d9;font-weight:bold">Abrir Programación</a> para reprogramarlo o mover la fecha.</p>
            </div>
          </div>`,
        })
      } catch (e) { console.error('No se pudo enviar alerta de fecha:', e) }
    }

    res.status(200).json({ ok: true, dia: p?.dia_inicio, entrega: p?.entrega_max, estado: p?.estado })
  } catch (error) {
    console.error('Error programando pedido:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}
