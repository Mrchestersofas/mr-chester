// Archivo: src/lib/whatsappBot.js
// Cerebro del bot de WhatsApp de Mr. Chester (API oficial de WhatsApp / Cloud API).
// - Si el teléfono tiene un pedido activo en el ERP, le dice en qué etapa va.
// - Si no, le muestra el menú: Quiero comprar / Mi pedido / Hablar con asesor.
// - "Mi pedido" sin pedido por teléfono: pide la cédula o NIT y busca por documento.
// - Cuando un asesor responde desde la app (coexistencia), el bot se calla 12 horas en ese chat.
// - A los números nuevos los crea como prospectos en el CRM (canal WhatsApp).
// La misma lógica se usa en el simulador del ERP (sin enviar nada ni tocar el CRM).

import { ETAPAS } from '@/lib/programacion'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const URL_SEGUIMIENTO = 'seguimiento.mrchester.com.co'
const URL_TIENDA = 'mrchester.com.co'
const HORAS_SILENCIO_ASESOR = 12 // después de que un asesor escribe, el bot no responde en ese chat
const HORAS_SIN_REPETIR = 6      // no repetir el menú si el bot ya respondió hace poco

export const soloNum = t => String(t || '').replace(/\D/g, '')
export const tel10 = t => soloNum(t).slice(-10)
const esEmpresa = n => /\b(s\.?a\.?s|ltda|s\.a\.?|iglesia|fundaci[oó]n|corporaci[oó]n|inmobiliaria|group|company)\b/i.test(String(n || ''))
const primerNombre = n => {
  if (esEmpresa(n)) return String(n).trim()
  const w = String(n || '').trim().split(/\s+/)[0] || ''
  return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''
}
const fechaLarga = iso => { if (!iso) return 'por confirmar'; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` }
const hoyCol = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)

function etapaTexto(p) {
  const pp = Array.isArray(p.programacion_produccion) ? p.programacion_produccion[0] : p.programacion_produccion
  const et = pp?.etapa_actual
  if (p.estado === 'entregado' || et === 'completado') return 'Entregado ✅'
  if (et === 'despacho') return 'Listo para despacho 🚚'
  if (!et || et === 'cola') return 'Programado, en espera de fabricación'
  return (ETAPAS.find(e => e.key === et)?.label || et) + ' (en fábrica) 🛠️'
}

// ---------- Mensajes ----------
const texto = body => ({ type: 'text', text: { body, preview_url: true } })
const botones = (body, lista) => ({
  type: 'interactive',
  interactive: { type: 'button', body: { text: body }, action: { buttons: lista.map(([id, title]) => ({ type: 'reply', reply: { id, title } })) } },
})
const BTN_COMPRAR = ['comprar', '🛋️ Quiero comprar']
const BTN_PEDIDO = ['pedido', '📦 Mi pedido']
const BTN_ASESOR = ['asesor', '💬 Hablar con asesor']

function bienvenida(nombre) {
  const n = primerNombre(nombre)
  return botones(`¡Hola${n ? ' ' + n : ''}! 👋 Bienvenido a *Mr. Chester*, sofás Chesterfield hechos en Bogotá.\n\n¿En qué te ayudamos?`, [BTN_COMPRAR, BTN_PEDIDO, BTN_ASESOR])
}
function infoCompra() {
  return texto(
    '🔥 *Hot Sale 50% OFF* · Sofá Chester\n\n' +
    '• 1,80 m (2 puestos): ~$4.390.000~ → *$2.195.000*\n' +
    '• 2,00 m (3 puestos): ~$4.990.000~ → *$2.495.000*\n' +
    '• 2,20 m (3 puestos amplios): ~$5.590.000~ → *$2.795.000*\n\n' +
    `Mira modelos y colores: ${URL_TIENDA}\n\n` +
    '👉 Cuéntanos *qué medida* buscas y *en qué ciudad* estás, y un asesor te responde por aquí.'
  )
}
function estadoPedidos(nombre, pedidos) {
  const n = primerNombre(nombre)
  const lineas = pedidos.map(p =>
    `• *${p.numero}* · ${p.tipo_sofa}${p.material ? ` (${p.material})` : ''}\n   Etapa: ${etapaTexto(p)}\n   ${p.fecha_entrega && String(p.fecha_entrega).slice(0, 10) >= hoyCol() ? `Entrega estimada: ${fechaLarga(p.fecha_entrega)}` : 'Entrega: un asesor te confirma la fecha por aquí'}`
  ).join('\n\n')
  return botones(
    `Hola${n ? ' ' + n : ''} 👋 Así va ${pedidos.length > 1 ? 'tu compra' : 'tu pedido'} en Mr. Chester:\n\n${lineas}\n\nPuedes verlo cuando quieras en ${URL_SEGUIMIENTO} con tu cédula o NIT.`,
    [BTN_ASESOR, BTN_COMPRAR]
  )
}
const pedirCedula = () => texto('Con gusto 😊 Escríbenos el *número de cédula o NIT* con el que hiciste la compra (solo números) y te decimos en qué va tu pedido.')
const noEncontrado = () => botones('No encontramos pedidos activos con ese documento 🤔 Revisa el número o habla con un asesor.', [BTN_PEDIDO, BTN_ASESOR])
const conAsesor = () => texto('Listo 🙌 Un asesor te responde por aquí en horario de atención (lunes a sábado). Escribe tu consulta con todo el detalle.')

// ---------- Datos ----------
async function clientesPorTelefono(db, t10) {
  if (t10.length < 7) return []
  const { data } = await db.from('clientes').select('id, nombre, telefono').not('telefono', 'is', null)
  return (data || []).filter(c => tel10(c.telefono) === t10)
}
async function clientesPorDocumento(db, doc) {
  const d = soloNum(doc)
  if (d.length < 5) return []
  const { data } = await db.from('clientes').select('id, nombre, cedula, dv').not('cedula', 'is', null)
  return (data || []).filter(c => soloNum(c.cedula) === d || soloNum(c.cedula) + soloNum(c.dv) === d)
}
async function pedidosActivos(db, clienteIds) {
  if (!clienteIds.length) return []
  const { data } = await db.from('pedidos')
    .select('id, numero, tipo_sofa, material, fecha_entrega, estado, programacion_produccion(etapa_actual)')
    .in('cliente_id', clienteIds)
    .not('estado', 'in', '(entregado,cancelado)')
    .order('numero')
  return data || []
}

async function leerEstado(db, tel) {
  const { data } = await db.from('wa_estado').select('*').eq('telefono', tel).maybeSingle()
  return data || { telefono: tel, paso: null, hasta: null, ultimo_bot: null }
}
async function guardarEstado(db, tel, cambios) {
  await db.from('wa_estado').upsert({ telefono: tel, ...cambios, updated_at: new Date().toISOString() })
}

// Registra al número como prospecto del CRM si no es cliente ni prospecto
async function asegurarProspecto(db, t10, nombre, primerTexto) {
  const { data: ya } = await db.from('crm_prospectos').select('id, telefono').not('telefono', 'is', null)
  const existe = (ya || []).find(p => tel10(p.telefono) === t10)
  if (existe) {
    await db.from('crm_prospectos').update({ ultima_actividad: new Date().toISOString() }).eq('id', existe.id)
    return
  }
  const { data: nuevo } = await db.from('crm_prospectos').insert({
    nombre: nombre || `WhatsApp ${t10}`, telefono: t10, canal: 'whatsapp', etapa: 'nuevo',
    interes: primerTexto ? String(primerTexto).slice(0, 200) : null, proximo_seguimiento: hoyCol(),
  }).select('id').single()
  if (nuevo) await db.from('crm_actividades').insert({ prospecto_id: nuevo.id, tipo: 'whatsapp', texto: `Escribió por WhatsApp: "${String(primerTexto || '').slice(0, 300)}"` })
}

/**
 * Decide qué responder a un mensaje entrante.
 * entrada: { telefono, nombre, texto, boton }  (boton = id del botón tocado, si fue un botón)
 * opciones: { simular }  → en simulación no se crean prospectos.
 * Devuelve la lista de mensajes a enviar (puede ser vacía si el bot debe quedarse callado).
 */
export async function responder(db, entrada, opciones = {}) {
  const tel = soloNum(entrada.telefono)
  const t10 = tel10(tel)
  const ahora = Date.now()
  const est = await leerEstado(db, opciones.simular ? 'sim:' + tel : tel)
  const claveEstado = opciones.simular ? 'sim:' + tel : tel
  const txt = String(entrada.texto || '').trim()
  const salida = []
  const fijar = async (paso, horas) => guardarEstado(db, claveEstado, { paso, hasta: horas ? new Date(ahora + horas * 3600e3).toISOString() : null, ultimo_bot: new Date().toISOString() })

  const clientes = await clientesPorTelefono(db, t10)
  if (!clientes.length && !opciones.simular) await asegurarProspecto(db, t10, entrada.nombre, txt || entrada.boton)
  const nombre = clientes[0]?.nombre || entrada.nombre

  // 1) Botones
  if (entrada.boton === 'comprar') { salida.push(infoCompra()); await fijar('asesor', HORAS_SILENCIO_ASESOR); return salida }
  if (entrada.boton === 'asesor') { salida.push(conAsesor()); await fijar('asesor', HORAS_SILENCIO_ASESOR); return salida }
  if (entrada.boton === 'pedido') {
    const peds = await pedidosActivos(db, clientes.map(c => c.id))
    if (peds.length) { salida.push(estadoPedidos(nombre, peds)); await fijar(null) }
    else { salida.push(pedirCedula()); await fijar('esperando_cedula', 2) }
    return salida
  }

  // 2) Palabra "menú" o "inicio": siempre muestra el menú
  if (/^(men[uú]|inicio|opciones)$/i.test(txt)) { salida.push(bienvenida(nombre)); await fijar(null); return salida }

  // 3) Esperando cédula
  const vigente = est.hasta && new Date(est.hasta).getTime() > ahora
  if (est.paso === 'esperando_cedula' && vigente) {
    const d = soloNum(txt)
    if (d.length >= 5) {
      const porDoc = await clientesPorDocumento(db, d)
      const peds = await pedidosActivos(db, porDoc.map(c => c.id))
      if (peds.length) { salida.push(estadoPedidos(porDoc[0].nombre, peds)); await fijar(null) }
      else { salida.push(noEncontrado()); await fijar(null) }
      return salida
    }
    salida.push(texto('Escríbenos solo el *número* de la cédula o NIT, sin puntos ni letras 🙏'))
    return salida
  }

  // 4) Un asesor está atendiendo este chat: el bot no interrumpe
  if (est.paso === 'asesor' && vigente) return salida

  // 5) No repetir el menú si el bot ya respondió hace poco
  if (est.ultimo_bot && ahora - new Date(est.ultimo_bot).getTime() < HORAS_SIN_REPETIR * 3600e3) return salida

  // 6) Primer mensaje: si tiene pedido activo, le contamos cómo va; si no, menú
  const peds = await pedidosActivos(db, clientes.map(c => c.id))
  salida.push(peds.length ? estadoPedidos(nombre, peds) : bienvenida(nombre))
  await fijar(null)
  return salida
}

// Cuando un asesor escribe desde la app (coexistencia), el bot se calla en ese chat
export async function asesorRespondio(db, telefono) {
  await guardarEstado(db, soloNum(telefono), { paso: 'asesor', hasta: new Date(Date.now() + HORAS_SILENCIO_ASESOR * 3600e3).toISOString() })
}

// Texto plano de un mensaje (para guardarlo en el historial y mostrarlo en el simulador)
export function textoDe(m) {
  if (m.type === 'text') return m.text.body
  if (m.type === 'interactive') return m.interactive.body.text + '\n' + m.interactive.action.buttons.map(b => `[${b.reply.title}]`).join(' ')
  return ''
}

// Envío real por la API de WhatsApp
export async function enviarWhatsApp(para, mensaje) {
  const v = process.env.WHATSAPP_API_VERSION || 'v23.0'
  const r = await fetch(`https://graph.facebook.com/${v}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: soloNum(para), ...mensaje }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message || `WhatsApp respondió ${r.status}`)
  return j?.messages?.[0]?.id || null
}
