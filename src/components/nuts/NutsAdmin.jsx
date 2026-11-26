import { useState } from 'react'
import { CARAMELO, pesos, gramos, colorNuez, Modal } from '@/lib/nuts'

/* Módulos de administración de Mr. Nuts, según `seccion`:
   ventas (del día y últimas) · control (lotes cerrados: faltantes por turno) · inventario (crudo, batches, bandejas, listos)
   · ajustes (productos con foto, nueces y usuarios). */

const TOLERANCIA = 3 // % de diferencia que se considera normal al cerrar un lote
const fecha = iso => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })

export default function NutsAdmin({ datos, rpc, seccion }) {
  const [edit, setEdit] = useState(null) // { tipo, item }
  const nombreNuez = id => datos.nueces.find(n => n.id === id)?.nombre || 'Nuez'
  const faltante = datos.cerrados.reduce((a, c) => a + Math.max(0, Number(c.diferencia)), 0)
  return (
    <div className='space-y-6'>
      {seccion === 'inventario' && <Inventario datos={datos} nombreNuez={nombreNuez} />}
      {seccion === 'ventas' && <>
      <section className='bg-white rounded-2xl p-4 shadow-sm space-y-3'>
        <h2 className='font-bold text-lg'>Hoy</h2>
        <div className='grid grid-cols-3 gap-2 text-center'>
          <Cifra v={pesos(datos.hoy.total)} t='vendido' />
          <Cifra v={datos.hoy.ventas} t='ventas' />
          <Cifra v={datos.hoy.lotes_hechos} t='lotes hechos' />
        </div>
        <div className='flex flex-wrap gap-2'>{Object.entries(datos.hoy.por_medio || {}).map(([m, t]) => <span key={m} className='rounded-full px-3 py-1 text-sm' style={{ background: '#FBF4EA' }}>{m}: <b>{pesos(t)}</b></span>)}</div>
      </section>
      </>}

      {seccion === 'control' && <section className='bg-white rounded-2xl p-4 shadow-sm space-y-3'>
        <div className='flex justify-between items-baseline gap-2 flex-wrap'><h2 className='font-bold text-lg'>Control de lotes cerrados</h2><span className='text-sm' style={{ color: faltante > 0 ? '#9B1C1C' : '#1F6B3F' }}>Faltante total: <b>{gramos(faltante)}</b></span></div>
        <p className='text-xs text-gray-500'>Diferencia entre lo que debía quedar en la bandeja y lo que quedó. Hasta {TOLERANCIA}% se considera normal.</p>
        {datos.cerrados.length === 0 ? <p className='text-sm text-gray-500'>Todavía no se ha cerrado ningún lote.</p> : (
          <div className='space-y-2'>
            {datos.cerrados.map(c => {
              const dif = Number(c.diferencia), pct = c.salida ? dif / c.salida * 100 : 0
              const col = dif <= 0 ? '#1F6B3F' : pct <= TOLERANCIA ? '#8A5300' : '#9B1C1C'
              return (
                <div key={c.codigo} className='flex justify-between gap-3 rounded-xl p-3' style={{ background: '#FAF8F5' }}>
                  <div className='min-w-0'><div className='font-semibold'>{nombreNuez(c.nuez_id)} · {c.codigo}</div><div className='text-xs text-gray-500'>Cerró {c.cerrado_por} · {fecha(c.cerrado_at)} · salió {gramos(c.salida)}, debía quedar {gramos(c.esperado)}, quedó {gramos(c.real)}</div></div>
                  <div className='text-right font-bold whitespace-nowrap' style={{ color: col }}>{dif > 0 ? '−' + gramos(dif) : dif < 0 ? '+' + gramos(-dif) : '✓'}<div className='text-xs font-normal'>{dif > 0 ? pct.toFixed(1) + '%' : 'cuadra'}</div></div>
                </div>
              )
            })}
          </div>
        )}
      </section>}

      {seccion === 'ventas' && <section className='bg-white rounded-2xl p-4 shadow-sm space-y-2'>
        <h2 className='font-bold text-lg'>Últimas ventas</h2>
        {datos.ultimas_ventas.length === 0 ? <p className='text-sm text-gray-500'>Sin ventas todavía.</p> : datos.ultimas_ventas.map((v, i) => (
          <div key={i} className='flex justify-between gap-3 text-sm border-b py-2'>
            <div className='min-w-0'><div className='truncate'>{v.items.map(x => `${x.cant} ${x.nombre}`).join(', ')}</div><div className='text-xs text-gray-500'>{v.usuario} · {v.medio} · {fecha(v.fecha)}</div></div>
            <b className='whitespace-nowrap'>{pesos(v.total)}</b>
          </div>
        ))}
      </section>}

      {seccion === 'ajustes' && <>
      <Lista titulo='Productos' nuevo={() => setEdit({ tipo: 'producto', item: { nombre: '', precio: '', receta: {}, activo: true } })}
        filas={datos.productos.map(p => ({ k: p.id, foto: p.foto, t: p.nombre, s: `${pesos(p.precio)} · ${Object.entries(p.receta || {}).map(([id, g]) => `${g} g ${nombreNuez(id).toLowerCase()}`).join(' + ') || 'sin receta'}${p.stock ? ` · ${p.stock} listos` : ''}`, off: !p.activo, onClick: () => setEdit({ tipo: 'producto', item: p }) }))} />
      <Lista titulo='Nueces' nuevo={() => setEdit({ tipo: 'nuez', item: { nombre: '', caja_kg: 12.5, nuez_g: 550, azucar_g: 450, canela_g: 8, activo: true } })}
        filas={datos.nueces.map(n => ({ k: n.id, t: n.nombre, s: `Caja de ${n.caja_kg} kg · batch: ${n.nuez_g} g + ${n.azucar_g} g azúcar + ${n.canela_g} g canela`, off: !n.activo, onClick: () => setEdit({ tipo: 'nuez', item: n }) }))} />
      <Lista titulo='Usuarios' nuevo={() => setEdit({ tipo: 'usuario', item: { nombre: '', usuario: '', rol: 'tienda', activo: true } })}
        filas={datos.usuarios.map(u => ({ k: u.id, t: u.nombre, s: `${u.usuario} · ${{ admin: 'Administrador', produccion: 'Producción', tienda: 'Tienda' }[u.rol]}`, off: !u.activo, onClick: () => setEdit({ tipo: 'usuario', item: u }) }))} />
      </>}

      {edit && <Editar e={edit} nueces={datos.nueces.filter(n => n.activo)} rpc={rpc} cerrar={() => setEdit(null)} />}
    </div>
  )
}

