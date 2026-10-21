import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'
import VistaTaller from '@/components/VistaTaller'
import { SECCIONES, normalizar, etiqueta } from '@/lib/etapas'

/* Taller: página para los encargados de sección y el jefe de producción.
   Entran con usuario y clave (tabla taller_usuarios, revisada en la base con taller_datos).
   Ven solo datos de fabricación (sin cliente ni precios). Pueden mover etapas solo si tienen permiso. */

const ORO = '#C9A84C', NEGRO = '#1a1a1a'

function Taller() {
  const [cred, setCred] = useState(null)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)

  async function cargar(c = cred) {
    if (!c) return
    const { data, error: e } = await supabase.rpc('taller_datos', { p_usuario: c.u, p_clave: c.k })
    if (e) { setError('No se pudo cargar: ' + e.message); setCargando(false); return }
    if (!data) { salir(); setError('Usuario o clave incorrectos.'); setCargando(false); return }
    setDatos(data); setError(null); setCargando(false)
  }

  useEffect(() => {
    let c = null
    try { c = JSON.parse(localStorage.getItem('taller') || 'null') } catch (e) {}
    if (c) { setCred(c); cargar(c) } else setCargando(false)
  }, [])
  useEffect(() => {
    if (!cred) return
    const t = setInterval(() => cargar(), 120000) // se actualiza solo cada 2 minutos
    return () => clearInterval(t)
  }, [cred])

  function salir() {
    try { localStorage.removeItem('taller'); localStorage.removeItem('modoTaller') } catch (e) {}
    setCred(null); setDatos(null)
  }

  async function entrar(u, k) {
    setCargando(true); setError(null)
    const { data, error: e } = await supabase.rpc('taller_datos', { p_usuario: u, p_clave: k })
    setCargando(false)
    if (e) { setError('No se pudo entrar: ' + e.message); return }
    if (!data) { setError('Usuario o clave incorrectos.'); return }
    const c = { u, k }
    try { localStorage.setItem('taller', JSON.stringify(c)); localStorage.setItem('modoTaller', '1') } catch (er) {}
    setCred(c); setDatos(data)
  }

  async function mover(it, dir) {
    const { error: e } = await supabase.rpc('taller_avanzar', { p_usuario: cred.u, p_clave: cred.k, p_prog: it.id, p_dir: dir })
    if (e) alert('No se pudo mover: ' + e.message)
    await cargar()
  }

  const u = datos?.usuario
  const items = (datos?.items || []).map(normalizar)
  const secciones = u?.rol === 'jefe' || !u?.seccion ? SECCIONES.map(s => s.key) : [u.seccion]

  return (
    <div style={{ minHeight: '100vh', background: '#F6F3EE', color: NEGRO }}>
      <Head><title>Taller · Mr. Chester</title></Head>
      <header style={{ background: NEGRO, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className='max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-2'>
          <div>
            <div style={{ color: ORO, fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: 4, fontSize: 18 }}>MR. CHESTER</div>
            <div style={{ color: ORO, fontSize: 11, letterSpacing: 2 }}>TALLER{u ? ` · ${u.rol === 'jefe' ? 'JEFE DE PRODUCCIÓN' : etiqueta(u.seccion).toUpperCase()}` : ''}</div>
          </div>
          {u && <button onClick={salir} className='text-xs px-3 py-1.5 rounded-lg' style={{ border: `1px solid ${ORO}`, color: ORO }}>Salir</button>}
        </div>
      </header>

      <main className='max-w-2xl mx-auto p-4 pb-16'>
        {cargando ? <p className='text-gray-500'>Cargando…</p>
          : !u ? <Login entrar={entrar} error={error} />
          : (
            <>
              <div className='flex justify-between items-center mb-4'>
                <p className='text-lg'>Hola <b>{u.nombre}</b></p>
                <button className='btn text-sm' onClick={() => cargar()}>↻ Actualizar</button>
              </div>
              {error && <p className='mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>{error}</p>}
              <VistaTaller
                items={items}
                secciones={secciones}
                modo={u.rol === 'jefe' ? 'general' : u.seccion === 'corte_tela' ? 'corte' : 'secciones'}
                puedeMover={it => !!u.puede_mover && (u.rol === 'jefe' || it.etapa === u.seccion)}
                mover={mover}
              />
            </>
          )}
      </main>
    </div>
  )
}
Taller.sinLayout = true
export default Taller

function Login({ entrar, error }) {
  const [u, setU] = useState('')
  const [k, setK] = useState('')
  return (
    <form className='card space-y-3 mt-4' onSubmit={e => { e.preventDefault(); entrar(u.trim().toLowerCase(), k) }}>
      <h1 className='text-lg font-semibold'>Entrar al taller</h1>
      <div><label htmlFor='tu' className='text-xs text-gray-500 mb-1 block'>Usuario</label><input id='tu' autoCapitalize='none' autoComplete='username' value={u} onChange={e => setU(e.target.value)} /></div>
      <div><label htmlFor='tk' className='text-xs text-gray-500 mb-1 block'>Clave</label><input id='tk' type='password' inputMode='numeric' autoComplete='current-password' value={k} onChange={e => setK(e.target.value)} /></div>
      {error && <p className='text-sm text-red-700'>{error}</p>}
      <button className='w-full rounded-xl py-3 font-bold' style={{ background: NEGRO, color: ORO }}>Entrar</button>
    </form>
  )
}
