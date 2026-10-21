import { useState } from 'react'
import Head from 'next/head'
import { supabase } from '@/lib/supabase'

/* Seguimiento público: el cliente escribe su cédula y ve la etapa, la fecha de entrega
   y las novedades de su sofá. La consulta la hace la función seguimiento_por_cedula,
   que devuelve solo datos no sensibles (sin dirección, teléfono ni valores). */

const ORO = '#C9A84C'
const NEGRO = '#1a1a1a'
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const PASOS = [
  { key: 'cola', label: 'Pedido confirmado', desc: 'Tu sofá está en la fila de producción.' },
  { key: 'estructura', label: 'Estructura', desc: 'Armamos la base en madera.' },
  { key: 'espumado', label: 'Espumado', desc: 'Ponemos las espumas y el confort.' },
  { key: 'corte_tela', label: 'Corte y costura', desc: 'Cortamos y cosemos tu tela a la medida.' },
  { key: 'tapizado', label: 'Tapizado', desc: 'Forramos tu sofá a mano.' },
  { key: 'terminado', label: 'Terminado', desc: 'Capitoné, botones, detalles y revisión final.' },
  { key: 'despacho', label: 'Listo para entrega', desc: 'Coordinamos contigo la entrega.' },
  { key: 'completado', label: 'Entregado', desc: '¡Disfrútalo!' },
]

function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return `${d} de ${MES[m - 1]} de ${y}`
}
function fechaCorta(iso) {
  const d = new Date(iso)
  return `${d.getDate()} de ${MES[d.getMonth()]}`
}

