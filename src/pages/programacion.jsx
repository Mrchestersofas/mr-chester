import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarYPlanificar, capacidad, sumarDias, sumarHabiles, hoyColombia, esHabil, FESTIVOS, primerCupoLibre, primerDiaPlan } from '@/lib/planificador'

/* Programación de fábrica: 3 cupos por día (sábado 2), por fecha de entrega prometida.
   Muestra cuándo se fabrica cada pedido, cuándo queda listo, la entrega real estimada
   contra la prometida, y permite reprogramar un pedido a otro día. */

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function f(iso) { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }
function fLarga(iso) { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} de ${MESES_L[d.getUTCMonth()]}` }
const cup = n => (Math.round(n * 100) / 100).toLocaleString('es-CO')
const ETAPA = { cola: 'En cola', estructura: 'Estructura', espumado: 'Espumado', corte_tela: 'Corte de tela', tapizado: 'Tapizado', terminado: 'Terminado', control_calidad: 'Control de calidad', despacho: 'Listo para entregar' }
const SEM = {
  ok: ['A tiempo', 'bg-green-100 text-green-800'],
  justo: ['Justo', 'bg-amber-100 text-amber-800'],
  tarde: ['Se pasa', 'bg-red-100 text-red-700'],
  sin_fecha: ['Sin fecha', 'bg-gray-100 text-gray-600'],
}

export default function Programacion() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('pedidos')
  const [reprog, setReprog] = useState(null)

  async function cargar() {
    try { setDatos(await cargarYPlanificar(supabase)); setError(null) }
    catch (e) { setError(e.message || String(e)) }
  }
  useEffect(() => { cargar() }, [])

  if (error) return <div className='p-4 max-w-2xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar la programación: {error}</p></div>
  if (!datos) return <div className='p-4 text-gray-500'>Calculando programación…</div>

  const { plan, usados } = datos
  const cola = plan.filter(p => p.etapa_actual === 'cola').sort((a, b) => a.dia_inicio.localeCompare(b.dia_inicio) || a.pedido.numero.localeCompare(b.pedido.numero))
  const fabrica = plan.filter(p => p.etapa_actual !== 'cola')
  const tarde = plan.filter(p => p.estado === 'tarde').length
  const justo = plan.filter(p => p.estado === 'justo').length
  const libre1 = primerCupoLibre(usados, 1)

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium'>Programación</h1>
      <p className='text-sm text-gray-500 mb-4'>3 cupos por día (sábado 2) · se programa por fecha de entrega prometida</p>

      <div className='grid grid-cols-3 gap-2 mb-4'>
        <Resumen n={cola.length} t='En cola' />
        <Resumen n={tarde} t='Se pasan' color={tarde ? 'text-red-600' : ''} />
        <Resumen n={justo} t='Justos' color={justo ? 'text-amber-600' : ''} />
      </div>
      <div className='card mb-4 text-sm'>
        <div className='flex justify-between gap-2'><span className='text-gray-600'>Primer cupo libre para un sofá</span><b className='capitalize'>{f(libre1)}</b></div>
        <div className='flex justify-between gap-2 mt-1'><span className='text-gray-600'>Entrega más pronta (Bogotá)</span><b className='capitalize'>{f(sumarHabiles(sumarHabiles(libre1, 1), 1))}</b></div>
        <div className='flex justify-between gap-2 mt-1'><span className='text-gray-600'>Entrega más pronta (fuera de Bogotá)</span><b className='capitalize'>{f(sumarHabiles(sumarHabiles(libre1, 1), 5))}</b></div>
      </div>

      <div className='flex gap-2 mb-4'>
        {[['pedidos', 'Pedidos'], ['calendario', 'Calendario']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg ${tab === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'pedidos' ? (
        <div className='space-y-3'>
          {cola.length === 0 && <div className='card text-center text-gray-500 py-8'>No hay pedidos en cola.</div>}
          {cola.map(p => <Tarjeta key={p.id} p={p} onReprog={() => setReprog(p)} recargar={cargar} />)}
          {fabrica.length > 0 && (
            <>
              <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 pt-3'>Ya en fábrica</h2>
              {fabrica.map(p => <Tarjeta key={p.id} p={p} recargar={cargar} />)}
            </>
          )}
        </div>
      ) : <Calendario plan={plan} usados={usados} onReprog={setReprog} />}

      {reprog && <Reprogramar p={reprog} usados={usados} cerrar={() => setReprog(null)} listo={async () => { setReprog(null); setDatos(null); await cargar() }} />}
    </div>
  )
}

function Resumen({ n, t, color = '' }) {
  return <div className='card text-center py-3'><div className={`text-2xl font-semibold ${color}`}>{n}</div><div className='text-xs text-gray-500'>{t}</div></div>
}

function Tarjeta({ p, onReprog, recargar }) {
  const [lbl, cls] = SEM[p.estado] || SEM.sin_fecha
  const [cambiando, setCambiando] = useState(false)
  const enCola = p.etapa_actual === 'cola'
  const fuera = p.entrega_min !== p.entrega_max

  async function cambiarPrometida() {
    if (!confirm(`¿Cambiar la fecha de entrega de ${p.pedido.numero} al ${fLarga(p.entrega_max)}? El cliente lo verá en su seguimiento.`)) return
    setCambiando(true)
    await supabase.from('pedidos').update({ fecha_entrega: p.entrega_max }).eq('id', p.pedido.id)
    setCambiando(false)
    recargar()
  }

  return (
    <div className={`card space-y-2 ${p.estado === 'tarde' ? 'border-red-300' : ''}`}>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className='font-semibold'>{p.pedido.numero} · {p.pedido.cliente?.nombre || 'Sin cliente'}</div>
          <div className='text-sm text-gray-600'>{p.pedido.tipo_sofa}{p.pedido.cantidad > 1 ? ` × ${p.pedido.cantidad}` : ''} · {cup(p.cupos)} cupo{p.cupos === 1 ? '' : 's'} · {p.pedido.cliente?.ciudad || 'Bogotá'}</div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${cls}`}>{lbl}</span>
      </div>
      <div className='grid grid-cols-2 gap-x-3 gap-y-1 text-sm'>
        <Dato t='Comprado' v={f(p.pedido.fecha_pedido)} />
        <Dato t={enCola ? 'Se fabrica' : 'Etapa'} v={enCola ? <>{f(p.dia_inicio)}{p.dia_fin !== p.dia_inicio ? ` → ${f(p.dia_fin)}` : ''}{p.fijo ? ' 📌' : ''}</> : ETAPA[p.etapa_actual] || p.etapa_actual} />
        <Dato t='Listo' v={f(p.listo)} />
        <Dato t='Entrega real' v={fuera ? `${f(p.entrega_min)} – ${f(p.entrega_max)}` : f(p.entrega_max)} />
        <Dato t='Prometida al cliente' v={f(p.prometida)} fuerte />
        {p.sobrecupo && enCola && <div className='col-span-2 text-xs text-amber-700'>⚠ Ese día quedó con más cupos de los que hay.</div>}
      </div>
      {enCola && (
        <div className='flex gap-2 pt-1'>
          <button className='btn flex-1' onClick={onReprog}>📅 Reprogramar</button>
          {p.estado === 'tarde' && <button className='btn flex-1 text-red-700' onClick={cambiarPrometida} disabled={cambiando}>{cambiando ? 'Cambiando…' : `Mover entrega al ${f(p.entrega_max)}`}</button>}
        </div>
      )}
    </div>
  )
}

