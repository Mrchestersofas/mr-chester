import { useState } from 'react'
import { CARAMELO, gramos, colorNuez, Modal } from '@/lib/nuts'

/* Bandejas: los lotes abiertos en la tienda. Desde aquí se registra una prueba (degustación),
   se arman unidades para tener listas (ej. tarros con lo que sobra) y se cierra el lote con lo que quedó. */

export default function NutsBandejas({ datos, rpc }) {
  const nombreNuez = id => datos.nueces.find(n => n.id === id)?.nombre || 'Nuez'
  const productos = datos.productos.filter(p => p.activo && Object.keys(p.receta || {}).length)
  const [lote, setLote] = useState(null)
  const [armar, setArmar] = useState(false)
  return (
    <div className='space-y-4'>
      {datos.lotes.length === 0 && <p className='bg-white rounded-2xl p-5 text-gray-600'>No hay bandejas abiertas. Producción tiene que registrar el caramelizado.</p>}
      <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {datos.lotes.map(l => {
          const pct = Math.max(0, Math.min(100, l.restante / l.salida * 100)), c = colorNuez(nombreNuez(l.nuez_id))
          const salidas = Object.entries(l.salidas || {})
          return (
            <button key={l.id} onClick={() => setLote(l)} className='bg-white rounded-2xl p-4 text-left shadow-sm space-y-3' style={{ border: '1px solid #E7D9C6' }}>
              <div className='flex items-center gap-3'>
                <div className='relative flex-none rounded-full' style={{ width: 64, height: 64, background: `conic-gradient(${c} ${pct}%, #EFE6DA 0)` }}>
                  <div className='absolute rounded-full bg-white flex items-center justify-center text-sm font-bold' style={{ inset: 8, color: CARAMELO }}>{Math.round(pct)}%</div>
                </div>
                <div className='min-w-0'>
                  <div className='text-lg font-bold leading-tight'>{nombreNuez(l.nuez_id)}</div>
                  <div className='text-sm text-gray-600'>Quedan {gramos(l.restante)}</div>
                  <div className='text-xs text-gray-400'>Lote {l.codigo}</div>
                </div>
              </div>
              {salidas.length > 0 && <div className='text-xs text-gray-600 rounded-lg p-2' style={{ background: '#FBF4EA' }}>{salidas.map(([k, n]) => `${Number(n)} ${k.toLowerCase()}`).join(' · ')}</div>}
            </button>
          )
        })}
      </div>
      <button onClick={() => setArmar(true)} disabled={!datos.lotes.length} className='w-full rounded-2xl py-4 font-semibold bg-white shadow-sm disabled:opacity-40' style={{ border: '1px solid #E7D9C6' }}>🫙 Armar para tener listo (ej. tarros)</button>
      {lote && <Lote l={lote} nuez={nombreNuez(lote.nuez_id)} rpc={rpc} cerrar={() => setLote(null)} />}
      {armar && <Armar productos={productos} rpc={rpc} cerrar={() => setArmar(false)} />}
    </div>
  )
}

function Lote({ l, nuez, rpc, cerrar }) {
  const [real, setReal] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  async function hacer(fn, args, despues) {
    setOcupado(true); setErr(null)
    try { const r = await rpc(fn, args); despues && despues(r) } catch (e) { setErr(e.message) }
    setOcupado(false)
  }
  return (
    <Modal titulo={`${nuez} · lote ${l.codigo}`} cerrar={cerrar}>
      <div className='text-sm text-gray-600'>Salió de la máquina con {gramos(l.salida)}. Debería quedar <b>{gramos(l.restante)}</b>.</div>
      {!res && <>
        <button disabled={ocupado} onClick={() => hacer('nuts_prueba', { p_lote: l.id, p_gramos: 10 }, cerrar)} className='w-full rounded-xl py-3 font-semibold border'>👆 Registrar prueba (10 g)</button>
        <div className='border-t pt-3 space-y-2'>
          <label htmlFor='nuts-real' className='block font-semibold'>Cerrar lote: ¿cuántos gramos quedaron en la bandeja?</label>
          <p className='text-xs text-gray-500'>Pésalo y escríbelo. Si la bandeja quedó vacía, escribe 0.</p>
          <input id='nuts-real' type='number' inputMode='numeric' min='0' value={real} onChange={e => setReal(e.target.value)} className='w-full' style={{ fontSize: 18, padding: 12 }} />
          <button disabled={ocupado || real === ''} onClick={() => hacer('nuts_cerrar_lote', { p_lote: l.id, p_real: Number(real) }, setRes)} className='w-full rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>Cerrar lote</button>
        </div>
      </>}
      {res && <Resultado r={res} />}
      {err && <p className='text-sm' style={{ color: '#9B1C1C' }}>{err}</p>}
    </Modal>
  )
}

export function Resultado({ r }) {
  const dif = Number(r.diferencia), pct = Number(r.pct)
  const [bg, fg, t] = dif <= 0 ? ['#EAF5EE', '#1F6B3F', dif < 0 ? `Cuadra. Sobraron ${gramos(-dif)}.` : 'Cuadra perfecto.']
    : pct <= 3 ? ['#FFF4E0', '#8A5300', `Diferencia pequeña: faltan ${gramos(dif)} (${pct}%).`]
    : ['#FDECEC', '#9B1C1C', `Faltan ${gramos(dif)} (${pct}% del lote). Queda registrado.`]
  return <div className='rounded-xl p-3' style={{ background: bg, color: fg }}><div className='font-bold'>{t}</div><div className='text-sm'>Debía quedar {gramos(r.esperado)} · quedó {gramos(r.real)}</div></div>
}

function Armar({ productos, rpc, cerrar }) {
  const [id, setId] = useState(productos[0]?.id || '')
  const [cant, setCant] = useState(1)
  const [err, setErr] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  async function guardar() {
    setOcupado(true); setErr(null)
    try { await rpc('nuts_armar', { p_producto: id, p_cantidad: Number(cant) }); cerrar() } catch (e) { setErr(e.message) }
    setOcupado(false)
  }
  return (
    <Modal titulo='Armar para tener listo' cerrar={cerrar}>
      <p className='text-sm text-gray-600'>Descuenta de las bandejas y quedan listos para vender (por ejemplo, tarros con lo que sobró).</p>
      <label className='block text-sm font-semibold'>Producto
        <select value={id} onChange={e => setId(e.target.value)} className='w-full mt-1' style={{ fontSize: 16, padding: 10 }}>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </label>
      <label className='block text-sm font-semibold'>Cantidad
        <input type='number' min='1' inputMode='numeric' value={cant} onChange={e => setCant(e.target.value)} className='w-full mt-1' style={{ fontSize: 16, padding: 10 }} />
      </label>
      {err && <p className='text-sm' style={{ color: '#9B1C1C' }}>{err}</p>}
      <button disabled={ocupado || !id || Number(cant) < 1} onClick={guardar} className='w-full rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>Armar</button>
    </Modal>
  )
}
