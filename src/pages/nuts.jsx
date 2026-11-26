import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'
import NutsVender from '@/components/nuts/NutsVender'
import NutsBandejas from '@/components/nuts/NutsBandejas'
import NutsProduccion from '@/components/nuts/NutsProduccion'
import NutsCompras from '@/components/nuts/NutsCompras'
import NutsAdmin from '@/components/nuts/NutsAdmin'
import { CARAMELO, mensaje } from '@/lib/nuts'

/* Mr. Nuts: ERP con menú por módulos. Cada persona entra con usuario + PIN y ve solo sus módulos:
   tienda → POS y Bandejas · producción → Producción, Compras, Inventario · admin → todo.
   Todo pasa por funciones seguras de la base (nuts_*): nadie lee las tablas directo. */

const MODULOS = [
  { k: 'pos', l: 'POS', i: '🛒', roles: ['tienda', 'admin'] },
  { k: 'bandejas', l: 'Bandejas', i: '🥜', roles: ['tienda', 'admin'] },
  { k: 'produccion', l: 'Producción', i: '🔥', roles: ['produccion', 'admin'] },
  { k: 'compras', l: 'Compras', i: '📦', roles: ['produccion', 'admin'] },
  { k: 'inventario', l: 'Inventario', i: '📋', roles: ['produccion', 'admin'] },
  { k: 'ventas', l: 'Ventas', i: '📊', roles: ['admin'] },
  { k: 'control', l: 'Control', i: '🔍', roles: ['admin'] },
  { k: 'ajustes', l: 'Ajustes', i: '⚙️', roles: ['admin'] },
]

function Nuts() {
  const [cred, setCred] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [hayUsuarios, setHayUsuarios] = useState(true)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState(null)
  const [menu, setMenu] = useState(false)

  async function cargar(c = cred) {
    if (!c) return null
    const { data, error: e } = await supabase.rpc('nuts_datos', { p_usuario: c.u, p_pin: c.k })
    if (e) { if (String(e.message).startsWith('acceso')) salir(); setError(mensaje(e)); return null }
    setDatos(data); setError(null)
    return data
  }

  useEffect(() => {
    let c = null
    try { c = JSON.parse(localStorage.getItem('nuts') || 'null') } catch (e) {}
    supabase.rpc('nuts_hay_usuarios').then(({ data }) => setHayUsuarios(data !== false))
    if (c) { setCred(c); cargar(c).then(() => setCargando(false)) } else setCargando(false)
  }, [])
  useEffect(() => {
    if (!cred) return
    const t = setInterval(() => cargar(), 60000)
    return () => clearInterval(t)
  }, [cred])

  function salir() {
    try { localStorage.removeItem('nuts') } catch (e) {}
    setCred(null); setDatos(null); setVista(null)
  }

  async function entrar(u, k) {
    setCargando(true); setError(null)
    const c = { u: u.trim().toLowerCase(), k }
    const d = await cargar(c)
    setCargando(false)
    if (!d) return
    try { localStorage.setItem('nuts', JSON.stringify(c)) } catch (er) {}
    setCred(c)
  }

  // Llama una función de la base con el usuario y PIN, y recarga los datos. Devuelve la respuesta o lanza un mensaje claro.
  async function rpc(fn, args = {}) {
    const { data, error: e } = await supabase.rpc(fn, { p_usuario: cred.u, p_pin: cred.k, ...args })
    if (e) throw new Error(mensaje(e))
    await cargar()
    return data
  }

  const yo = datos?.yo
  const mods = yo ? MODULOS.filter(m => m.roles.includes(yo.rol)) : []
  const actual = mods.find(m => m.k === vista) || mods[0]
  const ir = k => { setVista(k); setMenu(false) }
  const props = { datos, rpc }

  if (cargando) return <Fondo><p className='p-6 text-gray-500'>Cargando…</p></Fondo>
  if (!cred || !datos) return (
    <Fondo>
      {error && <p className='rounded-xl p-3 m-4 text-sm' style={{ background: '#FDECEC', color: '#9B1C1C' }}>{error}</p>}
      {hayUsuarios ? <Entrar entrar={entrar} /> : <PrimerAdmin listo={() => setHayUsuarios(true)} />}
    </Fondo>
  )

  const Menu = () => (
    <nav className='flex flex-col gap-1 p-3'>
      {mods.map(m => (
        <button key={m.k} onClick={() => ir(m.k)} className='flex items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold'
          style={m.k === actual?.k ? { background: '#fff', color: CARAMELO } : { color: '#F1E6D8' }}>
          <span className='text-xl w-7 text-center'>{m.i}</span>{m.l}
        </button>
      ))}
      <div className='border-t mt-3 pt-3 px-3 text-sm' style={{ borderColor: 'rgba(255,255,255,.2)', color: '#C9A07A' }}>
        {yo.nombre}<br /><button onClick={salir} className='underline mt-1' style={{ color: '#F1E6D8' }}>Salir</button>
      </div>
    </nav>
  )

  return (
    <Fondo>
      <div className='flex min-h-screen'>
        {mods.length > 1 && <aside className='hidden md:block w-56 flex-none sticky top-0 h-screen overflow-y-auto' style={{ background: CARAMELO }}><Marca /><Menu /></aside>}
        {menu && <div className='fixed inset-0 z-40 md:hidden' style={{ background: 'rgba(0,0,0,.45)' }} onClick={() => setMenu(false)}><aside className='w-64 h-full overflow-y-auto' style={{ background: CARAMELO }} onClick={e => e.stopPropagation()}><Marca /><Menu /></aside></div>}
        <div className='flex-1 min-w-0'>
          <header className='md:hidden sticky top-0 z-30 flex items-center justify-between px-3' style={{ background: CARAMELO, color: '#fff', paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: 60 }}>
            {mods.length > 1 ? <button aria-label='Abrir menú' onClick={() => setMenu(true)} className='text-2xl w-11 h-11'>☰</button> : <span className='w-11' />}
            <div className='flex items-center gap-2'><img src='/nuts-ardilla.jpg' alt='' style={{ width: 30, height: 40, objectFit: 'cover', borderRadius: 6 }} /><span style={{ fontWeight: 300, fontSize: 22, color: '#E7E3DF' }}>{actual?.l}</span></div>
            <button onClick={salir} className='text-xs underline w-11' style={{ color: '#F1E6D8' }}>Salir</button>
          </header>
          <main className='max-w-6xl mx-auto p-4 pb-28'>
            {error && <p className='rounded-xl p-3 mb-4 text-sm' style={{ background: '#FDECEC', color: '#9B1C1C' }}>{error}</p>}
            <h1 className='hidden md:block text-2xl font-bold mb-4'>{actual?.i} {actual?.l}</h1>
            {actual?.k === 'pos' ? <NutsVender {...props} />
              : actual?.k === 'bandejas' ? <NutsBandejas {...props} />
              : actual?.k === 'produccion' ? <NutsProduccion {...props} />
              : actual?.k === 'compras' ? <NutsCompras {...props} />
              : actual ? <NutsAdmin {...props} seccion={actual.k} /> : null}
          </main>
        </div>
      </div>
    </Fondo>
  )
}
Nuts.sinLayout = true
export default Nuts

