import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { etiqueta } from '@/lib/etapas'

/* 📦 Recibir (taller): cada encargado confirma la materia prima que le llegó.
   Lo que se pidió en Compras aparece "por recibir" en la sección que lo usa.
   Si llegó otra cantidad se anota; si llegó algo que no estaba en la lista, se registra aparte. */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const num = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })
const fecha = iso => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}` }
const cuando = ts => { const d = new Date(new Date(ts).getTime() - 5 * 3600e3); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} · ${d.toISOString().slice(11, 16)}` }

export default function Recibir({ cred, jefe }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [libre, setLibre] = useState(false)

  async function cargar() {
    const { data, error: e } = await supabase.rpc('taller_recepcion_datos', { p_usuario: cred.u, p_clave: cred.k })
    if (e) { setError('No se pudo cargar: ' + e.message); return }
    setDatos(data); setError(null)
  }
  useEffect(() => { cargar() }, [])

  if (error) return <p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>{error}</p>
  if (!datos) return <p className='text-gray-500'>Cargando…</p>

  // Agrupar lo pendiente por pedido (proveedor + día)
  const grupos = {}
  datos.pendientes.forEach(x => { (grupos[x.pedido_id] = grupos[x.pedido_id] || { proveedor: x.proveedor, fecha: x.fecha, items: [] }).items.push(x) })

  return (
    <div className='space-y-5'>
      <section>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2'>📦 Por recibir ({datos.pendientes.length})</h2>
        {datos.pendientes.length === 0 && <p className='card text-center text-gray-500 py-6'>No hay nada pendiente por llegar a tu sección.</p>}
        <div className='space-y-3'>
          {Object.entries(grupos).map(([id, g]) => (
            <div key={id} className='card space-y-2'>
              <div className='flex justify-between gap-2 items-baseline'>
                <b className='text-base'>{g.proveedor}</b>
                <span className='text-xs text-gray-500'>pedido el {fecha(g.fecha)}</span>
              </div>
              {g.items.map(x => <Item key={x.item_idx} x={x} cred={cred} jefe={jefe} listo={cargar} />)}
            </div>
          ))}
        </div>
      </section>

      {libre
        ? <Libre cred={cred} cerrar={() => setLibre(false)} listo={() => { setLibre(false); cargar() }} />
        : <button className='btn w-full' onClick={() => setLibre(true)}>+ Me llegó algo que no está en la lista</button>}

      {datos.recibidos.length > 0 && (
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2'>✅ Recibido (últimos 7 días)</h2>
          <div className='space-y-2'>
            {datos.recibidos.map(r => {
              const distinto = r.cantidad_pedida != null && Number(r.cantidad_recibida) !== Number(r.cantidad_pedida)
              return (
                <div key={r.id} className={`rounded-lg border px-3 py-2 text-sm ${distinto ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                  <div className='flex justify-between gap-2'>
                    <span className='min-w-0'>✓ <b>{num(r.cantidad_recibida)} {r.unidad || ''}</b> · {r.nombre}</span>
                    <span className='text-xs text-gray-500 whitespace-nowrap'>{cuando(r.created_at)}</span>
                  </div>
                  <div className='text-xs text-gray-600 mt-0.5'>
                    {r.proveedor || 'Sin pedido en el sistema'} · recibió {String(r.recibido_por || '').split(' ')[0]}
                    {jefe && r.seccion ? ` · ${etiqueta(r.seccion)}` : ''}
                    {distinto && <b className='text-amber-700'> · pedimos {num(r.cantidad_pedida)}</b>}
                  </div>
                  {r.nota && <div className='text-xs text-gray-700 mt-0.5'>📝 {r.nota}</div>}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function Item({ x, cred, jefe, listo }) {
  const [otra, setOtra] = useState(false)
  const [cant, setCant] = useState(String(x.cantidad ?? ''))
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function recibir(cantidad) {
    setOcupado(true)
    const { error } = await supabase.rpc('taller_recibir', { p_usuario: cred.u, p_clave: cred.k, p_pedido: x.pedido_id, p_idx: x.item_idx, p_cantidad: cantidad, p_nota: nota || null })
    setOcupado(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    listo()
  }

  return (
    <div className='rounded-lg border border-gray-200 p-2'>
      <div className='flex justify-between gap-2'>
        <div className='min-w-0'>
          <div className='font-semibold'>{x.nombre}</div>
          <div className='text-sm text-gray-600'>Pedimos <b>{num(x.cantidad)} {x.unidad || ''}</b>{x.para_dia ? ` · para ${fecha(x.para_dia)}` : ''}</div>
          {jefe && <div className='text-xs text-gray-400'>{x.seccion ? etiqueta(x.seccion) : 'Sin sección asignada'}</div>}
        </div>
      </div>
      {!otra ? (
        <div className='grid grid-cols-2 gap-2 mt-2'>
          <button className='rounded-xl py-2.5 font-bold text-white bg-green-700 disabled:opacity-50' disabled={ocupado} onClick={() => recibir(Number(x.cantidad))}>{ocupado ? 'Guardando…' : '✓ Llegó completo'}</button>
          <button className='rounded-xl py-2.5 font-semibold border border-gray-300 bg-white' onClick={() => setOtra(true)}>Llegó otra cantidad</button>
        </div>
      ) : (
        <div className='mt-2 space-y-2'>
          <div className='grid grid-cols-2 gap-2'>
            <div><label className='text-xs text-gray-500 block mb-1'>¿Cuánto llegó? ({x.unidad || 'cantidad'})</label><input inputMode='decimal' value={cant} onChange={e => setCant(e.target.value.replace(/[^\d.,]/g, ''))} /></div>
            <div><label className='text-xs text-gray-500 block mb-1'>Nota (opcional)</label><input value={nota} onChange={e => setNota(e.target.value)} placeholder='Ej: llegó dañada' /></div>
          </div>
          <div className='flex gap-2'>
            <button className='flex-1 rounded-xl py-2.5 font-bold text-white bg-green-700 disabled:opacity-50' disabled={ocupado || cant === ''} onClick={() => recibir(Number(cant.replace(',', '.')))}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
            <button className='btn' onClick={() => setOtra(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Libre({ cred, cerrar, listo }) {
  const [f, setF] = useState({ nombre: '', cantidad: '', unidad: '', nota: '' })
  const [ocupado, setOcupado] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase.rpc('taller_recibir_libre', { p_usuario: cred.u, p_clave: cred.k, p_nombre: f.nombre, p_cantidad: Number(f.cantidad.replace(',', '.')), p_unidad: f.unidad || null, p_nota: f.nota || null })
    setOcupado(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    listo()
  }
  return (
    <form className='card space-y-2' onSubmit={guardar}>
      <b>¿Qué te llegó?</b>
      <div><label className='text-xs text-gray-500 block mb-1'>Material</label><input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder='Ej: Colbón' /></div>
      <div className='grid grid-cols-2 gap-2'>
        <div><label className='text-xs text-gray-500 block mb-1'>Cantidad</label><input inputMode='decimal' value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value.replace(/[^\d.,]/g, '') })} /></div>
        <div><label className='text-xs text-gray-500 block mb-1'>Unidad</label><input value={f.unidad} onChange={e => setF({ ...f, unidad: e.target.value })} placeholder='galón, rollo…' /></div>
      </div>
      <div><label className='text-xs text-gray-500 block mb-1'>Nota (opcional)</label><input value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} placeholder='Quién lo trajo, estado…' /></div>
      <div className='flex gap-2'>
        <button className='flex-1 rounded-xl py-2.5 font-bold text-white bg-green-700 disabled:opacity-50' disabled={ocupado || !f.nombre.trim() || !f.cantidad}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        <button type='button' className='btn' onClick={cerrar}>Cancelar</button>
      </div>
    </form>
  )
}
