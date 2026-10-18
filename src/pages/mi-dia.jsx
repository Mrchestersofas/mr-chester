import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/* Mi Día: rutina, tareas, seguimientos y hábitos personales de Joseph.
   Los datos viven en tablas mi_* con acceso solo para el usuario dueño (RLS). */

const AREAS = {
  chester: { n: 'Mr. Chester', c: '#8C2F39' },
  personal: { n: 'Personal', c: '#3A6CA3' },
  salud: { n: 'Salud y nutrición', c: '#3C8758' },
  ninos: { n: 'Niños', c: '#B8741A' },
}
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DOW_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const ORO = '#C9A84C'

const pad = n => String(n).padStart(2, '0')
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hoyKey = () => keyOf(new Date())
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const pesos = n => '$' + Number(n || 0).toLocaleString('es-CO')
function fmtFecha(k) {
  if (!k) return ''
  if (k === hoyKey()) return 'Hoy'
  if (k === keyOf(addDays(new Date(), 1))) return 'Mañana'
  if (k === keyOf(addDays(new Date(), -1))) return 'Ayer'
  const d = parseKey(k); return `${DOW[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`
}
function fmtHora(t) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${pad(m)}`
}
const minutos = t => { if (!t) return 9999; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const porHora = (a, b) => (a.hora || '99').localeCompare(b.hora || '99')

function Area({ a }) {
  const x = AREAS[a] || { n: a, c: '#999' }
  return <span className='inline-flex items-center gap-1.5 text-xs text-gray-500'><span className='w-2 h-2 rounded-full' style={{ background: x.c }} />{x.n}</span>
}
function Check({ on, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={on}
      className='w-7 h-7 flex-none rounded-full border-2 flex items-center justify-center transition-colors'
      style={{ borderColor: on ? '#2F7A4C' : '#d6d3d1', background: on ? '#2F7A4C' : 'transparent', color: '#fff' }}>
      {on && <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round'><path d='m5 12 5 5 9-10' /></svg>}
    </button>
  )
}

/* ---------------- Acceso ---------------- */

export default function MiDia() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className='p-6 text-gray-400'>Cargando…</div>
  if (!session) return <Acceso />
  return <Panel session={session} />
}

function Acceso() {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [modo, setModo] = useState('entrar')
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setMsg(null); setCargando(true)
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
      if (error) setMsg({ t: 'error', m: /confirm/i.test(error.message) ? 'Tu cuenta todavía no está activada. Pídele a Claude que la active.' : 'Correo o contraseña incorrectos.' })
    } else {
      if (clave.length < 8) { setMsg({ t: 'error', m: 'La contraseña debe tener al menos 8 caracteres.' }); setCargando(false); return }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: clave })
      if (error) setMsg({ t: 'error', m: error.message })
      else if (!data.session) setMsg({ t: 'ok', m: 'Cuenta creada. Pídele a Claude que la active y luego entra con tu correo y contraseña.' })
    }
    setCargando(false)
  }

  return (
    <div className='p-4 max-w-sm mx-auto mt-6'>
      <div className='card space-y-4'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-widest' style={{ color: ORO }}>Mi Día</p>
          <h1 className='text-xl font-semibold mt-1'>{modo === 'entrar' ? 'Entrar' : 'Crear mi cuenta'}</h1>
          <p className='text-sm text-gray-500 mt-1'>Tu rutina y tus tareas son privadas: solo las ves tú con tu contraseña.</p>
        </div>
        <form onSubmit={enviar} className='space-y-3'>
          <div>
            <label htmlFor='md-email' className='text-xs text-gray-500 mb-1 block'>Correo</label>
            <input id='md-email' type='email' autoComplete='email' value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor='md-clave' className='text-xs text-gray-500 mb-1 block'>Contraseña</label>
            <input id='md-clave' type='password' autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={clave} onChange={e => setClave(e.target.value)} required />
          </div>
          {msg && <div className={`text-sm rounded-lg p-3 ${msg.t === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.m}</div>}
          <button className='btn btn-primary w-full justify-center' disabled={cargando}>{cargando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
        </form>
        <button className='text-sm underline text-gray-500' onClick={() => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setMsg(null) }}>
          {modo === 'entrar' ? 'Es mi primera vez: crear cuenta' : 'Ya tengo cuenta: entrar'}
        </button>
      </div>
    </div>
  )
}

