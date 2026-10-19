import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'

/* La Casa: página sencilla para quien ayuda en el hogar.
   Ve el menú y las listas de mercado del dueño, marca lo comprado y pide lo que falta.
   Los permisos los controla la base de datos (mi_hogar_miembros + RLS). */

const ORO = '#C9A84C'
const NEGRO = '#1a1a1a'
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DOW_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const PERSONAS = [['ninos', 'Niños'], ['monica', 'Mónica'], ['joseph', 'Joseph']]
const COMIDA_N = { desayuno: 'Desayuno', lonchera: 'Lonchera', onces: 'Onces', almuerzo: 'Almuerzo', snack: 'Snack', cena: 'Comida' }
const COMIDAS_DE = { ninos: ['desayuno', 'lonchera', 'onces', 'cena'], monica: ['desayuno', 'almuerzo', 'cena'], joseph: ['almuerzo', 'snack', 'cena'] }
const LISTA_PEDIDOS = 'Pedidos de la casa'

const tiendasDe = m => [...new Set(m.filter(x => !String(x.lista).startsWith('_')).map(x => x.lista))]
const diaTienda = (m, t) => { const x = m.find(i => i.lista === t && i.dia !== null && i.dia !== undefined); return x ? x.dia : null }
function guardarModo(v) { try { v ? localStorage.setItem('modoCasa', '1') : localStorage.removeItem('modoCasa') } catch (e) {} }