function Cifra({ v, t }) { return <div className='rounded-xl py-2' style={{ background: '#FBF4EA' }}><div className='text-xl font-bold' style={{ color: CARAMELO }}>{v}</div><div className='text-xs text-gray-500'>{t}</div></div> }

function Lista({ titulo, filas, nuevo }) {
  return (
    <section className='bg-white rounded-2xl p-4 shadow-sm space-y-2'>
      <div className='flex justify-between items-center'><h2 className='font-bold text-lg'>{titulo}</h2><button onClick={nuevo} className='rounded-lg px-3 py-2 text-sm font-semibold text-white' style={{ background: CARAMELO }}>+ Nuevo</button></div>
      {filas.length === 0 && <p className='text-sm text-gray-500'>Todavía no hay.</p>}
      {filas.map(f => (
        <button key={f.k} onClick={f.onClick} className='w-full text-left rounded-xl p-3 border' style={{ borderColor: '#EFE6D8', opacity: f.off ? .5 : 1 }}>
          <div className='flex items-center gap-3'>{f.foto && <img src={f.foto} alt='' className='w-12 h-12 rounded-lg flex-none' style={{ objectFit: 'cover' }} />}<div className='min-w-0'><div className='font-semibold'>{f.t}{f.off ? ' (inactivo)' : ''}</div><div className='text-xs text-gray-500'>{f.s}</div></div></div>
        </button>
      ))}
    </section>
  )
}

