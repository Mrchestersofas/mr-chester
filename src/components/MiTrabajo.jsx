import { useState } from 'react'
import { etiqueta, indice, siguiente, hoyISO, diaBogota, ETAPAS_FAB, SIN_TELA, modeloMedida } from '@/lib/etapas'
import { sumarHabiles } from '@/lib/planificador'

/* Mi trabajo (taller): cada encargado ve solo su sección y toca ✓ Terminé cuando acaba un sofá.
   El sofá pasa a la siguiente sección y la hora queda guardada (la base la registra sola).
   Corte y costura trabaja en paralelo: puede cortar la tela de lo programado aunque el sofá siga en
   Esqueletería o Espumado. Lo marca "✂️ Ya la corté" y, cuando terminen el espumado, pasa directo a Tapizado. */

export function duracion(min) {
  if (min == null || min < 0) return '—'
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return `${h} h${m ? ` ${m} min` : ''}`
}

export default function MiTrabajo({ items, tiempos = [], seccion, terminar, cortar }) {
  const [ocupado, setOcupado] = useState(null)
  const hoy = hoyISO()
  const s = seccion, j = indice(s), sig = siguiente(s)
  const color = ETAPAS_FAB.find(e => e.key === s)?.color || '#111827'

  // En mi sección: lo que está en mi etapa. En Esqueletería también lo programado (cola) hasta hoy.
  const mios = items.filter(it => it.etapa === s || (s === 'estructura' && it.etapa === 'cola' && it.dia && it.dia <= hoy))
  const orden = (a, b) => String(a.inicios[s] || '9').localeCompare(String(b.inicios[s] || '9')) || String(a.entrega || '9').localeCompare(String(b.entrega || '9'))
  const urgentePrimero = (a, b) => (b.prioridad === 'urgente') - (a.prioridad === 'urgente') || orden(a, b)
  // Corte en paralelo: la tela se puede cortar antes de que el sofá llegue a Corte
  const paralelo = s === 'corte_tela' && !!cortar
  const manana = sumarHabiles(hoy, 1)
  const antesDeMi = it => indice(it.etapa) < j && it.inicios[s]
  const adelantables = paralelo ? items.filter(it => antesDeMi(it) && !it.corteListo && it.inicios[s] <= hoy) : []
  const paraManana = paralelo ? items.filter(it => antesDeMi(it) && !it.corteListo && it.inicios[s] > hoy && it.inicios[s] <= manana).sort(urgentePrimero) : []
  const cortadas = paralelo ? items.filter(it => antesDeMi(it) && it.corteListo).sort(orden) : []
  const porHacer = [...mios, ...adelantables].sort(urgentePrimero)
  const vienen = paralelo ? [] : items.filter(it => indice(it.etapa) < j && it.inicios[s] && it.inicios[s] <= hoy && !mios.includes(it)).sort(orden)
  const hechos = tiempos.filter(t => t.seccion === s && t.fin && diaBogota(t.fin) === hoy)
  const unidades = l => l.reduce((a, x) => a + (Number(x.cantidad) || 1), 0)

  async function listo(it) {
    if (!confirm(`¿Terminaste ${it.numero} · ${it.ref}?\n\nPasa a ${etiqueta(sig)}.`)) return
    setOcupado(it.id)
    await terminar(it)
    setOcupado(null)
  }
  async function yaCortada(it) {
    if (!confirm(`¿Ya cortaste la tela de ${it.numero} · ${it.ref}?\n\nCuando terminen el espumado, pasa directo a Tapizado.`)) return
    setOcupado(it.id); await cortar(it); setOcupado(null)
  }
  async function deshacer(it) {
    if (!confirm(`¿Quitar la marca de tela cortada de ${it.numero}?`)) return
    setOcupado(it.id); await cortar(it, true); setOcupado(null)
  }
  const boton = it => {
    const adelantada = indice(it.etapa) < j
    return (
      <button className='w-full mt-2 rounded-xl py-3 font-bold text-white bg-green-700 disabled:opacity-50' disabled={ocupado === it.id} onClick={() => adelantada ? yaCortada(it) : listo(it)}>
        {ocupado === it.id ? 'Guardando…' : adelantada ? '✂️ Ya corté esta tela' : `✓ Terminé → pasa a ${etiqueta(sig)}`}
      </button>
    )
  }
  const dondeVa = it => <div className='text-xs text-gray-500 mt-1'>El sofá va en {it.etapa === 'cola' ? 'programación' : etiqueta(it.etapa)} · puedes cortar la tela ya</div>

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 gap-2 text-center'>
        <Cifra n={unidades(porHacer)} t='Por hacer' c={color} />
        <Cifra n={unidades(hechos)} t='Terminados hoy' c='#15803d' />
      </div>

      <Bloque titulo={`📋 Por hacer (${unidades(porHacer)})`}>
        {porHacer.length === 0 && <p className='card text-center text-gray-500 py-6'>No tienes sofás pendientes en tu sección. 🙌</p>}
        {porHacer.map(it => (
          <Sofa key={it.id} it={it} s={s} borde={color}>
            {paralelo && indice(it.etapa) < j && dondeVa(it)}
            {boton(it)}
          </Sofa>
        ))}
      </Bloque>

      {paraManana.length > 0 && (
        <Bloque titulo={`📅 Para adelantar · mañana (${unidades(paraManana)})`}>
          {paraManana.map(it => (
            <Sofa key={it.id} it={it} s={s} borde='#9ca3af'>
              <div className='text-xs text-gray-500 mt-1'>Si ya llegó la tela, la puedes cortar desde hoy.</div>
              {boton(it)}
            </Sofa>
          ))}
        </Bloque>
      )}

      {cortadas.length > 0 && (
        <Bloque titulo={`✂️ Tela cortada · esperan espumado (${cortadas.length})`}>
          {cortadas.map(it => (
            <div key={it.id} className='flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'>
              <span className='min-w-0 truncate'>✓ <b>{it.numero}</b> · {it.ref}{it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</span>
              <span className='flex items-center gap-2 whitespace-nowrap'>
                <span className='text-xs text-gray-500'>en {it.etapa === 'cola' ? 'programación' : etiqueta(it.etapa)}</span>
                <button className='text-xs text-gray-400 underline' disabled={ocupado === it.id} onClick={() => deshacer(it)}>Deshacer</button>
              </span>
            </div>
          ))}
        </Bloque>
      )}

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
            <div key={i} className='rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm'>
              ✓ <b>{t.numero}</b> · {t.ref}{t.cantidad > 1 ? ` × ${t.cantidad}` : ''}
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
  const { modelo, medida } = modeloMedida(it.ref)
  const conTela = !SIN_TELA.includes(s)
  return (
    <div className='card py-3' style={{ borderLeft: `5px solid ${borde}` }}>
      <div className='flex justify-between items-start gap-2'>
        <div className='min-w-0'>
          <div className='text-xl font-bold leading-tight'>{modelo}{it.cantidad > 1 ? <span className='text-gray-500'> × {it.cantidad}</span> : null}</div>
          {medida && <div className='text-2xl font-extrabold' style={{ color: borde }}>{medida}</div>}
          {conTela && <div className='text-base mt-1'>Tela: <b>{it.tela || 'por definir'}</b>{s === 'corte_tela' && it.metros ? <span className='text-gray-600 whitespace-nowrap'> · {(Math.round(it.metros * 10) / 10).toLocaleString('es-CO')} m de tela</span> : null}</div>}
        </div>
        <div className='text-right flex-none'>
          <div className='text-xs text-gray-400'>{it.numero}</div>
          {urgente && <div className='text-xs text-red-600 font-bold uppercase mt-0.5'>⚠ {it.prioridad}</div>}
        </div>
      </div>
      {it.obs && <p className='text-sm text-gray-700 mt-2 rounded bg-yellow-50 px-2 py-1'>📝 {it.obs}</p>}
      {children}
    </div>
  )
}
