// Archivo: src/lib/planificador.js
// Programación de fábrica por CUPOS diarios.
// - Lunes a viernes: 3 cupos. Sábado: 2. Domingos y festivos: 0.
// - Cupos por producto: sofá 1, esquinero 2, poltrona ½, puff ¼ (× cantidad).
// - Se programa por fecha de entrega prometida (la más cercana primero).
// - Un pedido "fijo" (reprogramado a mano) se queda en su día.
// - Listo = 1 día hábil después del último día de fabricación.
// - Entrega: Bogotá 1 día hábil después de listo; fuera de Bogotá entre 3 y 5.
import { calcularProgramacionCompleta } from './programacion'

export const CUPOS_DIA = { 0: 0, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2 }
export const CUPOS_CATEGORIA = { 'Sofá': 1, 'Esquinero': 2, 'Poltrona': 0.5, 'Puff': 0.25 }

// Festivos de Colombia (no se fabrica ni se entrega)
export const FESTIVOS = new Set([
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18',
  '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12',
  '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25',
  '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26', '2027-05-01', '2027-05-10',
  '2027-05-31', '2027-06-07', '2027-07-05', '2027-07-20', '2027-08-07', '2027-08-16', '2027-10-18',
  '2027-11-01', '2027-11-15', '2027-12-08', '2027-12-25',
])

const DIAS_ENTREGA = { bogota: [1, 1], fuera: [3, 5] }

export function hoyColombia() { return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10) }
export function sumarDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export function diaSemana(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay() }
export function capacidad(iso) { return FESTIVOS.has(iso) ? 0 : CUPOS_DIA[diaSemana(iso)] }
export function esHabil(iso) { return capacidad(iso) > 0 }
export function sumarHabiles(iso, n) { let d = iso; let k = 0; while (k < n) { d = sumarDias(d, 1); if (esHabil(d)) k++ } return d }
// Primer día que se puede programar: hoy, salvo que ya terminó la jornada (5 p. m.; sábado 1 p. m.)
export function primerDiaPlan(hoy = hoyColombia()) {
  const ahora = new Date(Date.now() - 5 * 3600 * 1000)
  const hora = ahora.getUTCHours() + ahora.getUTCMinutes() / 60
  const termino = hoy === hoyColombia() && hora >= (diaSemana(hoy) === 6 ? 13 : 17)
  return esHabil(hoy) && !termino ? hoy : sumarHabiles(hoy, 1)
}
export function esBogota(ciudad) { const c = String(ciudad || '').toLowerCase(); return !c.trim() || c.includes('bogot') }

export function cuposDe(tipoSofa, cantidad, productos) {
  const p = (productos || []).find(x => x.referencia === tipoSofa)
  const peso = CUPOS_CATEGORIA[p?.categoria] ?? 1
  return { peso, total: peso * (Number(cantidad) || 1) }
}

/**
 * filas: programacion_produccion con pedido (+cliente) embebido.
 * Devuelve { plan: [{ ...fila, peso, cupos, dia_inicio, dia_fin, listo, entrega_min, entrega_max, prometida, estado, sobrecupo }], usados: {dia: cupos} }
 */