function Casa() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return (
    <div style={{ minHeight: '100vh', background: '#F6F3EE' }}>
      <Head><title>La Casa</title><meta name='apple-mobile-web-app-title' content='La Casa' /></Head>
      <div style={{ background: NEGRO, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className='max-w-xl mx-auto px-4 py-3 flex items-center justify-between'>
          <span style={{ color: ORO, fontWeight: 800, letterSpacing: 3, fontSize: 14 }}>♛ LA CASA</span>
          {session && <button onClick={() => { guardarModo(false); supabase.auth.signOut() }} className='text-xs underline' style={{ color: '#bbb' }}>Salir</button>}
        </div>
      </div>
      {session === undefined ? <p className='p-6 text-gray-400'>Cargando…</p> : session ? <Panel session={session} /> : <Entrar />}
    </div>
  )
}
Casa.sinLayout = true
export default Casa

function Entrar() {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  async function entrar(e) {
    e.preventDefault()
    setError(null); setCargando(true)
    const u = usuario.trim().toLowerCase()
    const email = u.includes('@') ? u : `${u}@envios.mrchester.com.co`
    const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
    if (error) setError('Usuario o contraseña incorrectos. Revisa e intenta de nuevo.')
    setCargando(false)
  }
  return (
    <form onSubmit={entrar} className='max-w-sm mx-auto p-4 mt-6 space-y-4'>
      <h1 className='text-2xl font-semibold'>Bienvenida</h1>
      <p className='text-gray-600'>Aquí ves el menú de la semana y la lista del mercado.</p>
      <div>
        <label htmlFor='c-u' className='text-sm text-gray-600 block mb-1'>Usuario</label>
        <input id='c-u' autoCapitalize='none' autoComplete='username' value={usuario} onChange={e => setUsuario(e.target.value)} required style={{ fontSize: 18, padding: 12 }} />
      </div>
      <div>
        <label htmlFor='c-c' className='text-sm text-gray-600 block mb-1'>Contraseña</label>
        <input id='c-c' type='password' autoComplete='current-password' value={clave} onChange={e => setClave(e.target.value)} required style={{ fontSize: 18, padding: 12 }} />
      </div>
      {error && <p className='text-red-700 bg-red-50 rounded-lg p-3'>{error}</p>}
      <button className='w-full rounded-xl py-3 text-lg font-semibold' style={{ background: NEGRO, color: ORO }} disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
    </form>
  )
}

function Panel({ session }) {
  const [tab, setTab] = useState('hoy')
  const [owner, setOwner] = useState(null)
  const [nombre, setNombre] = useState('')
  const [menu, setMenu] = useState([])
  const [mercado, setMercado] = useState([])
  const [error, setError] = useState(null)
  const [listo, setListo] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [waDueno, setWaDueno] = useState('')
  const [ultimoPedido, setUltimoPedido] = useState(null)

  async function cargar() {
    const uid = session.user.id
    const { data: mem } = await supabase.from('mi_hogar_miembros').select('owner,nombre,whatsapp_dueno').eq('miembro', uid).maybeSingle()
    const own = mem ? mem.owner : uid
    setOwner(own); setNombre(mem ? mem.nombre : ''); setWaDueno(mem && mem.whatsapp_dueno ? mem.whatsapp_dueno : '')
    guardarModo(!!mem) // solo el celular de la casa abre directo esta página
    const [mn, mc] = await Promise.all([
      supabase.from('mi_menu').select('*').eq('owner', own),
      supabase.from('mi_mercado').select('*').eq('owner', own).order('orden'),
    ])
    if (mn.error || mc.error) { setError('No se pudo cargar. Revisa el internet e intenta de nuevo.'); return }
    setMenu(mn.data); setMercado(mc.data); setError(null); setListo(true)
  }
  useEffect(() => { cargar() }, [])

  async function marcar(m) {
    setMercado(xs => xs.map(x => x.id === m.id ? { ...x, comprado: !m.comprado } : x))
    const { error: e } = await supabase.from('mi_mercado').update({ comprado: !m.comprado }).eq('id', m.id)
    if (e) { setError('No se pudo guardar. Intenta de nuevo.'); cargar() }
  }

  const d = new Date(), dow = d.getDay()
  return (
    <div className='max-w-xl mx-auto p-4 pb-28'>
      <p className='text-sm text-gray-500 capitalize'>{DOW_L[dow]} {d.getDate()} de {MES[d.getMonth()]}</p>
      <h1 className='text-2xl font-semibold mb-4'>Hola{nombre ? `, ${nombre}` : ''}</h1>
      <div className='flex gap-2 mb-5'>
        {[['hoy', 'Hoy'], ['semana', 'Semana'], ['mercado', 'Mercado']].map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} className='flex-1 py-2.5 rounded-xl font-semibold border'
            style={tab === k ? { background: NEGRO, color: ORO, borderColor: NEGRO } : { borderColor: '#e2ddd4', background: '#fff' }}>{n}</button>
        ))}
      </div>
      {aviso && <div className='mb-4 rounded-xl p-3 bg-green-50 text-green-800 font-medium'>{aviso}</div>}
      {error && <div className='mb-4 rounded-xl p-3 bg-red-50 text-red-700'>{error}</div>}
      {!listo && !error && <p className='text-gray-400'>Cargando…</p>}
      {listo && tab === 'hoy' && (dow >= 1 && dow <= 5 ? <MenuDia menu={menu} dia={dow} /> : <Caja>Hoy es fin de semana: no hay menú programado.</Caja>)}
      {listo && tab === 'semana' && <Semana menu={menu} />}
      {listo && tab === 'mercado' && <Mercado mercado={mercado} marcar={marcar} />}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(transparent, #F6F3EE 30%)' }}>
        <div className='max-w-xl mx-auto'>
          <button onClick={() => setPidiendo(true)} className='w-full rounded-2xl py-4 text-lg font-bold shadow-lg' style={{ background: ORO, color: NEGRO }}>+ Pedir algo que falta</button>
        </div>
      </div>
      {pidiendo && <Pedir {...{ owner, nombre, mercado, cerrar: () => setPidiendo(false), listo: async (pedido) => { setPidiendo(false); setUltimoPedido(pedido); await cargar() } }} />}
      {ultimoPedido && <Avisar pedido={ultimoPedido} nombre={nombre} wa={waDueno} cerrar={() => setUltimoPedido(null)} />}
    </div>
  )
}

const Caja = ({ children }) => <div className='rounded-xl border border-dashed border-gray-300 p-4 text-gray-600'>{children}</div>

