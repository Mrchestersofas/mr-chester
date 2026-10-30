// @ts-nocheck
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { sumarHabiles } from '@/lib/planificador'

/* Compras simples: cada proveedor tiene días fijos y una lista con la cantidad de siempre.
   El día que toca, se ajusta la cantidad si hace falta, se pide por WhatsApp y queda registrado.
   Las telas van aparte y se calculan con los pedidos que todavía no se han cortado. */

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const FABRICA = 'Cra 99 #155-21, Bogotá'
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const num = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })

function hoyISO(d = new Date()) { return new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10) }
function diaSemana(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay() }
function sumarDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function fechaTexto(iso) { const d = new Date(iso + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()].toLowerCase()} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` }
function horaTexto(ts) { const d = new Date(new Date(ts).getTime() - 5 * 3600 * 1000); const h = d.getUTCHours(); return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}` }
function telWa(t) { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d }
function totalProveedor(p, cant) {
  return (p.insumos || []).reduce((s, i) => s + Number(i.precio) * Number(cant ? cant[i.id] ?? i.cantidad : i.cantidad), 0) + Number(p.costo_fijo || 0)
}

export default function Compras() {
  const [tab, setTab] = useState('hoy')
  const [provs, setProvs] = useState(null)
  const [error, setError] = useState(null)

  async function cargar() {
    const { data, error: e } = await supabase.from('compra_proveedores')
      .select('*, insumos:compra_insumos(*)').order('orden').order('nombre')
    if (e) { setError(e.message); setProvs([]); return }
    setProvs((data || []).map(p => ({ ...p, insumos: (p.insumos || []).filter(i => i.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)) })))
  }
  useEffect(() => { cargar() }, [])

  const tabs = [['hoy', 'Hoy'], ['semana', 'Semana'], ['telas', '🧵 Telas'], ['historial', 'Historial'], ['proveedores', 'Proveedores']]
  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium mb-4'>Compras</h1>
      <div className='flex gap-1.5 mb-5 overflow-x-auto pb-1'>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>
      {error && <p className='mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar: {error}</p>}
      {provs === null ? <p className='text-gray-500'>Cargando…</p>
        : tab === 'hoy' ? <TabHoy provs={provs.filter(p => p.activo)} />
        : tab === 'semana' ? <TabSemana provs={provs.filter(p => p.activo)} irA={() => setTab('hoy')} />
        : tab === 'telas' ? <TabTelas />
        : tab === 'historial' ? <TabHistorial />
        : <TabProveedores provs={provs} recargar={cargar} />}
    </div>
  )
}

/* ---------------- HOY ---------------- */

function TabHoy({ provs }) {
  const hoy = hoyISO()
  const [fecha, setFecha] = useState(hoy)
  const [pedidos, setPedidos] = useState([])
  const delDia = provs.filter(p => (p.dias || []).includes(diaSemana(fecha)))

  function cargarPedidos() {
    supabase.from('compra_pedidos').select('*').eq('fecha', fecha).order('created_at').then(({ data }) => setPedidos(data || []))
  }
  useEffect(cargarPedidos, [fecha])

  const totalDia = delDia.reduce((s, p) => s + totalProveedor(p), 0)
  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <button className='btn px-3' onClick={() => setFecha(sumarDias(fecha, -1))} aria-label='Día anterior'>‹</button>
        <div className='flex-1 text-center'>
          <div className='font-semibold capitalize'>{fecha === hoy ? 'Hoy, ' : fecha === sumarDias(hoy, 1) ? 'Mañana, ' : ''}{fechaTexto(fecha)}</div>
          {delDia.length > 0 && <div className='text-xs text-gray-500'>{delDia.length} proveedor(es) · ≈ {pesos(totalDia)}</div>}
        </div>
        <button className='btn px-3' onClick={() => setFecha(sumarDias(fecha, 1))} aria-label='Día siguiente'>›</button>
      </div>
      {fecha !== hoy && <button className='text-sm underline text-gray-600 w-full' onClick={() => setFecha(hoy)}>Volver a hoy</button>}

      {delDia.length === 0 ? (
        <div className='card text-center py-10 text-gray-500'>
          <div className='text-3xl mb-2'>✓</div>
          No hay compras programadas para este día.
          <ProximaCompra provs={provs} desde={fecha} irA={setFecha} />
        </div>
      ) : delDia.map(p => (
        <TarjetaPedido key={p.id + fecha} p={p} fecha={fecha} hechos={pedidos.filter(x => x.proveedor_id === p.id)} alPedir={cargarPedidos} />
      ))}
    </div>
  )
}

