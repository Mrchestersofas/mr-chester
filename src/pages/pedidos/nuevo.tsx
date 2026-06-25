import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase, Cliente } from '@/lib/supabase'
import { CheckCircle, AlertTriangle } from 'lucide-react'

interface Producto {
  id: string
  categoria: string
  referencia: string
  tipo_sofa: string
  valor_publico: number
  valor_oferta: number
  metros_tela: number
}

interface Material {
  id: string
  nombre: string
  costo_unitario: number
  unidad: string
}

export default function NuevoPedido() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [telas, setTelas] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [costoEstimado, setCostoEstimado] = useState(0)
  const [form, setForm] = useState({
    cliente_id: '',
    referencia_id: '',
    tela_id: '',
    cantidad: 1,
    fecha_entrega: '',
    prioridad: 'normal',
    precio_venta: '',
    usar_precio: 'oferta',
    observaciones: '',
    nuevo_cliente_nombre: '',
    nuevo_cliente_telefono: '',
    nuevo_cliente_email: '',
    crear_cliente: false,
  })
  const productoSeleccionado = productos.find(p => p.id === form.referencia_id)
  const telaSeleccionada = telas.find(t => t.id === form.tela_id)
  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: p }, { data: t }] = await Promise.all([
        supabase.from('clientes').select('*').order('nombre'),
        supabase.from('productos').select('*').order('categoria').order('referencia'),
        supabase.from('materiales').select('*').eq('unidad', 'metro').order('nombre'),
      ])
      setClientes(c || [])
      setProductos(p || [])
      setTelas(t || [])
    }
    cargar()
  }, [])
  useEffect(() => {
    if (productoSeleccionado && telaSeleccionada) {
      const costoTela = productoSeleccionado.metros_tela * telaSeleccionada.costo_unitario
      setCostoEstimado((488000 + costoTela) * form.cantidad)
    }
  }, [form.referencia_id, form.tela_id, form.cantidad])
  useEffect(() => {
    if (productoSeleccionado && form.usar_precio !== 'personalizado') {
      const precio = form.usar_precio === 'oferta' ? productoSeleccionado.valor_oferta : productoSeleccionado.valor_publico
      set('precio_venta', (precio * Number(form.cantidad)).toString())
    }
  }, [form.referencia_id, form.usar_precio, form.cantidad])
  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }
  const categorias = [...new Set(productos.map(p => p.categoria))]
  async function guardar() {
    setError('')
    if (!productoSeleccionado || !form.tela_id || !form.fecha_entrega || !form.precio_venta) {
      setError('Completa todos los campos obligatorios.')
      return
    }
    setLoading(true)
    let clienteId = form.cliente_id
    if (form.crear_cliente && form.nuevo_cliente_nombre) {
      const { data: nuevoCliente, error: errCliente } = await supabase
        .from('clientes').insert({ nombre: form.nuevo_cliente_nombre, telefono: form.nuevo_cliente_telefono, email: form.nuevo_cliente_email })
        .select().single()
      if (errCliente || !nuevoCliente) { setError('Error al crear el cliente.'); setLoading(false); return }
      clienteId = nuevoCliente.id
    }
    const { error: errPedido } = await supabase.from('pedidos').insert({
      numero: '',
      cliente_id: clienteId || null,
      tipo_sofa: productoSeleccionado.referencia,
      material: telaSeleccionada?.nombre || '',
      color: telaSeleccionada?.nombre || '',
      cantidad: Number(form.cantidad),
      fecha_entrega: form.fecha_entrega,
      prioridad: form.prioridad,
      estado: 'pendiente',
      precio_venta: Number(form.precio_venta.toString().replace(/\./g, '')),
      observaciones: `Tela: ${telaSeleccionada?.nombre} | Metros: ${productoSeleccionado.metros_tela} | Costo est: $${costoEstimado.toLocaleString('es-CO')} | ${form.observaciones}`,
    })
    if (errPedido) { setError('Error al guardar: ' + errPedido.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/pedidos'), 1500)
  }
  if (success) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <CheckCircle size={48} className="text-green-500" />
      <p className="text-lg font-medium">Pedido registrado</p>
      <p className="text-sm text-gray-400">Redirigiendo...</p>
    </div>
  )
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-medium mb-1">Nuevo pedido</h1>
      <p className="text-sm text-gray-400 mb-6">El número se asigna automáticamente.</p>
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      <div className="card space-y-5">
        <section>
          <h2 className="text-sm font-medium mb-3 text-gray-700">Cliente</h2>
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="modo_cliente" checked={!form.crear_cliente} onChange={() => set('crear_cliente', false)} />
              Cliente existente
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="modo_cliente" checked={form.crear_cliente} onChange={() => set('crear_cliente', true)} />
              Cliente nuevo
            </label>
          </div>
          {!form.crear_cliente ? (
            <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
              <option value="">— Seleccionar cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input placeholder="Nombre *" value={form.nuevo_cliente_nombre} onChange={e => set('nuevo_cliente_nombre', e.target.value)} />
              <input placeholder="Teléfono" value={form.nuevo_cliente_telefono} onChange={e => set('nuevo_cliente_telefono', e.target.value)} />
              <input placeholder="Email" value={form.nuevo_cliente_email} onChange={e => set('nuevo_cliente_email', e.target.value)} />
            </div>
          )}
        </section>
        <section>
          <h2 className="text-sm font-medium mb-3 text-gray-700">Producto *</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Referencia *</label>
              <select value={form.referencia_id} onChange={e => set('referencia_id', e.target.value)}>
                <option value="">— Seleccionar referencia —</option>
                {categorias.map(cat => (
                  <optgroup key={cat} label={cat}>
                    {productos.filter(p => p.categoria === cat).map(p => (
                      <option key={p.id} value={p.id}>{p.referencia}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tela *</label>
              <select value={form.tela_id} onChange={e => set('tela_id', e.target.value)}>
                <option value="">— Seleccionar tela —</option>
                {telas.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} — ${t.costo_unitario.toLocaleString('es-CO')}/m</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
              <input type="number" min="1" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prioridad</label>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          {productoSeleccionado && (
            <div className="mt-3 bg-purple-50 rounded-lg px-4 py-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-gray-500 text-xs block">Metros de tela</span><span className="font-medium">{productoSeleccionado.metros_tela} m</span></div>
                <div><span className="text-gray-500 text-xs block">Precio público</span><span className="font-medium">${productoSeleccionado.valor_publico.toLocaleString('es-CO')}</span></div>
                <div><span className="text-gray-500 text-xs block">Precio oferta</span><span className="font-medium">${productoSeleccionado.valor_oferta.toLocaleString('es-CO')}</span></div>
              </div>
              {costoEstimado > 0 && (
                <div className="mt-2 pt-2 border-t border-purple-100">
                  <span className="text-gray-500 text-xs">Costo estimado: </span>
                  <span className="font-medium text-purple-700">${costoEstimado.toLocaleString('es-CO')}</span>
                  {form.precio_venta && (
                    <span className="ml-3 text-green-600 text-xs font-medium">
                      Margen est: {(((Number(form.precio_venta) - costoEstimado) / Number(form.precio_venta)) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-sm font-medium mb-3 text-gray-700">Precio de venta</h2>
          <div className="flex gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="precio" checked={form.usar_precio === 'oferta'} onChange={() => set('usar_precio', 'oferta')} /> Precio oferta
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="precio" checked={form.usar_precio === 'publico'} onChange={() => set('usar_precio', 'publico')} /> Precio público
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="precio" checked={form.usar_precio === 'personalizado'} onChange={() => set('usar_precio', 'personalizado')} /> Personalizado
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio final (COP) *</label>
              <input placeholder="Se llena automático" value={form.precio_venta} onChange={e => { set('usar_precio', 'personalizado'); set('precio_venta', e.target.value) }} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha de entrega *</label>
              <input type="date" value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} />
            </div>
          </div>
        </section>
        <section>
          <label className="text-xs text-gray-500 mb-1 block">Observaciones adicionales</label>
          <textarea rows={2} placeholder="Instrucciones especiales, acabados, entrega..." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
        </section>
        <div className="flex gap-3 pt-2">
          <button className="btn btn-primary" onClick={guardar} disabled={loading}>
            {loading ? 'Guardando...' : '✓ Guardar pedido'}
          </button>
          <button className="btn" onClick={() => router.push('/pedidos')}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}