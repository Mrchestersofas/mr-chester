import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PERMITIDOS } from '@/components/Layout'
import FlujoFabrica from '@/components/FlujoFabrica'
import VentasEnVivo from '@/components/VentasEnVivo'

/* Pantalla para el televisor: la fábrica en vivo, en grande y en oscuro.
   Se abre en el navegador del TV con la sesión del ERP iniciada. */

function TV() {
  const [sesion, setSesion] = useState(undefined)
  const [ahora, setAhora] = useState(new Date())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    const t = setInterval(() => setAhora(new Date()), 15000)
    // recarga completa cada 6 horas para que el TV nunca se quede pegado
    const r = setTimeout(() => location.reload(), 6 * 3600 * 1000)
    return () => { data.subscription.unsubscribe(); clearInterval(t); clearTimeout(r) }
  }, [])

  async function pantallaCompleta() {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() } catch (e) {}
  }

  const fondo = { minHeight: '100vh', background: '#0b0b0f', color: '#f5f5f5' }
  if (sesion === undefined) return <div style={fondo} className='p-10 text-2xl text-gray-400'>Cargando…</div>
  if (!sesion || !PERMITIDOS.includes(sesion.user?.email)) return (
    <div style={fondo} className='p-10'>
      <p className='text-2xl mb-4'>Para ver la fábrica en este televisor, primero entra al ERP en este navegador.</p>
      <Link href='/' className='inline-block rounded-xl px-6 py-3 text-xl font-bold' style={{ background: '#C9A84C', color: '#111' }}>Entrar al ERP</Link>
    </div>
  )

  const fecha = ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
  const hora = ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })

  return (
    <div style={fondo} className='px-6 py-4'>
      <Head><title>En vivo · Mr. Chester</title></Head>
      <header className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-4'>
          <img src='/logo-mrchester.png' alt='' style={{ height: 48, width: 56, objectFit: 'cover' }} />
          <div>
            <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: 6, fontSize: 28, lineHeight: 1 }}>MR. CHESTER</div>
            <div className='text-sm uppercase tracking-widest text-gray-400 mt-1'>Panel en vivo</div>
          </div>
        </div>
        <div className='flex items-center gap-6'>
          <div className='text-right'>
            <div className='text-5xl font-bold tabular-nums leading-none'>{hora}</div>
            <div className='text-base text-gray-400 capitalize mt-1'>{fecha}</div>
          </div>
          <button onClick={pantallaCompleta} className='rounded-lg px-3 py-2 text-sm border border-gray-700 text-gray-300' aria-label='Pantalla completa'>⛶</button>
        </div>
      </header>
      <VentasEnVivo tv />
      <FlujoFabrica tv />
    </div>
  )
}
TV.sinLayout = true
export default TV
