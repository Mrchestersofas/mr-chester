import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SECCIONES, CARGO_SECCION, ETAPAS_FAB, etiqueta, trabajoSeccion, textoDiaSeccion, textoDiaGeneral, linkWhatsApp, hoyISO, sumar, fCorta } from '@/lib/etapas'

/* Programación del día por WhatsApp: a cada encargado lo de su sección y al jefe de taller el general.
   Los teléfonos salen de Nómina → Empleados (según el cargo). */

const sinTilde = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const proximoHabil = iso => { let d = sumar(iso, 1); while (new Date(d + 'T12:00:00Z').getUTCDay() === 0) d = sumar(d, 1); return d }

export default function EnviarDia({ items }) {
  const [abierto, setAbierto] = useState(false)
  const [dia, setDia] = useState(hoyISO())
  const [gente, setGente] = useState([])
  const [enviados, setEnviados] = useState({})
  const [ver, setVer] = useState(null)

  useEffect(() => {
    supabase.from('nom_empleados').select('nombre, cargo, telefono, activo').eq('activo', true)
      .then(({ data }) => setGente(data || []))
  }, [])
  useEffect(() => { setEnviados({}); setVer(null) }, [dia])

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
                <button type='button' className='text-xs font-semibold text-purple-700 whitespace-nowrap' onClick={() => setVer(ver === f.k ? null : f.k)}>{ver === f.k ? 'Ocultar' : 'Ver mensaje'}</button>
              </div>
              {ver === f.k && <pre className='whitespace-pre-wrap font-sans text-xs rounded-lg bg-gray-50 border border-gray-200 p-2 mb-2'>{f.texto(f.personas[0]?.nombre)}</pre>}
              {!f.personas.length ? (
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
