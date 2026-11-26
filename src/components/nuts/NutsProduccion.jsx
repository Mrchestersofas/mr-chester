import { useState } from 'react'
import { CARAMELO, pesos, gramos, colorNuez, Modal } from '@/lib/nuts'

/* Producción: caja cruda → batches (bolsitas para la máquina) → caramelizado (cada batch = un lote / una bandeja).
   Cada paso descuenta del anterior, así se ve si se pierde nuez cruda o si un lote rinde menos. */

export default function NutsProduccion({ datos, rpc }) {
  const nueces = datos.nueces.filter(n => n.activo)
  const [accion, setAccion] = useState(null) // { tipo, nuez }
  return (
    <div className='space-y-4'>
      <div className='bg-white rounded-xl p-3 text-sm text-gray-600 shadow-sm'>Hoy van <b style={{ color: CARAMELO }}>{datos.hoy.lotes_hechos}</b> lotes caramelizados.</div>
      <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {nueces.map(n => {
          const crudo = Number(datos.crudo[n.id] || 0)
          const batches = Number(datos.batches[n.id] || 0)
          const abiertos = datos.lotes.filter(l => l.nuez_id === n.id)
          return (
            <div key={n.id} className='bg-white rounded-2xl overflow-hidden shadow-sm'><div style={{ background: colorNuez(n.nombre), height: 10 }} /><div className='p-4 space-y-3'>
              <div className='flex justify-between items-baseline'><h2 className='text-lg font-bold'>{n.nombre}</h2><span className='text-xs text-gray-500'>{n.nuez_g} g + {n.azucar_g} g azúcar + {n.canela_g} g canela</span></div>
              <div className='grid grid-cols-3 gap-2 text-center'>
                <Dato v={(crudo / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' kg'} t='crudo' />
                <Dato v={batches} t='batches listos' />
                <Dato v={abiertos.length} t='bandejas abiertas' />
              </div>
              <div className='text-xs text-gray-500'>Con el crudo alcanza para {Math.floor(crudo / n.nuez_g)} batches más. La compra de crudo se registra en Compras.</div>
              <div className='grid grid-cols-2 gap-2'>
                <Boton onClick={() => setAccion({ tipo: 'batches', n, max: Math.floor(crudo / n.nuez_g) })}>🛍️ Armar batches</Boton>
                <Boton onClick={() => setAccion({ tipo: 'maquina', n })} disabled={batches < 1}>🔥 A la máquina</Boton>
              </div>
            </div></div>
          )
        })}
      </div>
      {accion && <Accion a={accion} rpc={rpc} cerrar={() => setAccion(null)} />}
    </div>
  )
}

function Dato({ v, t }) { return <div className='rounded-lg py-2' style={{ background: '#FBF4EA' }}><div className='font-bold'>{v}</div><div className='text-[11px] text-gray-500 leading-tight'>{t}</div></div> }
function Boton({ children, ...p }) { return <button {...p} className='rounded-xl py-3 text-sm font-semibold border disabled:opacity-40' style={{ borderColor: '#EADFCF' }}>{children}</button> }

function Accion({ a, rpc, cerrar }) {
  const n = a.n
  const [kg, setKg] = useState(String(n.caja_kg))
  const [precio, setPrecio] = useState('')
  const [cant, setCant] = useState(String(Math.max(1, a.max || 1)))
  const [salida, setSalida] = useState('920')
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  async function hacer(fn, args, texto) {
    setOcupado(true); setErr(null)
    try { const r = await rpc(fn, args); setOk(texto(r)) } catch (e) { setErr(e.message) }
    setOcupado(false)
  }
  const c = Number(cant) || 0
  const campo = (label, val, set, extra = {}) => (
    <label className='block text-sm font-semibold'>{label}<input type='number' inputMode='decimal' min='0' value={val} onChange={e => set(e.target.value)} className='w-full mt-1' style={{ fontSize: 18, padding: 10 }} {...extra} /></label>
  )
  return (
    <Modal titulo={{ compra: `Compra de ${n.nombre} crudo`, batches: `Armar batches de ${n.nombre}`, maquina: `${n.nombre} a la máquina` }[a.tipo]} cerrar={cerrar}>
      {ok ? <>
        <p className='rounded-xl p-3 font-semibold' style={{ background: '#EAF5EE', color: '#1F6B3F' }}>{ok}</p>
        <button onClick={cerrar} className='w-full rounded-xl py-3 font-bold text-white' style={{ background: CARAMELO }}>Listo</button>
      </> : a.tipo === 'compra' ? <>
        {campo('Kilos que llegaron', kg, setKg)}
        {campo('Precio pagado (opcional)', precio, setPrecio)}
        <button disabled={ocupado || !(Number(kg) > 0)} onClick={() => hacer('nuts_compra', { p_nuez: n.id, p_kg: Number(kg), p_precio: precio ? Number(precio) : null }, () => `✓ Entraron ${kg} kg de ${n.nombre} crudo${precio ? ' por ' + pesos(precio) : ''}.`)} className='w-full rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>Registrar compra</button>
      </> : a.tipo === 'batches' ? <>
        {campo('¿Cuántos batches armaste?', cant, setCant, { step: 1 })}
        <div className='text-sm rounded-lg p-3' style={{ background: '#FBF4EA' }}>
          Se descuentan <b>{gramos(n.nuez_g * c)}</b> de {n.nombre.toLowerCase()} crudo.<br />
          Para armarlos se usan {gramos(n.azucar_g * c)} de azúcar y {gramos(n.canela_g * c)} de canela.
          {a.max >= 0 && <><br />Con el crudo que hay alcanza para {a.max}.</>}
        </div>
        <button disabled={ocupado || c < 1} onClick={() => hacer('nuts_armar_batches', { p_nuez: n.id, p_cantidad: c }, () => `✓ ${c} batches de ${n.nombre} listos para la máquina.`)} className='w-full rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>Registrar batches</button>
      </> : <>
        <p className='text-sm text-gray-600'>Un batch entra a la máquina y sale una bandeja nueva (un lote). Escribe cuánto pesó lo que salió.</p>
        {campo('Gramos que salieron', salida, setSalida)}
        <button disabled={ocupado || !(Number(salida) > 0)} onClick={() => hacer('nuts_caramelizar', { p_nuez: n.id, p_gramos: Number(salida) }, r => `✓ Lote ${r.codigo} creado con ${gramos(salida)}. Ya se puede vender.`)} className='w-full rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>Registrar lote</button>
      </>}
      {err && <p className='text-sm' style={{ color: '#9B1C1C' }}>{err}</p>}
    </Modal>
  )
}
