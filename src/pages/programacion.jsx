import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { marcarEntregado } from '@/lib/entregar'
import { cargarYPlanificar, capacidad, sumarDias, sumarHabiles, hoyColombia, esHabil, FESTIVOS, primerCupoLibre, primerDiaPlan, esBogota } from '@/lib/planificador'

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
  const [ajustando, setAjustando] = useState(false)

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
  const hoyP = hoyColombia()
  const diasLlenos = Object.entries(usados).filter(([d, u]) => d >= hoyP && u > capacidad(d) + 1e-9).length
  const libre1 = primerCupoLibre(usados, 1)
  // Pedidos en cola cuya fabricación queda después de lo que exige la fecha prometida al cliente
  const atras = (iso, n) => { let x = iso, k = 0; while (k < n) { x = sumarDias(x, -1); if (esHabil(x)) k++ } return x }
  const primerDia = primerDiaPlan(hoyColombia())
  const diaNecesario = p => atras(p.prometida, 1)
  const tardeCola = cola.filter(p => p.prometida && p.estado === 'tarde')
  const porAjustar = tardeCola.filter(p => diaNecesario(p) >= primerDia)
  const imposibles = tardeCola.filter(p => diaNecesario(p) < primerDia)
  const fijos = cola.filter(p => p.fijo)
  async function ajustarATodas() {
    const dias = {}
    porAjustar.forEach(p => { const d = diaNecesario(p); dias[d] = (dias[d] || 0) + p.cupos })
    const pesados = Object.entries(dias).filter(([d, c]) => c + (usados[d] || 0) > capacidad(d)).length
    if (!confirm(`Se van a fijar ${porAjustar.length} pedidos en el día que necesitan para cumplir la fecha prometida al cliente.\n\nOjo: ${pesados} días quedarían con más sofás de los que caben (3 por día). En el calendario los verás en rojo con cuántos hay que sacar.\n\n¿Continuar?`)) return
    setAjustando(true)
    for (const p of porAjustar) await supabase.from('programacion_produccion').update({ fijo: true, dia_produccion: diaNecesario(p) }).eq('id', p.id)
    setAjustando(false); setDatos(null); await cargar()
  }
  async function todoAutomatico() {
    if (!confirm(`¿Volver los ${fijos.length} pedidos fijos 📌 a la programación automática por cupos?`)) return
    setAjustando(true)
    for (const p of fijos) await supabase.from('programacion_produccion').update({ fijo: false }).eq('id', p.id)
    setAjustando(false); setDatos(null); await cargar()
  }

  return (
    <div className={`p-4 mx-auto ${tab === 'mes' ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <h1 className='text-xl font-medium'>Programación</h1>
      <p className='text-sm text-gray-500 mb-4'>3 cupos por día (sábado 2) · cada pedido se fabrica 1 día hábil antes de la fecha prometida al cliente</p>

      <div className='grid grid-cols-3 gap-2 mb-4'>
        <Resumen n={cola.length} t='En cola' />
        <Resumen n={tarde} t='Se pasan' color={tarde ? 'text-red-600' : ''} />
        <Resumen n={diasLlenos} t='Días pasados de cupo' color={diasLlenos ? 'text-red-600' : ''} />
      </div>
      <div className='card mb-4 text-sm'>
        <div className='flex justify-between gap-2'><span className='text-gray-600'>Primer cupo libre para un sofá</span><b className='capitalize'>{f(libre1)}</b></div>
        <div className='flex justify-between gap-2 mt-1'><span className='text-gray-600'>Entrega más pronta (Bogotá)</span><b className='capitalize'>{f(sumarHabiles(libre1, 1))}</b></div>
        <div className='flex justify-between gap-2 mt-1'><span className='text-gray-600'>Entrega más pronta (fuera de Bogotá)</span><b className='capitalize'>{f(sumarHabiles(libre1, 5))}</b></div>
      </div>

      {tardeCola.length > 0 && (
        <div className='card mb-4 border-red-300 bg-red-50 text-sm space-y-2'>
          <p className='text-red-800'><b>{tardeCola.length} pedidos</b> no alcanzan a despacharse en la fecha que se le dio al cliente.</p>
          {porAjustar.length > 0 && <>
            <button className='btn w-full' disabled={ajustando} onClick={ajustarATodas}>{ajustando ? 'Ajustando…' : `📌 Fabricar ${porAjustar.length} según la fecha prometida al cliente`}</button>
            <p className='text-xs text-red-700'>Pone cada pedido en el día que necesita para cumplirle al cliente. Los días que se pasen de cupo quedan en rojo (ej. 5/3) para que sepas cuántos sofás extra hay que sacar ese día.</p>
          </>}
          {imposibles.length > 0 && <p className='text-xs text-red-800'><b>{imposibles.length} ya no alcanzan</b> aunque se fabriquen hoy: {imposibles.map(p => p.pedido.numero).join(', ')}. A esos hay que darles una fecha nueva desde <a href='/atencion' className='underline font-semibold'>Atención al cliente</a>.</p>}
        </div>
      )}
      {fijos.length > 0 && <button className='text-xs underline text-gray-500 mb-3' disabled={ajustando} onClick={todoAutomatico}>Volver los {fijos.length} pedidos fijos 📌 a programación automática</button>}

      <div className='flex gap-2 mb-4'>
        {[['pedidos', 'Pedidos'], ['mes', '🗓️ Mes'], ['calendario', 'Días'], ['recaudo', '💰 Recaudo']].map(([k, l]) => (
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
      ) : tab === 'mes' ? <Mes plan={plan} usados={usados} onReprog={setReprog} onMover={async (p, d) => {
          await supabase.from('programacion_produccion').update({ fijo: true, dia_produccion: d }).eq('id', p.id)
          await cargar()
        }} />
        : tab === 'calendario' ? <Calendario plan={plan} usados={usados} onReprog={setReprog} />
        : <Recaudo plan={plan} />}

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
      <button type='button' className='text-xs text-gray-500 underline' onClick={async () => { if (await marcarEntregado([p.pedido])) recargar() }}>✓ Ya se entregó</button>
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
/* Vista de mes tipo hoja: semanas en filas, días en columnas, cliente por cupo.
   Días pasados: lo que se fabricó (dia_produccion guardado). Hoy en adelante: el plan. */
const COLOR_ETAPA = {
  cola: 'bg-white border-gray-200 text-gray-800',
  fabrica: 'bg-amber-100 border-amber-300 text-amber-900',
  terminado: 'bg-green-100 border-green-300 text-green-900',
  entregado: 'bg-sky-100 border-sky-300 text-sky-900',
}
function grupoEtapa(et, estadoPedido) {
  if (estadoPedido === 'entregado' || et === 'completado') return 'entregado'
  if (et === 'cola') return 'cola'
  if (et === 'terminado' || et === 'despacho') return 'terminado'
  return 'fabrica'
}
function corto(nombre) { const w = String(nombre || 'Sin cliente').trim().split(/\s+/); return w.slice(0, 2).join(' ') }

function Mes({ plan, usados, onReprog, onMover }) {
  const hoy = hoyColombia()
  const primerDia = primerDiaPlan(hoy)
  // Arrastrar con el dedo o el mouse: mantener presionado un pedido en cola y soltarlo en otro día
  const [drag, setDrag] = useState(null) // { it, x, y, sobre }
  const [moviendo, setMoviendo] = useState(null)
  const timer = useRef(null)
  const inicio0 = useRef(null)
  const recienArrastrado = useRef(false)
  const dragRef = useRef(null)
  dragRef.current = drag

  useEffect(() => {
    // Mientras se arrastra, el dedo no debe mover la pantalla
    const bloquear = e => { if (dragRef.current) e.preventDefault() }
    document.addEventListener('touchmove', bloquear, { passive: false })
    return () => document.removeEventListener('touchmove', bloquear)
  }, [])

  const diaEn = (x, y) => document.elementFromPoint(x, y)?.closest('[data-dia]')?.getAttribute('data-dia') || null
  const sePuede = d => d && d >= primerDia && capacidad(d) > 0

  function presionar(e, it) {
    if (!it.p || it.p.etapa_actual !== 'cola' || moviendo) return
    const { clientX: x, clientY: y } = e
    inicio0.current = { x, y }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { setDrag({ it, x, y, sobre: null }); if (navigator.vibrate) navigator.vibrate(30) }, e.pointerType === 'mouse' ? 120 : 350)
  }
  function moverPuntero(e) {
    if (!drag) {
      const o = inicio0.current
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) { clearTimeout(timer.current); inicio0.current = null }
      return
    }
    setDrag(d => ({ ...d, x: e.clientX, y: e.clientY, sobre: diaEn(e.clientX, e.clientY) }))
  }
  async function soltar(e) {
    clearTimeout(timer.current); inicio0.current = null
    if (!drag) return
    const d = diaEn(e.clientX, e.clientY)
    const { it } = drag
    setDrag(null)
    recienArrastrado.current = true
    setTimeout(() => { recienArrastrado.current = false }, 400)
    const p = it.p
    if (!d || d === p.dia_inicio) return
    if (!sePuede(d)) { alert(d < primerDia ? 'No se puede programar en un día que ya pasó.' : 'Ese día no se trabaja.'); return }
    const mio = d >= p.dia_inicio && d <= p.dia_fin ? p.cupos : 0
    const libre = capacidad(d) - (usados[d] || 0) + mio
    if (libre + 1e-9 < p.cupos && !confirm(`El ${f(d)} ya está lleno. ¿Programar ${p.pedido.numero} igual?`)) return
    setMoviendo(p.id)
    await onMover(p, d)
    setMoviendo(null)
  }
  function cancelar() { clearTimeout(timer.current); inicio0.current = null; setDrag(null) }
  const [ancla, setAncla] = useState(hoy.slice(0, 7))
  const [historia, setHistoria] = useState([])
  const [y, m] = ancla.split('-').map(Number)
  const primero = `${ancla}-01`
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  useEffect(() => {
    supabase.from('programacion_produccion')
      .select('id, etapa_actual, dia_produccion, pedido:pedidos(numero, tipo_sofa, estado, cliente:clientes(nombre))')
      .gte('dia_produccion', primero).lte('dia_produccion', ultimo)
      .then(({ data }) => setHistoria((data || []).filter(r => r.pedido && r.pedido.estado !== 'cancelado')))
  }, [ancla])

  function delDia(d) {
    if (d >= hoy) {
      return plan.filter(p => p.etapa_actual === 'cola' ? (p.dia_inicio <= d && p.dia_fin >= d) : p.dia_inicio === d)
        .map(p => ({ id: p.id, p, nombre: p.pedido.cliente?.nombre, modelo: p.pedido.tipo_sofa, numero: p.pedido.numero, g: grupoEtapa(p.etapa_actual, p.pedido.estado), tarde: p.estado === 'tarde', fijo: p.fijo, prometida: p.prometida }))
    }
    return historia.filter(r => r.dia_produccion === d)
      .map(r => ({ id: r.id, nombre: r.pedido.cliente?.nombre, modelo: r.pedido.tipo_sofa, numero: r.pedido.numero, g: grupoEtapa(r.etapa_actual, r.pedido.estado) }))
  }

  // semanas de domingo a sábado que cubren el mes
  const inicio = sumarDias(primero, -new Date(primero + 'T12:00:00Z').getUTCDay())
  const semanas = []
  for (let d = inicio; d <= ultimo; d = sumarDias(d, 7)) semanas.push([0, 1, 2, 3, 4, 5, 6].map(k => sumarDias(d, k)))
  const mover = n => { const t = new Date(Date.UTC(y, m - 1 + n, 1)); setAncla(t.toISOString().slice(0, 7)) }

  return (
    <div onPointerMove={moverPuntero} onPointerUp={soltar} onPointerCancel={cancelar} onPointerLeave={e => e.pointerType === 'mouse' && cancelar()}>
      {drag && (
        <div className='fixed z-50 pointer-events-none px-2 py-1 rounded-lg shadow-lg bg-gray-900 text-white text-xs font-semibold'
          style={{ left: drag.x + 12, top: drag.y - 34 }}>
          {drag.it.numero} · {corto(drag.it.nombre)}{drag.sobre ? ` → ${f(drag.sobre)}` : ''}
        </div>
      )}
      <div className='flex items-center justify-between mb-3'>
        <button className='btn text-sm' onClick={() => mover(-1)}>‹ Anterior</button>
        <div className='font-semibold uppercase tracking-wide'>{MESES_L[m - 1]} {y}</div>
        <button className='btn text-sm' onClick={() => mover(1)}>Siguiente ›</button>
      </div>
      <div className='flex flex-wrap gap-3 text-xs text-gray-600 mb-3'>
        <span className='flex items-center gap-1'><i className='inline-block w-3 h-3 rounded border bg-white border-gray-300' /> En cola</span>
        <span className='flex items-center gap-1'><i className='inline-block w-3 h-3 rounded border bg-amber-100 border-amber-300' /> En fábrica</span>
        <span className='flex items-center gap-1'><i className='inline-block w-3 h-3 rounded border bg-green-100 border-green-300' /> Terminado</span>
        <span className='flex items-center gap-1'><i className='inline-block w-3 h-3 rounded border bg-sky-100 border-sky-300' /> Entregado</span>
        <span className='flex items-center gap-1'><i className='inline-block w-3 h-3 rounded border-2 border-red-500' /> Se pasa de la fecha prometida</span>
        <span className='flex items-center gap-1'><b className='text-red-600'>4/3</b> día con más sofás de los que caben</span>
      </div>
      <div className='overflow-x-auto rounded-lg border border-gray-300'>
        <table className='w-full min-w-[760px] border-collapse table-fixed text-xs'>
          <thead>
            <tr className='bg-gray-800 text-white'>
              {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(n => <th key={n} className='py-1.5 font-semibold uppercase tracking-wide'>{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {semanas.map(sem => (
              <tr key={sem[0]}>
                {sem.map(d => {
                  const fuera = d < primero || d > ultimo
                  const cap = capacidad(d)
                  const items = fuera ? [] : delDia(d)
                  return (
                    <td key={d} data-dia={fuera ? undefined : d} className={`align-top border border-gray-300 p-1 h-24 ${drag && drag.sobre === d ? (sePuede(d) ? 'bg-purple-100' : 'bg-red-50') : fuera || cap === 0 ? 'bg-gray-100' : 'bg-white'} ${d === hoy ? 'ring-2 ring-inset ring-gray-900' : ''}`}>
                      <div className={`text-right text-[10px] mb-0.5 ${fuera ? 'text-gray-300' : 'text-gray-500'}`}>
                        {!fuera && d >= hoy && cap > 0 && (usados[d] || 0) > 0 && <span className={`float-left font-semibold ${(usados[d] || 0) > cap + 1e-9 ? 'text-red-600' : 'text-gray-400'}`}>{Math.round((usados[d] || 0) * 100) / 100}/{cap}</span>}
                        {FESTIVOS.has(d) && !fuera ? 'Festivo · ' : ''}{Number(d.slice(8))}
                      </div>
                      <div className='space-y-0.5'>
                        {items.map(it => (
                          <button key={it.id} type='button' title={`${it.numero} · ${it.modelo}`}
                            onClick={() => !recienArrastrado.current && it.p && it.p.etapa_actual === 'cola' && onReprog(it.p)}
                            onPointerDown={e => presionar(e, it)}
                            onContextMenu={e => e.preventDefault()}
                            style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: drag ? 'none' : 'auto' }}
                            className={`block w-full text-left truncate px-1 py-0.5 rounded border ${COLOR_ETAPA[it.g]} ${it.tarde ? 'border-2 border-red-500' : ''} ${drag && drag.it.id === it.id ? 'opacity-30' : ''} ${moviendo === it.id ? 'animate-pulse' : ''} ${it.p && it.p.etapa_actual === 'cola' ? 'cursor-grab' : ''}`}>
                            {corto(it.nombre)}{it.fijo ? ' 📌' : ''}
                            {it.prometida && <span className={`block text-[10px] leading-tight ${it.tarde ? 'text-red-700 font-semibold' : 'opacity-70'}`}>entrega {Number(it.prometida.slice(8))}/{Number(it.prometida.slice(5, 7))}</span>}
                          </button>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='text-xs text-gray-500 mt-2'>✋ <b>Para mover un pedido:</b> mantenlo presionado un momento y arrástralo con el dedo (o el mouse) al día que quieras. Queda fijo 📌 en ese día. También puedes tocarlo para ver los días con cupo.</p>
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
            const entrega = sumarHabiles(d, 1)
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

/* ---------------- Recaudo: saldos por cobrar el día de la entrega ---------------- */

const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')

function Recaudo({ plan }) {
  const hoy = hoyColombia()
  const [abierto, setAbierto] = useState(null)
  // Se cobra el día de entrega: la fecha prometida, o la real si se pasa de la prometida
  const cobros = plan
    .map(p => {
      const saldo = Number(p.pedido.precio_venta || 0) - Number(p.pedido.abono || 0)
      const dia = !p.prometida ? p.entrega_max : p.entrega_max > p.prometida ? p.entrega_max : p.prometida
      return { p, saldo, dia }
    })
    .filter(x => x.saldo > 0)
  const atrasados = cobros.filter(x => x.dia < hoy)
  const futuros = cobros.filter(x => x.dia >= hoy)
  const total = cobros.reduce((s, x) => s + x.saldo, 0)
  const enDias = n => futuros.filter(x => x.dia <= sumarDias(hoy, n)).reduce((s, x) => s + x.saldo, 0)

  const porDia = {}
  futuros.forEach(x => { (porDia[x.dia] = porDia[x.dia] || []).push(x) })
  const dias = Object.keys(porDia).sort()

  // Por semana (lunes a domingo)
  const lunes = d => sumarDias(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7))
  const porSemana = {}
  futuros.forEach(x => { const l = lunes(x.dia); porSemana[l] = (porSemana[l] || 0) + x.saldo })

  if (!cobros.length) return <div className='card text-center text-gray-500 py-8'>No hay saldos pendientes por cobrar.</div>

  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-3 gap-2'>
        <div className='card text-center py-3'><div className='text-lg font-semibold'>{pesos(enDias(7))}</div><div className='text-xs text-gray-500'>Próx. 7 días</div></div>
        <div className='card text-center py-3'><div className='text-lg font-semibold'>{pesos(enDias(30))}</div><div className='text-xs text-gray-500'>Próx. 30 días</div></div>
        <div className='card text-center py-3'><div className='text-lg font-semibold'>{pesos(total)}</div><div className='text-xs text-gray-500'>Total por cobrar</div></div>
      </div>
      <p className='text-xs text-gray-500'>Saldo = precio − abono. Se cobra el día de entrega: la fecha prometida, o la real si se pasa.</p>

      {atrasados.length > 0 && (
        <div className='card border-red-300'>
          <div className='flex justify-between font-semibold text-red-700'><span>Entrega ya pasó · por cobrar</span><span>{pesos(atrasados.reduce((s, x) => s + x.saldo, 0))}</span></div>
          {atrasados.map(x => <FilaCobro key={x.p.id} x={x} />)}
        </div>
      )}

      {Object.keys(porSemana).length > 1 && (
        <div className='card'>
          <div className='font-semibold mb-1'>Por semana</div>
          {Object.keys(porSemana).sort().map(l => (
            <div key={l} className='flex justify-between text-sm py-1 border-t border-gray-100 first:border-0'>
              <span className='capitalize'>Semana del {f(l)}</span><b>{pesos(porSemana[l])}</b>
            </div>
          ))}
        </div>
      )}

      {dias.map(d => {
        const lista = porDia[d]
        const t = lista.reduce((s, x) => s + x.saldo, 0)
        return (
          <div key={d} className='card p-0 overflow-hidden'>
            <button className='w-full p-3 flex justify-between items-center gap-2 text-left' onClick={() => setAbierto(abierto === d ? null : d)} aria-expanded={abierto === d}>
              <div>
                <div className='font-semibold capitalize'>{d === hoy ? 'Hoy · ' : ''}{f(d)}</div>
                <div className='text-xs text-gray-500'>{lista.length} entrega{lista.length > 1 ? 's' : ''}</div>
              </div>
              <div className='text-lg font-semibold text-green-700'>{pesos(t)}</div>
            </button>
            {abierto === d && <div className='border-t border-gray-100 px-3 pb-2'>{lista.map(x => <FilaCobro key={x.p.id} x={x} />)}</div>}
          </div>
        )
      })}
    </div>
  )
}

function FilaCobro({ x }) {
  const { p, saldo } = x
  return (
    <div className='flex justify-between gap-2 text-sm py-2 border-t border-gray-100 first:border-0'>
      <div className='min-w-0'>
        <div className='font-medium'>{p.pedido.numero} · {p.pedido.cliente?.nombre || 'Sin cliente'}</div>
        <div className='text-xs text-gray-500'>{p.pedido.tipo_sofa} · total {pesos(p.pedido.precio_venta)} · abonó {pesos(p.pedido.abono)}</div>
      </div>
      <b className='whitespace-nowrap'>{pesos(saldo)}</b>
    </div>
  )
}
