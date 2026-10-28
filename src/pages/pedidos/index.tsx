import { useEffect, useState } from 'react'
import { supabase, Pedido, OrderStatus } from '@/lib/supabase'
import { EstadoBadge, PrioridadBadge } from '@/components/Badges'
import Link from 'next/link'
import { Plus, Search, Trash2, MessageSquarePlus, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const ESTADOS: { value: string; label: string }[] = [
  { value: '',               label: 'Todos los estados' },
  { value: 'pendiente',      label: 'Pendiente' },
  { value: 'estructura',     label: 'Estructura' },
  { value: 'tapizado',       label: 'Tapizado' },
  { value: 'costura',        label: 'Costura' },
  { value: 'control_calidad',label: 'Control calidad' },
  { value: 'listo',          label: 'Listo' },
  { value: 'entregado',      label: 'Entregado' },
]

function semaforo(fechaEntrega: string, estado: string) {
  if (estado === 'entregado') return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const entrega = new Date(fechaEntrega); entrega.setHours(0, 0, 0, 0)
  const dias = Math.ceil((entrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { color: '#ef4444', titulo: `Vencido hace ${Math.abs(dias)} día(s)` }
  if (dias <= 3) return { color: '#f59e0b', titulo: `Vence en ${dias} día(s)` }
  return { color: '#22c55e', titulo: `${dias} día(s) restantes` }
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<Pedido | null>(null)
  const [novedadesDe, setNovedadesDe] = useState<Pedido | null>(null)
  const [editando, setEditando] = useState<Pedido | null>(null)

  async function cargar() {
    setLoading(true)
    let q = supabase
      .from('pedidos')
      .select('*, cliente:clientes(*)')
      .order('fecha_entrega', { ascending: true })
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    const { data } = await q
    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [filtroEstado])

  const filtrados = pedidos.filter(p =>
    p.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.tipo_sofa.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.cliente as any)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Pedidos de una misma compra (varios productos) comparten "grupo" = número del primero
  const tamGrupo: Record<string, number> = {}
  pedidos.forEach((p: any) => { if (p.grupo) tamGrupo[p.grupo] = (tamGrupo[p.grupo] || 0) + 1 })

  async function cambiarEstado(id: string, nuevoEstado: OrderStatus) {
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id)
    cargar()
  }

  async function eliminarPedido(p: Pedido) {
    setEliminando(p.id)
    // Primero lo que depende del pedido (historial y programación); si no, la base no deja borrarlo
    await supabase.from('historial_estados').delete().eq('pedido_id', p.id)
    await supabase.from('programacion_produccion').delete().eq('pedido_id', p.id)
    const { error } = await supabase.from('pedidos').delete().eq('id', p.id)
    if (error) alert('No se pudo eliminar el pedido: ' + error.message)
    setEliminando(null)
    setConfirmar(null)
    cargar()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {novedadesDe && <ModalNovedades pedido={novedadesDe} onClose={() => setNovedadesDe(null)} />}
      {editando && <ModalEditar pedido={editando} onClose={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar() }} />}

      {confirmar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmar(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 rounded-full p-2">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-800">¿Eliminar pedido?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Vas a eliminar el pedido <b className="text-purple-700">{confirmar.numero}</b> — {confirmar.tipo_sofa}
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Esto también borrará su programación de producción. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmar(null)} className="btn flex-1">
                Cancelar
              </button>
              <button
                onClick={() => eliminarPedido(confirmar)}
                disabled={eliminando === confirmar.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {eliminando === confirmar.id ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Pedidos</h1>
        <Link href="/pedidos/nuevo" className="btn btn-primary">
          <Plus size={15} /> Nuevo pedido
        </Link>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, producto o cliente..."
            className="pl-9"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="w-48"
        >
          {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-gray-400 text-center">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400 mb-3">No hay pedidos con ese criterio.</p>
            <Link href="/pedidos/nuevo" className="btn btn-primary">
              <Plus size={14} /> Crear primer pedido
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Material / Color</th>
                <th>Fecha pedido</th>
                <th>Entrega</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Avanzar etapa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const s = semaforo(p.fecha_entrega, p.estado)
                return (
                  <tr key={p.id}>
                    <td>
                      <button type="button" onClick={() => setEditando(p)} className="font-medium text-purple-700 hover:underline">{p.numero}</button>
                      {(p as any).grupo && tamGrupo[(p as any).grupo] > 1 && (
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {(p as any).grupo === p.numero ? `Compra de ${tamGrupo[(p as any).grupo]} productos` : `Va con ${(p as any).grupo}`}
                        </div>
                      )}
                    </td>
                    <td>
                      {(p.cliente as any)?.nombre || '—'}
                      {(p as any).canal && <div className="text-xs text-gray-500">{({ tienda_85: 'Tienda 85', whatsapp: 'WhatsApp', instagram: 'Instagram', falabella: 'Falabella', web: 'Página web' } as any)[(p as any).canal] || (p as any).canal}</div>}
                    </td>
                    <td>{p.tipo_sofa}</td>
                    <td className="text-gray-500">{p.material} / {p.color}</td>
                    <td className="text-sm text-gray-500">
                      {(p as any).fecha_pedido ? format(parseISO((p as any).fecha_pedido), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="text-sm">
                      <div className="flex items-center gap-1.5">
                        {s && (
                          <span
                            title={s.titulo}
                            style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }}
                          />
                        )}
                        {format(parseISO(p.fecha_entrega), 'dd/MM/yyyy')}
                      </div>
                    </td>
                    <td><PrioridadBadge prioridad={p.prioridad} /></td>
                    <td><EstadoBadge estado={p.estado} /></td>
                    <td className="font-medium">${Number(p.precio_venta).toLocaleString('es-CO')}</td>
                    <td>
                      {p.estado !== 'entregado' && (
                        <select
                          className="text-xs py-1 w-36"
                          value={p.estado}
                          onChange={e => cambiarEstado(p.id, e.target.value as OrderStatus)}
                        >
                          {ESTADOS.filter(e => e.value).map(e =>
                            <option key={e.value} value={e.value}>{e.label}</option>
                          )}
                        </select>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <button
                        onClick={() => setEditando(p)}
                        className="text-gray-400 hover:text-purple-600 transition-colors p-1 rounded mr-1"
                        title="Editar pedido"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setNovedadesDe(p)}
                        className="text-gray-400 hover:text-purple-600 transition-colors p-1 rounded mr-1"
                        title="Novedades para el cliente"
                      >
                        <MessageSquarePlus size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmar(p)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"
                        title="Eliminar pedido"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">{filtrados.length} pedidos</p>
    </div>
  )
}

/* Novedades que el cliente ve en /seguimiento */
function ModalNovedades({ pedido, onClose }: { pedido: Pedido, onClose: () => void }) {
  const [lista, setLista] = useState<any[]>([])
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function cargar() {
    const { data, error: e } = await supabase.from('pedido_novedades').select('*').eq('pedido_id', pedido.id).order('created_at', { ascending: false })
    if (e) setError('No se pudieron cargar las novedades.')
    setLista(data || [])
  }
  useEffect(() => { cargar() }, [])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setGuardando(true); setError(null)
    const { error: err } = await supabase.from('pedido_novedades').insert({ pedido_id: pedido.id, texto: texto.trim(), origen: 'manual' })
    setGuardando(false)
    if (err) { setError('No se pudo guardar: ' + err.message); return }
    setTexto(''); cargar()
  }
  async function alternar(n: any) {
    await supabase.from('pedido_novedades').update({ visible_cliente: !n.visible_cliente }).eq('id', n.id)
    cargar()
  }
  const link = 'https://seguimiento.mrchester.com.co'
  const cliente: any = (pedido as any).cliente
  const tel = String(cliente?.telefono || '').replace(/\D/g, '')
  const telWa = tel.length === 10 ? '57' + tel : tel
  const msg = `Hola ${String(cliente?.nombre || '').split(' ')[0]}, puedes ver cómo va tu sofá ${pedido.numero} aquí: ${link} (solo escribe tu número de cédula).`
  async function copiarLink() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch (e) {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">Novedades · {pedido.numero}</h3>
            <p className="text-xs text-gray-500">{cliente?.nombre} · {pedido.tipo_sofa}. El cliente las ve en el seguimiento con su cédula.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>
        <form onSubmit={agregar} className="space-y-2">
          <textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: Ya llegó tu tela, empezamos el tapizado esta semana." />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={guardando}>{guardando ? 'Guardando…' : 'Publicar novedad'}</button>
        </form>
        <div className="space-y-2">
          {lista.length === 0 && <p className="text-sm text-gray-400">Todavía no hay novedades. Las de cambio de etapa y de fecha salen solas.</p>}
          {lista.map(n => (
            <div key={n.id} className={`rounded-lg border p-3 text-sm ${n.visible_cliente ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-60'}`}>
              <div>{n.texto}</div>
              <div className="flex justify-between items-center mt-1 text-xs text-gray-400">
                <span>{new Date(n.created_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {n.origen === 'auto' ? 'automática' : 'manual'}</span>
                <button onClick={() => alternar(n)} className="underline">{n.visible_cliente ? 'Ocultar al cliente' : 'Mostrar al cliente'}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs text-gray-500">Link de seguimiento para el cliente:</p>
          <div className="flex gap-2">
            <button onClick={copiarLink} className="btn flex-1 justify-center">{copiado ? '✓ Copiado' : 'Copiar link'}</button>
            {tel && <a className="btn flex-1 justify-center" href={`https://wa.me/${telWa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Editar un pedido: producto, tela, precio, fechas, canal y datos del cliente */
const CANALES_ED: [string, string][] = [['tienda_85', 'Tienda 85'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['falabella', 'Falabella'], ['web', 'Página web']]
const ETIQ: Record<string, string> = { tipo_sofa: 'producto', material: 'tela', cantidad: 'cantidad', precio_venta: 'precio', fecha_pedido: 'fecha del pedido', fecha_entrega: 'fecha de entrega', canal: 'canal', prioridad: 'prioridad', observaciones: 'observaciones', factura_iva: 'factura con IVA', nombre: 'nombre', cedula: 'documento', telefono: 'teléfono', email: 'correo', direccion: 'dirección', ciudad: 'ciudad' }

function L({ t, id, children }: any) { return <div><label htmlFor={id} className="text-xs text-gray-500 mb-1 block">{t}</label>{children}</div> }

function ModalEditar({ pedido, onClose, onGuardado }: { pedido: Pedido, onClose: () => void, onGuardado: () => void }) {
  const p: any = pedido
  const c: any = p.cliente || {}
  const [productos, setProductos] = useState<any[]>([])
  const [telas, setTelas] = useState<any[]>([])
  const [f, setF] = useState<any>({
    tipo_sofa: p.tipo_sofa || '', material: p.material || '', cantidad: p.cantidad || 1, precio_venta: String(Math.round(Number(p.precio_venta || 0))),
    fecha_pedido: String(p.fecha_pedido || '').slice(0, 10), fecha_entrega: String(p.fecha_entrega || '').slice(0, 10),
    canal: p.canal || '', prioridad: p.prioridad || 'normal', observaciones: p.observaciones || '', factura_iva: !!p.factura_iva,
  })
  const [cl, setCl] = useState<any>({ nombre: c.nombre || '', cedula: c.cedula || '', telefono: c.telefono || '', email: c.email || '', direccion: c.direccion || '', ciudad: c.ciudad || '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('productos').select('referencia').order('categoria').order('referencia').then(({ data }) => setProductos(data || []))
    supabase.from('materiales').select('nombre').eq('unidad', 'metro').order('nombre').then(({ data }) => setTelas(data || []))
  }, [])
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }))
  const setC = (k: string, v: any) => setCl((x: any) => ({ ...x, [k]: v }))

  async function guardar() {
    if (!f.tipo_sofa.trim()) { setError('Escribe el producto.'); return }
    if (!(Number(f.precio_venta) > 0)) { setError('El precio debe ser mayor a 0.'); return }
    if (!f.fecha_entrega) { setError('Pon la fecha de entrega.'); return }
    if (Number(f.precio_venta) < Number(p.abono || 0)) { setError(`El precio no puede ser menor a lo que ya abonó (${'$' + Math.round(Number(p.abono)).toLocaleString('es-CO')}).`); return }
    setGuardando(true); setError(null)
    const nuevo: any = { ...f, cantidad: Number(f.cantidad) || 1, precio_venta: Number(f.precio_venta), canal: f.canal || null }
    const antes: any = { ...p, precio_venta: Number(p.precio_venta), cantidad: Number(p.cantidad), fecha_pedido: String(p.fecha_pedido || '').slice(0, 10), fecha_entrega: String(p.fecha_entrega || '').slice(0, 10), factura_iva: !!p.factura_iva }
    const cambiosP = Object.keys(nuevo).filter(k => String(nuevo[k] ?? '') !== String(antes[k] ?? ''))
    const cambiosC = Object.keys(cl).filter(k => String(cl[k] ?? '') !== String(c[k] ?? ''))
    if (!cambiosP.length && !cambiosC.length) { onClose(); return }
    if (cambiosP.length) {
      const { error: e } = await supabase.from('pedidos').update(Object.fromEntries(cambiosP.map(k => [k, nuevo[k]]))).eq('id', p.id)
      if (e) { setError('No se pudo guardar: ' + e.message); setGuardando(false); return }
    }
    if (cambiosC.length && p.cliente_id) {
      const { error: e } = await supabase.from('clientes').update(Object.fromEntries(cambiosC.map(k => [k, cl[k].trim ? cl[k].trim() : cl[k]]))).eq('id', p.cliente_id)
      if (e) { setError('No se pudo guardar el cliente: ' + e.message); setGuardando(false); return }
    }
    const detalle = [...cambiosP.map(k => `${ETIQ[k] || k}: ${antes[k] ?? '—'} → ${nuevo[k] ?? '—'}`), ...cambiosC.map(k => `${ETIQ[k] || k} del cliente`)].join('; ')
    await supabase.from('historial_estados').insert({ pedido_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, nota: `Editado: ${detalle}`.slice(0, 900) })
    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-label="Editar pedido">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">Editar {p.numero}</h3>
            <p className="text-xs text-gray-500">Los cambios quedan anotados en el historial del pedido.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none" aria-label="Cerrar">×</button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Producto</p>
        <L t="Referencia" id="e-ref">
          <input id="e-ref" list="e-refs" value={f.tipo_sofa} onChange={e => set('tipo_sofa', e.target.value)} />
          <datalist id="e-refs">{productos.map(x => <option key={x.referencia} value={x.referencia} />)}</datalist>
        </L>
        <L t="Tela / material" id="e-tela">
          <input id="e-tela" list="e-telas" value={f.material} onChange={e => set('material', e.target.value)} />
          <datalist id="e-telas">{telas.map(x => <option key={x.nombre} value={x.nombre} />)}</datalist>
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L t="Cantidad" id="e-cant"><input id="e-cant" type="number" min="1" inputMode="numeric" value={f.cantidad} onChange={e => set('cantidad', e.target.value)} /></L>
          <L t="Precio total COP" id="e-precio"><input id="e-precio" inputMode="numeric" value={f.precio_venta} onChange={e => set('precio_venta', e.target.value.replace(/\D/g, ''))} /></L>
        </div>
        <p className="text-xs text-gray-500 -mt-2">Abonado: ${Math.round(Number(p.abono || 0)).toLocaleString('es-CO')}. Los pagos se registran en Despachos.</p>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">Fechas y canal</p>
        <div className="grid grid-cols-2 gap-3">
          <L t="Fecha del pedido" id="e-fp"><input id="e-fp" type="date" value={f.fecha_pedido} onChange={e => set('fecha_pedido', e.target.value)} /></L>
          <L t="Fecha de entrega" id="e-fe"><input id="e-fe" type="date" value={f.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} /></L>
        </div>
        {f.fecha_entrega !== String(p.fecha_entrega || '').slice(0, 10) && <p className="text-xs text-amber-700 -mt-2">Para avisarle al cliente la nueva fecha (y revisar que haya cupo), es mejor hacerlo desde Atención al cliente.</p>}
        <div className="grid grid-cols-2 gap-3">
          <L t="Canal" id="e-canal">
            <select id="e-canal" value={f.canal} onChange={e => set('canal', e.target.value)}>
              <option value="">Sin canal</option>
              {CANALES_ED.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </L>
          <L t="Prioridad" id="e-prio">
            <select id="e-prio" value={f.prioridad} onChange={e => set('prioridad', e.target.value)}>
              <option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
            </select>
          </L>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" style={{ width: 'auto' }} checked={f.factura_iva} onChange={e => set('factura_iva', e.target.checked)} /> Factura con IVA</label>
        <L t="Observaciones" id="e-obs"><textarea id="e-obs" rows={2} value={f.observaciones} onChange={e => set('observaciones', e.target.value)} /></L>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">Cliente</p>
        <L t="Nombre" id="e-nom"><input id="e-nom" value={cl.nombre} onChange={e => setC('nombre', e.target.value)} /></L>
        <div className="grid grid-cols-2 gap-3">
          <L t="Cédula / NIT" id="e-ced"><input id="e-ced" inputMode="numeric" value={cl.cedula} onChange={e => setC('cedula', e.target.value)} /></L>
          <L t="Teléfono" id="e-tel"><input id="e-tel" inputMode="tel" value={cl.telefono} onChange={e => setC('telefono', e.target.value)} /></L>
        </div>
        <L t="Correo" id="e-mail"><input id="e-mail" type="email" value={cl.email} onChange={e => setC('email', e.target.value)} /></L>
        <L t="Dirección" id="e-dir"><input id="e-dir" value={cl.direccion} onChange={e => setC('direccion', e.target.value)} /></L>
        <L t="Ciudad" id="e-ciu"><input id="e-ciu" value={cl.ciudad} onChange={e => setC('ciudad', e.target.value)} /></L>
        <p className="text-xs text-gray-500 -mt-2">Los datos del cliente se cambian en todos sus pedidos.</p>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button className="btn flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary flex-1 justify-center" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  )
}
