import { useState } from 'react'
import { CARAMELO, pesos, colorNuez, Modal } from '@/lib/nuts'

/* POS de la tienda: productos con foto, se tocan para agregarlos y se cobra con el medio de pago.
   Al cobrar, el sistema descuenta los gramos de las bandejas (lotes) de cada nuez, de la más vieja a la más nueva;
   si el producto ya estaba armado (unidades listas), sale de ahí. */

const MEDIOS = [['Efectivo', '💵'], ['Datáfono', '💳'], ['Transferencia', '📲'], ['Rappi', '🛵']]

export default function NutsVender({ datos, rpc }) {
  const nombreNuez = id => datos.nueces.find(n => n.id === id)?.nombre || ''
  const productos = datos.productos.filter(p => p.activo)
  const cats = ['Todos', ...Array.from(new Set(productos.map(p => p.categoria || 'Otros')))]
  const [cat, setCat] = useState('Todos')
  const [carrito, setCarrito] = useState({})
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(null)

  const items = Object.entries(carrito).map(([id, cant]) => ({ p: productos.find(x => x.id === id), cant })).filter(x => x.p)
  const total = items.reduce((a, x) => a + x.p.precio * x.cant, 0)
  const unidades = items.reduce((a, x) => a + x.cant, 0)
  const sumar = (id, d) => setCarrito(c => { const n = (c[id] || 0) + d; const o = { ...c }; if (n > 0) o[id] = n; else delete o[id]; return o })
  const vis = productos.filter(p => cat === 'Todos' || (p.categoria || 'Otros') === cat)

  async function cobrar(medio) {
    setOcupado(true)
    try {
      await rpc('nuts_vender', { p_items: items.map(x => ({ id: x.p.id, cant: x.cant })), p_medio: medio })
      setCarrito({}); setAbierto(false); setAviso({ ok: true, t: `✓ Venta de ${pesos(total)} · ${medio}` })
      setTimeout(() => setAviso(null), 3500)
    } catch (e) { setAviso({ ok: false, t: e.message }) }
    setOcupado(false)
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm'>
        <div><div className='text-xs text-gray-500'>Vendido hoy</div><div className='text-2xl font-bold' style={{ color: CARAMELO }}>{pesos(datos.hoy.total)}</div></div>
        <div className='text-right'><div className='text-xs text-gray-500'>Ventas</div><div className='text-2xl font-bold'>{datos.hoy.ventas}</div></div>
      </div>

      <div className='flex gap-2 overflow-x-auto pb-1'>
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)} className='rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap'
            style={c === cat ? { background: CARAMELO, color: '#fff' } : { background: '#fff', color: CARAMELO, border: '1px solid #E7D9C6' }}>{c}</button>
        ))}
      </div>

      {aviso && !abierto && <p className='rounded-xl p-3 font-semibold' style={{ background: aviso.ok ? '#EAF5EE' : '#FDECEC', color: aviso.ok ? '#1F6B3F' : '#9B1C1C' }}>{aviso.t}</p>}

      <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {vis.map(p => {
          const [titulo, pres] = p.nombre.split(' · ')
          const nueces = Object.keys(p.receta || {}).map(nombreNuez)
          return (
            <button key={p.id} onClick={() => sumar(p.id, 1)} className='bg-white rounded-2xl overflow-hidden text-left shadow-sm relative flex flex-col active:scale-95 transition-transform'
              style={{ border: carrito[p.id] ? `3px solid ${CARAMELO}` : '1px solid #E7D9C6' }}>
              <div className='w-full' style={{ aspectRatio: '1 / 1', background: nueces[0] ? colorNuez(nueces[0]) : '#EFE6DA' }}>
                {p.foto && <img src={p.foto} alt='' loading='lazy' className='w-full h-full' style={{ objectFit: 'cover' }} />}
              </div>
              <div className='p-2.5 flex-1 flex flex-col'>
                <div className='font-bold leading-tight'>{titulo}</div>
                {pres && <div className='text-xs text-gray-500'>{pres}</div>}
                <div className='text-base font-bold mt-auto pt-1' style={{ color: CARAMELO }}>{pesos(p.precio)}</div>
                {p.stock > 0 && <div className='text-[11px]' style={{ color: '#2F7A4C' }}>{p.stock} listos</div>}
              </div>
              {carrito[p.id] > 0 && <span className='absolute top-2 right-2 rounded-full text-base font-bold text-white w-9 h-9 flex items-center justify-center shadow' style={{ background: CARAMELO }}>{carrito[p.id]}</span>}
            </button>
          )
        })}
      </div>

      {unidades > 0 && (
        <button onClick={() => setAbierto(true)} className='fixed left-3 right-3 md:left-auto md:w-96 z-30 rounded-2xl px-5 py-4 flex items-center justify-between text-white font-bold shadow-lg'
          style={{ background: CARAMELO, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)', right: 12 }}>
          <span>🛒 {unidades} {unidades === 1 ? 'producto' : 'productos'}</span><span>Cobrar {pesos(total)} →</span>
        </button>
      )}

      {abierto && (
        <Modal titulo='Cobrar' cerrar={() => setAbierto(false)}>
          <div className='space-y-2'>
            {items.map(x => (
              <div key={x.p.id} className='flex items-center gap-2'>
                {x.p.foto && <img src={x.p.foto} alt='' className='w-11 h-11 rounded-lg flex-none' style={{ objectFit: 'cover' }} />}
                <div className='flex-1 min-w-0'><div className='font-medium truncate'>{x.p.nombre}</div><div className='text-xs text-gray-500'>{pesos(x.p.precio)} c/u</div></div>
                <button aria-label='Quitar uno' onClick={() => sumar(x.p.id, -1)} className='w-10 h-10 rounded-lg border text-lg'>−</button>
                <span className='w-6 text-center font-bold'>{x.cant}</span>
                <button aria-label='Agregar uno' onClick={() => sumar(x.p.id, 1)} className='w-10 h-10 rounded-lg border text-lg'>+</button>
              </div>
            ))}
          </div>
          <div className='flex justify-between text-xl font-bold border-t pt-3'><span>Total</span><span>{pesos(total)}</span></div>
          <div className='text-sm font-semibold'>¿Cómo pagó?</div>
          <div className='grid grid-cols-2 gap-2'>
            {MEDIOS.map(([m, ic]) => <button key={m} disabled={!items.length || ocupado} onClick={() => cobrar(m)} className='rounded-xl py-4 font-bold text-white disabled:opacity-40 flex flex-col items-center gap-1' style={{ background: CARAMELO }}><span className='text-2xl'>{ic}</span>{m}</button>)}
          </div>
          {aviso && !aviso.ok && <p className='text-sm rounded-lg p-2' style={{ background: '#FDECEC', color: '#9B1C1C' }}>{aviso.t}</p>}
        </Modal>
      )}
    </div>
  )
}
