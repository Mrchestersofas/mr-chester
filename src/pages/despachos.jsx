import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* Despachos: 1) registrar el pago del saldo, 2) despachar con remisión (REM-001…).
   No se puede despachar mientras quede saldo. Al despachar, el pedido queda entregado,
   el cliente lo ve en su seguimiento y la remisión llega por correo (cliente, Mónica y Joseph). */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
function fechaLarga(iso) { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}` }
function fechaCorta(iso) { if (!iso) return '—'; const [, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${MESES[m - 1].slice(0, 3)}` }
function primerNombre(n) { const x = String(n || '').trim().split(/\s+/)[0] || ''; return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() }
const ETAPA = { cola: 'En cola', estructura: 'Estructura', espumado: 'Espumado', corte_tela: 'Corte de tela', tapizado: 'Tapizado', terminado: 'Terminado', control_calidad: 'Control de calidad', despacho: 'Listo', completado: 'Entregado' }
const etapaDe = p => (Array.isArray(p.programacion_produccion) ? p.programacion_produccion[0] : p.programacion_produccion)?.etapa_actual || 'cola'
const MEDIOS = [['efectivo', 'Efectivo'], ['transferencia', 'Transferencia bancaria'], ['tarjeta_credito', 'Tarjeta crédito'], ['tarjeta_debito', 'Tarjeta débito'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata']]

export default function Despachos() {
  const [tab, setTab] = useState('pendientes')
  const [pedidos, setPedidos] = useState(null)
  const [remisiones, setRemisiones] = useState([])
  const [resultado, setResultado] = useState(null)

  async function cargar() {
    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase.from('pedidos').select('*, cliente:clientes(*), programacion_produccion(etapa_actual)')
        .not('estado', 'in', '(entregado,cancelado)').order('fecha_entrega'),
      supabase.from('remisiones').select('*, cliente:clientes(*)').order('created_at', { ascending: false }).limit(60),
    ])
    setPedidos(ps || [])
    setRemisiones(rs || [])
  }
  useEffect(() => { cargar() }, [])

  if (resultado) return <Resultado {...resultado} volver={() => { setResultado(null); cargar() }} />
  if (!pedidos) return <div className='p-4 text-gray-500'>Cargando…</div>

  // Agrupar por compra (pedidos con varios productos comparten "grupo")
  const grupos = {}
  pedidos.forEach(p => { const g = p.grupo || p.numero; (grupos[g] = grupos[g] || []).push(p) })
  const lista = Object.entries(grupos).map(([g, items]) => ({ g, items, listos: items.filter(p => etapaDe(p) === 'despacho').length }))
  const listos = lista.filter(x => x.listos > 0)
  const enProduccion = lista.filter(x => x.listos === 0)

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium mb-4'>Despachos</h1>
      <div className='flex gap-2 mb-4'>
        {[['pendientes', `Por despachar (${listos.length})`], ['remisiones', 'Remisiones']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'pendientes' ? (
        <div className='space-y-3'>
          {listos.length === 0 && <div className='card text-center text-gray-500 py-8'>No hay pedidos listos para entregar.<br /><span className='text-xs'>Aparecen aquí cuando en Producción pasan a "Despacho".</span></div>}
          {listos.map(x => <Grupo key={x.g} x={x} recargar={cargar} alDespachar={setResultado} />)}
          {enProduccion.length > 0 && (
            <details className='pt-2'>
              <summary className='text-sm text-gray-600 cursor-pointer py-2'>Pedidos todavía en producción ({enProduccion.length}) — por si necesitas registrar un pago o despachar antes</summary>
              <div className='space-y-3 mt-2'>{enProduccion.map(x => <Grupo key={x.g} x={x} recargar={cargar} alDespachar={setResultado} />)}</div>
            </details>
          )}
        </div>
      ) : (
        <div className='space-y-2'>
          {remisiones.length === 0 && <div className='card text-center text-gray-500 py-8'>Todavía no hay remisiones.</div>}
          {remisiones.map(r => (
            <button key={r.id} className='card w-full text-left flex justify-between gap-2' onClick={() => setResultado({ rem: r, cliente: r.cliente, correo: null })}>
              <div>
                <div className='font-semibold'>{r.numero} · {r.cliente?.nombre || '—'}</div>
                <div className='text-xs text-gray-500'>{fechaCorta(r.fecha)} · {(r.items || []).map(i => i.tipo_sofa).join(', ')}{r.entregado_por ? ` · ${r.entregado_por}` : ''}</div>
              </div>
              <div className='font-semibold whitespace-nowrap'>{pesos(r.total)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Una compra (uno o varios productos) ---------- */

function Grupo({ x, recargar, alDespachar }) {
  const [abierto, setAbierto] = useState(false)
  const [sel, setSel] = useState(() => Object.fromEntries(x.items.map(p => [p.id, x.listos === 0 || etapaDe(p) === 'despacho'])))
  const elegidos = x.items.filter(p => sel[p.id])
  const total = elegidos.reduce((s, p) => s + Number(p.precio_venta || 0), 0)
  const pagado = elegidos.reduce((s, p) => s + Number(p.abono || 0), 0)
  const saldo = Math.max(0, total - pagado)
  const c = x.items[0].cliente
  const [por, setPor] = useState('')
  const [telT, setTelT] = useState('')

  return (
    <div className='card p-0 overflow-hidden'>
      <button className='w-full p-4 text-left flex justify-between gap-2' onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <div className='min-w-0'>
          <div className='font-semibold'>{x.g} · {c?.nombre || 'Sin cliente'}</div>
          <div className='text-sm text-gray-600 truncate'>{x.items.map(p => p.tipo_sofa + (p.cantidad > 1 ? ` ×${p.cantidad}` : '')).join(' + ')}</div>
          <div className='text-xs text-gray-500'>Entrega prometida {fechaCorta(x.items[0].fecha_entrega)} · {c?.ciudad || 'Bogotá'}</div>
        </div>
        <div className='text-right flex-none'>
          <div className={`text-sm font-semibold ${saldo > 0 ? 'text-red-600' : 'text-green-700'}`}>{saldo > 0 ? `Saldo ${pesos(saldo)}` : '✓ Pagado'}</div>
          <div className='text-xs text-gray-500'>{x.listos}/{x.items.length} listo{x.items.length > 1 ? 's' : ''}</div>
        </div>
      </button>

      {abierto && (
        <div className='border-t border-gray-100 p-4 space-y-4'>
          {c && (
            <div className='text-sm text-gray-700 rounded-lg bg-gray-50 p-3'>
              {c.direccion && <div>📍 {c.direccion}{c.ciudad ? `, ${c.ciudad}` : ''}</div>}
              {c.telefono && <div>📱 {c.telefono}</div>}
              {c.email && <div>✉️ {c.email}</div>}
            </div>
          )}

          <div className='space-y-1.5'>
            {x.items.map(p => (
              <label key={p.id} className='flex items-start gap-2 text-sm cursor-pointer'>
                <input type='checkbox' checked={!!sel[p.id]} onChange={e => setSel(s => ({ ...s, [p.id]: e.target.checked }))} style={{ width: 'auto', marginTop: 3 }} />
                <span className='flex-1'>
                  <b>{p.numero}</b> · {p.tipo_sofa}{p.cantidad > 1 ? ` × ${p.cantidad}` : ''} · {p.material}
                  <span className={`ml-1 text-xs ${etapaDe(p) === 'despacho' ? 'text-green-700' : 'text-amber-700'}`}>({ETAPA[etapaDe(p)] || etapaDe(p)})</span>
                </span>
                <span className='whitespace-nowrap'>{pesos(p.precio_venta)}</span>
              </label>
            ))}
          </div>

          <div className='rounded-lg bg-gray-50 p-3 text-sm space-y-1'>
            <div className='flex justify-between'><span className='text-gray-600'>Total</span><span>{pesos(total)}</span></div>
            <div className='flex justify-between'><span className='text-gray-600'>Pagado</span><span className='text-green-700'>{pesos(pagado)}</span></div>
            <div className='flex justify-between font-semibold pt-1 border-t border-gray-200'><span>Saldo</span><span className={saldo > 0 ? 'text-red-600' : 'text-green-700'}>{pesos(saldo)}</span></div>
          </div>

          {elegidos.length > 0 && <Transportador x={x} elegidos={elegidos} saldo={saldo} por={por} setPor={setPor} tel={telT} setTel={setTelT} />}
          {elegidos.length === 0 ? <p className='text-sm text-gray-500'>Elige al menos un producto.</p>
            : saldo > 0 ? <><CobrarSaldo c={c} elegidos={elegidos} saldo={saldo} /><Pago elegidos={elegidos} saldo={saldo} listo={recargar} /></>
            : <Despachar x={x} elegidos={elegidos} total={total} pagado={pagado} alDespachar={alDespachar} por={por} setPor={setPor} tel={telT} />}
        </div>
      )}
    </div>
  )
}

/* ---------- Cobrar el saldo por WhatsApp ---------- */

const MEDIOS_EJEMPLO = '🏦 *Bancolombia* – Cuenta de ahorros [número]\n   A nombre de Mr. Chester Export S.A.S. · NIT [NIT]\n🔑 *Llave Bancolombia:* [llave]\n📱 *Nequi:* [número]\n💳 *Tarjeta de crédito:* te enviamos un link de pago, sin costo adicional'

function mensajeCobro(c, elegidos, saldo, medios) {
  const productos = elegidos.map(p => p.tipo_sofa + (p.cantidad > 1 ? ` ×${p.cantidad}` : '')).join(' + ')
  const listos = elegidos.every(p => etapaDe(p) === 'despacho')
  return [
    '♛ *MR. CHESTER* ♛',
    '_Sofás Chesterfield · Fabricantes_',
    '',
    `¡Hola, ${primerNombre(c?.nombre) || ''}! 👋`,
    '',
    listos ? `Tenemos una excelente noticia: tu *${productos}* ya está *listo para despacho* 🛋️✨` : `Te escribimos por tu pedido *${productos}* 🛋️`,
    '',
    `📦 Pedido: *${elegidos.map(p => p.numero).join(', ')}*`,
    `💰 Saldo pendiente: *${pesos(saldo)}*`,
    '',
    'Para programar la entrega, te pedimos realizar el pago del saldo por cualquiera de estos medios:',
    '',
    medios,
    '',
    'Cuando realices el pago, envíanos el comprobante por este chat y coordinamos la fecha y hora de entrega 🚚',
    '',
    '¡Gracias por elegir Mr. Chester! 🙌',
  ].join('\n')
}

function CobrarSaldo({ c, elegidos, saldo }) {
  const [medios, setMedios] = useState(null)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [ver, setVer] = useState(false)
  useEffect(() => {
    supabase.from('ajustes').select('valor').eq('clave', 'medios_pago').maybeSingle().then(({ data }) => setMedios(data?.valor || ''))
  }, [])
  if (medios === null) return null
  const faltan = !medios || medios.includes('[')
  const texto = mensajeCobro(c, elegidos, saldo, medios || MEDIOS_EJEMPLO)
  const tel = String(c?.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel

  async function guardar() {
    await supabase.from('ajustes').upsert({ clave: 'medios_pago', valor: borrador.trim() })
    setMedios(borrador.trim()); setEditando(false)
  }

  if (editando) return (
    <div className='rounded-lg border border-gray-200 p-3 space-y-2'>
      <label htmlFor='medios' className='text-sm font-semibold block'>Medios de pago (salen en el mensaje)</label>
      <textarea id='medios' rows={7} className='w-full text-sm' value={borrador} onChange={e => setBorrador(e.target.value)} />
      <p className='text-xs text-gray-500'>Cambia lo que está entre [corchetes] por tus datos. Los *asteriscos* salen en negrilla en WhatsApp.</p>
      <div className='flex gap-2'><button className='btn btn-primary flex-1' onClick={guardar}>Guardar</button><button className='btn' onClick={() => setEditando(false)}>Cancelar</button></div>
    </div>
  )

  return (
    <div className='space-y-2'>
      {faltan && <p className='text-xs text-amber-700'>⚠ Antes del primer envío, pon tus datos de pago: <button className='underline font-semibold' onClick={() => { setBorrador(medios || MEDIOS_EJEMPLO); setEditando(true) }}>Editar medios de pago</button></p>}
      <div className='flex gap-2'>
        {telWa ? (
          <a className={`btn flex-1 text-center ${faltan ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: '#25D366', color: '#fff', borderColor: '#25D366' }}
            href={`https://wa.me/${telWa}?text=${encodeURIComponent(texto)}`} target='_blank' rel='noreferrer'>💬 Cobrar saldo por WhatsApp</a>
        ) : <p className='text-sm text-gray-500 flex-1'>El cliente no tiene teléfono registrado.</p>}
        <button type='button' className='btn' onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Ver mensaje'}</button>
      </div>
      {ver && (
        <div className='rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2'>
          <pre className='whitespace-pre-wrap text-xs font-sans'>{texto}</pre>
          <div className='flex gap-3 text-xs'>
            <button className='underline text-gray-600' onClick={() => navigator.clipboard?.writeText(texto)}>Copiar</button>
            <button className='underline text-gray-600' onClick={() => { setBorrador(medios || MEDIOS_EJEMPLO); setEditando(true) }}>Editar medios de pago</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Paso 1: registrar el pago ---------- */

function Pago({ elegidos, saldo, listo }) {
  const [valor, setValor] = useState(String(Math.round(saldo)))
  const [medio, setMedio] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function registrar() {
    const v = Number(valor)
    if (!(v > 0)) { setError('Escribe el valor del pago.'); return }
    if (v > saldo + 1) { setError(`El pago es mayor al saldo (${pesos(saldo)}).`); return }
    if (!medio) { setError('Elige el medio de pago.'); return }
    setGuardando(true); setError(null)
    // El pago se reparte entre los productos elegidos, llenando el saldo de cada uno en orden
    let resto = v
    for (const p of elegidos) {
      const s = Number(p.precio_venta || 0) - Number(p.abono || 0)
      const parte = Math.min(s, resto)
      if (parte <= 0) continue
      resto -= parte
      const { error: e1 } = await supabase.from('pedido_pagos').insert({ pedido_id: p.id, fecha, valor: parte, medio_pago: medio })
      const { error: e2 } = await supabase.from('pedidos').update({ abono: Number(p.abono || 0) + parte }).eq('id', p.id)
      await supabase.from('historial_estados').insert({ pedido_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, nota: `Pago registrado: ${pesos(parte)} (${medio})` })
      if (e1 || e2) { setError('No se guardó el pago: ' + (e1 || e2).message); setGuardando(false); return }
      if (resto <= 0) break
    }
    setGuardando(false)
    listo()
  }

  return (
    <div className='rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3'>
      <div className='font-semibold text-sm'>1 · Registrar pago</div>
      <p className='text-xs text-gray-600'>Para despachar, el saldo debe quedar en $0.</p>
      <div className='grid grid-cols-2 gap-2'>
        <div><label className='text-xs text-gray-500 mb-1 block'>Valor</label><input inputMode='numeric' value={valor} onChange={e => setValor(e.target.value.replace(/\D/g, ''))} /></div>
        <div><label className='text-xs text-gray-500 mb-1 block'>Fecha</label><input type='date' value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      </div>
      <div>
        <label className='text-xs text-gray-500 mb-1 block'>Medio de pago</label>
        <select value={medio} onChange={e => setMedio(e.target.value)}>
          <option value=''>Seleccionar</option>
          {MEDIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <button className='btn btn-primary w-full' onClick={registrar} disabled={guardando}>{guardando ? 'Guardando…' : `Registrar pago de ${pesos(valor)}`}</button>
    </div>
  )
}

/* ---------- Paso 2: despachar con remisión ---------- */

function Despachar({ x, elegidos, total, pagado, alDespachar, por, setPor, tel }) {
  const [fecha, setFecha] = useState(hoyISO())
  const [obs, setObs] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [sugeridos, setSugeridos] = useState([])
  useEffect(() => {
    supabase.from('remisiones').select('entregado_por').not('entregado_por', 'is', null).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setSugeridos([...new Set((data || []).map(r => r.entregado_por))]))
  }, [])

  async function despachar() {
    if (!por.trim()) { setError('Escribe quién entregó o el transportador.'); return }
    const noListos = elegidos.filter(p => etapaDe(p) !== 'despacho')
    if (noListos.length && !confirm(`${noListos.map(p => p.numero).join(', ')} todavía no está listo en Producción. ¿Despachar igual?`)) return
    setGuardando(true); setError(null)
    const cliente = elegidos[0].cliente
    const items = elegidos.map(p => ({ pedido_id: p.id, numero: p.numero, tipo_sofa: p.tipo_sofa, material: p.material, cantidad: p.cantidad, precio_venta: Number(p.precio_venta || 0) }))
    const { data: rem, error: e } = await supabase.from('remisiones').insert({
      numero: '', grupo: x.g, cliente_id: cliente?.id || null, pedido_ids: elegidos.map(p => p.id), items,
      fecha, entregado_por: por.trim(), entregado_tel: tel.replace(/\D/g, '') || null, observaciones: obs.trim() || null, total, pagado,
    }).select().single()
    if (e || !rem) { setError('No se creó la remisión: ' + (e?.message || 'error')); setGuardando(false); return }

    const ids = elegidos.map(p => p.id)
    await supabase.from('pedidos').update({ estado: 'entregado' }).in('id', ids)
    await supabase.from('programacion_produccion').update({ etapa_actual: 'completado' }).in('pedido_id', ids)
    for (const p of elegidos) {
      await supabase.from('historial_estados').insert({ pedido_id: p.id, estado_anterior: p.estado, estado_nuevo: 'entregado', nota: `Despachado con remisión ${rem.numero} · entregó ${por.trim()}` })
    }
    const correo = await enviarRemision(rem, cliente)
    setGuardando(false)
    alDespachar({ rem, cliente, correo })
  }

  return (
    <div className='rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-3'>
      <div className='font-semibold text-sm'>2 · Despachar</div>
      <div>
        <label className='text-xs text-gray-500 mb-1 block'>¿Quién entregó? / Transportador *</label>
        <input list={'entregadores-' + x.g} value={por} onChange={e => setPor(e.target.value)} placeholder='Ej: Carlos (camioneta)' />
        <datalist id={'entregadores-' + x.g}>{sugeridos.map(s => <option key={s} value={s} />)}</datalist>
      </div>
      <div><label className='text-xs text-gray-500 mb-1 block'>Fecha de entrega</label><input type='date' value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      <div><label className='text-xs text-gray-500 mb-1 block'>Observaciones</label><textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder='Opcional' /></div>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <button className='btn btn-primary w-full' onClick={despachar} disabled={guardando}>{guardando ? 'Despachando…' : '🚚 Despachar y crear remisión'}</button>
    </div>
  )
}

/* ---------- Orden de entrega para el transportador (WhatsApp, antes de despachar) ---------- */

function Transportador({ x, elegidos, saldo, por, setPor, tel, setTel }) {
  const [lista, setLista] = useState([])
  const [otro, setOtro] = useState(false)
  const [obs, setObs] = useState('')
  const [enviado, setEnviado] = useState(false)
  useEffect(() => {
    supabase.from('transportadores').select('*').eq('activo', true).order('nombre').then(({ data }) => setLista(data || []))
  }, [])

  function elegir(v) {
    if (v === '__otro') { setOtro(true); setPor(''); setTel(''); return }
    setOtro(false)
    const t = lista.find(l => l.id === v)
    setPor(t ? t.nombre : ''); setTel(t ? t.whatsapp || '' : '')
  }
  async function guardarNuevo() {
    if (!por.trim()) return
    const { data } = await supabase.from('transportadores').insert({ nombre: por.trim(), whatsapp: tel.replace(/\D/g, '') || null }).select().single()
    if (data) { setLista(l => [...l, data].sort((a, b) => a.nombre.localeCompare(b.nombre))); setOtro(false) }
  }
  const elegido = lista.find(l => l.nombre === por)
  const c = elegidos[0].cliente || {}
  const dir = [c.direccion, c.ciudad].filter(Boolean).join(', ')
  const t = tel.replace(/\D/g, '')
  const telWa = t.length === 10 ? '57' + t : t


  function texto() {
    return [
      `🚚 *ORDEN DE ENTREGA · MR. CHESTER*`,
      `Pedido ${x.g}`,
      ``,
      `👤 *${c.nombre || 'Cliente'}*`,
      c.telefono ? `📱 ${c.telefono}` : null,
      dir ? `📍 ${dir}` : null,
      dir ? `🗺️ https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}` : null,
      ``,
      `*Productos:*`,
      ...elegidos.map(p => `• ${p.tipo_sofa}${p.cantidad > 1 ? ` × ${p.cantidad}` : ''} · ${p.material}`),
      ``,
      saldo > 0 ? `💰 *Saldo pendiente: $${Math.round(saldo).toLocaleString('es-CO')}* — confirmar pago antes de entregar` : `✅ Pagado — no cobrar`,
      obs.trim() ? `📝 ${obs.trim()}` : null,
      ``,
      `Recoger en fábrica: Cra 99 #155-21, Bogotá`,
      `Al entregar, avísanos por aquí. ¡Gracias!`,
    ].filter(l => l !== null).join('\n')
  }

  return (
    <div className='rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3'>
      <div className='font-semibold text-sm'>🚚 Enviar orden al transportador</div>
      <div>
        <label className='text-xs text-gray-500 mb-1 block'>Transportador</label>
        <select value={otro ? '__otro' : elegido ? elegido.id : ''} onChange={e => elegir(e.target.value)}>
          <option value=''>Seleccionar</option>
          {lista.map(t => <option key={t.id} value={t.id}>{t.nombre}{t.whatsapp ? ` · ${t.whatsapp}` : ''}</option>)}
          <option value='__otro'>+ Otro transportador</option>
        </select>
      </div>
      {otro && (
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
          <div><label className='text-xs text-gray-500 mb-1 block'>Nombre</label><input value={por} onChange={e => setPor(e.target.value)} placeholder='Ej: Carlos (camioneta)' /></div>
          <div><label className='text-xs text-gray-500 mb-1 block'>WhatsApp</label><input inputMode='tel' value={tel} onChange={e => setTel(e.target.value)} placeholder='Ej: 3001234567' /></div>
          <button type='button' className='btn sm:col-span-2' onClick={guardarNuevo} disabled={!por.trim()}>Guardar en la lista</button>
        </div>
      )}
      <div><label className='text-xs text-gray-500 mb-1 block'>Indicaciones (opcional)</label><input value={obs} onChange={e => setObs(e.target.value)} placeholder='Ej: llamar antes, entregar después de las 2 p. m.' /></div>
      {t.length >= 10
        ? <a className='btn btn-primary w-full text-center block' href={`https://wa.me/${telWa}?text=${encodeURIComponent(texto())}`} target='_blank' rel='noreferrer' onClick={() => setEnviado(true)}>🟢 Enviar por WhatsApp</a>
        : <p className='text-xs text-gray-500'>Escribe el WhatsApp del transportador para enviarle la orden con la dirección, el teléfono del cliente y el mapa.</p>}
      {enviado && <p className='text-sm text-green-700'>✓ Abierto en WhatsApp. El nombre y el número quedan guardados al despachar.</p>}
    </div>
  )
}

async function enviarRemision(remision, cliente) {
  try {
    const r = await fetch('/api/enviar-remision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remision, cliente }) })
    return await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }))
  } catch (e) { return { ok: false, error: 'No hubo conexión para enviar el correo.' } }
}

/* ---------- Después de despachar (o al abrir una remisión) ---------- */

function Resultado({ rem, cliente, correo: inicial, volver }) {
  const [correo, setCorreo] = useState(inicial)
  const [trabajando, setTrabajando] = useState(false)
  const [img, setImg] = useState(null)
  const tel = (cliente?.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel
  const msg = textoWhatsApp(rem, cliente)

  async function compartir() {
    setTrabajando(true)
    try {
      const blob = await dibujarRemision(rem, cliente)
      const archivo = new File([blob], `Remision-${rem.numero}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], text: msg }) } catch (e) { if (e && e.name !== 'AbortError') setImg(URL.createObjectURL(blob)) }
      } else setImg(URL.createObjectURL(blob))
    } catch (e) { alert('No se pudo crear la imagen: ' + e.message) }
    setTrabajando(false)
  }

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <div className='card space-y-4'>
        <div className='rounded-lg bg-green-50 border border-green-200 p-4'>
          <p className='text-sm text-green-700 font-semibold'>✓ {inicial !== null ? 'Despachado' : 'Remisión'}</p>
          <p className='text-3xl font-bold mt-1'>{rem.numero}</p>
          <p className='text-sm text-gray-600 mt-1'>{cliente?.nombre} · {fechaLarga(rem.fecha)} · entregó {rem.entregado_por}</p>
          <ul className='text-sm text-gray-700 mt-2'>{(rem.items || []).map(i => <li key={i.numero}>{i.numero} · {i.tipo_sofa}{i.cantidad > 1 ? ` × ${i.cantidad}` : ''} · {i.material}</li>)}</ul>
        </div>
        {correo && (
          <div className={`rounded-lg p-3 text-sm border ${correo.enviando ? 'bg-gray-50 border-gray-200' : correo.cliente_ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            {correo.enviando ? 'Enviando correo…'
              : correo.cliente_ok ? <>✓ Remisión enviada a <b>{cliente.email}</b></>
              : !cliente?.email ? <>El cliente no tiene correo. Envíale la remisión por WhatsApp.</>
              : <>⚠ No se pudo enviar el correo al cliente: {correo.error}</>}
            {correo.copias_ok && <div className='text-gray-500 mt-1'>Copia a Mónica y a ti ✓</div>}
          </div>
        )}
        <button className='btn btn-primary' onClick={compartir} disabled={trabajando}>{trabajando ? 'Preparando imagen…' : '📄 Compartir remisión con logo'}</button>
        {tel && <a className='btn text-center block' href={`https://wa.me/${telWa}?text=${encodeURIComponent(msg)}`} target='_blank' rel='noreferrer'>Enviar solo texto por WhatsApp</a>}
        {img && <div className='rounded-lg border p-2 text-center text-sm text-gray-600'>Mantén presionada la imagen para guardarla o compartirla.<img src={img} alt={`Remisión ${rem.numero}`} className='mt-2 rounded' /></div>}
        <button className='btn w-full' disabled={correo?.enviando} onClick={async () => { setCorreo({ enviando: true }); setCorreo(await enviarRemision(rem, cliente)) }}>Reenviar por correo</button>
        <button className='btn w-full' onClick={volver}>Volver a Despachos</button>
      </div>
    </div>
  )
}

function textoWhatsApp(rem, cliente) {
  return [
    `👑 *MR. CHESTER* · Sofás que hablan de ti`,
    `━━━━━━━━━━━━━━`,
    `Hola ${primerNombre(cliente?.nombre)}, ✅ *tu pedido fue entregado.*`,
    `Remisión *${rem.numero}* · ${fechaLarga(rem.fecha)}`,
    ``,
    ...(rem.items || []).map(i => `🛋️ ${i.tipo_sofa}${i.cantidad > 1 ? ` × ${i.cantidad}` : ''} · ${i.material}`),
    ``,
    `💰 Total: ${pesos(rem.total)} · Pagado: ${pesos(rem.pagado)} ✓`,
    `🛡️ Garantía de 5 años sobre estructura y defectos de fabricación.`,
    `━━━━━━━━━━━━━━`,
    `¡Gracias por elegirnos! Disfruta tu sofá 🛋️`,
  ].join('\n')
}

function cargarImagen(src) { return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('logo')); i.src = src }) }

async function dibujarRemision(rem, cliente) {
  const items = rem.items || []
  const ORO = '#C9A84C', NEGRO = '#1a1a1a', CREMA = '#f4f1eb', GRIS = '#6b6b6b'
  const serif = 'Georgia, "Times New Roman", serif', sans = 'Helvetica, Arial, sans-serif'
  const W = 1080, x0 = 70, y0 = 450, cw = W - 140
  const filas = [
    ...items.map(i => [`${i.tipo_sofa}${i.cantidad > 1 ? ` × ${i.cantidad}` : ''}`, i.material || '']),
    ['Fecha de entrega', fechaLarga(rem.fecha)],
    ['Entregó', rem.entregado_por || ''],
    ['Valor total', pesos(rem.total)],
  ]
  const dir = [cliente?.direccion, cliente?.ciudad].filter(Boolean).join(', ')
  const ch = 300 + filas.length * 78 + 140
  const H = y0 + ch + 140 + 190
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const rect = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill() }
  const corta = (t, max) => { let s = String(t); while (g.measureText(s).width > max && s.length > 3) s = s.slice(0, -2); return s === String(t) ? s : s + '…' }

  g.fillStyle = CREMA; g.fillRect(0, 0, W, H)
  g.fillStyle = NEGRO; g.fillRect(0, 0, W, 330)
  try { const logo = await cargarImagen('/logo-mrchester.png'); const lw = 400; g.drawImage(logo, (W - lw) / 2, 50, lw, logo.height * (lw / logo.width)) } catch (e) { /* sin logo */ }
  g.textAlign = 'center'; g.fillStyle = ORO
  g.font = `bold 76px ${serif}`; g.fillText('M R .  C H E S T E R', W / 2, 220)
  g.font = `24px ${sans}`; g.fillText('S O F Á S   Q U E   H A B L A N   D E   T I', W / 2, 270)
  g.fillStyle = ORO; g.fillRect(0, 330, W, 70)
  g.fillStyle = NEGRO; g.font = `bold 28px ${sans}`; g.fillText('R E M I S I Ó N   D E   D E S P A C H O', W / 2, 376)

  g.fillStyle = '#ffffff'; rect(x0, y0, cw, ch, 24)
  g.textAlign = 'left'
  g.fillStyle = GRIS; g.font = `26px ${sans}`; g.fillText('REMISIÓN', x0 + 50, y0 + 70)
  g.fillStyle = NEGRO; g.font = `bold 80px ${serif}`; g.fillText(rem.numero || '', x0 + 50, y0 + 155)
  g.fillStyle = GRIS; g.font = `30px ${sans}`; g.fillText(corta(String(cliente?.nombre || '').toUpperCase(), cw - 100), x0 + 50, y0 + 205)
  g.font = `24px ${sans}`; if (dir) g.fillText(corta(dir, cw - 100), x0 + 50, y0 + 245)
  g.fillStyle = ORO; g.fillRect(x0 + 50, y0 + 270, 90, 4)
  let y = y0 + 335
  filas.forEach(([k, v]) => {
    g.fillStyle = GRIS; g.font = `28px ${sans}`; g.textAlign = 'left'; g.fillText(corta(k, cw / 2 - 40), x0 + 50, y)
    g.fillStyle = NEGRO; g.font = `bold 30px ${sans}`; g.textAlign = 'right'; g.fillText(corta(v, cw / 2 - 40), x0 + cw - 50, y)
    g.strokeStyle = '#ece7dd'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 50, y + 28); g.lineTo(x0 + cw - 50, y + 28); g.stroke()
    y += 78
  })
  const by = y0 + ch - 130
  g.fillStyle = '#2f7a4c'; rect(x0 + 40, by, cw - 80, 90, 16)
  g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = `bold 34px ${sans}`
  g.fillText(`✓ PAGADO ${pesos(rem.pagado)} · PAZ Y SALVO`, W / 2, by + 58)

  g.fillStyle = GRIS; g.font = `24px ${sans}`
  g.fillText('Garantía de 5 años sobre estructura y defectos de fabricación.', W / 2, y0 + ch + 60)
  g.fillText('¡Gracias por elegir Mr. Chester!', W / 2, y0 + ch + 100)

  g.fillStyle = NEGRO; g.fillRect(0, H - 190, W, 190)
  g.fillStyle = ORO; g.font = `bold 26px ${sans}`; g.fillText('MR. CHESTER EXPORT S.A.S.', W / 2, H - 125)
  g.fillStyle = '#bdbdbd'; g.font = `24px ${sans}`
  g.fillText('Centro de Experiencia: Cra 19A #85-69, Bogotá', W / 2, H - 82)
  g.fillText('WhatsApp Pedidos: 320 277 4320', W / 2, H - 46)
  return new Promise((ok, mal) => c.toBlob(b => (b ? ok(b) : mal(new Error('no se generó la imagen'))), 'image/png'))
}
