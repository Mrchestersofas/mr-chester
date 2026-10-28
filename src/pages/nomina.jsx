import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* Nómina (valor fijo): cada quincena se paga la mitad del salario los días 5 y 20.
   Al registrar el pago queda en Finanzas (gasto "Nómina quincenal" de ese periodo) y se
   genera un comprobante con el logo para enviarle al empleado por WhatsApp. */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_PAGO = [5, 20]
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
const fLarga = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}` }
const fCorta = iso => { const [, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} de ${MESES[m - 1]}` }
const primerNombre = n => String(n || '').trim().split(/\s+/)[0] || ''
const MEDIOS = [['transferencia', 'Transferencia'], ['nequi', 'Nequi'], ['efectivo', 'Efectivo']]

const MENSAJES = [
  'Gracias por poner tus manos en cada sofá que sale de esta fábrica. Tu trabajo es lo que hace grande a Mr. Chester.',
  'Cada pieza que haces llega a un hogar y lo hace más bonito. Gracias por tu dedicación y tu esfuerzo.',
  'Este equipo no sería el mismo sin ti. Gracias por tu compromiso de todos los días.',
  'Lo que hacemos se nota en cada detalle, y esos detalles los haces tú. ¡Gracias por ser parte de este equipo!',
  'Detrás de cada cliente feliz está tu trabajo. Gracias por dar lo mejor de ti.',
  'Gracias por tu esfuerzo esta quincena. Juntos seguimos construyendo algo de lo que todos nos sentimos orgullosos.',
  'Tu talento y tu constancia son el corazón de Mr. Chester. ¡Gracias por estar aquí!',
  'Cada quincena es la oportunidad de decirte gracias. Gracias por tu trabajo y por tu buena energía.',
]
const mensajeDe = (empId, periodo) => { let h = 0; for (const ch of empId + periodo) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return MENSAJES[h % MENSAJES.length] }

