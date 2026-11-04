import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pushSoportado, esIphone, esApp, suscripcionActual, activarPush } from '@/lib/push'

/* 🔔 Avisos en este celular: cuando alguien del taller termina una sección, llega una notificación.
   En iPhone solo funciona si el ERP está agregado a la pantalla de inicio y se abre desde ahí. */

export default function AvisosCelular() {
  const [estado, setEstado] = useState('cargando') // cargando | activo | inactivo | iphone | no
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    (async () => {
      if (esIphone() && !esApp()) return setEstado('iphone')
      if (!pushSoportado()) return setEstado('no')
      try { setEstado((await suscripcionActual()) && Notification.permission === 'granted' ? 'activo' : 'inactivo') } catch (e) { setEstado('inactivo') }
    })()
  }, [])

  async function activar() {
    setOcupado(true); setError(null)
    try {
      const s = await activarPush()
      const { data: { session } } = await supabase.auth.getSession()
      const { error: e } = await supabase.from('push_suscripciones').upsert({
        endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth,
        usuario: session?.user?.email || null, dispositivo: navigator.userAgent.slice(0, 120),
      }, { onConflict: 'endpoint' })
      if (e) throw new Error('No se guardó: ' + e.message)
      setEstado('activo')
    } catch (e) { setError(e.message || String(e)) }
    setOcupado(false)
  }
  async function probar() {
    setOcupado(true); setError(null)
    const { error: e } = await supabase.rpc('push_probar')
    if (e) setError('No se pudo enviar la prueba: ' + e.message)
    setOcupado(false)
  }

  if (estado === 'cargando' || estado === 'no') return null
  return (
    <div className='card mb-4'>
      <div className='flex items-start justify-between gap-3 flex-wrap'>
        <div className='min-w-0'>
          <div className='font-semibold'>🔔 Avisos del taller en este celular</div>
          {estado === 'activo' && <p className='text-sm text-green-700'>✓ Activados. Te llega una notificación cada vez que un sofá pasa de sección.</p>}
          {estado === 'inactivo' && <p className='text-sm text-gray-600'>Recibe una notificación cada vez que alguien del taller termina un sofá.</p>}
          {estado === 'iphone' && <p className='text-sm text-gray-600'>En iPhone: toca <b>Compartir</b> <span aria-hidden>⬆️</span> → <b>Agregar a pantalla de inicio</b>. Abre <b>Mr. Chester</b> desde el ícono nuevo y activa los avisos aquí.</p>}
          {error && <p className='text-sm text-red-700 mt-1'>{error}</p>}
        </div>
        {estado === 'inactivo' && <button className='btn btn-primary' onClick={activar} disabled={ocupado}>{ocupado ? 'Activando…' : 'Activar avisos'}</button>}
        {estado === 'activo' && <button className='btn' onClick={probar} disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar prueba'}</button>}
      </div>
    </div>
  )
}
