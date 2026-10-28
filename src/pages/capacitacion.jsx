import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MODULOS, LECCIONES, APROBAR } from '@/lib/capacitacion'

/* Capacitación: manual de ventas en lecciones con quiz. El contenido está en src/lib/capacitacion.js.
   Cada persona ve su avance; Joseph ve además el avance del equipo y puede crear usuarios vendedores. */

const ADMIN = 'josephtoledo@gmail.com'
const $ = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')

export default function Capacitacion() {
  const [email, setEmail] = useState(null)
  const [progreso, setProgreso] = useState({})
  const [abierta, setAbierta] = useState(null)
  const [tab, setTab] = useState('cursos')

  async function cargar(em) {
    const { data } = await supabase.from('cap_progreso').select('*').eq('email', em)
    setProgreso(Object.fromEntries((data || []).map(r => [r.leccion, r])))
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const em = data.session?.user?.email
      setEmail(em)
      if (em) cargar(em)
    })
  }, [])

  const aprobadas = LECCIONES.filter(l => progreso[l.id]?.aprobado).length
  const pct = Math.round(aprobadas / LECCIONES.length * 100)

  if (abierta) {
    const l = LECCIONES.find(x => x.id === abierta)
    const i = LECCIONES.findIndex(x => x.id === abierta)
    return <Leccion l={l} email={email} previo={progreso[l.id]} siguiente={LECCIONES[i + 1]} volver={() => { setAbierta(null); window.scrollTo(0, 0) }} abrir={id => { setAbierta(id); window.scrollTo(0, 0) }} guardado={() => cargar(email)} />
  }

  return (
    <div className='p-4 max-w-3xl mx-auto'>
      <h1 className='text-xl font-medium'>Capacitación</h1>
      <p className='text-sm text-gray-500 mb-4'>Manual de ventas Mr. Chester. Lee cada lección y responde el quiz: se aprueba con {Math.round(APROBAR * 100)}%.</p>

      {email === ADMIN && (
        <div className='flex gap-2 mb-4'>
          {[['cursos', '📚 Lecciones'], ['equipo', '👥 Equipo']].map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{t}</button>
          ))}
        </div>
      )}

      {tab === 'equipo' ? <Equipo /> : (
        <>
          <div className='card mb-4'>
            <div className='flex justify-between text-sm mb-1'><span>Tu avance: <b>{aprobadas} de {LECCIONES.length}</b> lecciones</span><b>{pct}%</b></div>
            <div className='h-3 rounded-full bg-gray-100 overflow-hidden'><div className='h-full bg-green-500' style={{ width: pct + '%' }} /></div>
            {pct === 100 && <p className='text-sm text-green-700 font-semibold mt-2'>🏆 ¡Terminaste toda la capacitación!</p>}
          </div>
          <div className='space-y-4'>
            {MODULOS.map((m, mi) => (
              <div key={m.id} className='card'>
                <h2 className='font-semibold mb-2'>{m.icono} Módulo {mi + 1} · {m.titulo}</h2>
                <div className='space-y-2'>
                  {m.lecciones.map(l => {
                    const pr = progreso[l.id]
                    return (
                      <button key={l.id} type='button' onClick={() => { setAbierta(l.id); window.scrollTo(0, 0) }}
                        className='w-full text-left flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-purple-300 hover:bg-purple-50'>
                        <div>
                          <p className='text-sm font-medium'>{l.titulo}</p>
                          <p className='text-xs text-gray-500'>{l.minutos} min · {l.quiz.length} preguntas</p>
                        </div>
                        <span className={`text-xs font-semibold whitespace-nowrap ${pr?.aprobado ? 'text-green-700' : pr ? 'text-amber-600' : 'text-gray-400'}`}>
                          {pr?.aprobado ? `✓ ${pr.puntaje}/${pr.total}` : pr ? `Repetir (${pr.puntaje}/${pr.total})` : 'Pendiente'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Bloque({ b, precios }) {
  if (b.t === 'p') return <p className='text-[15px] leading-relaxed text-gray-800'>{b.x}</p>
  if (b.t === 'tip') return <div className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>💡 {b.x}</div>
  if (b.t === 'alerta') return <div className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 font-medium'>⚠️ {b.x}</div>
  if (b.t === 'guion') return <div className='rounded-xl border-l-4 border-purple-400 bg-purple-50 p-3 text-sm text-purple-900'><span className='block text-xs font-semibold uppercase tracking-wide text-purple-500 mb-1'>Así lo puedes decir</span>{b.x}</div>
  if (b.t === 'lista') return (
    <div>
      {b.titulo && <h3 className='font-semibold text-sm mb-1.5'>{b.titulo}</h3>}
      <ul className='list-disc ml-5 space-y-1.5 text-[15px] leading-relaxed text-gray-800'>{b.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  )
  if (b.t === 'tabla') return (
    <div className='overflow-x-auto'>
      <table>
        <thead><tr>{b.cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{b.filas.map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j} className={j === 0 ? 'font-medium whitespace-nowrap' : 'text-sm'}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
  if (b.t === 'precios') return !precios ? <p className='text-sm text-gray-400'>Cargando precios…</p> : (
    <div className='overflow-x-auto'>
      <table>
        <thead><tr><th>Referencia</th><th>Precio oferta</th><th>Precio público</th></tr></thead>
        <tbody>{precios.map(p => (
          <tr key={p.id}><td className='font-medium'>{p.referencia}</td><td className='font-semibold text-green-700 whitespace-nowrap'>{p.valor_oferta ? $(p.valor_oferta) : '—'}</td><td className='text-gray-500 line-through whitespace-nowrap'>{p.valor_publico ? $(p.valor_publico) : '—'}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
  return null
}

function Leccion({ l, email, previo, siguiente, volver, abrir, guardado }) {
  const [resp, setResp] = useState({})
  const [enviado, setEnviado] = useState(false)
  const [precios, setPrecios] = useState(null)
  const [intento, setIntento] = useState(0)
  // Las opciones salen en orden distinto en cada intento
  const orden = useMemo(() => l.quiz.map(q => q.o.map((_, j) => j).sort(() => Math.random() - 0.5)), [l.id, intento])
  useEffect(() => { setResp({}); setEnviado(false) }, [l.id])
  useEffect(() => {
    if (l.bloques.some(b => b.t === 'precios')) supabase.from('productos').select('id, categoria, referencia, valor_publico, valor_oferta').order('categoria').order('referencia').then(({ data }) => setPrecios(data || []))
  }, [l.id])

  const buenas = l.quiz.filter((q, i) => resp[i] === q.c).length
  const aprobado = buenas / l.quiz.length >= APROBAR - 1e-9
  const completo = Object.keys(resp).length === l.quiz.length

  async function calificar() {
    setEnviado(true)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    if (!email) return
    const mejor = previo && previo.puntaje > buenas ? previo : null
    await supabase.from('cap_progreso').upsert({
      email, leccion: l.id,
      puntaje: mejor ? mejor.puntaje : buenas, total: l.quiz.length,
      aprobado: !!(previo?.aprobado || aprobado),
      intentos: (previo?.intentos || 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email,leccion' })
    guardado()
  }

  return (
    <div className='p-4 max-w-3xl mx-auto'>
      <button type='button' onClick={volver} className='text-sm text-purple-700 mb-3'>← Volver a las lecciones</button>
      <h1 className='text-xl font-semibold mb-1'>{l.titulo}</h1>
      <p className='text-xs text-gray-500 mb-4'>{l.minutos} min de lectura{previo?.aprobado ? ' · ✓ Aprobada' : ''}</p>

      <div className='card space-y-4 mb-6'>
        {l.bloques.map((b, i) => <Bloque key={i} b={b} precios={precios} />)}
      </div>

      <div className='card space-y-5'>
        <h2 className='font-semibold'>📝 Quiz · {l.quiz.length} preguntas</h2>
        {l.quiz.map((q, i) => (
          <fieldset key={i} className='space-y-2'>
            <legend className='text-sm font-medium mb-1'>{i + 1}. {q.p}</legend>
            {orden[i].map(j => {
              const op = q.o[j]
              const elegido = resp[i] === j
              const color = !enviado ? (elegido ? 'border-purple-500 bg-purple-50' : 'border-gray-200')
                : j === q.c ? 'border-green-500 bg-green-50' : elegido ? 'border-red-400 bg-red-50' : 'border-gray-200 opacity-60'
              return (
                <label key={j} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${color}`}>
                  <input type='radio' name={`q${i}`} className='mt-0.5' checked={elegido} disabled={enviado} onChange={() => setResp(r => ({ ...r, [i]: j }))} />
                  <span>{op}</span>
                </label>
              )
            })}
            {enviado && <p className={`text-xs ${resp[i] === q.c ? 'text-green-700' : 'text-red-700'}`}>{resp[i] === q.c ? '✓ Correcto. ' : '✗ '}{q.e}</p>}
          </fieldset>
        ))}

        {!enviado ? (
          <button className='btn btn-primary w-full' disabled={!completo} onClick={calificar}>{completo ? 'Calificar' : `Responde las ${l.quiz.length} preguntas`}</button>
        ) : (
          <div className={`rounded-xl p-4 text-center ${aprobado ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
            <p className='text-2xl font-bold'>{buenas} / {l.quiz.length}</p>
            <p className='font-semibold'>{aprobado ? '¡Aprobada! 🎉' : `Necesitas ${Math.ceil(APROBAR * l.quiz.length)} correctas. Repasa y vuelve a intentarlo.`}</p>
            <div className='flex gap-2 justify-center mt-3'>
              {!aprobado && <button className='btn' onClick={() => { setResp({}); setEnviado(false); setIntento(n => n + 1); window.scrollTo(0, 0) }}>Repetir</button>}
              {aprobado && siguiente && <button className='btn btn-primary' onClick={() => abrir(siguiente.id)}>Siguiente: {siguiente.titulo} →</button>}
              {aprobado && !siguiente && <button className='btn btn-primary' onClick={volver}>Terminar</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Equipo() {
  const [filas, setFilas] = useState(null)
  const [equipo, setEquipo] = useState([])
  const [nuevo, setNuevo] = useState({ nombre: '', usuario: '', clave: '' })
  const [msg, setMsg] = useState('')
  const [creando, setCreando] = useState(false)

  async function cargar() {
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('cap_progreso').select('*'),
      supabase.from('cap_equipo').select('*').order('nombre'),
    ])
    setFilas(p || []); setEquipo(e || [])
  }
  useEffect(() => { cargar() }, [])

  async function crear(ev) {
    ev.preventDefault()
    const usuario = nuevo.usuario.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    if (!nuevo.nombre.trim() || !usuario || nuevo.clave.length < 6) { setMsg('Escribe nombre, usuario y una clave de mínimo 6 caracteres.'); return }
    setCreando(true); setMsg('')
    const { error } = await supabase.rpc('cap_crear_vendedor', { p_nombre: nuevo.nombre.trim(), p_usuario: usuario, p_clave: nuevo.clave })
    setCreando(false)
    if (error) { setMsg('No se pudo crear: ' + error.message); return }
    setMsg(`✓ Usuario creado. Entra con usuario "${usuario}" y la clave que pusiste.`)
    setNuevo({ nombre: '', usuario: '', clave: '' }); cargar()
  }

  if (!filas) return <p className='text-gray-500'>Cargando…</p>
  const personas = [...new Set([...equipo.map(e => e.email), ...filas.map(f => f.email)])]
  const nombreDe = em => equipo.find(e => e.email === em)?.nombre || (em === ADMIN ? 'Joseph' : em.split('@')[0])

  return (
    <div className='space-y-4'>
      <div className='card overflow-x-auto'>
        <h2 className='text-sm font-semibold mb-3'>Avance del equipo</h2>
        {!personas.length ? <p className='text-sm text-gray-400'>Todavía nadie ha empezado.</p> : (
          <table>
            <thead><tr><th>Persona</th><th>Aprobadas</th><th>Avance</th><th>Pendientes</th></tr></thead>
            <tbody>{personas.map(em => {
              const mias = filas.filter(f => f.email === em)
              const ok = LECCIONES.filter(l => mias.find(f => f.leccion === l.id && f.aprobado))
              const falta = LECCIONES.filter(l => !ok.includes(l))
              return (
                <tr key={em}>
                  <td className='font-medium'>{nombreDe(em)}</td>
                  <td>{ok.length}/{LECCIONES.length}</td>
                  <td><div className='w-24 h-2 rounded-full bg-gray-100 overflow-hidden'><div className='h-full bg-green-500' style={{ width: (ok.length / LECCIONES.length * 100) + '%' }} /></div></td>
                  <td className='text-xs text-gray-500'>{falta.length ? falta.map(l => l.titulo).join(', ') : '🏆 Terminó'}</td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </div>

      <form onSubmit={crear} className='card space-y-3'>
        <h2 className='text-sm font-semibold'>Crear usuario para un vendedor</h2>
        <p className='text-xs text-gray-500'>El vendedor solo verá Capacitación y Cotizaciones en el ERP.</p>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          <div><label htmlFor='v-nom' className='text-xs text-gray-500 mb-1 block'>Nombre</label><input id='v-nom' value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} placeholder='Ej: Laura Gómez' /></div>
          <div><label htmlFor='v-usu' className='text-xs text-gray-500 mb-1 block'>Usuario</label><input id='v-usu' autoCapitalize='none' value={nuevo.usuario} onChange={e => setNuevo(n => ({ ...n, usuario: e.target.value }))} placeholder='Ej: laura' /></div>
          <div><label htmlFor='v-cla' className='text-xs text-gray-500 mb-1 block'>Clave</label><input id='v-cla' value={nuevo.clave} onChange={e => setNuevo(n => ({ ...n, clave: e.target.value }))} placeholder='Mínimo 6 caracteres' /></div>
        </div>
        <button className='btn btn-primary' disabled={creando}>{creando ? 'Creando…' : 'Crear usuario'}</button>
        {msg && <p className='text-sm text-gray-700'>{msg}</p>}
        {equipo.length > 0 && <p className='text-xs text-gray-500'>Vendedores: {equipo.map(e => `${e.nombre} (${e.email.split('@')[0]})`).join(' · ')}</p>}
      </form>
    </div>
  )
}
