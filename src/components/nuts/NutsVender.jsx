import { useState } from 'react'
import { CARAMELO, pesos, gramos, colorNuez, tipoEmpaque, Empaque } from '@/lib/nuts'

/* POS de la tienda: se toca el producto, se cobra, y el sistema descuenta los gramos de los lotes (bandejas)
   abiertos de cada nuez, del más viejo al más nuevo. Si el producto ya estaba armado (stock), sale de ahí.
   También: prueba (degustación), armar para tener listo y cerrar lote (lo que quedó en la bandeja). */

const MEDIOS = ['Efectivo', 'Datáfono', 'Transferencia', 'Rappi']

export default function NutsVender({ datos, rpc }) {
  const nombreNuez = id => datos.nueces.find(n => n.id === id)?.nombre || 'Nuez'
  const productos = datos.productos.filter(p => p.activo)
  const [carrito, setCarrito] = useState({})
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [lote, setLote] = useState(null)
  const [armar, setArmar] = useState(false)

  const items = Object.entries(carrito).map(([id, cant]) => ({ p: productos.find(x => x.id === id), cant })).filter(x => x.p)
  const total = items.reduce((a, x) => a + x.p.precio * x.cant, 0)
  const sumar = (id, d) => setCarrito(c => { const n = (c[id] || 0) + d; const o = { ...c }; if (n > 0) o[id] = n; else delete o[id]; return o })

  async function cobrar(medio) {
    setOcupado(true); setAviso(null)
    try {
      await rpc('nuts_vender', { p_items: items.map(x => ({ id: x.p.id, cant: x.cant })), p_medio: medio })
      setCarrito({}); setAviso({ ok: true, t: `✓ Venta de ${pesos(total)} registrada (${medio})` })
    } catch (e) { setAviso({ ok: false, t: e.message }) }
    setOcupado(false)
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-2 gap-3'>
        <Cifra n={pesos(datos.hoy.total)} t='Vendido hoy' />
        <Cifra n={datos.hoy.ventas} t='Ventas hoy' />
      </div>

      <section>
        <h2 className='font-bold mb-2'>Bandejas abiertas</h2>
        {datos.lotes.length === 0 && <p className='bg-white rounded-xl p-4 text-sm text-gray-600'>No hay lotes abiertos. Producción tiene que registrar el caramelizado para poder vender.</p>}
        <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {datos.lotes.map(l => {
            const pct = Math.max(0, Math.min(100, l.restante / l.salida * 100)), c = colorNuez(nombreNuez(l.nuez_id))
            return (
              <button key={l.id} onClick={() => setLote(l)} className='bg-white rounded-2xl p-3 text-left shadow-sm flex items-center gap-3' style={{ border: '1px solid #E7D9C6' }}>
                <div className='relative flex-none rounded-full' style={{ width: 54, height: 54, background: `conic-gradient(${c} ${pct}%, #EFE6DA 0)` }}>
                  <div className='absolute rounded-full bg-white flex items-center justify-center text-xs font-bold' style={{ inset: 7, color: CARAMELO }}>{Math.round(pct)}%</div>
                </div>
                <div className='min-w-0'>
                  <div className='font-bold leading-tight'>{nombreNuez(l.nuez_id)}</div>
                  <div className='text-xs text-gray-500'>{gramos(l.restante)}</div>
                  <div className='text-[11px] text-gray-400'>{l.codigo}</div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className='font-bold mb-2'>Productos</h2>
        {productos.length === 0 && <p className='bg-white rounded-xl p-4 text-sm text-gray-600'>Todavía no hay productos. El administrador los crea en "Resumen y ajustes".</p>}
        <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {productos.map(p => {
            const nueces = Object.keys(p.receta || {}).map(nombreNuez)
            const fondo = nueces.length > 1 ? `linear-gradient(135deg, ${nueces.map(colorNuez).join(', ')})` : nueces.length ? colorNuez(nueces[0]) : '#CFE3C9'
            const [titulo, pres] = p.nombre.split(' · ')
            return (
              <button key={p.id} onClick={() => sumar(p.id, 1)} className='bg-white rounded-2xl overflow-hidden text-left shadow-sm relative flex flex-col' style={{ border: carrito[p.id] ? `3px solid ${CARAMELO}` : '1px solid #E7D9C6' }}>
                <div className='flex items-center justify-center' style={{ background: fondo, height: 74 }}><Empaque tipo={tipoEmpaque(p.nombre)} color={CARAMELO} size={46} /></div>
                <div className='p-2.5'>
                  <div className='font-bold leading-tight'>{titulo}</div>
                  {pres && <div className='text-xs text-gray-500'>{pres}</div>}
                  <div className='text-sm font-semibold mt-1' style={{ color: CARAMELO }}>{pesos(p.precio)}</div>
                  {p.stock > 0 && <div className='text-[11px]' style={{ color: '#2F7A4C' }}>{p.stock} listos</div>}
                </div>
                {carrito[p.id] > 0 && <span className='absolute top-2 right-2 rounded-full text-sm font-bold text-white w-7 h-7 flex items-center justify-center' style={{ background: CARAMELO }}>{carrito[p.id]}</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className='bg-white rounded-2xl p-4 shadow-sm space-y-3'>
        <h2 className='font-bold'>Venta actual</h2>
        {items.length === 0 ? <p className='text-sm text-gray-500'>Toca un producto para agregarlo.</p> : items.map(x => (
          <div key={x.p.id} className='flex items-center gap-2'>
            <div className='flex-1 min-w-0'><div className='font-medium truncate'>{x.p.nombre}</div><div className='text-xs text-gray-500'>{pesos(x.p.precio)} c/u</div></div>
            <button aria-label='Quitar uno' onClick={() => sumar(x.p.id, -1)} className='w-10 h-10 rounded-lg border text-lg'>−</button>
            <span className='w-6 text-center font-bold'>{x.cant}</span>
            <button aria-label='Agregar uno' onClick={() => sumar(x.p.id, 1)} className='w-10 h-10 rounded-lg border text-lg'>+</button>
          </div>
        ))}
        <div className='flex justify-between text-lg font-bold border-t pt-3'><span>Total</span><span>{pesos(total)}</span></div>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
          {MEDIOS.map(m => <button key={m} disabled={!items.length || ocupado} onClick={() => cobrar(m)} className='rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>{m}</button>)}
        </div>
        {aviso && <p className='text-sm rounded-lg p-2' style={{ background: aviso.ok ? '#EAF5EE' : '#FDECEC', color: aviso.ok ? '#1F6B3F' : '#9B1C1C' }}>{aviso.t}</p>}
      </section>

      <button onClick={() => setArmar(true)} className='w-full rounded-xl py-3 font-semibold bg-white shadow-sm' style={{ border: '1px solid #EADFCF' }}>🫙 Armar para tener listo (ej. tarros)</button>

      {lote && <Lote l={lote} nuez={nombreNuez(lote.nuez_id)} rpc={rpc} cerrar={() => setLote(null)} />}
      {armar && <Armar productos={productos} rpc={rpc} cerrar={() => setArmar(false)} />}
    </div>
  )
}

function Cifra({ n, t }) {
  return <div className='bg-white rounded-xl p-3 text-center shadow-sm'><div className='text-2xl font-bold' style={{ color: CARAMELO }}>{n}</div><div className='text-xs text-gray-500'>{t}</div></div>
}

export function Modal({ titulo, cerrar, children }) {
  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3' style={{ background: 'rgba(0,0,0,.45)' }} onClick={cerrar}>
      <div className='bg-white rounded-2xl p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto' onClick={e => e.stopPropagation()}>
        <div className='flex justify-between items-start gap-3'><h3 className='text-lg font-bold'>{titulo}</h3><button aria-label='Cerrar' onClick={cerrar} className='text-2xl leading-none text-gray-400'>×</button></div>
        {children}
      </div>
    </div>
  )
}

function Lote({ l, nuez, rpc, cerrar }) {
  const [real, setReal] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const salidas = Object.entries(l.salidas || {})
  async function hacer(fn, args, despues) {
    setOcupado(true); setErr(null)
    try { const r = await rpc(fn, args); despues && despues(r) } catch (e) { setErr(e.message) }
    setOcupado(false)
  }
  return (
    <Modal titulo={`${nuez} · lote ${l.codigo}`} cerrar={cerrar}>
      <div className='text-sm text-gray-600'>Salió de la máquina con {gramos(l.salida)}. Debería quedar <b>{gramos(l.restante)}</b>.</div>
      {salidas.length > 0 && <div className='text-sm bg-amber-50 rounded-lg p-2'>De este lote: {salidas.map(([k, n]) => `${Number(n)} ${k.toLowerCase()}`).join(' · ')}</div>}
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