function Fondo({ children }) {
  return <div style={{ minHeight: '100vh', background: '#F6EFE6', color: '#2B1A0E' }}><Head><title>Mr. Nuts</title><meta name='viewport' content='width=device-width, initial-scale=1' /></Head>{children}</div>
}

function Marca() {
  return (
    <div className='flex items-center gap-3 px-4 pt-5 pb-3'>
      <img src='/nuts-ardilla.jpg' alt='' style={{ width: 40, height: 54, objectFit: 'cover', borderRadius: 8 }} />
      <div><div style={{ fontWeight: 300, fontSize: 24, lineHeight: 1, color: '#E7E3DF' }}>Mr Nuts</div><div style={{ fontSize: 10, letterSpacing: 2, color: '#C9A07A', fontWeight: 600 }}>FRESH ROASTED NUTS</div></div>
    </div>
  )
}

function Entrar({ entrar }) {
  const [u, setU] = useState('')
  const [k, setK] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); if (u && k) entrar(u, k) }} className='bg-white rounded-2xl p-5 shadow-sm space-y-3 max-w-sm mx-auto mt-6'>
      <img src='/nuts-logo.jpg' alt='Mr Nuts' className='w-48 mx-auto rounded-2xl' />
      <h1 className='text-xl font-bold text-center'>Entrar</h1>
      <label className='block text-sm font-semibold'>Usuario<input value={u} onChange={e => setU(e.target.value)} autoCapitalize='none' autoComplete='username' className='w-full mt-1' style={{ fontSize: 18, padding: 12 }} /></label>
      <label className='block text-sm font-semibold'>PIN<input value={k} onChange={e => setK(e.target.value)} type='password' inputMode='numeric' autoComplete='current-password' className='w-full mt-1' style={{ fontSize: 18, padding: 12 }} /></label>
      <button className='w-full rounded-xl py-3 font-bold text-white' style={{ background: CARAMELO }}>Entrar</button>
    </form>
  )
}

function PrimerAdmin({ listo }) {
  const [f, setF] = useState({ nombre: '', usuario: '', pin: '' })
  const [msg, setMsg] = useState(null)
  async function crear(e) {
    e.preventDefault(); setMsg(null)
    const { error: er } = await supabase.rpc('nuts_crear_primer_admin', { p_nombre: f.nombre, p_usuario: f.usuario, p_pin: f.pin })
    if (er) { setMsg(mensaje(er)); return }
    listo()
  }
  return (
    <form onSubmit={crear} className='bg-white rounded-2xl p-5 shadow-sm space-y-3 max-w-sm mx-auto mt-6'>
      <img src='/nuts-logo.jpg' alt='Mr Nuts' className='w-40 mx-auto rounded-2xl' />
      <h1 className='text-xl font-bold'>Crear el administrador</h1>
      <p className='text-sm text-gray-600'>Es la primera vez. Crea tu usuario de administrador; después, desde Ajustes, creas los de la tienda y producción.</p>
      {[['nombre', 'Tu nombre'], ['usuario', 'Usuario (sin espacios)'], ['pin', 'PIN (mínimo 4 números)']].map(([k, l]) => (
        <label key={k} className='block text-sm font-semibold'>{l}
          <input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} type={k === 'pin' ? 'password' : 'text'} inputMode={k === 'pin' ? 'numeric' : undefined} autoCapitalize='none' className='w-full mt-1' style={{ fontSize: 18, padding: 12 }} />
        </label>
      ))}
      {msg && <p className='text-sm' style={{ color: '#9B1C1C' }}>{msg}</p>}
      <button className='w-full rounded-xl py-3 font-bold text-white' style={{ background: CARAMELO }}>Crear</button>
    </form>
  )
}