function Editar({ e, nueces, rpc, cerrar }) {
  const [f, setF] = useState({ ...e.item, receta: { ...(e.item.receta || {}) }, pin: '' })
  const [err, setErr] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const nuevo = !e.item.id
  async function guardar() {
    setOcupado(true); setErr(null)
    try {
      if (e.tipo === 'producto') {
        const receta = Object.fromEntries(Object.entries(f.receta).filter(([, g]) => Number(g) > 0).map(([k, g]) => [k, Number(g)]))
        await rpc('nuts_guardar_producto', { p: { id: f.id || '', nombre: f.nombre, precio: Number(f.precio) || 0, receta, foto: f.foto || '', categoria: f.categoria || '', activo: f.activo } })
      } else if (e.tipo === 'nuez') {
        await rpc('nuts_guardar_nuez', { p: { id: f.id || '', nombre: f.nombre, caja_kg: Number(f.caja_kg), nuez_g: Number(f.nuez_g), azucar_g: Number(f.azucar_g), canela_g: Number(f.canela_g), activo: f.activo } })
      } else {
        await rpc('nuts_guardar_usuario', { p: { id: f.id || '', nombre: f.nombre, usuario: f.usuario, rol: f.rol, activo: f.activo, pin: f.pin } })
      }
      cerrar()
    } catch (er) { setErr(er.message) }
    setOcupado(false)
  }
  const txt = (k, l, extra = {}) => <label className='block text-sm font-semibold'>{l}<input value={f[k] ?? ''} onChange={ev => set(k, ev.target.value)} className='w-full mt-1' style={{ fontSize: 16, padding: 10 }} {...extra} /></label>
  const num = (k, l) => txt(k, l, { type: 'number', inputMode: 'decimal', min: '0' })
  return (
    <Modal titulo={(nuevo ? 'Nuevo ' : 'Editar ') + { producto: 'producto', nuez: 'nuez', usuario: 'usuario' }[e.tipo]} cerrar={cerrar}>
      {txt('nombre', 'Nombre')}
      {e.tipo === 'producto' && <>
        {num('precio', 'Precio de venta')}
        <label className='block text-sm font-semibold'>Categoría
          <select value={f.categoria || ''} onChange={ev => set('categoria', ev.target.value)} className='w-full mt-1' style={{ fontSize: 16, padding: 10 }}>
            {['', 'Nueces', 'Conos', 'Mix', 'Cajas'].map(c => <option key={c} value={c}>{c || 'Sin categoría'}</option>)}
          </select>
        </label>
        {txt('foto', 'Link de la foto (opcional)', { inputMode: 'url', autoCapitalize: 'none' })}
        {f.foto && <img src={f.foto} alt='' className='w-24 h-24 rounded-xl' style={{ objectFit: 'cover' }} />}
        <div className='text-sm font-semibold'>Gramos de cada nuez que lleva</div>
        <p className='text-xs text-gray-500 -mt-2'>Un cono de marañón: 70 en Marañón. Un mix: 50 en cada nuez que lleve. Deja en blanco las que no lleva.</p>
        {nueces.map(n => (
          <label key={n.id} className='flex items-center gap-3 text-sm'><span className='flex-1'>{n.nombre}</span>
            <input type='number' inputMode='numeric' min='0' value={f.receta[n.id] ?? ''} onChange={ev => setF(x => ({ ...x, receta: { ...x.receta, [n.id]: ev.target.value } }))} className='w-28' style={{ fontSize: 16, padding: 8 }} /> g
          </label>
        ))}
      </>}
      {e.tipo === 'nuez' && <>
        {num('caja_kg', 'Kilos que trae la caja')}
        <div className='text-sm font-semibold'>Receta del batch</div>
        <div className='grid grid-cols-3 gap-2'>{num('nuez_g', 'Nuez (g)')}{num('azucar_g', 'Azúcar (g)')}{num('canela_g', 'Canela (g)')}</div>
      </>}
      {e.tipo === 'usuario' && <>
        {txt('usuario', 'Usuario (para entrar)', { autoCapitalize: 'none', disabled: !nuevo })}
        <label className='block text-sm font-semibold'>Rol
          <select value={f.rol} onChange={ev => set('rol', ev.target.value)} className='w-full mt-1' style={{ fontSize: 16, padding: 10 }}>
            <option value='tienda'>Tienda (vende, prueba, cierra lotes)</option>
            <option value='produccion'>Producción (compras, batches, máquina)</option>
            <option value='admin'>Administrador (todo)</option>
          </select>
        </label>
        {txt('pin', nuevo ? 'PIN (mínimo 4 números)' : 'PIN nuevo (déjalo vacío para no cambiarlo)', { type: 'password', inputMode: 'numeric' })}
      </>}
      {!nuevo && <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={f.activo !== false} onChange={ev => set('activo', ev.target.checked)} /> Activo</label>}
      {err && <p className='text-sm' style={{ color: '#9B1C1C' }}>{err}</p>}
      <button disabled={ocupado} onClick={guardar} className='w-full rounded-xl py-3 font-bold text-white disabled:opacity-40' style={{ background: CARAMELO }}>Guardar</button>
    </Modal>
  )
}

function Inventario({ datos, nombreNuez }) {
  const listos = datos.productos.filter(p => p.stock > 0)
  return (
    <>
      <section className='bg-white rounded-2xl p-4 shadow-sm space-y-3'>
        <h2 className='font-bold text-lg'>Por nuez</h2>
        <div className='grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {datos.nueces.filter(n => n.activo).map(n => {
            const bandeja = datos.lotes.filter(l => l.nuez_id === n.id).reduce((a, l) => a + Number(l.restante), 0)
            return (
              <div key={n.id} className='rounded-xl overflow-hidden border' style={{ borderColor: '#EFE6D8' }}>
                <div className='px-3 py-2 font-bold' style={{ background: colorNuez(n.nombre) }}>{n.nombre}</div>
                <div className='grid grid-cols-3 text-center py-2'>
                  <div><div className='font-bold'>{(Number(datos.crudo[n.id] || 0) / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg</div><div className='text-[11px] text-gray-500'>crudo</div></div>
                  <div><div className='font-bold'>{Number(datos.batches[n.id] || 0)}</div><div className='text-[11px] text-gray-500'>batches</div></div>
                  <div><div className='font-bold'>{gramos(bandeja)}</div><div className='text-[11px] text-gray-500'>en bandejas</div></div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <section className='bg-white rounded-2xl p-4 shadow-sm space-y-2'>
        <h2 className='font-bold text-lg'>Productos ya armados</h2>
        {listos.length === 0 ? <p className='text-sm text-gray-500'>No hay unidades armadas guardadas.</p> : listos.map(p => (
          <div key={p.id} className='flex items-center gap-3 border-b py-2'>{p.foto && <img src={p.foto} alt='' className='w-10 h-10 rounded-lg' style={{ objectFit: 'cover' }} />}<span className='flex-1'>{p.nombre}</span><b>{p.stock}</b></div>
        ))}
      </section>
    </>
  )
}
