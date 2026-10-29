import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SECCIONES, ETAPAS_FAB, etiqueta, diaBogota, hoyISO, sumar, fCorta } from '@/lib/etapas'
import { duracion } from '@/components/MiTrabajo'

/* Tiempos de fábrica: lo que cada persona marca en el taller (▶ Empezar / ✓ Terminé).
   El tiempo cuenta solo horario de taller (lunes a sábado, 7:00 a 17:00) para que las noches no inflen el promedio. */

const H_INI = 7, H_FIN = 17
const hora = ts => ts ? new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '—'
// minutos dentro del horario de taller entre dos momentos
function minTaller(a, b) {
  if (!a || !b) return null
  let ini = new Date(a).getTime(), fin = new Date(b).getTime()
  if (fin <= ini) return 0
  const OFF = 5 * 3600000, DIA = 86400000
  let total = 0
  for (let d = Math.floor((ini - OFF) / DIA) * DIA + OFF; d < fin; d += DIA) { // d = medianoche Bogotá
    if (new Date(d - OFF + 12 * 3600000).getUTCDay() === 0) continue
    const s = Math.max(ini, d + H_INI * 3600000), e = Math.min(fin, d + H_FIN * 3600000)
    if (e > s) total += (e - s) / 60000
  }
  return total
}
const prom = l => l.length ? l.reduce((a, x) => a + x, 0) / l.length : null

