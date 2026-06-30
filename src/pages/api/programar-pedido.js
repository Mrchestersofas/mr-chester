// Archivo: src/pages/api/programar-pedido.js
// Se llama al crear un pedido nuevo para calcular su programación de producción

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { calcularFechaInicio, calcularProgramacionCompleta, verificarFechaEntrega } from '@/lib/programacion'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { pedido_id, cantidad, fecha_entrega, numero_pedido } = req.body

  if (!pedido_id) return res.status(400).json({ ok: false, error: 'Falta pedido_id' })

  try {
    const { data: programaciones } = await supabase
      .from('programacion_produccion')
      .select('inicio_estructura')
      .order('inicio_estructura', { ascending: true })

    const fechaBase = new Date()
    const totalUnidades = cantidad || 1
    let colaActual = programaciones || []
    let ultimaProgramacion = null

    for (let i = 0; i < totalUnidades; i++) {
      const fechaInicio = calcularFechaInicio(fechaBase, colaActual)
      const programacion = calcularProgramacionCompleta(fechaInicio)
      colaActual = [...colaActual, { inicio_estructura: programacion.inicio_estructura }]
      ultimaProgramacion = programacion
    }

    const { error } = await supabase.from('programacion_produccion').insert({
      pedido_id,
      ...ultimaProgramacion,
      etapa_actual: 'estructura',
    })

    if (error) throw error

    // Verificar si la fecha de despacho choca con la fecha de entrega prometida
    let alertaFecha = null
    if (fecha_entrega && ultimaProgramacion?.fin_despacho) {
      const check = verificarFechaEntrega(ultimaProgramacion.fin_despacho, fecha_entrega)
      if (!check.seCumple) {
        alertaFecha = check

        // Enviar email de alerta
        try {
          await resend.emails.send({
            from: 'Mr. Chester ERP <onboarding@resend.dev>',
            to: ['josephtoledo@gmail.com'],
            subject: `⚠️ Riesgo de retraso — Pedido ${numero_pedido || ''} · Mr. Chester`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">
              <div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;text-align:center">
                <h2 style="color:#fff;margin:0;font-size:18px">⚠️ Riesgo de retraso en producción</h2>
              </div>
              <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
                <p style="color:#374151;font-size:14px;line-height:1.7">
                  El pedido <b>${numero_pedido || pedido_id}</b> tiene una fecha de entrega prometida de
                  <b>${new Date(fecha_entrega + 'T00:00:00').toLocaleDateString('es-CO')}</b>, pero según la
                  capacidad actual de producción (3 unidades/día), el despacho estimado es
                  <b style="color:#dc2626">${check.despacho.toLocaleDateString('es-CO')}</b>
                  (${Math.abs(check.diasDiferencia)} día(s) de retraso).
                </p>
                <p style="color:#6b7280;font-size:13px;margin-top:20px">
                  Revisa la programación en <a href="https://mrchester-produccion.vercel.app/produccion" style="color:#6d28d9">el tablero de producción</a>.
                </p>
              </div>
            </div>`,
          })
        } catch (e) {
          console.error('No se pudo enviar alerta de fecha:', e)
        }
      }
    }

    res.status(200).json({ ok: true, programacion: ultimaProgramacion, alertaFecha })
  } catch (error) {
    console.error('Error programando pedido:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}