function MenuDia({ menu, dia }) {
  const [abierta, setAbierta] = useState(null)
  return (
    <div className='space-y-4'>
      {abierta && <Receta m={abierta} cerrar={() => setAbierta(null)} />}
      {PERSONAS.map(([p, pn]) => {
        const del = COMIDAS_DE[p].map(c => menu.find(x => x.persona === p && x.dia === dia && x.comida === c)).filter(Boolean)
        return del.length > 0 && (
          <div key={p}>
            <div className='text-sm font-bold uppercase tracking-wide mb-1.5' style={{ color: '#8C6A1F' }}>{pn}</div>
            <div className='bg-white rounded-xl border border-gray-100 divide-y divide-gray-100'>
              {del.map(m => (
                <button key={m.id} onClick={() => m.receta && setAbierta(m)} className='w-full text-left p-3 block' disabled={!m.receta}>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-xs text-gray-500'>{COMIDA_N[m.comida]}</span>
                    {m.receta && <span className='text-xs font-semibold' style={{ color: '#8C6A1F' }}>Ver receta ›</span>}
                  </div>
                  <div className='text-base font-medium'>{m.plato}</div>
                  {m.nota && <div className='text-sm mt-1 rounded-lg px-2 py-1' style={{ background: '#FBF6E9', color: '#7a5c17' }}>📝 {m.nota}</div>}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Receta({ m, cerrar }) {
  const r = m.receta || {}
  const Lista = ({ titulo, items, numerada }) => items && items.length > 0 && (
    <div>
      <h3 className='font-bold text-base mb-1.5'>{titulo}</h3>
      {numerada ? (
        <ol className='space-y-2'>
          {items.map((x, i) => (
            <li key={i} className='flex gap-3'>
              <span className='w-7 h-7 flex-none rounded-full flex items-center justify-center text-sm font-bold' style={{ background: NEGRO, color: ORO }}>{i + 1}</span>
              <span className='text-base leading-snug pt-0.5'>{x}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className='space-y-1'>
          {items.map((x, i) => <li key={i} className='text-base flex gap-2'><span style={{ color: ORO }}>•</span><span>{x}</span></li>)}
        </ul>
      )}
    </div>
  )
  return (
    <div className='fixed inset-0 z-50 bg-black/40 flex items-end justify-center' onClick={cerrar}>
      <div onClick={e => e.stopPropagation()} className='bg-white w-full max-w-xl rounded-t-2xl overflow-y-auto' style={{ maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className='sticky top-0 bg-white p-5 pb-3 border-b border-gray-100 flex justify-between gap-3'>
          <div>
            <div className='text-xs font-bold uppercase tracking-wide' style={{ color: '#8C6A1F' }}>{COMIDA_N[m.comida]} · {DOW_L[m.dia]}{r.porciones ? ` · ${r.porciones}` : ''}</div>
            <h2 className='text-xl font-semibold leading-snug mt-0.5'>{m.plato}</h2>
          </div>
          <button onClick={cerrar} className='text-2xl leading-none text-gray-400 px-1' aria-label='Cerrar'>×</button>
        </div>
        <div className='p-5 space-y-5'>
          {m.nota && <div className='rounded-lg px-3 py-2' style={{ background: '#FBF6E9', color: '#7a5c17' }}>📝 {m.nota}</div>}
          <Lista titulo='Ingredientes' items={r.ingredientes} />
          <Lista titulo='Cómo se prepara' items={r.pasos} numerada />
          {r.tips && r.tips.length > 0 && (
            <div className='rounded-xl p-3' style={{ background: '#F1F7F2' }}>
              <h3 className='font-bold mb-1' style={{ color: '#2F7A4C' }}>💡 Tips</h3>
              {r.tips.map((t, i) => <p key={i} className='text-base'>{t}</p>)}
            </div>
          )}
          {r.alterna && (
            <div className='rounded-xl border border-dashed border-gray-300 p-4 space-y-4'>
              <h3 className='font-bold text-base'>🔁 {r.alterna.titulo}</h3>
              <Lista titulo='Ingredientes' items={r.alterna.ingredientes} />
              <Lista titulo='Cómo se prepara' items={r.alterna.pasos} numerada />
            </div>
          )}
          <button onClick={cerrar} className='w-full py-3 rounded-xl font-semibold' style={{ background: NEGRO, color: ORO }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function Semana({ menu }) {
  const hoy = new Date().getDay()
  const [dia, setDia] = useState(hoy >= 1 && hoy <= 5 ? hoy : 1)
  return (
    <>
      <div className='flex gap-1.5 mb-4'>
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} onClick={() => setDia(i)} className='flex-1 py-2 rounded-lg text-sm font-semibold border'
            style={dia === i ? { background: NEGRO, color: ORO, borderColor: NEGRO } : { borderColor: '#e2ddd4', background: '#fff' }}>{DOW[i]}</button>
        ))}
      </div>
      <MenuDia menu={menu} dia={dia} />
    </>
  )
}

function Mercado({ mercado, marcar }) {
  const tiendas = tiendasDe(mercado)
  const hoy = new Date().getDay()
  const porDefecto = tiendas.find(t => diaTienda(mercado, t) === hoy) || tiendas[0]
  const [tienda, setTienda] = useState(porDefecto)
  const t = tiendas.includes(tienda) ? tienda : tiendas[0]
  const items = mercado.filter(m => m.lista === t)
  const secciones = [...new Set(items.map(m => m.seccion))]
  if (!tiendas.length) return <Caja>No hay listas de mercado todavía.</Caja>
  return (
    <>
      <div className='flex gap-2 overflow-x-auto pb-1 mb-4'>
        {tiendas.map(k => {
          const dd = diaTienda(mercado, k), p = mercado.filter(m => m.lista === k && !m.comprado).length
          return (
            <button key={k} onClick={() => setTienda(k)} className='flex-none px-3 py-2 rounded-xl text-left border'
              style={k === t ? { background: NEGRO, color: ORO, borderColor: NEGRO } : { borderColor: '#e2ddd4', background: '#fff' }}>
              <span className='block font-semibold'>{k}</span>
              <span className='block text-xs opacity-75'>{dd !== null ? DOW_L[dd] : 'cuando haga falta'} · faltan {p}</span>
            </button>
          )
        })}
      </div>
      <p className='text-sm text-gray-600 mb-3'>Toca el círculo cuando ya lo compraste o si ya hay en la casa.</p>
      {secciones.map(sec => (
        <div key={sec} className='mb-4'>
          <div className='text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5'>{sec}</div>
          <div className='bg-white rounded-xl border border-gray-100 divide-y divide-gray-100'>
            {items.filter(m => m.seccion === sec).map(m => (
              <button key={m.id} onClick={() => marcar(m)} className='w-full flex items-center gap-3 p-3 text-left' aria-pressed={m.comprado}>
                <span className='w-8 h-8 flex-none rounded-full border-2 flex items-center justify-center text-white text-lg'
                  style={{ borderColor: m.comprado ? '#2F7A4C' : '#cfcac2', background: m.comprado ? '#2F7A4C' : 'transparent' }}>{m.comprado ? '✓' : ''}</span>
                <span className='flex-1 min-w-0'>
                  <span className={`text-base ${m.comprado ? 'line-through text-gray-400' : 'font-medium'}`}>{m.item}</span>
                  {m.cantidad && <span className='text-gray-500'> · {m.cantidad}</span>}
                  {m.pedido_por && <span className='block text-xs' style={{ color: '#8C6A1F' }}>Pedido por {m.pedido_por}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function Avisar({ pedido, nombre, wa, cerrar }) {
  const texto = `Hola Joseph, soy ${nombre || 'Lucellis'}. Hace falta: ${pedido.item}${pedido.cantidad ? ` (${pedido.cantidad})` : ''}${pedido.tienda ? `, se compra en ${pedido.tienda}` : ''}. Ya lo dejé anotado en La Casa.`
  const link = `https://wa.me/${wa || ''}?text=${encodeURIComponent(texto)}`
  return (
    <div className='fixed inset-0 z-40 bg-black/40 flex items-end justify-center' onClick={cerrar}>
      <div onClick={e => e.stopPropagation()} className='bg-white w-full max-w-xl rounded-t-2xl p-5 space-y-3' style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <div className='rounded-xl p-3 bg-green-50 text-green-800 font-semibold'>✓ Quedó anotado: {pedido.item}</div>
        <p className='text-gray-700'>Ahora avísale a Joseph para que lo vea de una vez:</p>
        <a href={link} target='_blank' rel='noreferrer' onClick={() => setTimeout(cerrar, 500)}
          className='flex items-center justify-center gap-2 w-full rounded-2xl py-4 text-lg font-bold text-white' style={{ background: '#25D366' }}>
          Avisarle a Joseph por WhatsApp
        </a>
        <button onClick={cerrar} className='w-full py-3 rounded-xl border border-gray-200 font-semibold text-gray-600'>No es urgente, cerrar</button>
      </div>
    </div>
  )
}

function Pedir({ owner, nombre, mercado, cerrar, listo }) {
  const tiendas = tiendasDe(mercado).filter(t => t !== LISTA_PEDIDOS)
  const [item, setItem] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [tienda, setTienda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  async function enviar(e) {
    e.preventDefault()
    if (!item.trim()) return
    setGuardando(true); setError(null)
    const lista = tienda || LISTA_PEDIDOS
    const { error: err } = await supabase.from('mi_mercado').insert({
      owner, lista, dia: tienda ? diaTienda(mercado, tienda) : null, seccion: 'Pedidos', item: item.trim(),
      cantidad: cantidad.trim() || null, orden: 1000, pedido_por: nombre || 'La casa',
    })
    setGuardando(false)
    if (err) { setError('No se pudo enviar. Revisa el internet e intenta de nuevo.'); return }
    listo({ item: item.trim(), cantidad: cantidad.trim(), tienda })
  }
  return (
    <div className='fixed inset-0 z-40 bg-black/40 flex items-end justify-center' onClick={cerrar}>
      <form onSubmit={enviar} onClick={e => e.stopPropagation()} className='bg-white w-full max-w-xl rounded-t-2xl p-5 space-y-3' style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <h2 className='text-xl font-semibold'>¿Qué hace falta?</h2>
        <div>
          <label htmlFor='p-i' className='text-sm text-gray-600 block mb-1'>Qué necesitas</label>
          <input id='p-i' value={item} onChange={e => setItem(e.target.value)} placeholder='Ej: jabón de loza, huevos, papel higiénico' autoFocus required style={{ fontSize: 18, padding: 12 }} />
        </div>
        <div>
          <label htmlFor='p-c' className='text-sm text-gray-600 block mb-1'>Cuánto (opcional)</label>
          <input id='p-c' value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder='Ej: 2, 1 kg' style={{ fontSize: 18, padding: 12 }} />
        </div>
        <div>
          <label htmlFor='p-t' className='text-sm text-gray-600 block mb-1'>Dónde se compra (opcional)</label>
          <select id='p-t' value={tienda} onChange={e => setTienda(e.target.value)} style={{ fontSize: 17, padding: 12 }}>
            <option value=''>No sé / que decida Joseph</option>
            {tiendas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {error && <p className='text-red-700 bg-red-50 rounded-lg p-3'>{error}</p>}
        <div className='flex gap-2 pt-1'>
          <button type='button' onClick={cerrar} className='flex-1 py-3 rounded-xl border border-gray-200 font-semibold'>Cancelar</button>
          <button className='flex-1 py-3 rounded-xl font-bold' style={{ background: NEGRO, color: ORO }} disabled={guardando}>{guardando ? 'Enviando…' : 'Pedir'}</button>
        </div>
      </form>
    </div>
  )
}