function ProximaCompra({ provs, desde, irA }) {
  for (let k = 1; k <= 7; k++) {
    const f = sumarDias(desde, k)
    const ps = provs.filter(p => (p.dias || []).includes(diaSemana(f)))
    if (ps.length) return <button className='btn mt-4' onClick={() => irA(f)}>Próxima compra: {DIAS[diaSemana(f)]} ({ps.map(p => p.nombre).join(', ')})</button>
  }
  return null
}

function TarjetaPedido({ p, fecha, hechos, alPedir }) {
  const inicial = {}
  ;(p.insumos || []).forEach(i => { inicial[i.id] = String(i.cantidad) })
  const [cant, setCant] = useState(inicial)
  const [msg, setMsg] = useState(null)
  const ultimo = hechos[hechos.length - 1]
  const total = totalProveedor(p, cant)

  function textoPedido() {
    const lineas = [
      `Hola${p.contacto ? ' ' + p.contacto : ''}, buen día 👋`,
      `Pedido de *Mr. Chester* para el ${fechaTexto(fecha)}:`,
      ``,
    ]
    p.insumos.forEach(i => { const c = Number(cant[i.id]); if (c > 0) lineas.push(`• ${num(c)} ${i.unidad ? i.unidad + ' ' : ''}— ${i.nombre}`) })
    lineas.push(``, `📍 Entrega en la fábrica: ${FABRICA}`, `¡Gracias!`)
    return lineas.join('\n')
  }

  async function pedir() {
    const items = p.insumos.map(i => ({ nombre: i.nombre, unidad: i.unidad, precio: Number(i.precio), cantidad: Number(cant[i.id]) || 0 })).filter(i => i.cantidad > 0)
    if (!items.length) { setMsg({ error: 'Todas las cantidades están en 0.' }); return }
    if (p.whatsapp) window.open(`https://wa.me/${telWa(p.whatsapp)}?text=${encodeURIComponent(textoPedido())}`, '_blank')
    const { error } = await supabase.from('compra_pedidos').insert({
      proveedor_id: p.id, proveedor_nombre: p.nombre, fecha, items, costo_fijo: Number(p.costo_fijo || 0), total,
    })
    setMsg(error ? { error: 'Se abrió WhatsApp, pero no quedó registrado: ' + error.message } : { ok: true })
    alPedir()
  }

  return (
    <div className={`card space-y-3 ${ultimo ? 'border-green-300' : ''}`}>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <div className='font-semibold'>{p.nombre}</div>
          <div className='text-xs text-gray-500'>{[p.contacto, p.whatsapp].filter(Boolean).join(' · ')}</div>
        </div>
        {ultimo
          ? <span className='text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 font-semibold whitespace-nowrap'>✓ Pedido {horaTexto(ultimo.created_at)}</span>
          : <span className='text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold whitespace-nowrap'>Por pedir</span>}
      </div>

      <div className='divide-y divide-gray-100'>
        {p.insumos.map(i => (
          <div key={i.id} className='flex items-center gap-2 py-2'>
            <div className='flex-1 min-w-0'>
              <div className='text-sm font-medium'>{i.nombre}</div>
              <div className='text-xs text-gray-500'>{pesos(i.precio)}{i.unidad ? ` / ${i.unidad}` : ''} · {pesos(Number(i.precio) * (Number(cant[i.id]) || 0))}</div>
            </div>
            <div className='flex items-center gap-1 flex-none'>
              <button className='w-8 h-8 rounded-lg border border-gray-200 text-lg leading-none' aria-label={`Menos ${i.nombre}`}
                onClick={() => setCant(c => ({ ...c, [i.id]: String(Math.max(0, (Number(c[i.id]) || 0) - 1)) }))}>−</button>
              <input inputMode='decimal' value={cant[i.id]} aria-label={`Cantidad de ${i.nombre}`}
                onChange={e => setCant(c => ({ ...c, [i.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                className={`w-16 text-center ${Number(cant[i.id]) !== Number(i.cantidad) ? 'border-amber-400 bg-amber-50' : ''}`} style={{ padding: '6px 4px' }} />
              <button className='w-8 h-8 rounded-lg border border-gray-200 text-lg leading-none' aria-label={`Más ${i.nombre}`}
                onClick={() => setCant(c => ({ ...c, [i.id]: String((Number(c[i.id]) || 0) + 1) }))}>+</button>
            </div>
          </div>
        ))}
        {Number(p.costo_fijo) > 0 && (
          <div className='flex justify-between py-2 text-sm'><span className='text-gray-600'>{p.costo_fijo_nombre || 'Transporte'}</span><span>{pesos(p.costo_fijo)}</span></div>
        )}
        <div className='flex justify-between pt-2 font-semibold'><span>Total</span><span>{pesos(total)}</span></div>
      </div>

      <button className='btn btn-primary w-full' onClick={pedir}>
        {ultimo ? 'Volver a pedir por WhatsApp' : p.whatsapp ? '🟢 Pedir por WhatsApp' : 'Registrar pedido'}
      </button>
      {msg?.ok && <p className='text-sm text-green-700'>✓ Pedido registrado.</p>}
      {msg?.error && <p className='text-sm text-red-700'>{msg.error}</p>}
      {Object.keys(cant).some(k => Number(cant[k]) !== Number(p.insumos.find(i => i.id === k)?.cantidad)) && (
        <p className='text-xs text-gray-500'>Las cantidades en amarillo cambian solo este pedido. Para cambiar la cantidad de siempre, ve a Proveedores.</p>
      )}
    </div>
  )
}

/* ---------------- SEMANA ---------------- */

function TabSemana({ provs }) {
  const dias = [1, 2, 3, 4, 5, 6]
  const totalSemana = dias.reduce((s, d) => s + provs.filter(p => (p.dias || []).includes(d)).reduce((a, p) => a + totalProveedor(p), 0), 0)
  return (
    <div className='space-y-3'>
      {dias.map(d => {
        const ps = provs.filter(p => (p.dias || []).includes(d))
        if (!ps.length) return null
        return (
          <div key={d} className='card'>
            <div className='flex justify-between font-semibold mb-1'><span>{DIAS[d]}</span><span>{pesos(ps.reduce((a, p) => a + totalProveedor(p), 0))}</span></div>
            {ps.map(p => (
              <div key={p.id} className='flex justify-between text-sm text-gray-600 py-0.5'><span>{p.nombre}</span><span>{pesos(totalProveedor(p))}</span></div>
            ))}
          </div>
        )
      })}
      <div className='card flex justify-between font-semibold text-lg'><span>Total semana</span><span>{pesos(totalSemana)}</span></div>
      <p className='text-xs text-gray-500 text-center'>Con las cantidades de siempre. Sin telas.</p>
    </div>
  )
}

/* ---------------- TELAS ---------------- */
/* La tela se pide un día hábil antes de producir: hoy se pide lo que se fabrica mañana.
   Lista por proveedor con los metros de cada tela, para mandar por WhatsApp; queda registrado en el historial. */

const ANTES_DE_CORTE = ['cola', 'estructura', 'espumado']
const sinTilde = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function TabTelas() {
  const hoy = hoyISO()
  const [dia, setDia] = useState(sumarHabiles(hoy, 1))
  const [datos, setDatos] = useState(null)
  const [msg, setMsg] = useState({})

  async function cargar() {
    const [{ data: prog }, { data: productos }, { data: telas }, { data: provs }, { data: pedidos }] = await Promise.all([
      supabase.from('programacion_produccion').select('id, etapa_actual, dia_produccion, pedido:pedidos(numero, tipo_sofa, material, cantidad, estado)').in('etapa_actual', ANTES_DE_CORTE),
      supabase.from('productos').select('referencia, metros_tela'),
      supabase.from('materiales').select('nombre, proveedor, costo_unitario').eq('unidad', 'metro'),
      supabase.from('compra_proveedores').select('id, nombre, whatsapp, contacto'),
      supabase.from('compra_pedidos').select('proveedor_nombre, items, created_at, fecha').gte('fecha', sumarDias(hoy, -10)),
    ])
    setDatos({ prog: prog || [], productos: productos || [], telas: telas || [], provs: provs || [], pedidos: pedidos || [] })
  }
  useEffect(() => { cargar() }, [])

  if (!datos) return <p className='text-gray-500'>Calculando…</p>
  const metrosRef = Object.fromEntries(datos.productos.map(p => [sinTilde(p.referencia), Number(p.metros_tela) || 0]))
  // Si la referencia no está en Productos, se estima: poltrona 5,5 m, esquinero 14 m, o un Cheers de la misma medida (+1 m si es Picadilly)
  function metrosDe(ref) {
    const r = sinTilde(ref)
    if (metrosRef[r]) return { m: metrosRef[r], estimado: false }
    if (r.startsWith('poltrona')) return { m: 5.5, estimado: true }
    if (r.startsWith('esquinero')) return { m: metrosRef['esquinero cheers'] || 14, estimado: true }
    const med = (r.match(/(\d{3})/) || [])[1]
    if (med && metrosRef['cheers ' + med]) return { m: metrosRef['cheers ' + med] + (r.includes('picadilly') || r.includes('piccadilly') ? 1 : 0), estimado: true }
    return { m: 0, estimado: true }
  }
  const infoTela = Object.fromEntries(datos.telas.map(t => [sinTilde(t.nombre), t]))
  const delDia = datos.prog.filter(f => f.dia_produccion === dia && f.pedido && !['entregado', 'cancelado'].includes(f.pedido.estado))
  // ya pedidas: se marcan las telas de este día que ya se registraron
  const yaPedido = new Set()
  datos.pedidos.forEach(x => (x.items || []).forEach(i => { if (i.para_dia === dia) yaPedido.add(sinTilde(i.nombre)) }))

  const grupos = {}
  delDia.forEach(({ pedido }) => {
    const tela = (pedido.material || '').trim() || 'Tela por definir'
    const info = infoTela[sinTilde(tela)]
    const prov = info?.proveedor || 'Proveedor por definir'
    const md = metrosDe(pedido.tipo_sofa)
    const m = md.m * (Number(pedido.cantidad) || 1)
    grupos[prov] = grupos[prov] || {}
    const g = grupos[prov][tela] = grupos[prov][tela] || { tela, metros: 0, precio: Number(info?.costo_unitario || 0), sofas: [], sinMedida: false, estimados: [] }
    g.metros += m
    if (!md.m) g.sinMedida = true
    else if (md.estimado) g.estimados.push(pedido.tipo_sofa)
    g.sofas.push(`${pedido.numero} ${pedido.tipo_sofa}${pedido.cantidad > 1 ? ' ×' + pedido.cantidad : ''}`)
  })
  const redondo = m => Math.ceil(m * 2) / 2 // a medio metro hacia arriba
  const diasOpc = [sumarHabiles(hoy, 1), sumarHabiles(hoy, 2), sumarHabiles(hoy, 3)]

  function texto(prov, lista) {
    const pv = datos.provs.find(x => sinTilde(x.nombre) === sinTilde(prov))
    const saludo = pv?.contacto ? String(pv.contacto).split(' ')[0] : prov !== 'Proveedor por definir' ? prov : ''
    return [
      `Hola${saludo ? ' ' + saludo : ''} 👋, buen día. Te escribe Mr. Chester.`,
      `Para producir el ${fechaTexto(dia)} necesitamos:`, ``,
      ...lista.map(t => `• ${num(redondo(t.metros))} m — ${t.tela}`), ``,
      `📍 Entrega en la fábrica: ${FABRICA}`, `¡Gracias!`,
    ].join('\n')
  }
  async function pedir(prov, lista) {
    const p = datos.provs.find(x => sinTilde(x.nombre) === sinTilde(prov))
    const t = texto(prov, lista)
    window.open(p?.whatsapp ? `https://wa.me/${telWa(p.whatsapp)}?text=${encodeURIComponent(t)}` : `https://wa.me/?text=${encodeURIComponent(t)}`, '_blank')
    const items = lista.map(x => ({ nombre: x.tela, unidad: 'm', cantidad: redondo(x.metros), precio: x.precio, para_dia: dia }))
    const { error } = await supabase.from('compra_pedidos').insert({
      proveedor_id: p?.id || null, proveedor_nombre: prov, fecha: hoy, items, costo_fijo: 0,
      total: items.reduce((a, i) => a + i.precio * i.cantidad, 0),
    })
    setMsg(m => ({ ...m, [prov]: error ? 'Se abrió WhatsApp, pero no quedó registrado: ' + error.message : 'ok' }))
    cargar()
  }
  async function copiar(prov, lista) {
    try { await navigator.clipboard.writeText(texto(prov, lista)); setMsg(m => ({ ...m, [prov]: 'copiado' })) } catch (e) {}
  }

  const provs = Object.entries(grupos)
  const totalM = provs.reduce((a, [, g]) => a + Object.values(g).reduce((b, t) => b + redondo(t.metros), 0), 0)
  return (
    <div className='space-y-3'>
      <p className='text-sm text-gray-600'>La tela se pide un día hábil antes: hoy se pide lo que se fabrica el <b>{fechaTexto(sumarHabiles(hoy, 1))}</b>.</p>
      <div className='flex gap-2'>
        {diasOpc.map((d, k) => (
          <button key={d} onClick={() => setDia(d)} className={`flex-1 px-2 py-2 text-sm rounded-lg capitalize ${dia === d ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {k === 0 ? 'Mañana · ' : ''}{fechaTexto(d).split(' de ')[0]}
          </button>
        ))}
      </div>

      {!delDia.length ? (
        <div className='card text-center py-8 text-gray-500'>No hay sofás programados para el {fechaTexto(dia)} que estén antes de corte.</div>
      ) : (<>
        <div className='card flex justify-between items-center'>
          <span className='text-sm text-gray-600'>{delDia.length} sofá{delDia.length === 1 ? '' : 's'} para el {fechaTexto(dia)}</span>
          <span className='text-lg font-semibold'>{num(totalM)} m</span>
        </div>
        {provs.map(([prov, g]) => {
          const lista = Object.values(g).sort((a, b) => b.metros - a.metros)
          const pedidaTodo = lista.every(t => yaPedido.has(sinTilde(t.tela)))
          const pv = datos.provs.find(x => sinTilde(x.nombre) === sinTilde(prov))
          return (
            <div key={prov} className={`card space-y-2 ${pedidaTodo ? 'border-green-300' : ''}`}>
              <div className='flex justify-between items-start gap-2'>
                <div>
                  <div className='font-semibold'>{prov}</div>
                  <div className='text-xs text-gray-500'>{pv?.whatsapp ? `WhatsApp ${pv.whatsapp}` : 'Sin WhatsApp guardado: agrégalo en la pestaña Proveedores'}</div>
                </div>
                {pedidaTodo && <span className='text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 font-semibold whitespace-nowrap'>✓ Ya pedida</span>}
              </div>
              {lista.map(t => (
                <div key={t.tela} className='border-t border-gray-100 pt-2'>
                  <div className='flex justify-between gap-2'>
                    <span className='font-medium'>{yaPedido.has(sinTilde(t.tela)) ? '✓ ' : ''}{t.tela}</span>
                    <span className='font-semibold whitespace-nowrap'>{num(redondo(t.metros))} m</span>
                  </div>
                  <div className='text-xs text-gray-500'>{t.sofas.join(' · ')}</div>
                  {t.sinMedida && <div className='text-xs text-amber-700'>⚠ Hay una referencia sin metros de tela en Costos/Productos: revisa la cantidad.</div>}
                  {t.estimados.length > 0 && <div className='text-xs text-amber-700'>≈ Metros estimados para {t.estimados.join(', ')} (no está en Productos).</div>}
                </div>
              ))}
              <div className='flex gap-2 pt-1'>
                <button className='btn btn-primary flex-1 justify-center' onClick={() => pedir(prov, lista)}>💬 Pedir por WhatsApp</button>
                <button className='btn' onClick={() => copiar(prov, lista)}>{msg[prov] === 'copiado' ? '✓ Copiado' : 'Copiar'}</button>
              </div>
              {msg[prov] === 'ok' && <p className='text-xs text-green-700'>Quedó registrado en el historial.</p>}
              {msg[prov] && !['ok', 'copiado'].includes(msg[prov]) && <p className='text-xs text-red-700'>{msg[prov]}</p>}
            </div>
          )
        })}
        <p className='text-xs text-gray-500'>Los metros se redondean a medio metro hacia arriba. El proveedor de cada tela sale de Materiales.</p>
      </>)}
    </div>
  )
}

/* ---------------- HISTORIAL ---------------- */

function TabHistorial() {
  const [lista, setLista] = useState(null)
  const [abierto, setAbierto] = useState(null)
  useEffect(() => {
    supabase.from('compra_pedidos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(150)
      .then(({ data }) => setLista(data || []))
  }, [])
  if (!lista) return <p className='text-gray-500'>Cargando…</p>
  if (!lista.length) return <div className='card text-center py-10 text-gray-500'>Todavía no hay pedidos registrados.</div>

  const mes = hoyISO().slice(0, 7)
  const totalMes = lista.filter(x => x.fecha.startsWith(mes)).reduce((s, x) => s + Number(x.total), 0)
  return (
    <div className='space-y-2'>
      <div className='card flex justify-between font-semibold'><span className='capitalize'>Total {MESES[Number(mes.slice(5)) - 1]}</span><span>{pesos(totalMes)}</span></div>
      {lista.map(x => (
        <div key={x.id} className='card p-0 overflow-hidden'>
          <button className='w-full text-left p-3 flex justify-between gap-2' onClick={() => setAbierto(abierto === x.id ? null : x.id)} aria-expanded={abierto === x.id}>
            <div>
              <div className='font-medium'>{x.proveedor_nombre}</div>
              <div className='text-xs text-gray-500 capitalize'>{fechaTexto(x.fecha)} · {horaTexto(x.created_at)}</div>
            </div>
            <div className='font-semibold whitespace-nowrap'>{pesos(x.total)}</div>
          </button>
          {abierto === x.id && (
            <ul className='border-t border-gray-100 px-3 py-2 text-sm space-y-0.5'>
              {(x.items || []).map((i, k) => <li key={k} className='flex justify-between'><span>{num(i.cantidad)} {i.unidad} · {i.nombre}</span><span>{pesos(i.precio * i.cantidad)}</span></li>)}
              {Number(x.costo_fijo) > 0 && <li className='flex justify-between text-gray-600'><span>Transporte</span><span>{pesos(x.costo_fijo)}</span></li>}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

/* ---------------- PROVEEDORES (editar) ---------------- */

function TabProveedores({ provs, recargar }) {
  const [editando, setEditando] = useState(null)
  async function nuevo() {
    const { data } = await supabase.from('compra_proveedores').insert({ nombre: 'Nuevo proveedor', dias: [], orden: provs.length + 1 }).select().single()
    await recargar()
    if (data) setEditando(data.id)
  }
  return (
    <div className='space-y-3'>
      {provs.map(p => editando === p.id
        ? <EditarProveedor key={p.id} p={p} cerrar={() => setEditando(null)} recargar={recargar} />
        : (
          <button key={p.id} className={`card w-full text-left ${p.activo ? '' : 'opacity-50'}`} onClick={() => setEditando(p.id)}>
            <div className='flex justify-between gap-2'>
              <div>
                <div className='font-semibold'>{p.nombre}{!p.activo && ' (pausado)'}</div>
                <div className='text-xs text-gray-500'>{(p.dias || []).sort().map(d => DIAS[d]).join(', ') || 'Sin días'} · {p.insumos.length} insumo(s)</div>
              </div>
              <div className='text-sm font-semibold whitespace-nowrap'>{pesos(totalProveedor(p))}</div>
            </div>
          </button>
        ))}
      <button className='btn w-full' onClick={nuevo}>+ Agregar proveedor</button>
    </div>
  )
}

function EditarProveedor({ p, cerrar, recargar }) {
  const [f, setF] = useState({ nombre: p.nombre, contacto: p.contacto || '', whatsapp: p.whatsapp || '', dias: p.dias || [], costo_fijo: String(p.costo_fijo || ''), activo: p.activo })
  const [insumos, setInsumos] = useState(p.insumos.map(i => ({ ...i, precio: String(i.precio), cantidad: String(i.cantidad) })))
  const [borrados, setBorrados] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const setI = (k, cambios) => setInsumos(a => a.map((x, j) => (j === k ? { ...x, ...cambios } : x)))
  const toggleDia = d => setF(x => ({ ...x, dias: x.dias.includes(d) ? x.dias.filter(y => y !== d) : [...x.dias, d].sort() }))

  async function guardar() {
    if (!f.nombre.trim()) { setError('Escribe el nombre del proveedor.'); return }
    setGuardando(true); setError(null)
    const { error: e1 } = await supabase.from('compra_proveedores').update({
      nombre: f.nombre.trim(), contacto: f.contacto.trim() || null, whatsapp: f.whatsapp.replace(/\D/g, '') || null,
      dias: f.dias, costo_fijo: Number(f.costo_fijo) || 0, activo: f.activo,
    }).eq('id', p.id)
    const filas = insumos.filter(i => i.nombre.trim()).map((i, k) => ({
      ...(i.id ? { id: i.id } : {}), proveedor_id: p.id, nombre: i.nombre.trim(), unidad: (i.unidad || '').trim() || null,
      precio: Number(i.precio) || 0, cantidad: Number(i.cantidad) || 0, orden: k + 1, activo: true,
    }))
    const nuevos = filas.filter(x => !x.id), existentes = filas.filter(x => x.id)
    const r = await Promise.all([
      existentes.length ? supabase.from('compra_insumos').upsert(existentes) : { error: null },
      nuevos.length ? supabase.from('compra_insumos').insert(nuevos) : { error: null },
      // Los insumos quitados se archivan (no se borran) para no perder el historial
      borrados.length ? supabase.from('compra_insumos').update({ activo: false }).in('id', borrados) : { error: null },
    ])
    const err = e1 || r.find(x => x.error)?.error
    setGuardando(false)
    if (err) { setError('No se guardó: ' + err.message); return }
    await recargar(); cerrar()
  }

  return (
    <div className='card space-y-3 border-gray-900'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <L t='Proveedor'><input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></L>
        <L t='Contacto'><input value={f.contacto} onChange={e => setF({ ...f, contacto: e.target.value })} placeholder='Ej: Yerson' /></L>
        <L t='WhatsApp'><input inputMode='tel' value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder='Ej: 3158101692' /></L>
        <L t='Transporte por pedido'><input inputMode='numeric' value={f.costo_fijo} onChange={e => setF({ ...f, costo_fijo: e.target.value.replace(/\D/g, '') })} placeholder='0' /></L>
      </div>
      <div>
        <div className='text-xs text-gray-500 mb-1'>Días de compra</div>
        <div className='flex flex-wrap gap-1.5'>
          {[1, 2, 3, 4, 5, 6].map(d => (
            <button key={d} type='button' onClick={() => toggleDia(d)} aria-pressed={f.dias.includes(d)}
              className={`px-3 py-1.5 rounded-full border text-sm ${f.dias.includes(d) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'}`}>{DIAS[d].slice(0, 3)}</button>
          ))}
        </div>
      </div>

      <div>
        <div className='text-xs text-gray-500 mb-1'>Insumos (precio y cantidad de siempre)</div>
        <div className='space-y-2'>
          {insumos.map((i, k) => (
            <div key={i.id || 'n' + k} className='rounded-lg border border-gray-200 p-2 space-y-2'>
              <div className='flex gap-2'>
                <input className='flex-1' value={i.nombre} onChange={e => setI(k, { nombre: e.target.value })} placeholder='Insumo' aria-label='Insumo' />
                <button type='button' className='text-sm text-red-600 px-2' onClick={() => { if (i.id) setBorrados(b => [...b, i.id]); setInsumos(a => a.filter((_, j) => j !== k)) }}>Quitar</button>
              </div>
              <div className='grid grid-cols-3 gap-2'>
                <L t='Unidad'><input value={i.unidad || ''} onChange={e => setI(k, { unidad: e.target.value })} placeholder='rollo' /></L>
                <L t='Precio'><input inputMode='numeric' value={i.precio} onChange={e => setI(k, { precio: e.target.value.replace(/[^\d.]/g, '') })} /></L>
                <L t='Cantidad'><input inputMode='decimal' value={i.cantidad} onChange={e => setI(k, { cantidad: e.target.value.replace(/[^\d.]/g, '') })} /></L>
              </div>
            </div>
          ))}
          <button type='button' className='btn w-full' onClick={() => setInsumos(a => [...a, { nombre: '', unidad: '', precio: '', cantidad: '1' }])}>+ Agregar insumo</button>
        </div>
      </div>

      <label className='flex items-center gap-2 text-sm'>
        <input type='checkbox' checked={!f.activo} onChange={e => setF({ ...f, activo: !e.target.checked })} style={{ width: 'auto' }} /> Pausar este proveedor (no aparece en Hoy ni en Semana)
      </label>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <div className='flex gap-2'>
        <button className='btn btn-primary flex-1' onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button className='btn' onClick={cerrar}>Cancelar</button>
      </div>
    </div>
  )
}

function L({ t, children }) {
  return <div><label className='text-xs text-gray-500 mb-1 block'>{t}</label>{children}</div>
}