/* ---------------- Panel ---------------- */

const PESTANAS = [['hoy', 'Hoy'], ['tareas', 'Tareas'], ['seg', 'Seguimientos'], ['hab', 'Hábitos'], ['rut', 'Rutina']]

function Panel({ session }) {
  const [tab, setTab] = useState('hoy')
  const [areaF, setAreaF] = useState('all')
  const [rutDia, setRutDia] = useState(new Date().getDay())
  const [rutina, setRutina] = useState([])
  const [tareas, setTareas] = useState([])
  const [segs, setSegs] = useState([])
  const [registro, setRegistro] = useState({})
  const [fabrica, setFabrica] = useState(null)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState(null)
  const [hoja, setHoja] = useState(null)
  const [, setTick] = useState(0)

  async function cargar() {
    const desde = keyOf(addDays(new Date(), -120))
    const [r, t, s, g] = await Promise.all([
      supabase.from('mi_rutina').select('*'),
      supabase.from('mi_tareas').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('mi_seguimientos').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('mi_registro').select('fecha,rutina_id').gte('fecha', desde),
    ])
    const err = r.error || t.error || s.error || g.error
    if (err) { setError('No se pudieron cargar tus datos: ' + err.message); return }
    setRutina(r.data); setTareas(t.data); setSegs(s.data)
    const reg = {}
    g.data.forEach(x => { (reg[x.fecha] = reg[x.fecha] || new Set()).add(x.rutina_id) })
    setRegistro(reg); setError(null); setListo(true)
  }

  async function cargarFabrica() {
    const hoy = hoyKey()
    const { data, error: e } = await supabase.from('pedidos')
      .select('numero,tipo_sofa,fecha_entrega,precio_venta,abono,estado,clientes(nombre)')
      .neq('estado', 'entregado').neq('estado', 'cancelado')
      .gte('fecha_entrega', keyOf(addDays(new Date(), -30)))
      .lte('fecha_entrega', keyOf(addDays(new Date(), 7)))
      .order('fecha_entrega')
    if (e) return
    const atrasados = data.filter(p => p.fecha_entrega < hoy)
    const semana = data.filter(p => p.fecha_entrega >= hoy)
    const saldo = semana.reduce((s, p) => s + Number(p.precio_venta || 0) - Number(p.abono || 0), 0)
    setFabrica({ atrasados, semana, saldo })
  }

  useEffect(() => {
    cargar(); cargarFabrica()
    const i = setInterval(() => setTick(x => x + 1), 60000)
    return () => clearInterval(i)
  }, [])

  async function ejecutar(promesa) {
    const { error: e } = await promesa
    if (e) { setError('No se pudo guardar: ' + e.message); return false }
    await cargar(); return true
  }

  async function marcarRutina(id) {
    const k = hoyKey()
    const hecho = registro[k]?.has(id)
    const nuevo = { ...registro, [k]: new Set(registro[k] || []) }
    hecho ? nuevo[k].delete(id) : nuevo[k].add(id)
    setRegistro(nuevo)
    await ejecutar(hecho
      ? supabase.from('mi_registro').delete().eq('fecha', k).eq('rutina_id', id)
      : supabase.from('mi_registro').insert({ fecha: k, rutina_id: id }))
  }
  async function marcarTarea(t) {
    const hecha = t.estado !== 'hecha'
    setTareas(ts => ts.map(x => x.id === t.id ? { ...x, estado: hecha ? 'hecha' : 'pendiente' } : x))
    await ejecutar(supabase.from('mi_tareas').update({ estado: hecha ? 'hecha' : 'pendiente', hecha_en: hecha ? new Date().toISOString() : null }).eq('id', t.id))
  }

  const enArea = x => areaF === 'all' || x.area === areaF
  const hoy = hoyKey()

  return (
    <div className='p-4 max-w-2xl mx-auto pb-16'>
      <div className='flex items-center justify-between mb-3'>
        <p className='text-xs font-semibold uppercase tracking-widest' style={{ color: ORO }}>Mi Día</p>
        <button className='text-xs text-gray-400 underline' onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
      <div className='flex gap-1 overflow-x-auto mb-5 -mx-1 px-1'>
        {PESTANAS.map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)}
            className='flex-none px-3 py-1.5 rounded-full text-sm font-medium border'
            style={tab === k ? { background: '#1a1a1a', color: ORO, borderColor: '#1a1a1a' } : { borderColor: '#e7e5e4', color: '#57534e' }}>{n}</button>
        ))}
      </div>
      {error && <div className='mb-4 rounded-lg bg-red-50 text-red-700 text-sm p-3'>{error}</div>}
      {!listo && !error && <div className='text-gray-400 text-sm'>Cargando tu día…</div>}
      {listo && tab === 'hoy' && <VistaHoy {...{ rutina, tareas, segs, registro, fabrica, marcarRutina, marcarTarea, setHoja, setTab }} />}
      {listo && tab === 'tareas' && <VistaTareas {...{ tareas, areaF, setAreaF, enArea, marcarTarea, setHoja }} />}
      {listo && tab === 'seg' && <VistaSeg {...{ segs, areaF, setAreaF, enArea, setHoja, ejecutar }} />}
      {listo && tab === 'hab' && <VistaHabitos {...{ rutina, registro }} />}
      {listo && tab === 'rut' && <VistaRutina {...{ rutina, rutDia, setRutDia, setHoja }} />}
      {hoja && <Hoja hoja={hoja} cerrar={() => setHoja(null)} ejecutar={ejecutar} rutDia={rutDia} areaF={areaF} />}
    </div>
  )
}

