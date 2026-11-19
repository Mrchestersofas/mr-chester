import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SECCIONES, CARGO_SECCION, ETAPAS_FAB, etiqueta, trabajoSeccion, textoDiaSeccion, textoDiaGeneral, linkWhatsApp, hoyISO, sumar, fCorta, indice } from '@/lib/etapas'

/* Programación del día por WhatsApp: a cada encargado lo de su sección y al jefe de taller el general.
   Los teléfonos salen de Nómina → Empleados (según el cargo). */

const sinTilde = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const proximoHabil = iso => { let d = sumar(iso, 1); while (new Date(d + 'T12:00:00Z').getUTCDay() === 0) d = sumar(d, 1); return d }

export default function EnviarDia({ items, recargar }) {
  const [abierto, setAbierto] = useState(false)
  const [dia, setDia] = useState(hoyISO())
  const [gente, setGente] = useState([])
  const [enviados, setEnviados] = useState({})
  const [ver, setVer] = useState(null)
  const [elegir, setElegir] = useState(null) // sección en la que se eligen pedidos a mano

  useEffect(() => {
    supabase.from('nom_empleados').select('nombre, cargo, telefono, activo').eq('activo', true)
      .then(({ data }) => setGente(data || []))
  }, [])
  useEffect(() => { setEnviados({}); setVer(null); setElegir(null) }, [dia])

  const hoy = hoyISO()
  const jefe = gente.filter(g => sinTilde(g.cargo).includes('jefe'))
  const filas = [
    { k: 'general', titulo: 'General (todo el taller)', color: '#111827', personas: jefe, texto: n => textoDiaGeneral(items, dia, n), cuenta: new Set(SECCIONES.flatMap(s => trabajoSeccion(items, s.key, dia).hoy.map(it => it.id))).size },
    ...SECCIONES.map(s => {
      const t = trabajoSeccion(items, s.key, dia)
      return { k: s.key, titulo: etiqueta(s.key), color: ETAPAS_FAB.find(e => e.key === s.key)?.color, personas: gente.filter(g => CARGO_SECCION[sinTilde(g.cargo)] === s.key), texto: n => textoDiaSeccion(items, s.key, dia, n), cuenta: t.hoy.length, atrasados: t.atrasados.length }
    }),
  ]

  return (
    <div className='card mb-4 p-0 overflow-hidden'>
      <button type='button' className='w-full flex items-center justify-between px-4 py-3 text-left' onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <span className='font-semibold'>📲 Enviar programación del día</span>
        <span className='text-sm text-gray-500'>{abierto ? 'Cerrar' : 'A cada operario'}</span>
      </button>
      {abierto && (
        <div className='border-t border-gray-100 p-4 space-y-3'>
          <div className='flex items-center gap-2'>
            <button className='btn px-3' onClick={() => setDia(sumar(dia, -1))} aria-label='Día anterior'>‹</button>
            <div className='flex-1 text-center font-semibold capitalize'>{dia === hoy ? 'Hoy, ' : dia === proximoHabil(hoy) ? 'Mañana, ' : ''}{fCorta(dia)}</div>
            <button className='btn px-3' onClick={() => setDia(sumar(dia, 1))} aria-label='Día siguiente'>›</button>
          </div>
          <div className='flex gap-2'>
            <button className={`flex-1 btn text-sm ${dia === hoy ? 'ring-2 ring-gray-900' : ''}`} onClick={() => setDia(hoy)}>Hoy</button>
            <button className={`flex-1 btn text-sm ${dia === proximoHabil(hoy) ? 'ring-2 ring-gray-900' : ''}`} onClick={() => setDia(proximoHabil(hoy))}>Mañana</button>
          </div>
          {filas.map(f => (
            <div key={f.k} className='rounded-lg border border-gray-200 p-3'>
              <div className='flex items-center justify-between gap-2 mb-2'>
                <div className='min-w-0'>
                  <div className='font-semibold' style={{ color: f.color }}>{f.titulo}</div>
                  <div className='text-xs text-gray-500'>{f.cuenta} para este día{f.atrasados ? ` · ⏳ ${f.atrasados} pendiente${f.atrasados > 1 ? 's' : ''} de antes` : ''}</div>
                </div>
                <div className='flex flex-col items-end gap-1'>
                  {f.k !== 'general' && <button type='button' className='text-xs font-semibold text-amber-700 whitespace-nowrap' onClick={() => { setElegir(elegir === f.k ? null : f.k); setVer(null) }}>{elegir === f.k ? 'Cerrar' : '✋ Elegir a mano'}</button>}
                  <button type='button' className='text-xs font-semibold text-purple-700 whitespace-nowrap' onClick={() => { setVer(ver === f.k ? null : f.k); setElegir(null) }}>{ver === f.k ? 'Ocultar' : 'Ver mensaje'}</button>
                </div>
              </div>
              {elegir === f.k && <ElegirAMano items={items} s={f.k} dia={dia} color={f.color} personas={f.personas}
                enviado={async nombre => { setEnviados(e => ({ ...e, [f.k + nombre]: true })); if (recargar) await recargar() }} />}
              {ver === f.k && <pre className='whitespace-pre-wrap font-sans text-xs rounded-lg bg-gray-50 border border-gray-200 p-2 mb-2'>{f.texto(f.personas[0]?.nombre)}</pre>}
              {elegir === f.k ? null : !f.personas.length ? (
                <p className='text-xs text-amber-700'>No hay nadie con este cargo en Nómina → Empleados.</p>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {f.personas.map(p => p.telefono ? (
                    <a key={p.nombre} href={linkWhatsApp(p.telefono, f.texto(p.nombre))} target='_blank' rel='noreferrer'
                      onClick={() => setEnviados(e => ({ ...e, [f.k + p.nombre]: true }))}
                      className={`btn text-sm ${enviados[f.k + p.nombre] ? 'bg-green-50 border-green-300 text-green-800' : ''}`}>
                      {enviados[f.k + p.nombre] ? '✓ ' : '💬 '}{p.nombre}
                    </a>
                  ) : (
                    <span key={p.nombre} className='btn text-sm opacity-50 cursor-not-allowed' title='Agrega el teléfono en Nómina'>{p.nombre} · sin teléfono</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className='text-xs text-gray-500'>Los teléfonos y cargos salen de Nómina → Empleados. Si cambias a alguien de sección, cámbiale el cargo allá.</p>
        </div>
      )}
    </div>
  )
}

/* Elegir a mano qué pedidos le mandas a una sección ese día.
   Empieza vacío: tocas los que quieres y el WhatsApp lleva SOLO esos.
   Los elegidos quedan fijos ese día (el sistema ya no los mueve); los demás no se tocan. */
function ElegirAMano({ items, s, dia, color, personas, enviado }) {
  const j = indice(s)
  const { hoy, atrasados } = trabajoSeccion(items, s, dia)
  const idsHoy = new Set(hoy.map(it => it.id))
  const pendientes = items.filter(it => indice(it.etapa) <= j && it.etapa !== 'despacho')
  const peso = it => idsHoy.has(it.id) ? 0 : atrasados.some(a => a.id === it.id) ? 1 : 2
  const lista = [...pendientes].sort((a, b) => peso(a) - peso(b) || String(a.entrega || '9').localeCompare(String(b.entrega || '9')) || String(a.numero).localeCompare(String(b.numero)))
  const [sel, setSel] = useState([]) // en el orden en que los tocas
  const [buscar, setBuscar] = useState('')
  const [ver, setVer] = useState(false)
  const sinT = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const q = sinT(buscar.trim())
  const visibles = q ? lista.filter(it => [it.cliente, it.numero, it.ref, it.tela].some(x => sinT(x).includes(q))) : lista
  const toggle = id => setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const elegidos = sel.map(id => lista.find(it => it.id === id)).filter(Boolean)
  // El mensaje se arma solo con los elegidos
  const texto = nombre => textoDiaSeccion(elegidos.map(it => ({ ...it, inicios: { ...it.inicios, [s]: dia } })), s, dia, nombre)

  function guardar() {
    return Promise.all(elegidos.map(it => {
      const cambios = { [`inicio_${s}`]: dia + 'T13:00:00Z' } // 8:00 a. m. Colombia
      if (it.etapa === 'cola' || !it.dia || it.dia > dia) Object.assign(cambios, { dia_produccion: dia, fijo: true })
      return supabase.from('programacion_produccion').update(cambios).eq('id', it.id)
    }))
  }

  return (
    <div className='rounded-lg bg-amber-50 border border-amber-200 p-2 mb-2'>
      <p className='text-sm text-gray-700 mb-2'>Toca los que va a hacer el <b>{fCorta(dia)}</b>:</p>
      {lista.length > 8 && <input type='search' value={buscar} onChange={e => setBuscar(e.target.value)} placeholder='🔍 Buscar…' className='w-full mb-2 text-sm' />}
      <div className='space-y-1 max-h-80 overflow-y-auto'>
        {visibles.map(it => {
          const n = sel.indexOf(it.id) + 1
          return (
            <button key={it.id} type='button' onClick={() => toggle(it.id)}
              className={`w-full flex items-center gap-2 rounded-lg border p-2 text-left ${n ? 'bg-white border-gray-900' : 'bg-white/60 border-gray-200'}`}>
              <span className='w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center text-sm font-bold'
                style={n ? { background: color, borderColor: color, color: '#fff' } : { borderColor: '#d1d5db' }}>{n || ''}</span>
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-semibold truncate'>{it.ref}{it.cantidad > 1 ? ` ×${it.cantidad}` : ''} {it.prioridad === 'urgente' ? '⚠️' : ''}</span>
                <span className='block text-xs text-gray-500 truncate'>{it.numero} · {it.cliente || '—'} · entrega {fCorta(it.entrega)}</span>
              </span>
            </button>
          )
        })}
        {!visibles.length && <p className='text-xs text-gray-500 p-2'>No hay pedidos pendientes para esta sección.</p>}
      </div>
      {!elegidos.length ? (
        <p className='text-sm text-center text-gray-500 mt-3'>👆 Elige al menos uno</p>
      ) : (
        <div className='mt-3 space-y-2'>
          <button type='button' className='text-xs font-semibold text-purple-700' onClick={() => setVer(!ver)}>{ver ? 'Ocultar mensaje' : `Ver mensaje (${elegidos.length})`}</button>
          {ver && <pre className='whitespace-pre-wrap font-sans text-xs rounded-lg bg-white border border-gray-200 p-2'>{texto(personas[0]?.nombre)}</pre>}
          {!personas.length && <p className='text-xs text-amber-700'>No hay nadie con este cargo en Nómina → Empleados.</p>}
          {personas.map(p => p.telefono ? (
            <a key={p.nombre} href={linkWhatsApp(p.telefono, texto(p.nombre))} target='_blank' rel='noreferrer'
              onClick={() => { guardar().then(() => enviado(p.nombre)) }}
              className='btn w-full text-center block font-semibold text-white' style={{ background: color, borderColor: color }}>
              💬 Enviar {elegidos.length} a {p.nombre.split(' ')[0]}
            </a>
          ) : (
            <span key={p.nombre} className='btn w-full text-center block opacity-50'>{p.nombre} · sin teléfono</span>
          ))}
        </div>
      )}
    </div>
  )
}
