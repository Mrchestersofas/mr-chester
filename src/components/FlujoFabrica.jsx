import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ETAPAS_FAB, etiqueta, normalizar, hoyISO, fCorta, modeloMedida, indice } from '@/lib/etapas'

/* Flujo de la fábrica en vivo: Programación → Esqueletería → Espumado → Corte y costura → Tapizado → Terminado → Listos.
   Se actualiza solo (en vivo con Supabase Realtime y cada 30 s por si acaso).
   Cuando un sofá cambia de sección, brilla en la columna nueva durante un minuto.
   tv = versión grande y oscura para el televisor (/tv). */

const ICONO = { cola: '📋', estructura: '🪵', espumado: '🧽', corte_tela: '✂️', tapizado: '🛋️', terminado: '✨', despacho: '🚚' }
const TITULO = { cola: 'Para hoy', despacho: 'Listos' }
const hora = ts => new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
// "maria fernanda lopez gomez" → "Maria Lopez"
const nombreCorto = n => { const p = String(n || '').trim().split(/\s+/).map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()); return p.length > 2 ? `${p[0]} ${p[p.length >= 4 ? 2 : 1]}` : p.join(' ') }
const unidades = l => l.reduce((a, x) => a + (Number(x.cantidad) || 1), 0)

export default function FlujoFabrica({ tv = false }) {
  const [items, setItems] = useState(null)
  const [hechos, setHechos] = useState([])
  const [error, setError] = useState(null)
  const [nuevos, setNuevos] = useState({})
  const [abierto, setAbierto] = useState(null)
  const previo = useRef(null)

  async function cargar() {
    const hoy = hoyISO()
    const [pp, pt] = await Promise.all([
      supabase.from('programacion_produccion')
        .select('*, pedido:pedidos(numero, tipo_sofa, material, cantidad, fecha_entrega, prioridad, estado, cliente:clientes(nombre))')
        .neq('etapa_actual', 'completado'),
      supabase.from('prod_tiempos').select('id, seccion, nombre, fin, prog_id, pedido:pedidos(numero, tipo_sofa, cantidad)')
        .gte('fin', new Date(hoy + 'T00:00:00-05:00').toISOString()).order('fin', { ascending: false }),
    ])
    if (pp.error) { setError(pp.error.message); return }
    const lista = (pp.data || []).filter(f => f.pedido && !['entregado', 'cancelado'].includes(f.pedido.estado)).map(normalizar)
    // ¿qué cambió de sección desde la última carga?
    if (previo.current) {
      const ahora = Date.now(), n = {}
      lista.forEach(it => { const antes = previo.current[it.id]; if (antes && antes !== it.etapa) n[it.id] = ahora })
      if (Object.keys(n).length) setNuevos(v => ({ ...v, ...n }))
    }
    previo.current = Object.fromEntries(lista.map(it => [it.id, it.etapa]))
    setItems(lista)
    setHechos(pt.data || [])
    setError(null)
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    let espera = null
    const pronto = () => { clearTimeout(espera); espera = setTimeout(cargar, 800) }
    const canal = supabase.channel('flujo-fabrica')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programacion_produccion' }, pronto)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prod_tiempos' }, pronto)
      .subscribe()
    return () => { clearInterval(t); clearTimeout(espera); supabase.removeChannel(canal) }
  }, [])
  // quitar el brillo después de 60 s
  useEffect(() => {
    const t = setInterval(() => setNuevos(v => { const c = Date.now() - 60000, n = {}; Object.entries(v).forEach(([k, x]) => { if (x > c) n[k] = x }); return n }), 5000)
    return () => clearInterval(t)
  }, [])

  if (error) return <div className='card text-sm text-red-700'>No se pudo cargar el flujo: {error}</div>
  if (!items) return <div className={tv ? 'text-gray-400 p-8 text-2xl' : 'card text-gray-400'}>Cargando fábrica…</div>

  const hoy = hoyISO()
  const columnas = ETAPAS_FAB.map(e => {
    let lista = items.filter(it => it.etapa === e.key)
    if (e.key === 'cola') lista = lista.filter(it => it.dia && it.dia <= hoy)
    lista.sort((a, b) => (b.prioridad === 'urgente') - (a.prioridad === 'urgente') || String(a.dia || '9').localeCompare(String(b.dia || '9')))
    const salieron = e.key === 'cola' ? hechos.filter(h => h.seccion === 'estructura') : hechos.filter(h => h.seccion === e.key)
    return { ...e, lista, hoyN: unidades(salieron.map(h => h.pedido || {})) }
  })
  const enFabrica = unidades(items.filter(it => !['cola', 'despacho'].includes(it.etapa)))
  const listosHoy = unidades(hechos.filter(h => h.seccion === 'terminado').map(h => h.pedido || {}))
  const programadosHoy = unidades(items.filter(it => it.dia === hoy))
  const max = tv ? 4 : 5

  const C = tv
    ? { fondo: '#0b0b0f', tarjeta: '#17171f', borde: '#2a2a35', texto: '#f5f5f5', suave: '#9ca3af' }
    : { fondo: '#ffffff', tarjeta: '#ffffff', borde: '#e5e7eb', texto: '#111827', suave: '#6b7280' }

  return (
    <div className={tv ? '' : 'card mb-4'} style={{ background: C.fondo, color: C.texto }}>
      <style jsx global>{`
        @keyframes flujo-avanza { from { background-position: 0 0; } to { background-position: 24px 0; } }
        @keyframes flujo-brilla { 0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); } 50% { box-shadow: 0 0 0 4px rgba(250, 204, 21, .75); } }
        @keyframes flujo-entra { from { transform: translateY(-8px) scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }
        .flujo-flecha { background-image: linear-gradient(90deg, currentColor 40%, transparent 40%); background-size: 12px 3px; background-repeat: repeat-x; animation: flujo-avanza .9s linear infinite; }
        .flujo-nuevo { animation: flujo-entra .5s ease-out, flujo-brilla 1.6s ease-in-out 6; }
        @media (prefers-reduced-motion: reduce) { .flujo-flecha, .flujo-nuevo { animation: none; } }
      `}</style>

      {/* Encabezado con cifras grandes */}
      <div className={`flex flex-wrap items-end justify-between gap-3 ${tv ? 'mb-3' : 'mb-4'}`}>
        <div>
          <div className={`${tv ? 'text-sm' : 'text-xs'} font-semibold uppercase tracking-widest`} style={{ color: C.suave }}>🏭 Fábrica en vivo</div>
          {!tv && <div className='text-xs' style={{ color: C.suave }}>Se actualiza solo cuando el taller marca ✓ Terminé · <a href='/tv' target='_blank' rel='noreferrer' className='font-semibold text-purple-700'>📺 Ver en pantalla grande</a></div>}
        </div>
        <div className={`flex ${tv ? 'gap-8' : 'gap-5'}`}>
          <Cifra n={programadosHoy} t='programados hoy' tv={tv} c={C} />
          <Cifra n={enFabrica} t='en fábrica' tv={tv} c={C} />
          <Cifra n={listosHoy} t='terminados hoy' tv={tv} c={C} color='#22c55e' />
        </div>
      </div>

      {/* Columnas del flujo */}
      <div className='overflow-x-auto -mx-1 px-1 pb-1'>
        <div className='grid gap-0 items-stretch' style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(${tv ? 170 : 132}px, 1fr))`, minWidth: tv ? 0 : columnas.length * 132 }}>
          {columnas.map((col, i) => (
            <div key={col.key} className='relative flex flex-col px-1.5'>
              {/* flecha animada hacia la siguiente sección */}
              {i < columnas.length - 1 && (
                <div className='absolute z-10 flex items-center' style={{ right: tv ? -12 : -10, top: tv ? 44 : 30, color: col.color }} aria-hidden>
                  <div className='flujo-flecha' style={{ width: tv ? 16 : 12, height: 4 }} />
                  <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: `9px solid ${col.color}` }} />
                </div>
              )}
              <div className='rounded-xl px-2 py-2 text-white text-center' style={{ background: col.color }}>
                <div className={`${tv ? 'text-base' : 'text-[11px]'} font-semibold uppercase tracking-wide truncate`}>{ICONO[col.key]} {TITULO[col.key] || etiqueta(col.key)}</div>
                <div className={`${tv ? 'text-5xl' : 'text-3xl'} font-extrabold leading-none tabular-nums my-1`}>{unidades(col.lista)}</div>
                <div className={`${tv ? 'text-sm' : 'text-[10px]'} opacity-90`}>{col.key === 'despacho' ? 'por despachar' : col.key === 'cola' ? 'por empezar' : col.hoyN ? `✓ ${col.hoyN} ${col.hoyN === 1 ? 'pasó' : 'pasaron'} hoy` : 'sofás'}</div>
              </div>
              <div className='flex-1 mt-2 space-y-1.5 rounded-xl p-1' style={{ background: tv ? '#111118' : '#f9fafb' }}>
                {col.lista.length === 0 && <div className={`${tv ? 'text-base' : 'text-xs'} text-center py-3`} style={{ color: C.suave }}>—</div>}
                {col.lista.slice(0, max).map(it => (
                  <Sofa key={it.id} it={it} col={col} tv={tv} C={C} nuevo={!!nuevos[it.id]} hoy={hoy}
                    abierto={abierto === it.id} alternar={() => setAbierto(abierto === it.id ? null : it.id)} />
                ))}
                {col.lista.length > max && <div className={`${tv ? 'text-base' : 'text-xs'} text-center font-semibold py-1`} style={{ color: C.suave }}>+{col.lista.length - max} más</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Últimos movimientos */}
      <div className={tv ? 'mt-4' : 'mt-4'}>
        <div className={`${tv ? 'text-sm' : 'text-xs'} font-semibold uppercase tracking-widest mb-2`} style={{ color: C.suave }}>⚡ Últimos movimientos de hoy</div>
        {hechos.length === 0 ? (
          <p className={tv ? 'text-lg' : 'text-sm'} style={{ color: C.suave }}>Todavía nadie ha marcado ✓ Terminé hoy.</p>
        ) : (
          <div className={`flex flex-wrap ${tv ? 'gap-3' : 'gap-2'}`}>
            {hechos.slice(0, tv ? 10 : 6).map(h => {
              const { modelo, medida } = modeloMedida(h.pedido?.tipo_sofa)
              const sig = ETAPAS_FAB[indice(h.seccion) + 1]
              return (
                <div key={h.id} className={`rounded-full border ${tv ? 'px-4 py-2 text-base' : 'px-3 py-1 text-xs'}`} style={{ borderColor: C.borde, background: C.tarjeta }}>
                  <span style={{ color: C.suave }}>{hora(h.fin)}</span> · <b>{modelo}{medida ? ` ${medida}` : ''}</b> → <span style={{ color: sig?.color, fontWeight: 600 }}>{sig ? (TITULO[sig.key] || etiqueta(sig.key)) : ''}</span>
                  {h.nombre && h.nombre !== 'ERP' ? <span style={{ color: C.suave }}> · {h.nombre.split(' ')[0]}</span> : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Cifra({ n, t, tv, c, color }) {
  return (
    <div className='text-right'>
      <div className={`${tv ? 'text-5xl' : 'text-3xl'} font-extrabold tabular-nums leading-none`} style={{ color: color || c.texto }}>{n}</div>
      <div className={`${tv ? 'text-sm' : 'text-[11px]'} uppercase tracking-wide mt-1`} style={{ color: c.suave }}>{t}</div>
    </div>
  )
}

function Sofa({ it, col, tv, C, nuevo, abierto, alternar, hoy }) {
  const { modelo, medida } = modeloMedida(it.ref)
  const urgente = it.prioridad === 'urgente' || it.prioridad === 'alta'
  const atrasado = col.key !== 'despacho' && it.entrega && it.entrega < hoy
  return (
    <button type='button' onClick={alternar} aria-expanded={abierto}
      className={`w-full text-left rounded-lg border ${tv ? 'px-3 py-2' : 'px-2 py-1.5'} ${nuevo ? 'flujo-nuevo' : ''}`}
      style={{ background: C.tarjeta, borderColor: nuevo ? '#facc15' : C.borde, borderLeft: `4px solid ${urgente || atrasado ? '#ef4444' : col.color}` }}>
      <div className='flex items-start justify-between gap-1'>
        <div className={`${tv ? 'text-lg' : 'text-[13px]'} font-bold leading-tight truncate`}>{modelo}{it.cantidad > 1 ? <span style={{ color: C.suave }}> ×{it.cantidad}</span> : null}</div>
        {nuevo && <span className={`${tv ? 'text-xs' : 'text-[9px]'} font-bold rounded px-1 flex-none`} style={{ background: '#facc15', color: '#111' }}>NUEVO</span>}
      </div>
      <div className='flex items-center justify-between gap-1'>
        <span className={`${tv ? 'text-base' : 'text-xs'} font-semibold`} style={{ color: col.color }}>{medida || ' '}</span>
        <span className={`${tv ? 'text-xs' : 'text-[10px]'}`} style={{ color: C.suave }}>{it.numero}</span>
      </div>
      {it.cliente && <div className={`${tv ? 'text-sm' : 'text-[11px]'} truncate`} style={{ color: C.suave }} title={it.cliente}>👤 {nombreCorto(it.cliente)}</div>}
      {(urgente || atrasado) && <div className={`${tv ? 'text-xs' : 'text-[10px]'} font-bold text-red-500 uppercase`}>{urgente ? `⚠ ${it.prioridad}` : '⏰ entrega vencida'}</div>}
      {abierto && (
        <div className={`${tv ? 'text-sm' : 'text-[11px]'} mt-1 pt-1 border-t space-y-0.5`} style={{ borderColor: C.borde, color: C.suave }}>
          {it.cliente && <div>Cliente: <b style={{ color: C.texto }}>{it.cliente}</b></div>}
          <div>Tela: <b style={{ color: C.texto }}>{it.tela || '—'}</b></div>
          <div>Entrega: <b style={{ color: C.texto }}>{fCorta(it.entrega)}</b></div>
          {it.dia && <div>Programado: {fCorta(it.dia)}</div>}
        </div>
      )}
    </button>
  )
}
