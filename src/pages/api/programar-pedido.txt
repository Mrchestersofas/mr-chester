// Archivo: src/pages/api/programar-pedido.js
// Se llama al crear un pedido nuevo para calcular su programación de producción

import { createClient } from '@supabase/supabase-js'
import { calcularFechaInicio, calcularProgramacionCompleta } from '@/lib/programacion'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { pedido_id, cantidad } = req.body

  if (!pedido_id) return res.status(400).json({ ok: false, error: 'Falta pedido_id' })

  try {
    // Obtener todos los pedidos ya programados (en cola)
    const { data: programaciones } = await supabase
      .from('programacion_produccion')
      .select('inicio_estructura')
      .order('inicio_estructura', { ascending: true })

    const fechaBase = new Date()
    const totalUnidades = cantidad || 1
    const resultados = []

    let colaActual = programaciones || []

    // Si el pedido tiene varias unidades, programar cada una en cascada
    for (let i = 0; i < totalUnidades; i++) {
      const fechaInicio = calcularFechaInicio(fechaBase, colaActual)
      const programacion = calcularProgramacionCompleta(fechaInicio)

      colaActual = [...colaActual, { inicio_estructura: programacion.inicio_estructura }]
      resultados.push(programacion)
    }

    // Guardar solo la primera unidad como referencia (caso típico: cantidad=1)
    const primera = resultados[0]

    const { error } = await supabase.from('programacion_produccion').insert({
      pedido_id,
      ...primera,
      etapa_actual: 'estructura',
    })

    if (error) throw error

    res.status(200).json({ ok: true, programacion: primera })
  } catch (error) {
    console.error('Error programando pedido:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}
