import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'
import NutsVender from '@/components/nuts/NutsVender'
import NutsProduccion from '@/components/nuts/NutsProduccion'
import NutsAdmin from '@/components/nuts/NutsAdmin'
import { CARAMELO, mensaje } from '@/lib/nuts'

/* Mr. Nuts: mini ERP (POS, producción por batches y lotes, control de faltantes).
   Cada persona entra con usuario + PIN. Todo pasa por funciones seguras de la base (nuts_*):
   la tienda nunca ve datos de Mr. Chester ni puede leer las tablas directo. */

function Nuts() {
  const [cred, setCred] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [hayUsuarios, setHayUsuarios] = useState(true)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState(null)

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
  const tabs = !yo ? [] : [
    ...(yo.rol !== 'produccion' ? [['vender', '🛒 Vender']] : []),
    ...(yo.rol !== 'tienda' ? [['produccion', '🔥 Producción']] : []),
    ...(yo.rol === 'admin' ? [['admin', '📊 Resumen y ajustes']] : []),
  ]
  const actual = vista && tabs.some(t => t[0] === vista) ? vista : tabs[0]?.[0]

  return (
    <div style={{ minHeight: '100vh', background: '#FBF7F1', color: '#1F1A14' }}>
      <Head><title>Mr. Nuts</title><meta name='viewport' content='width=device-width, initial-scale=1' /></Head>
      <header style={{ background: CARAMELO, color: '#fff', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className='max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3'>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 1 }}>MR. NUTS</div>
            {yo && <div style={{ fontSize: 13, opacity: .9 }}>Hola {yo.nombre}</div>}
          </div>
          {yo && <button onClick={salir} className='rounded-lg px-3 py-2 text-sm font-semibold' style={{ border: '1px solid rgba(255,255,255,.6)' }}>Salir</button>}
        </div>
        {tabs.length > 1 && (
          <div className='max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto'>
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setVista(k)} className='rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap'
                style={k === actual ? { background: '#fff', color: CARAMELO } : { background: 'rgba(255,255,255,.15)', color: '#fff' }}>{l}</button>
            ))}
          </div>
        )}
      </header>

      <main className='max-w-5xl mx-auto p-4 pb-16'>
        {error && <p className='rounded-xl p-3 mb-4 text-sm' style={{ background: '#FDECEC', color: '#9B1C1C' }}>{error}</p>}
        {cargando ? <p className='text-gray-500'>Cargando…</p>
          : !cred || !datos ? (hayUsuarios ? <Entrar entrar={entrar} /> : <PrimerAdmin listo={() => setHayUsuarios(true)} />)
          : actual === 'vender' ? <NutsVender datos={datos} rpc={rpc} />
          : actual === 'produccion' ? <NutsProduccion datos={datos} rpc={rpc} />
          : actual === 'admin' ? <NutsAdmin datos={datos} rpc={rpc} />
          : null}
      </main>
    </div>
  )
}
Nuts.sinLayout = true
export default Nuts

function Entrar({ entrar }) {
  const [u, setU] = useState('')
  const [k, setK] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); if (u && k) entrar(u, k) }} className='bg-white rounded-2xl p-5 shadow-sm space-y-3 max-w-sm mx-auto mt-6'>
      <h1 className='text-xl font-bold'>Entrar</h1>
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