export default function Tiempos() {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [rango, setRango] = useState(7)

  async function cargar() {
    const desde = new Date(Date.now() - 31 * 86400000).toISOString()
    const { data, error: e } = await supabase.from('prod_tiempos')
      .select('*, pedido:pedidos(numero, tipo_sofa, cantidad)')
      .or(`fin.is.null,fin.gte.${desde}`).order('fin', { ascending: false, nullsFirst: true })
    if (e) { setError(e.message); return }
    setFilas(data || [])
  }
  useEffect(() => { cargar(); const t = setInterval(cargar, 120000); return () => clearInterval(t) }, [])

  if (error) return <div className='p-4 max-w-2xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar: {error}. Revisa que hayas corrido el SQL de tiempos.</p></div>
  if (!filas) return <div className='p-4 text-gray-500'>Cargando…</div>

  const hoy = hoyISO(), desde = sumar(hoy, -(rango - 1))
  const enProceso = filas.filter(f => !f.fin && f.inicio)
  const hechos = filas.filter(f => f.fin && diaBogota(f.fin) >= desde).map(f => ({ ...f, min: minTaller(f.inicio, f.fin), u: Number(f.pedido?.cantidad) || 1 }))
  const porDia = {}
  hechos.forEach(f => { const d = diaBogota(f.fin); (porDia[d] = porDia[d] || []).push(f) })
  const personas = {}
  hechos.forEach(f => { const k = f.nombre || 'Sin nombre'; personas[k] = personas[k] || { u: 0, mins: [], secs: new Set() }; personas[k].u += f.u; if (f.min != null && f.inicio) personas[k].mins.push(f.min / f.u); personas[k].secs.add(f.seccion) })
  const sinInicio = hechos.filter(f => !f.inicio).length

  return (
    <div className='p-4 max-w-3xl mx-auto'>
      <div className='flex items-start justify-between gap-2 mb-1'>
        <h1 className='text-xl font-medium'>⏱ Tiempos de fábrica</h1>
        <Link href='/produccion' className='btn text-sm whitespace-nowrap'>← Producción</Link>
      </div>
      <p className='text-sm text-gray-500 mb-4'>Lo que marca cada persona en el taller. El tiempo cuenta solo horario de taller (L–S, {H_INI}:00 a {H_FIN}:00).</p>

      <div className='flex gap-2 mb-4'>
        {[[1, 'Hoy'], [7, '7 días'], [30, '30 días']].map(([n, l]) => (
          <button key={n} onClick={() => setRango(n)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${rango === n ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2'>Por sección</h2>
      <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5'>
        {SECCIONES.map(({ key }) => {
          const l = hechos.filter(f => f.seccion === key)
          const u = l.reduce((a, f) => a + f.u, 0)
          const p = prom(l.filter(f => f.inicio && f.min != null).map(f => f.min / f.u))
          const c = ETAPAS_FAB.find(e => e.key === key)?.color
          return (
            <div key={key} className='card py-3' style={{ borderTop: `4px solid ${c}` }}>
              <div className='text-xs font-semibold uppercase' style={{ color: c }}>{etiqueta(key)}</div>
              <div className='text-2xl font-bold'>{u} <span className='text-sm font-normal text-gray-500'>u.</span></div>
              <div className='text-xs text-gray-500'>{p != null ? `${duracion(p)} por unidad` : 'sin tiempos aún'}</div>
              {rango > 1 && u > 0 && <div className='text-xs text-gray-500'>{Math.round(u / rango * 10) / 10} u./día</div>}
            </div>
          )
        })}
      </div>

      {enProceso.length > 0 && (<>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2'>🔨 Trabajando ahora</h2>
        <div className='space-y-1.5 mb-5'>
          {enProceso.map(f => (
            <div key={f.id} className='flex justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm'>
              <span className='min-w-0 truncate'><b>{f.pedido?.numero}</b> · {f.pedido?.tipo_sofa} · {etiqueta(f.seccion)} · {f.nombre}</span>
              <span className='whitespace-nowrap text-amber-800'>desde {hora(f.inicio)}{diaBogota(f.inicio) !== hoy ? ` (${fCorta(diaBogota(f.inicio))})` : ''} · {duracion(minTaller(f.inicio, new Date().toISOString()))}</span>
            </div>
          ))}
        </div>
      </>)}

      {Object.keys(personas).length > 0 && (<>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2'>Por persona</h2>
        <div className='card p-0 overflow-x-auto mb-5'>
          <table className='w-full text-sm'>
            <thead><tr className='text-left text-xs text-gray-500 border-b'><th className='p-2'>Persona</th><th className='p-2'>Sección</th><th className='p-2 text-right'>Unidades</th><th className='p-2 text-right'>Promedio / u.</th></tr></thead>
            <tbody>
              {Object.entries(personas).sort((a, b) => b[1].u - a[1].u).map(([n, x]) => (
                <tr key={n} className='border-b border-gray-100'><td className='p-2 font-medium'>{n}</td><td className='p-2 text-gray-500'>{[...x.secs].map(etiqueta).join(', ')}</td><td className='p-2 text-right'>{x.u}</td><td className='p-2 text-right'>{duracion(prom(x.mins))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2'>Terminados</h2>
      {!hechos.length && <div className='card text-center text-gray-500 py-8'>Todavía no hay nada marcado como terminado en este periodo.</div>}
      <div className='space-y-4'>
        {Object.entries(porDia).sort((a, b) => b[0].localeCompare(a[0])).map(([d, l]) => (
          <div key={d}>
            <div className='text-sm font-semibold capitalize mb-1'>{d === hoy ? 'Hoy · ' : ''}{fCorta(d)} <span className='text-gray-400 font-normal'>({l.reduce((a, f) => a + f.u, 0)} u.)</span></div>
            <div className='card p-0 overflow-x-auto'>
              <table className='w-full text-sm'>
                <tbody>
                  {l.map(f => (
                    <tr key={f.id} className='border-b border-gray-100 last:border-0'>
                      <td className='p-2 whitespace-nowrap text-gray-500'>{hora(f.fin)}</td>
                      <td className='p-2'><b>{f.pedido?.numero}</b> · {f.pedido?.tipo_sofa}{f.u > 1 ? ` × ${f.u}` : ''}</td>
                      <td className='p-2 whitespace-nowrap' style={{ color: ETAPAS_FAB.find(e => e.key === f.seccion)?.color }}>{etiqueta(f.seccion)}</td>
                      <td className='p-2 whitespace-nowrap text-gray-600'>{f.nombre}</td>
                      <td className='p-2 whitespace-nowrap text-right'>{f.inicio ? duracion(f.min) : <span className='text-gray-400'>sin inicio</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {sinInicio > 0 && <p className='text-xs text-gray-500 mt-3'>{sinInicio} sin hora de inicio: los marcaron como terminados sin tocar "▶ Empezar". Para tener el tiempo, que siempre toquen Empezar cuando arrancan.</p>}
    </div>
  )
}
