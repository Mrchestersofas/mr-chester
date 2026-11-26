import { useState } from 'react'
import { CARAMELO, pesos, colorNuez, Modal } from '@/lib/nuts'

/* Compras: entrada de nuez cruda (caja, bolsa o por kilo) con su precio. Suma al inventario de crudo,
   que después se descuenta al armar los batches. Abajo, el historial de compras. */

const fecha = iso => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })

export default function NutsCompras({ datos, rpc }) {
  const nueces = datos.nueces.filter(n => n.activo)
  const nombreNuez = id => datos.nueces.find(n => n.id === id)?.nombre || 'Nuez'
  const [nuez, setNuez] = useState(null)
  return (
    <div className='space-y-5'>
      <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {nueces.map(n => (
          <button key={n.id} onClick={() => setNuez(n)} className='bg-white rounded-2xl overflow-hidden shadow-sm text-left' style={{ border: '1px solid #E7D9C6' }}>
            <div style={{ background: colorNuez(n.nombre), height: 10 }} />
            <div className='p-3 space-y-1'>
              <div className='font-bold text-lg'>{n.nombre}</div>
              <div className='text-xs text-gray-500'>{n.nota_compra || `Caja de ${n.caja_kg} kg`}</div>
              <div className='text-sm'>Hay <b>{(Number(datos.crudo[n.id] || 0) / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg</b> crudo</div>
              <div className='text-sm font-semibold pt-1' style={{ color: CARAMELO }}>+ Registrar compra</div>
            </div>
          </button>
        ))}
      </div>

      <section className='bg-white rounded-2xl p-4 shadow-sm'>
        <h2 className='font-bold text-lg mb-2'>Últimas compras</h2>
        {datos.compras.length === 0 ? <p className='text-sm text-gray-500'>Todavía no hay compras registradas.</p> : datos.compras.map((c, i) => (
          <div key={i} className='flex justify-between gap-3 border-b py-2 text-sm'>
            <div><b>{nombreNuez(c.nuez_id)}</b> · {(c.gramos / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg<div className='text-xs text-gray-500'>{c.usuario} · {fecha(c.fecha)}</div></div>
            <b className='whitespace-nowrap'>{c.precio ? pesos(c.precio) : '—'}</b>
          </div>
        ))}
      </section>
      {nuez && <Compra n={nuez} rpc={rpc} cerrar={() => setNuez(null)} />}
    </div>
  )
}

function Compra({ n, rpc, cerrar }) {
  const [kg, setKg] = useState(String(n.caja_kg))
  const [precio, setPrecio] = useState(n.precio_compra ? String(n.precio_compra) : '')
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  async function guardar() {
    setOcupado(true); setErr(null)
    try { await rpc('nuts_compra', { p_nuez: n.id, p_kg: Number(kg), p_precio: precio ? Number(precio) : null }); setOk(true) } catch (e) { setErr(e.message) }
    setOcupado(false)
  }
  return (
    <Modal titulo={`Compra de ${n.nombre}`} cerrar={cerrar}>
      {ok ? <>
        <p className='rounded-xl p-3 font-semibold' style={{ background: '#EAF5EE', color: '#1F6B3F' }}>✓ Entraron {kg} kg de {n.nombre} crudo{precio ? ' por ' + pesos(precio) : ''}.</p>
        <button onClick={cerrar} className='w-full rounded-xl py-3 font-bold text-white' style={{ background: CARAMELO }}>Listo</button>
      </> : <>
        {n.proveedor && <p className='text-sm text-gray-600'>{n.proveedor}</p>}
        <label className='block text-sm font-semibold'>Kilos que llegaron<input type='number' inputMode='decimal' min='0' value={kg} onChange={e => setKg(e.target.value)} className='w-full mt-1' style={{ fontSize: 18, padding: 10 }} /></label>
        <label className='block text-sm font-semibold'>Precio pagado<input type='number' inputMode='numeric' min='0' value={precio} onChange={e => setPrecio(e.target.value)} className='w-full mt-1' style={{ fontSize: 18, padding: 10 }} /></label>
        {err && <p className='text-sm' style={{ color: '#9B1C1C' }}>{err}</p>}
        <button disabled={ocupado || !(Number(kg) > 0)} onClick={guardar} className='w-full rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>Registrar compra</button>
      </>}
    </Modal>
  )
}
