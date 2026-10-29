import { useEffect, useState } from 'react'
import { etiqueta, indice, siguiente, hoyISO, diaBogota, fCorta, ETAPAS_FAB } from '@/lib/etapas'

/* Mi trabajo (taller): cada encargado ve solo su sección.
   ▶ Empezar guarda la hora de inicio; ✓ Terminé guarda la hora de fin y pasa el sofá a la siguiente sección. */

const hora = ts => ts ? new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }) : '—'
export function duracion(min) {
  if (min == null || min < 0) return '—'
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h} h${m ? ` ${m} min` : ''}`
}
const minutos = (a, b) => a && b ? (new Date(b) - new Date(a)) / 60000 : null

export default function MiTrabajo({ items, tiempos = [], seccion, empezar, terminar }) {
  const [, setTick] = useState(0)
  const [ocupado, setOcupado] = useState(null)
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(t) }, [])

  const hoy = hoyISO()
  const s = seccion, j = indice(s), sig = siguiente(s)
  const color = ETAPAS_FAB.find(e => e.key === s)?.color || '#111827'
  const abierto = {}
  tiempos.filter(t => t.seccion === s && !t.fin).forEach(t => { abierto[t.prog_id] = t })

  // En mi sección: lo que está en mi etapa. En Esqueletería también lo programado (cola) hasta hoy.
  const mios = items.filter(it => it.etapa === s || (s === 'estructura' && it.etapa === 'cola' && it.dia && it.dia <= hoy))
  const orden = (a, b) => String(a.inicios[s] || '9').localeCompare(String(b.inicios[s] || '9')) || String(a.entrega || '9').localeCompare(String(b.entrega || '9'))
  const trabajando = mios.filter(it => abierto[it.id]).sort(orden)
  const porHacer = mios.filter(it => !abierto[it.id]).sort((a, b) => (b.prioridad === 'urgente') - (a.prioridad === 'urgente') || orden(a, b))
  const vienen = items.filter(it => indice(it.etapa) < j && it.inicios[s] && it.inicios[s] <= hoy && !mios.includes(it)).sort(orden)
  const hechos = tiempos.filter(t => t.seccion === s && t.fin && diaBogota(t.fin) === hoy).sort((a, b) => String(b.fin).localeCompare(String(a.fin)))
  const unidades = l => l.reduce((a, x) => a + (Number(x.cantidad) || 1), 0)

  async function hacer(it, accion) {
    if (accion === 'fin' && !confirm(`¿Terminaste ${it.numero} · ${it.ref}?\n\nPasa a ${etiqueta(sig)}.`)) return
    setOcupado(it.id)
    if (accion === 'inicio') await empezar(it); else await terminar(it)
    setOcupado(null)
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-3 gap-2 text-center'>
        <Cifra n={unidades(trabajando)} t='Trabajando' c='#b45309' />
        <Cifra n={unidades(porHacer)} t='Por hacer' c={color} />
        <Cifra n={unidades(hechos)} t='Terminados hoy' c='#15803d' />
      </div>

      {trabajando.length > 0 && (
        <Bloque titulo='🔨 Trabajando ahora'>
          {trabajando.map(it => {
            const t = abierto[it.id]
            return (
              <Sofa key={it.id} it={it} s={s} borde='#f59e0b'>
                <p className='text-sm text-amber-800 mt-1'>Empezaste a las <b>{hora(t.inicio)}</b> · lleva {duracion(minutos(t.inicio, new Date().toISOString()))}</p>
                <button className='w-full mt-2 rounded-xl py-3 font-bold text-white bg-green-700 disabled:opacity-50' disabled={ocupado === it.id} onClick={() => hacer(it, 'fin')}>
                  {ocupado === it.id ? 'Guardando…' : `✓ Terminé → pasa a ${etiqueta(sig)}`}
                </button>
              </Sofa>
            )
          })}
        </Bloque>
      )}

      <Bloque titulo={`📋 Por hacer (${porHacer.length})`}>
        {porHacer.length === 0 && <p className='card text-center text-gray-500 py-6'>No tienes sofás pendientes en tu sección. 🙌</p>}
        {porHacer.map(it => {
          const atrasado = it.inicios[s] && it.inicios[s] < hoy
          return (
            <Sofa key={it.id} it={it} s={s} borde={atrasado ? '#dc2626' : color}>
              {atrasado && <p className='text-xs font-semibold text-red-700 mt-1'>⏳ Estaba para el {fCorta(it.inicios[s])}</p>}
              <div className='flex gap-2 mt-2'>
                <button className='flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-50' style={{ background: '#1a1a1a' }} disabled={ocupado === it.id} onClick={() => hacer(it, 'inicio')}>
                  {ocupado === it.id ? 'Guardando…' : '▶ Empezar'}
                </button>
                {it.etapa === s && (
                  <button className='flex-1 rounded-xl py-3 font-bold border-2 border-green-700 text-green-800 disabled:opacity-50' disabled={ocupado === it.id} onClick={() => hacer(it, 'fin')}>✓ Ya lo terminé</button>
                )}
              </div>
            </Sofa>
          )
        })}
      </Bloque>

      {vienen.length > 0 && (
        <Bloque titulo={`🚚 Vienen en camino (${vienen.length})`}>
          {vienen.map(it => (
            <div key={it.id} className='flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm opacity-80'>
              <span className='min-w-0 truncate'><b>{it.numero}</b> · {it.ref}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</span>
              <span className='text-xs text-gray-500 whitespace-nowrap'>en {it.etapa === 'cola' ? 'programación' : etiqueta(it.etapa)}</span>
            </div>
          ))}
        </Bloque>
      )}

      {hechos.length > 0 && (
        <Bloque titulo={`✅ Terminados hoy (${unidades(hechos)})`}>
          {hechos.map((t, i) => (
            <div key={i} className='flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm'>
              <span className='min-w-0 truncate'><b>{t.numero}</b> · {t.ref}{t.cantidad > 1 ? ` × ${t.cantidad}` : ''}{t.nombre ? <span className='text-gray-500'> · {t.nombre.split(' ')[0]}</span> : null}</span>
              <span className='text-xs text-green-800 whitespace-nowrap'>{hora(t.fin)}{t.inicio ? ` · ${duracion(minutos(t.inicio, t.fin))}` : ''}</span>
            </div>
          ))}
        </Bloque>
      )}
    </div>
  )
}

function Cifra({ n, t, c }) {
  return <div className='rounded-xl bg-white border border-gray-200 py-2'><div className='text-2xl font-bold' style={{ color: c }}>{n}</div><div className='text-[11px] text-gray-500'>{t}</div></div>
}
function Bloque({ titulo, children }) {
  return <section><h2 className='text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2'>{titulo}</h2><div className='space-y-2'>{children}</div></section>
}
function Sofa({ it, s, borde, children }) {
  const urgente = it.prioridad === 'urgente' || it.prioridad === 'alta'
  return (
    <div className='card py-3' style={{ borderLeft: `5px solid ${borde}` }}>
      <div className='flex justify-between gap-2'>
        <div className='min-w-0'>
          <div className='text-lg font-bold leading-tight'>{it.ref}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</div>
          <div className='text-sm text-gray-500'>{it.numero}</div>
          <div className='text-sm mt-0.5'>Tela: <b>{it.tela || 'por definir'}</b>{s === 'corte_tela' && it.metros ? ` · ${Math.round(it.metros * 10) / 10} m` : ''}</div>
        </div>
        <div className='text-right text-xs text-gray-500 flex-none'>
          <div className='font-semibold text-gray-800'>Entrega {fCorta(it.entrega)}</div>
          {urgente && <div className='text-red-600 font-bold uppercase mt-0.5'>⚠ {it.prioridad}</div>}
        </div>
      </div>
      {it.obs && <p className='text-sm text-gray-700 mt-1 rounded bg-yellow-50 px-2 py-1'>📝 {it.obs}</p>}
      {children}
    </div>
  )
}