function Dato({ t, v, fuerte }) {
  return <div><div className='text-xs text-gray-500'>{t}</div><div className={`capitalize ${fuerte ? 'font-semibold' : ''}`}>{v}</div></div>
}

function Calendario({ plan, usados, onReprog }) {
  const hoy = hoyColombia()
  const dias = []
  for (let k = 0; dias.length < 24 && k < 60; k++) { const d = sumarDias(hoy, k); if (diaVisible(d)) dias.push(d) }
  return (
    <div className='space-y-2'>
      {dias.map(d => {
        const cap = capacidad(d), u = usados[d] || 0
        const delDia = plan.filter(p => p.etapa_actual === 'cola' ? (p.dia_inicio <= d && p.dia_fin >= d) : (p.dia_inicio === d && p.etapa_actual !== 'despacho'))
        return (
          <div key={d} className={`card py-3 ${cap === 0 ? 'opacity-60' : ''}`}>
            <div className='flex justify-between items-center mb-1.5'>
              <span className='font-semibold capitalize'>{d === hoy ? 'Hoy · ' : ''}{f(d)}</span>
              <span className={`text-xs font-semibold ${u > cap ? 'text-red-600' : u >= cap ? 'text-gray-900' : 'text-green-700'}`}>
                {FESTIVOS.has(d) ? 'Festivo' : `${cup(u)} / ${cap} cupos`}
              </span>
            </div>
            {cap > 0 && (
              <div className='h-2 rounded-full bg-gray-100 overflow-hidden mb-2'>
                <div className={`h-full ${u > cap ? 'bg-red-500' : 'bg-gray-900'}`} style={{ width: Math.min(100, (u / cap) * 100) + '%' }} />
              </div>
            )}
            <div className='flex flex-wrap gap-1.5'>
              {delDia.map(p => (
                <button key={p.id} onClick={() => p.etapa_actual === 'cola' && onReprog(p)}
                  className={`text-xs px-2 py-1 rounded-full border ${p.estado === 'tarde' ? 'border-red-300 bg-red-50 text-red-800' : p.estado === 'justo' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white'}`}>
                  {p.pedido.numero} · {p.pedido.tipo_sofa}{p.fijo ? ' 📌' : ''}
                </button>
              ))}
              {cap > 0 && !delDia.length && <span className='text-xs text-gray-400'>Libre</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
function diaVisible(d) { return new Date(d + 'T12:00:00Z').getUTCDay() !== 0 }

function Reprogramar({ p, usados, cerrar, listo }) {
  const [guardando, setGuardando] = useState(false)
  const hoy = hoyColombia()
  // Cupos libres de cada día sin contar este mismo pedido
  const opciones = []
  for (let k = 0, d = primerDiaPlan(hoy); opciones.length < 30 && k < 90; k++, d = sumarHabiles(d, 1)) {
    const mio = d >= p.dia_inicio && d <= p.dia_fin ? (p.dia_inicio === p.dia_fin ? p.cupos : p.peso) : 0
    opciones.push({ d, libre: capacidad(d) - (usados[d] || 0) + mio })
  }

  async function elegir(d) {
    setGuardando(true)
    await supabase.from('programacion_produccion').update({ fijo: true, dia_produccion: d }).eq('id', p.id)
    await listo()
  }
  async function automatico() {
    setGuardando(true)
    await supabase.from('programacion_produccion').update({ fijo: false }).eq('id', p.id)
    await listo()
  }

  return (
    <div className='fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center' onClick={cerrar}>
      <div className='bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col' onClick={e => e.stopPropagation()} role='dialog' aria-label='Reprogramar pedido'>
        <div className='p-4 border-b border-gray-100'>
          <div className='flex justify-between items-start gap-2'>
            <div>
              <div className='font-semibold'>Reprogramar {p.pedido.numero}</div>
              <div className='text-sm text-gray-600'>{p.pedido.tipo_sofa}{p.pedido.cantidad > 1 ? ` × ${p.pedido.cantidad}` : ''} · necesita {cup(p.cupos)} cupo{p.cupos === 1 ? '' : 's'}</div>
              <div className='text-sm text-gray-600'>Prometido al cliente: <b className='capitalize'>{f(p.prometida)}</b></div>
            </div>
            <button className='text-gray-500 text-2xl leading-none px-2' onClick={cerrar} aria-label='Cerrar'>×</button>
          </div>
          {p.fijo && <button className='btn w-full mt-3' onClick={automatico} disabled={guardando}>Volver a programación automática</button>}
        </div>
        <div className='overflow-y-auto p-2'>
          {opciones.map(({ d, libre }) => {
            const alcanza = libre + 1e-9 >= p.cupos
            const actual = d === p.dia_inicio
            const entrega = sumarHabiles(sumarHabiles(d, 1), p.entrega_min === p.entrega_max ? 1 : 5)
            const aTiempo = !p.prometida || entrega <= p.prometida
            return (
              <button key={d} disabled={guardando || actual} onClick={() => (alcanza || confirm('Ese día no tiene cupo suficiente. ¿Programarlo igual?')) && elegir(d)}
                className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg ${actual ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}>
                <div>
                  <div className='font-medium capitalize'>{f(d)}{actual ? ' (actual)' : ''}</div>
                  <div className={`text-xs ${actual ? 'text-gray-300' : aTiempo ? 'text-green-700' : 'text-red-600'}`}>Entrega {f(entrega)} {aTiempo ? '✓' : '· se pasa'}</div>
                </div>
                <span className={`text-xs font-semibold ${actual ? '' : alcanza ? 'text-green-700' : 'text-gray-400'}`}>{libre > 0 ? `${cup(libre)} libre${libre === 1 ? '' : 's'}` : 'Lleno'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