export function planificar(filas, productos, hoy = hoyColombia()) {
  const usados = {}
  const usar = (dia, c) => { usados[dia] = (usados[dia] || 0) + c }
  const libre = dia => capacidad(dia) - (usados[dia] || 0)
  const primerDia = primerDiaPlan(hoy)

  const items = filas.filter(f => f.pedido && f.etapa_actual !== 'completado' && f.pedido.estado !== 'cancelado' && f.pedido.estado !== 'entregado')
    .map(f => {
      const { peso, total } = cuposDe(f.pedido.tipo_sofa, f.pedido.cantidad, productos)
      return { ...f, cupos_guardados: f.cupos, peso, cupos: total, unidades: Math.max(1, Number(f.pedido.cantidad) || 1) }
    })

  // 1) Los que ya están en fábrica o listos ocupan su día (si es de hoy en adelante)
  const enFabrica = items.filter(f => f.etapa_actual !== 'cola')
  enFabrica.forEach(f => {
    const d = f.dia_produccion || (f.inicio_estructura ? String(f.inicio_estructura).slice(0, 10) : hoy)
    f.dia_inicio = f.dia_fin = d
    if (d >= hoy && f.etapa_actual !== 'despacho') usar(d, f.cupos)
  })
  // 2) Los fijos se quedan en su día (aunque se pasen de cupo)
  const enCola = items.filter(f => f.etapa_actual === 'cola')
  enCola.filter(f => f.fijo && f.dia_produccion).forEach(f => {
    f.dia_inicio = f.dia_fin = f.dia_produccion
    usar(f.dia_produccion, f.cupos)
  })
  // 3) El resto, por fecha de entrega prometida, en el primer cupo libre (unidad por unidad)
  enCola.filter(f => !(f.fijo && f.dia_produccion))
    .sort((a, b) => String(a.pedido.fecha_entrega).localeCompare(String(b.pedido.fecha_entrega))
      || String(a.pedido.fecha_pedido).localeCompare(String(b.pedido.fecha_pedido))
      || String(a.pedido.numero).localeCompare(String(b.pedido.numero)))
    .forEach(f => {
      let d = primerDia
      for (let u = 0; u < f.unidades; u++) {
        let guard = 0
        while (libre(d) + 1e-9 < Math.min(f.peso, capacidad(d) || 99) && guard++ < 800) d = sumarDias(d, 1)
        while (!esHabil(d) && guard++ < 800) d = sumarDias(d, 1)
        usar(d, f.peso)
        if (!f.dia_inicio) f.dia_inicio = d
        f.dia_fin = d
      }
    })

  // 4) Fechas: listo y entrega real estimada contra la prometida
  const plan = items.map(f => {
    const listo = f.etapa_actual === 'despacho' ? hoy : sumarHabiles(f.dia_fin, 1)
    const [a, b] = esBogota(f.pedido.cliente?.ciudad) ? DIAS_ENTREGA.bogota : DIAS_ENTREGA.fuera
    const entrega_min = sumarHabiles(listo, a)
    const entrega_max = sumarHabiles(listo, b)
    const prometida = String(f.pedido.fecha_entrega || '').slice(0, 10)
    const estado = !prometida ? 'sin_fecha' : entrega_max <= prometida ? 'ok' : entrega_min <= prometida ? 'justo' : 'tarde'
    return { ...f, listo, entrega_min, entrega_max, prometida, estado, sobrecupo: (usados[f.dia_inicio] || 0) > capacidad(f.dia_inicio) + 1e-9 }
  })
  return { plan, usados }
}

/** Primer día con cupo libre (sin mover a nadie), para sugerir fechas a pedidos nuevos. */
export function primerCupoLibre(usados, cupos = 1, desde = hoyColombia()) {
  let d = primerDiaPlan(desde)
  let guard = 0
  while (capacidad(d) - (usados[d] || 0) + 1e-9 < Math.min(cupos, capacidad(d) || 99) && guard++ < 800) d = sumarHabiles(d, 1)
  return d
}

/** Carga todo, planifica y guarda en la base el día de fabricación de los pedidos en cola que cambiaron. */
export async function cargarYPlanificar(supabase, reintento = false) {
  const [{ data: filas, error }, { data: productos }, { data: sinProg }] = await Promise.all([
    supabase.from('programacion_produccion')
      .select('*, pedido:pedidos(id, numero, grupo, tipo_sofa, material, cantidad, estado, prioridad, fecha_pedido, fecha_entrega, precio_venta, abono, cliente:clientes(nombre, ciudad, telefono))'),
    supabase.from('productos').select('referencia, categoria'),
    supabase.from('pedidos').select('id, programacion_produccion(id)').not('estado', 'in', '(entregado,cancelado)'),
  ])
  if (error) throw error

  // Pedidos activos que nunca se programaron: se agregan a la cola
  const faltan = (sinProg || []).filter(p => !p.programacion_produccion || (Array.isArray(p.programacion_produccion) && !p.programacion_produccion.length))
  if (faltan.length && !reintento) {
    await supabase.from('programacion_produccion').insert(faltan.map(p => ({ pedido_id: p.id, etapa_actual: 'cola' })))
    return cargarYPlanificar(supabase, true)
  }

  const r = planificar(filas || [], productos || [])
  const cambios = r.plan.filter(f => f.etapa_actual === 'cola' && (f.dia_produccion !== f.dia_inicio || Number(f.cupos_guardados ?? f.cupos) !== f.cupos))
  for (const f of cambios) {
    const horas = calcularProgramacionCompleta(new Date(f.dia_inicio + 'T13:00:00Z')) // 8:00 a. m. Colombia
    await supabase.from('programacion_produccion').update({ dia_produccion: f.dia_inicio, cupos: f.cupos, ...horas }).eq('id', f.id)
    f.dia_produccion = f.dia_inicio
  }
  return { ...r, productos: productos || [] }
}