/* ---------------- Vistas ---------------- */

function Seccion({ titulo, accion, children }) {
  return (
    <section className='mb-7'>
      <div className='flex items-center justify-between mb-2'>
        <h2 className='text-base font-semibold'>{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}
const Vacio = ({ children }) => <div className='rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500'>{children}</div>
const Lista = ({ children }) => <div className='bg-white border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden'>{children}</div>
const BotonTexto = ({ onClick, children }) => <button onClick={onClick} className='text-sm font-semibold' style={{ color: '#8C6A1F' }}>{children}</button>

function FilaTarea({ t, marcarTarea, setHoja }) {
  const tarde = t.fecha && t.fecha < hoyKey() && t.estado !== 'hecha'
  return (
    <div className='flex items-center gap-3 px-3 py-3'>
      <Check on={t.estado === 'hecha'} onClick={() => marcarTarea(t)} label={`Completar ${t.titulo}`} />
      <div className='flex-1 min-w-0'>
        <div className={`text-sm font-medium break-words ${t.estado === 'hecha' ? 'line-through text-gray-400' : ''}`}>{t.titulo}</div>
        <div className='flex flex-wrap items-center gap-2 mt-0.5'>
          <Area a={t.area} />
          {t.fecha && <span className={`text-xs px-2 py-0.5 rounded-full ${tarde ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{tarde ? 'Atrasada · ' : ''}{fmtFecha(t.fecha)}</span>}
          {t.pedido_numero && <span className='text-xs px-2 py-0.5 rounded-full bg-gray-900' style={{ color: ORO }}>{t.pedido_numero}</span>}
        </div>
      </div>
      <BotonTexto onClick={() => setHoja({ tipo: 'tarea', item: t })}>Editar</BotonTexto>
    </div>
  )
}

function VistaHoy({ rutina, tareas, segs, registro, fabrica, marcarRutina, marcarTarea, setHoja, setTab }) {
  const d = new Date(), dow = d.getDay(), k = hoyKey()
  const items = rutina.filter(r => (r.dias || []).includes(dow)).sort(porHora)
  const hechos = registro[k] || new Set()
  const ahora = d.getHours() * 60 + d.getMinutes()
  const siguiente = items.find(r => !hechos.has(r.id) && minutos(r.hora) + 30 >= ahora)?.id
  const n = items.filter(r => hechos.has(r.id)).length
  const pct = items.length ? Math.round(n / items.length * 100) : 0
  const vencidas = tareas.filter(t => t.estado !== 'hecha' && t.fecha && t.fecha <= k).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const revisar = segs.filter(s => s.estado !== 'cerrado' && s.proxima && s.proxima <= k)
  const saludo = d.getHours() < 12 ? 'Buenos días' : d.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
      <div className='mb-6'>
        <p className='text-sm text-gray-500 capitalize'>{DOW_L[dow]} {d.getDate()} de {MES[d.getMonth()]}</p>
        <h1 className='text-2xl font-semibold mt-0.5'>{saludo}, Joseph</h1>
        <p className='text-xs text-gray-500 mt-1'>{n} de {items.length} de tu rutina · {vencidas.length} tareas para hoy · {revisar.length} seguimientos</p>
        <div className='h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden'><div className='h-full rounded-full transition-all' style={{ width: pct + '%', background: ORO }} /></div>
      </div>

      {fabrica && (
        <Seccion titulo='Fábrica' accion={<Link href='/pedidos' className='text-sm font-semibold' style={{ color: '#8C6A1F' }}>Ver pedidos</Link>}>
          <div className='grid grid-cols-3 gap-2 mb-2'>
            <Dato n={fabrica.semana.length} t='entregas en 7 días' />
            <Dato n={fabrica.atrasados.length} t='atrasados' alerta={fabrica.atrasados.length > 0} />
            <Dato n={pesos(fabrica.saldo)} t='saldo por cobrar' chico />
          </div>
          {[...fabrica.atrasados, ...fabrica.semana].slice(0, 5).length > 0 && (
            <Lista>
              {[...fabrica.atrasados, ...fabrica.semana].slice(0, 5).map(p => (
                <div key={p.numero} className='flex items-center gap-3 px-3 py-2.5 text-sm'>
                  <span className='font-semibold w-16 flex-none'>{p.numero}</span>
                  <span className='flex-1 min-w-0 truncate text-gray-600'>{p.clientes?.nombre || '—'} · {p.tipo_sofa}</span>
                  <span className={`text-xs flex-none ${p.fecha_entrega < k ? 'text-amber-700 font-semibold' : 'text-gray-500'}`}>{fmtFecha(p.fecha_entrega)}</span>
                </div>
              ))}
            </Lista>
          )}
        </Seccion>
      )}

      <Seccion titulo='Rutina de hoy' accion={<BotonTexto onClick={() => setTab('rut')}>Editar</BotonTexto>}>
        {items.length ? (
          <Lista>
            {items.map(r => {
              const on = hechos.has(r.id)
              return (
                <div key={r.id} className='flex items-center gap-3 px-3 py-3' style={r.id === siguiente ? { background: '#FBF6E9' } : null}>
                  <span className='w-11 flex-none text-sm font-semibold tabular-nums' style={{ color: r.id === siguiente ? '#8C6A1F' : '#78716c' }}>{fmtHora(r.hora)}</span>
                  <div className='flex-1 min-w-0'>
                    <div className={`text-sm font-medium break-words ${on ? 'line-through text-gray-400' : ''}`}>{r.titulo}</div>
                    <Area a={r.area} />
                  </div>
                  <Check on={on} onClick={() => marcarRutina(r.id)} label={`Marcar ${r.titulo}`} />
                </div>
              )
            })}
          </Lista>
        ) : <Vacio>No hay nada en tu rutina para hoy. Agrégalo en la pestaña Rutina.</Vacio>}
      </Seccion>

      <Seccion titulo='Tareas para hoy' accion={<BotonTexto onClick={() => setHoja({ tipo: 'tarea' })}>+ Tarea</BotonTexto>}>
        {vencidas.length ? <Lista>{vencidas.map(t => <FilaTarea key={t.id} {...{ t, marcarTarea, setHoja }} />)}</Lista>
          : <Vacio>Nada vencido. Las tareas con fecha de hoy o atrasadas aparecen aquí.</Vacio>}
      </Seccion>

      {revisar.length > 0 && (
        <Seccion titulo='Seguimientos para revisar'>
          <div className='space-y-3'>{revisar.map(s => <TarjetaSeg key={s.id} s={s} setHoja={setHoja} />)}</div>
        </Seccion>
      )}
    </>
  )
}

function Dato({ n, t, alerta, chico }) {
  return (
    <div className='rounded-xl border p-3' style={{ borderColor: alerta ? '#F3D9B1' : '#f1f0ee', background: alerta ? '#FFF8EC' : '#fff' }}>
      <div className={`${chico ? 'text-base' : 'text-2xl'} font-semibold tabular-nums ${alerta ? 'text-amber-700' : ''}`}>{n}</div>
      <div className='text-xs text-gray-500 leading-tight mt-0.5'>{t}</div>
    </div>
  )
}

function Filtros({ areaF, setAreaF }) {
  return (
    <div className='flex gap-2 overflow-x-auto pb-1 mb-3'>
      {[['all', 'Todos'], ...Object.entries(AREAS).map(([k, v]) => [k, v.n])].map(([k, n]) => (
        <button key={k} onClick={() => setAreaF(k)} className='flex-none inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border'
          style={areaF === k ? { background: '#1c1917', color: '#fff', borderColor: '#1c1917' } : { borderColor: '#e7e5e4' }}>
          {k !== 'all' && <span className='w-2 h-2 rounded-full' style={{ background: AREAS[k].c }} />}{n}
        </button>
      ))}
    </div>
  )
}

function VistaTareas({ tareas, areaF, setAreaF, enArea, marcarTarea, setHoja }) {
  const k = hoyKey()
  const abiertas = tareas.filter(t => t.estado !== 'hecha' && enArea(t))
  const grupos = [
    ['Atrasadas', abiertas.filter(t => t.fecha && t.fecha < k)],
    ['Hoy', abiertas.filter(t => t.fecha === k)],
    ['Próximas', abiertas.filter(t => t.fecha && t.fecha > k)],
    ['Sin fecha', abiertas.filter(t => !t.fecha)],
  ]
  const hechas = tareas.filter(t => t.estado === 'hecha' && enArea(t)).sort((a, b) => (b.hecha_en || '').localeCompare(a.hecha_en || '')).slice(0, 30)
  return (
    <>
      <Filtros {...{ areaF, setAreaF }} />
      <button className='btn btn-primary mb-5' onClick={() => setHoja({ tipo: 'tarea' })}>+ Nueva tarea</button>
      {!abiertas.length && <Vacio>No tienes tareas abiertas en este tema.</Vacio>}
      {grupos.map(([n, l]) => l.length > 0 && (
        <Seccion key={n} titulo={`${n} (${l.length})`}>
          <Lista>{l.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map(t => <FilaTarea key={t.id} {...{ t, marcarTarea, setHoja }} />)}</Lista>
        </Seccion>
      ))}
      {hechas.length > 0 && (
        <details className='mt-2'>
          <summary className='text-sm text-gray-500 font-medium cursor-pointer'>Completadas ({hechas.length})</summary>
          <div className='mt-2'><Lista>{hechas.map(t => <FilaTarea key={t.id} {...{ t, marcarTarea, setHoja }} />)}</Lista></div>
        </details>
      )}
    </>
  )
}

function TarjetaSeg({ s, setHoja, ejecutar }) {
  const tarde = s.proxima && s.proxima < hoyKey() && s.estado !== 'cerrado'
  const notas = (s.notas || []).slice(-2).reverse()
  return (
    <div className='bg-white border border-gray-100 rounded-xl p-4 space-y-2'>
      <div className='flex justify-between gap-2'>
        <div className='min-w-0'>
          <div className='font-semibold break-words'>{s.titulo}</div>
          <div className='flex flex-wrap items-center gap-2 mt-0.5'>
            <Area a={s.area} />
            {s.con_quien && <span className='text-xs text-gray-500'>· con {s.con_quien}</span>}
            {s.pedido_numero && <span className='text-xs px-2 py-0.5 rounded-full bg-gray-900' style={{ color: ORO }}>{s.pedido_numero}</span>}
          </div>
        </div>
        {s.estado === 'cerrado' ? <span className='text-xs h-fit px-2 py-0.5 rounded-full bg-gray-100 text-gray-500'>Cerrado</span>
          : s.proxima && <span className={`text-xs h-fit whitespace-nowrap px-2 py-0.5 rounded-full ${tarde ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>Revisar {fmtFecha(s.proxima)}</span>}
      </div>
      {notas.length ? notas.map((n, i) => (
        <div key={i} className='text-sm border-l-2 border-gray-200 pl-3'>{n.t}<div className='text-xs text-gray-400'>{fmtFecha(n.d)}</div></div>
      )) : <div className='text-xs text-gray-400'>Sin avances registrados todavía.</div>}
      <div className='flex flex-wrap gap-2 pt-1'>
        {s.estado !== 'cerrado' && <button className='btn btn-primary' onClick={() => setHoja({ tipo: 'avance', item: s })}>Registrar avance</button>}
        {ejecutar && s.estado !== 'cerrado' && <button className='btn' onClick={() => ejecutar(supabase.from('mi_seguimientos').update({ estado: 'cerrado' }).eq('id', s.id))}>Cerrar</button>}
        {ejecutar && s.estado === 'cerrado' && <button className='btn' onClick={() => ejecutar(supabase.from('mi_seguimientos').update({ estado: 'abierto' }).eq('id', s.id))}>Reabrir</button>}
        <BotonTexto onClick={() => setHoja({ tipo: 'seg', item: s })}>Editar</BotonTexto>
      </div>
    </div>
  )
}

function VistaSeg({ segs, areaF, setAreaF, enArea, setHoja, ejecutar }) {
  const abiertos = segs.filter(s => s.estado !== 'cerrado' && enArea(s)).sort((a, b) => (a.proxima || '9').localeCompare(b.proxima || '9'))
  const cerrados = segs.filter(s => s.estado === 'cerrado' && enArea(s))
  return (
    <>
      <Filtros {...{ areaF, setAreaF }} />
      <button className='btn btn-primary mb-5' onClick={() => setHoja({ tipo: 'seg' })}>+ Nuevo seguimiento</button>
      {abiertos.length ? <div className='space-y-3'>{abiertos.map(s => <TarjetaSeg key={s.id} {...{ s, setHoja, ejecutar }} />)}</div>
        : <Vacio>Aquí van los temas que revisas cada tanto: un proveedor, un proyecto, un saldo por cobrar. Cada uno tiene fecha de próxima revisión e historial.</Vacio>}
      {cerrados.length > 0 && (
        <details className='mt-5'>
          <summary className='text-sm text-gray-500 font-medium cursor-pointer'>Cerrados ({cerrados.length})</summary>
          <div className='space-y-3 mt-2'>{cerrados.map(s => <TarjetaSeg key={s.id} {...{ s, setHoja, ejecutar }} />)}</div>
        </details>
      )}
    </>
  )
}

function VistaHabitos({ rutina, registro }) {
  const habitos = rutina.filter(r => r.habito).sort(porHora)
  const hoy = new Date(), dias = []
  for (let i = 13; i >= 0; i--) dias.push(addDays(hoy, -i))
  if (!habitos.length) return <Vacio>Marca algo de tu rutina como hábito para seguirlo aquí.</Vacio>
  let prog = 0, cumplidos = 0
  return (
    <>
      <p className='text-sm text-gray-500 mb-3'>Últimos 14 días. Solo cuentan los días en que el hábito está en tu rutina.</p>
      <div className='bg-white border border-gray-100 rounded-xl p-3 overflow-x-auto'>
        <table className='text-xs' style={{ width: 'auto' }}>
          <thead><tr><th className='!p-1'></th>{dias.map(d => <th key={keyOf(d)} className='!p-1 text-center !normal-case'>{DOW[d.getDay()][0]}<br />{d.getDate()}</th>)}<th className='!p-1'></th></tr></thead>
          <tbody>
            {habitos.map(r => {
              let racha = 0
              for (let i = 0; i < 120; i++) {
                const d = addDays(hoy, -i), k = keyOf(d)
                if (!(r.dias || []).includes(d.getDay())) continue
                if (registro[k]?.has(r.id)) racha++
                else if (i > 0) break
              }
              return (
                <tr key={r.id}>
                  <td className='!p-1 !border-0 pr-3 text-sm whitespace-nowrap'>{r.titulo}</td>
                  {dias.map(d => {
                    const k = keyOf(d), prog_ = (r.dias || []).includes(d.getDay()), ok = registro[k]?.has(r.id)
                    if (prog_ && k <= hoyKey()) { prog++; if (ok) cumplidos++ }
                    return <td key={k} className='!p-1 !border-0'><span className='block w-4 h-4 rounded' style={{ background: !prog_ ? 'transparent' : ok ? '#2F7A4C' : '#e7e5e4', border: !prog_ ? '1px dashed #e7e5e4' : 'none', outline: k === hoyKey() ? `2px solid ${ORO}` : 'none', outlineOffset: 1 }} /></td>
                  })}
                  <td className='!p-1 !border-0 pl-2 text-sm font-semibold whitespace-nowrap' style={{ color: '#2F7A4C' }}>{racha ? `${racha} seguidos` : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className='card mt-4'>
        <div className='text-xs text-gray-500 uppercase tracking-wide'>Cumplimiento</div>
        <div className='text-3xl font-semibold mt-1'>{prog ? Math.round(cumplidos / prog * 100) : 0}%</div>
        <div className='text-sm text-gray-500'>{cumplidos} de {prog} veces en 14 días</div>
      </div>
    </>
  )
}

function VistaRutina({ rutina, rutDia, setRutDia, setHoja }) {
  const items = rutina.filter(r => (r.dias || []).includes(rutDia)).sort(porHora)
  return (
    <>
      <div className='flex gap-1.5 overflow-x-auto mb-3'>
        {DOW.map((d, i) => (
          <button key={d} onClick={() => setRutDia(i)} className='flex-none px-3 py-1 rounded-full text-sm border'
            style={rutDia === i ? { background: '#1c1917', color: '#fff', borderColor: '#1c1917' } : { borderColor: '#e7e5e4' }}>{d}</button>
        ))}
      </div>
      <button className='btn btn-primary mb-5' onClick={() => setHoja({ tipo: 'rutina' })}>+ Agregar a la rutina</button>
      {items.length ? (
        <Lista>
          {items.map(r => (
            <div key={r.id} className='flex items-center gap-3 px-3 py-3'>
              <span className='w-11 flex-none text-sm font-semibold tabular-nums text-gray-500'>{fmtHora(r.hora)}</span>
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-medium break-words'>{r.titulo}</div>
                <div className='flex items-center gap-2'><Area a={r.area} />{r.habito && <span className='text-xs px-2 py-0.5 rounded-full' style={{ background: '#FBF6E9', color: '#8C6A1F' }}>Hábito</span>}</div>
              </div>
              <BotonTexto onClick={() => setHoja({ tipo: 'rutina', item: r })}>Editar</BotonTexto>
            </div>
          ))}
        </Lista>
      ) : <Vacio>Nada programado para el {DOW_L[rutDia]}.</Vacio>}
    </>
  )
}

/* ---------------- Formulario (hoja inferior) ---------------- */

function Hoja({ hoja, cerrar, ejecutar, rutDia, areaF }) {
  const { tipo, item } = hoja
  const i = item || {}
  const areaInicial = i.area || (areaF !== 'all' ? areaF : tipo === 'rutina' ? 'personal' : 'chester')
  const [f, setF] = useState({
    titulo: i.titulo || '', area: areaInicial, fecha: i.fecha || '', proxima: i.proxima || keyOf(addDays(new Date(), 7)),
    con_quien: i.con_quien || '', pedido_numero: i.pedido_numero || '', hora: (i.hora || '08:00').slice(0, 5),
    dias: i.dias || [rutDia], habito: !!i.habito, nota: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [borrar, setBorrar] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const titulos = { tarea: item ? 'Editar tarea' : 'Nueva tarea', seg: item ? 'Editar seguimiento' : 'Nuevo seguimiento', avance: 'Registrar avance', rutina: item ? 'Editar rutina' : 'Agregar a la rutina' }
  const tabla = { tarea: 'mi_tareas', seg: 'mi_seguimientos', rutina: 'mi_rutina' }[tipo]
  const pedidoLimpio = v => { const s = v.trim().toUpperCase().replace(/\s/g, ''); return !s ? null : /^\d+$/.test(s) ? 'MC-' + s.padStart(3, '0') : s }

  async function guardar(e) {
    e.preventDefault()
    let q
    if (tipo === 'avance') {
      if (!f.nota.trim()) return
      q = supabase.from('mi_seguimientos').update({ notas: [...(i.notas || []), { d: hoyKey(), t: f.nota.trim() }].slice(-50), proxima: f.proxima || null }).eq('id', i.id)
    } else {
      if (!f.titulo.trim()) return
      let d
      if (tipo === 'tarea') d = { titulo: f.titulo.trim(), area: f.area, fecha: f.fecha || null, pedido_numero: pedidoLimpio(f.pedido_numero) }
      if (tipo === 'seg') d = { titulo: f.titulo.trim(), area: f.area, con_quien: f.con_quien.trim() || null, proxima: f.proxima || null, pedido_numero: pedidoLimpio(f.pedido_numero) }
      if (tipo === 'rutina') { if (!f.dias.length) return; d = { titulo: f.titulo.trim(), area: f.area, hora: f.hora, dias: [...f.dias].sort(), habito: f.habito } }
      q = item ? supabase.from(tabla).update(d).eq('id', i.id) : supabase.from(tabla).insert(d)
    }
    setGuardando(true)
    if (await ejecutar(q)) cerrar()
    setGuardando(false)
  }
  async function eliminar() {
    if (!borrar) { setBorrar(true); return }
    setGuardando(true)
    if (await ejecutar(supabase.from(tabla).delete().eq('id', i.id))) cerrar()
    setGuardando(false)
  }

  const campo = (id, label, el) => <div><label htmlFor={id} className='text-xs text-gray-500 mb-1 block'>{label}</label>{el}</div>
  const selArea = <select id='h-area' value={f.area} onChange={e => set('area', e.target.value)}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}</select>

  return (
    <div className='fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center' onClick={cerrar}>
      <form onSubmit={guardar} onClick={e => e.stopPropagation()} className='bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto' style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <h2 className='text-lg font-semibold'>{titulos[tipo]}</h2>
        {tipo === 'avance' ? (
          <>
            <p className='text-sm text-gray-500'>{i.titulo}</p>
            {campo('h-nota', '¿Qué pasó?', <textarea id='h-nota' rows={3} value={f.nota} onChange={e => set('nota', e.target.value)} autoFocus required />)}
            {campo('h-prox', 'Próxima revisión', <input id='h-prox' type='date' value={f.proxima} onChange={e => set('proxima', e.target.value)} />)}
          </>
        ) : (
          <>
            {campo('h-titulo', tipo === 'rutina' ? 'Actividad' : tipo === 'seg' ? 'Tema a seguir' : 'Tarea', <input id='h-titulo' value={f.titulo} onChange={e => set('titulo', e.target.value)} autoFocus required />)}
            <div className='grid grid-cols-2 gap-3'>
              {campo('h-area', 'Tema', selArea)}
              {tipo === 'tarea' && campo('h-fecha', 'Fecha', <input id='h-fecha' type='date' value={f.fecha} onChange={e => set('fecha', e.target.value)} />)}
              {tipo === 'seg' && campo('h-quien', 'Con quién', <input id='h-quien' value={f.con_quien} onChange={e => set('con_quien', e.target.value)} />)}
              {tipo === 'rutina' && campo('h-hora', 'Hora', <input id='h-hora' type='time' value={f.hora} onChange={e => set('hora', e.target.value)} required />)}
            </div>
            {tipo === 'seg' && campo('h-prox', 'Próxima revisión', <input id='h-prox' type='date' value={f.proxima} onChange={e => set('proxima', e.target.value)} />)}
            {(tipo === 'tarea' || tipo === 'seg') && campo('h-pedido', 'Pedido relacionado (opcional)', <input id='h-pedido' placeholder='Ej: MC-035' value={f.pedido_numero} onChange={e => set('pedido_numero', e.target.value)} />)}
            {tipo === 'rutina' && (
              <>
                <div>
                  <span className='text-xs text-gray-500 mb-1 block'>Días</span>
                  <div className='flex flex-wrap gap-1.5'>
                    {DOW.map((d, n) => {
                      const on = f.dias.includes(n)
                      return <button type='button' key={d} onClick={() => set('dias', on ? f.dias.filter(x => x !== n) : [...f.dias, n])} aria-pressed={on}
                        className='px-2.5 py-1 rounded-lg text-sm font-medium border' style={on ? { background: '#1c1917', color: '#fff', borderColor: '#1c1917' } : { borderColor: '#e7e5e4' }}>{d}</button>
                    })}
                  </div>
                </div>
                <label className='flex items-center gap-2 text-sm'><input type='checkbox' style={{ width: 'auto' }} checked={f.habito} onChange={e => set('habito', e.target.checked)} /> Seguirlo como hábito</label>
              </>
            )}
          </>
        )}
        <div className='flex items-center justify-between gap-2 pt-2'>
          <div>{item && tipo !== 'avance' && <button type='button' className='btn' style={{ color: '#B4561F' }} onClick={eliminar} disabled={guardando}>{borrar ? 'Toca otra vez para borrar' : 'Borrar'}</button>}</div>
          <div className='flex gap-2'>
            <button type='button' className='btn' onClick={cerrar}>Cancelar</button>
            <button className='btn btn-primary' disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