function Seguimiento() {
  const [cedula, setCedula] = useState('')
  const [cargando, setCargando] = useState(false)
  const [pedidos, setPedidos] = useState(null)
  const [error, setError] = useState(null)

  async function buscar(e) {
    e.preventDefault()
    const limpia = cedula.replace(/\D/g, '')
    if (limpia.length < 5) { setError('Escribe tu número de cédula completo, solo números.'); return }
    setCargando(true); setError(null)
    const { data, error: err } = await supabase.rpc('seguimiento_por_cedula', { p_cedula: limpia })
    setCargando(false)
    if (err) { setError('No pudimos consultar en este momento. Intenta de nuevo en unos minutos.'); return }
    setPedidos(data || [])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6F3EE', color: NEGRO }}>
      <Head>
        <title>Seguimiento de tu sofá · Mr. Chester</title>
        <meta name='description' content='Consulta en qué etapa va tu sofá Mr. Chester' />
      </Head>
      <header style={{ background: NEGRO, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className='max-w-xl mx-auto px-4 py-6 text-center'>
          <img src='/logo-mrchester.png' alt='' style={{ width: 160, margin: '0 auto' }} />
          <div style={{ color: ORO, fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: 6, fontSize: 24, marginTop: 4 }}>MR. CHESTER</div>
          <div style={{ color: ORO, fontSize: 11, letterSpacing: 4, marginTop: 2 }}>SOFÁS QUE HABLAN DE TI</div>
        </div>
        <div style={{ background: ORO }} className='text-center py-2'>
          <span style={{ color: NEGRO, fontSize: 12, fontWeight: 700, letterSpacing: 3 }}>SEGUIMIENTO DE TU PEDIDO</span>
        </div>
      </header>

      <main className='max-w-xl mx-auto p-4 pb-16'>
        <form onSubmit={buscar} className='bg-white rounded-2xl p-5 shadow-sm space-y-3 mt-2'>
          <label htmlFor='seg-ced' className='block font-semibold'>Escribe tu número de cédula</label>
          <input id='seg-ced' inputMode='numeric' autoComplete='off' value={cedula} onChange={e => setCedula(e.target.value)}
            placeholder='Ej: 1020304050' style={{ fontSize: 20, padding: 14, letterSpacing: 1 }} />
          {error && <p className='text-red-700 bg-red-50 rounded-lg p-3 text-sm'>{error}</p>}
          <button className='w-full rounded-xl py-3.5 text-lg font-bold' style={{ background: NEGRO, color: ORO }} disabled={cargando}>
            {cargando ? 'Buscando…' : 'Ver mi pedido'}
          </button>
        </form>

        {pedidos && pedidos.length === 0 && (
          <div className='mt-5 bg-white rounded-2xl p-5 text-center space-y-2'>
            <p className='font-semibold'>No encontramos pedidos con esa cédula.</p>
            <p className='text-sm text-gray-600'>Revisa el número. Si el pedido está a nombre de otra persona, usa su cédula. ¿Dudas? Escríbenos por WhatsApp.</p>
          </div>
        )}

        {pedidos && pedidos.length > 0 && (
          <div className='mt-5 space-y-5'>
            <p className='text-lg'>Hola <b>{pedidos[0].nombre}</b>, así va tu pedido:</p>
            {pedidos.map(p => <Pedido key={p.numero} p={p} />)}
          </div>
        )}

        <p className='text-center text-xs text-gray-500 mt-8'>Centro de Experiencia: Cra 19A #85-69, Bogotá</p>
      </main>
    </div>
  )
}
Seguimiento.sinLayout = true
export default Seguimiento

function Pedido({ p }) {
  const idx = Math.max(0, PASOS.findIndex(s => s.key === (p.etapa === 'control_calidad' ? 'terminado' : p.etapa)))
  const actual = PASOS[idx]
  const pct = Math.round(idx / (PASOS.length - 1) * 100)
  const entregado = p.etapa === 'completado'
  return (
    <div className='bg-white rounded-2xl overflow-hidden shadow-sm'>
      <div className='p-5 space-y-1' style={{ borderBottom: '1px solid #eee' }}>
        <div className='text-xs font-bold tracking-widest' style={{ color: '#8C6A1F' }}>PEDIDO {p.numero}</div>
        <div className='text-xl font-semibold'>{p.sofa}{p.cantidad > 1 ? ` × ${p.cantidad}` : ''}</div>
        {p.tela && <div className='text-sm text-gray-600'>Tela: {p.tela}</div>}
      </div>

      <div className='p-5 space-y-4'>
        <div className='rounded-xl p-4' style={{ background: entregado ? '#F1F7F2' : '#FBF6E9' }}>
          <div className='text-xs font-bold uppercase tracking-wide' style={{ color: entregado ? '#2F7A4C' : '#8C6A1F' }}>Estado actual</div>
          <div className='text-lg font-semibold mt-0.5'>{actual.label}</div>
          <div className='text-sm text-gray-600'>{actual.desc}</div>
          <div className='h-2 rounded-full mt-3 overflow-hidden' style={{ background: '#e7e1d4' }}>
            <div className='h-full rounded-full' style={{ width: pct + '%', background: entregado ? '#2F7A4C' : ORO }} />
          </div>
        </div>

        {!entregado && p.fecha_entrega && (
          <div className='flex items-center gap-3'>
            <span className='text-2xl'>📅</span>
            <div>
              <div className='text-xs text-gray-500'>Fecha estimada de entrega</div>
              <div className='font-semibold'>{fechaLarga(p.fecha_entrega)}</div>
            </div>
          </div>
        )}

        <ol className='space-y-0'>
          {PASOS.map((s, i) => {
            const hecho = i < idx || entregado
            const esActual = i === idx && !entregado
            return (
              <li key={s.key} className='flex gap-3'>
                <div className='flex flex-col items-center'>
                  <span className='w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-none'
                    style={{ background: hecho ? '#2F7A4C' : esActual ? ORO : '#e7e1d4', color: hecho || esActual ? '#fff' : '#999' }}>
                    {hecho ? '✓' : ''}
                  </span>
                  {i < PASOS.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 14, background: hecho ? '#2F7A4C' : '#e7e1d4' }} />}
                </div>
                <div className={`pb-3 text-sm ${esActual ? 'font-semibold' : hecho ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</div>
              </li>
            )
          })}
        </ol>

        <div>
          <h3 className='font-semibold mb-2'>Novedades</h3>
          {p.novedades && p.novedades.length > 0 ? (
            <ul className='space-y-2'>
              {p.novedades.map((n, i) => (
                <li key={i} className='rounded-xl p-3' style={{ background: n.origen === 'manual' ? '#FBF6E9' : '#F6F3EE' }}>
                  <div className='text-sm'>{n.texto}</div>
                  <div className='text-xs text-gray-500 mt-0.5'>{fechaCorta(n.fecha)}</div>
                </li>
              ))}
            </ul>
          ) : <p className='text-sm text-gray-500'>Sin novedades por ahora. Todo va según lo planeado.</p>}
        </div>
      </div>
    </div>
  )
}