// Periodos de pago (días 5 y 20) desde hace 2 meses hasta el próximo mes
function periodos(hoy) {
  const [y, m] = hoy.split('-').map(Number)
  const out = []
  for (let k = -2; k <= 1; k++) {
    const t = new Date(Date.UTC(y, m - 1 + k, 1))
    DIAS_PAGO.forEach(d => out.push(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`))
  }
  return out
}

export default function Nomina() {
  const hoy = hoyISO()
  const [tab, setTab] = useState('quincena')
  const [emps, setEmps] = useState(null)
  const [pagos, setPagos] = useState([])
  const [pagoFin, setPagoFin] = useState(null)
  const [error, setError] = useState(null)
  const lista = periodos(hoy)
  const [periodo, setPeriodo] = useState(() => lista.find(p => p >= hoy) || lista[lista.length - 1])

  async function cargar() {
    const [{ data: e, error: er }, { data: p }, { data: fp }] = await Promise.all([
      supabase.from('nom_empleados').select('*').order('created_at'),
      supabase.from('nom_pagos').select('*').gte('periodo', lista[0]),
      supabase.from('fin_pagos').select('id, concepto, valor').eq('ambito', 'empresa').ilike('concepto', 'Nómina quincenal%').limit(1),
    ])
    if (er) { setError(er.message); return }
    setEmps(e || []); setPagos(p || []); setPagoFin(fp?.[0] || null)
  }
  useEffect(() => { cargar() }, [])

  if (error) return <div className='p-4 max-w-2xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar: {error}. Revisa que hayas corrido el SQL de Nómina.</p></div>
  if (!emps) return <div className='p-4 text-gray-500'>Cargando…</div>

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium'>Nómina</h1>
      <p className='text-sm text-gray-500 mb-4'>Pagos los días 5 y 20 (media quincena del salario). Al pagar queda registrado en Finanzas y puedes enviar el comprobante.</p>
      <div className='flex gap-2 mb-4'>
        {[['quincena', '💵 Quincena'], ['empleados', '👥 Empleados'], ['historial', '📒 Historial']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>
      {tab === 'quincena' ? <Quincena {...{ emps, pagos, periodo, setPeriodo, lista, pagoFin, recargar: cargar, hoy }} />
        : tab === 'empleados' ? <Empleados emps={emps} pagoFin={pagoFin} recargar={cargar} />
        : <Historial emps={emps} pagos={pagos} />}
    </div>
  )
}

/* ---------- Quincena ---------- */

function Quincena({ emps, pagos, periodo, setPeriodo, lista, pagoFin, recargar, hoy }) {
  const activos = emps.filter(e => e.activo)
  const delPeriodo = pagos.filter(p => p.periodo === periodo)
  const pagadoDe = id => delPeriodo.find(p => p.empleado_id === id)
  const total = activos.reduce((a, e) => a + Number(e.salario || 0) / 2, 0)
  const pagado = delPeriodo.reduce((a, p) => a + Number(p.total || 0), 0)
  const pendientes = activos.filter(e => !pagadoDe(e.id))
  const [pagando, setPagando] = useState(null)
  const [todos, setTodos] = useState(false)
  const [comprobante, setComprobante] = useState(null)

  async function pagarTodos() {
    if (!confirm(`¿Registrar el pago de ${pendientes.length} empleados por ${pesos(pendientes.reduce((a, e) => a + Number(e.salario) / 2, 0))} con fecha de hoy, por transferencia?`)) return
    setTodos(true)
    for (const e of pendientes) await registrar({ e, periodo, fecha: hoy, extras: 0, descuentos: 0, medio: e.medio_pago || 'transferencia', nota: '' })
    await sincronizarFinanzas(periodo, pagoFin)
    setTodos(false); recargar()
  }

  return (
    <div className='space-y-3'>
      <div className='flex gap-2 overflow-x-auto pb-1'>
        {lista.map(p => (
          <button key={p} onClick={() => setPeriodo(p)} className={`flex-none px-3 py-1.5 text-xs font-medium rounded-full border ${periodo === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600'}`}>
            {fCorta(p)}{pagos.some(x => x.periodo === p) && pagos.filter(x => x.periodo === p).length >= activos.length ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className='card'>
        <div className='flex justify-between items-baseline'>
          <div><p className='text-xs text-gray-500 uppercase tracking-wide font-semibold'>Pago del {fLarga(periodo)}</p><p className='text-sm text-gray-600 mt-1'>{activos.length - pendientes.length} de {activos.length} pagados</p></div>
          <div className='text-right'><p className='text-2xl font-bold tabular-nums'>{pesos(pagado)}</p><p className='text-xs text-gray-500'>de {pesos(total)}</p></div>
        </div>
        <div className='h-2 rounded-full bg-gray-100 overflow-hidden mt-2'><div className='h-full bg-green-500' style={{ width: (total ? Math.min(100, pagado / total * 100) : 0) + '%' }} /></div>
        {pendientes.length > 1 && <button className='btn btn-primary w-full mt-3 justify-center' disabled={todos} onClick={pagarTodos}>{todos ? 'Registrando…' : `Registrar pago de los ${pendientes.length} pendientes`}</button>}
      </div>

      {activos.map(e => {
        const pg = pagadoDe(e.id)
        return (
          <div key={e.id} className='card flex items-center justify-between gap-3 py-3'>
            <div className='min-w-0'>
              <p className='font-semibold truncate'>{e.nombre}</p>
              <p className='text-xs text-gray-500'>{e.cargo || '—'} · quincena {pesos(Number(e.salario) / 2)}</p>
              {pg && <p className='text-xs text-green-700 mt-0.5'>✓ Pagado {pesos(pg.total)} el {fCorta(pg.fecha_pago)}{Number(pg.extras) || Number(pg.descuentos) ? ` (base ${pesos(pg.base)}${Number(pg.extras) ? ` + ${pesos(pg.extras)}` : ''}${Number(pg.descuentos) ? ` − ${pesos(pg.descuentos)}` : ''})` : ''}</p>}
            </div>
            {pg ? <button className='btn text-sm flex-none' onClick={() => setComprobante({ e, pg })}>🧾 Comprobante</button>
              : <button className='btn btn-primary text-sm flex-none' onClick={() => setPagando(e)}>Pagar</button>}
          </div>
        )
      })}

      {pagando && <ModalPago e={pagando} periodo={periodo} hoy={hoy} cerrar={() => setPagando(null)} listo={async pg => { await sincronizarFinanzas(periodo, pagoFin); setPagando(null); await recargar(); setComprobante({ e: pagando, pg }) }} />}
      {comprobante && <ModalComprobante {...comprobante} cerrar={() => setComprobante(null)} />}
    </div>
  )
}

async function registrar({ e, periodo, fecha, extras, descuentos, medio, nota }) {
  const base = Math.round(Number(e.salario || 0) / 2)
  const total = base + Number(extras || 0) - Number(descuentos || 0)
  const { data: s } = await supabase.auth.getSession()
  const { data, error } = await supabase.from('nom_pagos').insert({ empleado_id: e.id, periodo, fecha_pago: fecha, base, extras: Number(extras || 0), descuentos: Number(descuentos || 0), total, medio, nota: nota || null, registrado_por: s.session?.user?.email || null }).select().single()
  if (error) throw error
  return data
}

// Un solo movimiento en Finanzas por quincena, con el total pagado hasta el momento
async function sincronizarFinanzas(periodo, pagoFin) {
  if (!pagoFin) return
  const [{ data: ps }, { data: activos }] = await Promise.all([
    supabase.from('nom_pagos').select('total, fecha_pago').eq('periodo', periodo),
    supabase.from('nom_empleados').select('id').eq('activo', true),
  ])
  const total = (ps || []).reduce((a, p) => a + Number(p.total || 0), 0)
  const fecha = (ps || []).map(p => p.fecha_pago).sort().slice(-1)[0] || periodo
  const nota = `Nómina: ${(ps || []).length} de ${(activos || []).length} empleados pagados (desde el módulo de Nómina)`
  const { data: mv } = await supabase.from('fin_movimientos').select('id').eq('pago_id', pagoFin.id).eq('periodo', periodo).limit(1)
  if (mv && mv.length) await supabase.from('fin_movimientos').update({ valor: total, fecha, nota }).eq('id', mv[0].id)
  else await supabase.from('fin_movimientos').insert({ pago_id: pagoFin.id, periodo, concepto: pagoFin.concepto, fecha, valor: total, nota, registrado_por: 'Nómina' })
}

function ModalPago({ e, periodo, hoy, cerrar, listo }) {
  const base = Math.round(Number(e.salario || 0) / 2)
  const [fecha, setFecha] = useState(hoy)
  const [extras, setExtras] = useState('')
  const [descuentos, setDescuentos] = useState('')
  const [medio, setMedio] = useState(e.medio_pago || 'transferencia')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const total = base + (Number(extras) || 0) - (Number(descuentos) || 0)
  async function guardar() {
    setGuardando(true); setError(null)
    try { const pg = await registrar({ e, periodo, fecha, extras, descuentos, medio, nota }); await listo(pg) }
    catch (er) { setError('No se pudo registrar: ' + er.message); setGuardando(false) }
  }
  return (
    <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4' style={{ background: 'rgba(0,0,0,0.5)' }} onClick={cerrar}>
      <div className='bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3' onClick={ev => ev.stopPropagation()} role='dialog' aria-label='Registrar pago'>
        <div className='flex justify-between'><h3 className='font-semibold'>Pagar a {e.nombre}</h3><button onClick={cerrar} className='text-gray-400 text-2xl leading-none' aria-label='Cerrar'>×</button></div>
        <p className='text-sm text-gray-600'>Pago del {fLarga(periodo)} · base {pesos(base)}</p>
        <div className='grid grid-cols-2 gap-3'>
          <div><label htmlFor='p-ext' className='text-xs text-gray-500 mb-1 block'>Extras (bonos, horas)</label><input id='p-ext' inputMode='numeric' value={extras} onChange={ev => setExtras(ev.target.value.replace(/\D/g, ''))} placeholder='0' /></div>
          <div><label htmlFor='p-des' className='text-xs text-gray-500 mb-1 block'>Descuentos (préstamos)</label><input id='p-des' inputMode='numeric' value={descuentos} onChange={ev => setDescuentos(ev.target.value.replace(/\D/g, ''))} placeholder='0' /></div>
          <div><label htmlFor='p-fec' className='text-xs text-gray-500 mb-1 block'>Fecha del pago</label><input id='p-fec' type='date' value={fecha} onChange={ev => setFecha(ev.target.value)} /></div>
          <div><label htmlFor='p-med' className='text-xs text-gray-500 mb-1 block'>Medio</label><select id='p-med' value={medio} onChange={ev => setMedio(ev.target.value)}>{MEDIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        <div><label htmlFor='p-not' className='text-xs text-gray-500 mb-1 block'>Nota (opcional, sale en el comprobante)</label><input id='p-not' value={nota} onChange={ev => setNota(ev.target.value)} placeholder='Ej: incluye 4 horas extra' /></div>
        <div className='rounded-lg bg-gray-50 p-3 flex justify-between font-semibold'><span>Total a pagar</span><span>{pesos(total)}</span></div>
        {error && <p className='text-sm text-red-600'>{error}</p>}
        <button className='btn btn-primary w-full justify-center' disabled={guardando || total <= 0} onClick={guardar}>{guardando ? 'Registrando…' : 'Registrar pago'}</button>
      </div>
    </div>
  )
}

/* ---------- Comprobante ---------- */

function cargarImagen(src) {
  return new Promise((ok, mal) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = mal; i.src = src })
}

async function dibujar(e, pg) {
  const W = 1080
  const filas = [['Quincena', pesos(pg.base)]]
  if (Number(pg.extras)) filas.push(['Extras', '+ ' + pesos(pg.extras)])
  if (Number(pg.descuentos)) filas.push(['Descuentos', '− ' + pesos(pg.descuentos)])
  filas.push(['Fecha de pago', fLarga(pg.fecha_pago)], ['Medio', (MEDIOS.find(m => m[0] === pg.medio) || [0, pg.medio || ''])[1]])
  const x0 = 70, y0 = 450, cw = W - 140, ch = 300 + filas.length * 72 + 150
  const H = Math.max(1500, y0 + ch + 420)
  const ORO = '#C9A84C', NEGRO = '#1a1a1a', CREMA = '#f4f1eb', GRIS = '#6b6b6b'
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const serif = 'Georgia, "Times New Roman", serif', sans = 'Helvetica, Arial, sans-serif'
  g.fillStyle = CREMA; g.fillRect(0, 0, W, H)
  g.fillStyle = NEGRO; g.fillRect(0, 0, W, 330)
  try { const logo = await cargarImagen('/logo-mrchester.png'); const lw = 400, lh = logo.height * (lw / logo.width); g.drawImage(logo, (W - lw) / 2, 50, lw, lh) } catch (er) {}
  g.textAlign = 'center'; g.fillStyle = ORO
  g.font = `bold 76px ${serif}`; g.fillText('M R .  C H E S T E R', W / 2, 220)
  g.font = `24px ${sans}`; g.fillText('S O F Á S   Q U E   H A B L A N   D E   T I', W / 2, 270)
  g.fillStyle = ORO; g.fillRect(0, 330, W, 70)
  g.fillStyle = NEGRO; g.font = `bold 28px ${sans}`; g.fillText('C O M P R O B A N T E   D E   N Ó M I N A', W / 2, 376)

  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect ? g.roundRect(x0, y0, cw, ch, 24) : g.rect(x0, y0, cw, ch); g.fill()
  g.textAlign = 'left'
  g.fillStyle = GRIS; g.font = `26px ${sans}`; g.fillText('PAGO DEL ' + fLarga(pg.periodo).toUpperCase(), x0 + 50, y0 + 70)
  g.fillStyle = NEGRO; g.font = `bold 64px ${serif}`
  let nom = e.nombre; while (g.measureText(nom).width > cw - 100 && nom.length > 4) nom = nom.slice(0, -1)
  g.fillText(nom, x0 + 50, y0 + 150)
  g.fillStyle = GRIS; g.font = `30px ${sans}`; g.fillText(String(e.cargo || '').toUpperCase(), x0 + 50, y0 + 200)
  g.fillStyle = ORO; g.fillRect(x0 + 50, y0 + 230, 90, 4)
  let y = y0 + 300
  filas.forEach(([k, v]) => {
    g.fillStyle = GRIS; g.font = `28px ${sans}`; g.textAlign = 'left'; g.fillText(k, x0 + 50, y)
    g.fillStyle = NEGRO; g.font = `bold 32px ${sans}`; g.textAlign = 'right'; g.fillText(v, x0 + cw - 50, y)
    g.strokeStyle = '#ece7dd'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 50, y + 28); g.lineTo(x0 + cw - 50, y + 28); g.stroke()
    y += 72
  })
  g.fillStyle = NEGRO; g.beginPath(); g.roundRect ? g.roundRect(x0 + 30, y0 + ch - 130, cw - 60, 100, 18) : g.rect(x0 + 30, y0 + ch - 130, cw - 60, 100); g.fill()
  g.fillStyle = ORO; g.textAlign = 'left'; g.font = `bold 30px ${sans}`; g.fillText('TOTAL PAGADO', x0 + 70, y0 + ch - 68)
  g.textAlign = 'right'; g.font = `bold 52px ${serif}`; g.fillText(pesos(pg.total), x0 + cw - 70, y0 + ch - 62)

  // Mensaje
  g.textAlign = 'center'; g.fillStyle = NEGRO; g.font = `italic 34px ${serif}`
  const palabras = mensajeDe(e.id, pg.periodo).split(' '); const lineas = []; let l = ''
  palabras.forEach(w => { const t = l ? l + ' ' + w : w; if (g.measureText(t).width > W - 200) { lineas.push(l); l = w } else l = t })
  if (l) lineas.push(l)
  let my = y0 + ch + 100
  g.fillStyle = ORO; g.font = `bold 34px ${sans}`; g.fillText(`¡Gracias, ${primerNombre(e.nombre)}!`, W / 2, my); my += 60
  g.fillStyle = NEGRO; g.font = `italic 32px ${serif}`
  lineas.forEach(t => { g.fillText(t, W / 2, my); my += 46 })
  if (pg.nota) { g.fillStyle = GRIS; g.font = `26px ${sans}`; g.fillText(pg.nota.slice(0, 70), W / 2, my + 20) }
  g.fillStyle = GRIS; g.font = `22px ${sans}`; g.fillText('Mr. Chester Export S.A.S. · Bogotá', W / 2, H - 50)
  return new Promise(ok => c.toBlob(ok, 'image/png'))
}

function ModalComprobante({ e, pg, cerrar }) {
  const [url, setUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  useEffect(() => { dibujar(e, pg).then(b => { setBlob(b); setUrl(URL.createObjectURL(b)) }) }, [])
  const tel = String(e.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel
  const texto = `Hola, ${primerNombre(e.nombre)} 👋\n\nTe compartimos el comprobante de tu pago del ${fCorta(pg.periodo)}: *${pesos(pg.total)}*.\n\n${mensajeDe(e.id, pg.periodo)}\n\n*Equipo Mr. Chester* ♛`
  const archivo = () => new File([blob], `Nomina-${primerNombre(e.nombre)}-${pg.periodo}.png`, { type: 'image/png' })
  const puedeCompartir = blob && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [archivo()] })
  async function compartir() {
    try { await navigator.share({ files: [archivo()], text: texto }) } catch (er) {}
  }
  return (
    <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4' style={{ background: 'rgba(0,0,0,0.6)' }} onClick={cerrar}>
      <div className='bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md p-4 space-y-3 max-h-[92vh] overflow-y-auto' onClick={ev => ev.stopPropagation()} role='dialog' aria-label='Comprobante de nómina'>
        <div className='flex justify-between'><h3 className='font-semibold'>Comprobante · {e.nombre}</h3><button onClick={cerrar} className='text-gray-400 text-2xl leading-none' aria-label='Cerrar'>×</button></div>
        {url ? <img src={url} alt={`Comprobante de nómina de ${e.nombre}`} className='w-full rounded-lg border border-gray-200' /> : <p className='text-sm text-gray-400'>Generando…</p>}
        {puedeCompartir && <button className='btn w-full justify-center' style={{ background: '#25D366', color: '#fff', borderColor: '#25D366' }} onClick={compartir}>📲 Enviar comprobante (elige WhatsApp y a {primerNombre(e.nombre)})</button>}
        {telWa && <a className='btn w-full text-center block' href={`https://wa.me/${telWa}?text=${encodeURIComponent(texto)}`} target='_blank' rel='noreferrer'>💬 Abrir el chat de {primerNombre(e.nombre)} con el mensaje</a>}
        {url && <a className='btn w-full text-center block' href={url} download={`Nomina-${primerNombre(e.nombre)}-${pg.periodo}.png`}>⬇ Descargar imagen</a>}
        <p className='text-xs text-gray-500'>En el celular, "Enviar comprobante" abre el menú de compartir: elige WhatsApp y el contacto. En el computador, descarga la imagen y adjúntala en el chat.</p>
      </div>
    </div>
  )
}

/* ---------- Empleados ---------- */

function Empleados({ emps, pagoFin, recargar }) {
  const [editando, setEditando] = useState(null)
  const total = emps.filter(e => e.activo).reduce((a, e) => a + Number(e.salario || 0), 0)
  async function guardar(x) {
    const datos = { nombre: x.nombre.trim(), cargo: x.cargo || null, cedula: x.cedula || null, salario: Number(String(x.salario).replace(/\D/g, '')) || 0, telefono: String(x.telefono || '').replace(/\D/g, '') || null, email: x.email || null, medio_pago: x.medio_pago || 'transferencia', activo: !!x.activo }
    if (!datos.nombre) { alert('Escribe el nombre.'); return }
    if (x.id) await supabase.from('nom_empleados').update(datos).eq('id', x.id)
    else await supabase.from('nom_empleados').insert(datos)
    // Mantener Finanzas al día: quincena = la mitad del total de salarios activos
    const { data: act } = await supabase.from('nom_empleados').select('salario').eq('activo', true)
    const q = Math.round((act || []).reduce((a, e) => a + Number(e.salario || 0), 0) / 2)
    if (pagoFin) await supabase.from('fin_pagos').update({ valor: q }).eq('id', pagoFin.id)
    await supabase.from('fin_pagos').update({ valor: q }).eq('ambito', 'empresa').ilike('concepto', 'Prima de%')
    setEditando(null); recargar()
  }
  return (
    <div className='space-y-3'>
      <div className='card flex justify-between'><span className='text-sm text-gray-600'>{emps.filter(e => e.activo).length} empleados activos</span><span className='font-semibold'>{pesos(total)} / mes</span></div>
      {emps.map(e => (
        <button key={e.id} type='button' onClick={() => setEditando({ ...e })} className={`card w-full text-left flex justify-between gap-2 py-3 ${e.activo ? '' : 'opacity-50'}`}>
          <div className='min-w-0'>
            <p className='font-semibold truncate'>{e.nombre}{!e.activo ? ' (inactivo)' : ''}</p>
            <p className='text-xs text-gray-500'>{e.cargo || '—'}{e.telefono ? ` · ${e.telefono}` : ' · ⚠ sin WhatsApp'}</p>
          </div>
          <span className='font-semibold whitespace-nowrap'>{pesos(e.salario)}</span>
        </button>
      ))}
      <button className='btn w-full' onClick={() => setEditando({ nombre: '', cargo: '', salario: '', telefono: '', email: '', cedula: '', medio_pago: 'transferencia', activo: true })}>+ Agregar empleado</button>
      <p className='text-xs text-gray-500'>Al guardar, la nómina quincenal y las primas en Finanzas se actualizan con el nuevo total.</p>
      {editando && (
        <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4' style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditando(null)}>
          <div className='bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto' onClick={ev => ev.stopPropagation()} role='dialog' aria-label='Empleado'>
            <h3 className='font-semibold'>{editando.id ? 'Editar empleado' : 'Nuevo empleado'}</h3>
            {[['nombre', 'Nombre completo'], ['cargo', 'Cargo o sección'], ['salario', 'Salario mensual'], ['telefono', 'WhatsApp'], ['cedula', 'Cédula'], ['email', 'Correo']].map(([k, l]) => (
              <div key={k}><label htmlFor={`em-${k}`} className='text-xs text-gray-500 mb-1 block'>{l}</label>
                <input id={`em-${k}`} inputMode={['salario', 'telefono', 'cedula'].includes(k) ? 'numeric' : undefined} value={editando[k] ?? ''} onChange={ev => setEditando(x => ({ ...x, [k]: ev.target.value }))} /></div>
            ))}
            <div><label htmlFor='em-medio' className='text-xs text-gray-500 mb-1 block'>Medio de pago</label><select id='em-medio' value={editando.medio_pago} onChange={ev => setEditando(x => ({ ...x, medio_pago: ev.target.value }))}>{MEDIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <label className='flex items-center gap-2 text-sm'><input type='checkbox' style={{ width: 'auto' }} checked={!!editando.activo} onChange={ev => setEditando(x => ({ ...x, activo: ev.target.checked }))} /> Activo (sale en la nómina)</label>
            <div className='flex gap-2'><button className='btn flex-1' onClick={() => setEditando(null)}>Cancelar</button><button className='btn btn-primary flex-1 justify-center' onClick={() => guardar(editando)}>Guardar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Historial ---------- */

function Historial({ emps, pagos }) {
  const porPeriodo = {}
  pagos.forEach(p => { (porPeriodo[p.periodo] = porPeriodo[p.periodo] || []).push(p) })
  const nombre = id => emps.find(e => e.id === id)?.nombre || '—'
  const per = Object.keys(porPeriodo).sort().reverse()
  if (!per.length) return <div className='card text-center text-gray-500 py-8'>Todavía no hay pagos registrados.</div>
  return (
    <div className='space-y-3'>
      {per.map(p => (
        <div key={p} className='card'>
          <div className='flex justify-between font-semibold mb-2'><span>Pago del {fLarga(p)}</span><span>{pesos(porPeriodo[p].reduce((a, x) => a + Number(x.total || 0), 0))}</span></div>
          {porPeriodo[p].map(x => <div key={x.id} className='flex justify-between text-sm py-0.5'><span>{nombre(x.empleado_id)}</span><span>{pesos(x.total)} · {fCorta(x.fecha_pago)}</span></div>)}
        </div>
      ))}
    </div>
  )
}
