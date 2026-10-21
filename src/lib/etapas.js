// Archivo: src/lib/etapas.js
// Etapas de fábrica y utilidades compartidas entre Producción (ERP) y Taller (encargados).

export const ETAPAS_FAB = [
  { key: 'cola', label: 'Programación', corto: 'Programado', color: '#6b7280' },
  { key: 'estructura', label: 'Esqueletería', corto: 'Esqueletería', color: '#b45309' },
  { key: 'espumado', label: 'Espumado', corto: 'Espumado', color: '#2563eb' },
  { key: 'corte_tela', label: 'Corte y costura', corto: 'Corte y costura', color: '#7c3aed' },
  { key: 'tapizado', label: 'Tapizado', corto: 'Tapizado', color: '#db2777' },
  { key: 'terminado', label: 'Terminado', corto: 'Terminado', color: '#4f46e5' },
  { key: 'despacho', label: 'Despacho', corto: 'Listo', color: '#15803d' },
]
// Secciones con encargado (las que trabajan el sofá)
export const SECCIONES = ETAPAS_FAB.filter(e => !['cola', 'despacho'].includes(e.key))
export const ORDEN = ETAPAS_FAB.map(e => e.key)
export const etiqueta = k => ETAPAS_FAB.find(e => e.key === k)?.label || (k === 'control_calidad' ? 'Terminado' : k)
export function indice(k) { const i = ORDEN.indexOf(k === 'control_calidad' ? 'terminado' : k); return i < 0 ? 0 : i }
export function siguiente(k) { return ORDEN[Math.min(indice(k) + 1, ORDEN.length - 1)] }
export function anterior(k) { return ORDEN[Math.max(indice(k) - 1, 0)] }
// Estado general del pedido según la etapa (lo usan Pedidos, Dashboard, etc.)
export function estadoPedido(etapa) {
  return { cola: 'pendiente', estructura: 'estructura', espumado: 'estructura', corte_tela: 'costura', tapizado: 'tapizado', terminado: 'tapizado', despacho: 'listo' }[etapa] || 'pendiente'
}

export const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
export const diaBogota = ts => ts ? new Date(new Date(ts).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10) : null
export function sumar(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export function fCorta(iso) { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }
export function lunesDe(iso) { const w = new Date(iso + 'T12:00:00Z').getUTCDay(); return sumar(iso, -((w + 6) % 7)) }

// Normaliza una fila de programacion_produccion (+pedido) al formato de las vistas
export function normalizar(f) {
  const p = f.pedido || f
  const inicios = {}
  SECCIONES.forEach(s => { inicios[s.key] = diaBogota(f[`inicio_${s.key}`]) || f.dia_produccion || null })
  return {
    id: f.id, pedido_id: f.pedido_id, etapa: f.etapa_actual === 'control_calidad' ? 'terminado' : f.etapa_actual,
    dia: f.dia_produccion, inicios,
    numero: p.numero, ref: p.tipo_sofa, tela: p.material, cantidad: p.cantidad, entrega: p.fecha_entrega,
    prioridad: p.prioridad, obs: p.observaciones, cliente: p.cliente?.nombre || null, estado: p.estado,
    metros: p.metros != null ? Number(p.metros) : null,
  }
}

// ---------- Programación semanal para el jefe de producción (WhatsApp) ----------
export const WHATSAPP_JEFE = '573133533882' // Luis
export const URL_TALLER = 'https://mrchester-produccion.vercel.app/taller'

/** Texto de WhatsApp con los sofás que se fabrican de lunes a sábado de la semana que empieza en `lunes`. */
export function textoSemana(items, lunes) {
  const dias = [0, 1, 2, 3, 4, 5].map(k => sumar(lunes, k))
  const lineas = [`📅 *PROGRAMACIÓN MR. CHESTER*`, `Semana del ${fCorta(dias[0])} al ${fCorta(dias[5])}`, ``]
  let total = 0
  dias.forEach(d => {
    const del = items.filter(it => it.dia === d).sort((a, b) => String(a.numero).localeCompare(String(b.numero)))
    if (!del.length) return
    lineas.push(`*${fCorta(d).replace(/^./, c => c.toUpperCase())}*`)
    del.forEach(it => {
      total += Number(it.cantidad) || 1
      lineas.push(`• ${it.numero} · ${it.ref}${it.cantidad > 1 ? ` ×${it.cantidad}` : ''} · ${it.tela || 'tela por definir'} · entrega ${fCorta(it.entrega)}${it.prioridad === 'urgente' ? ' · ⚠️ URGENTE' : ''}`)
    })
    lineas.push(``)
  })
  if (!total) lineas.push(`No hay nada programado esta semana.`, ``)
  else lineas.push(`Total: *${total} unidad${total === 1 ? '' : 'es'}*`)
  lineas.push(`Ver detalle: ${URL_TALLER}`)
  return lineas.join('\n')
}
export function linkSemanaJefe(items, lunes) {
  return `https://wa.me/${WHATSAPP_JEFE}?text=${encodeURIComponent(textoSemana(items, lunes))}`
}
