import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase, Cliente } from '@/lib/supabase'
import { CheckCircle, AlertTriangle } from 'lucide-react'

const TIPOS_SOFA = [
  'Chester 3 puestos',
  'Chester 2 puestos',
  'Love seat',
  'Esquinero modular',
  'Sofá cama 2 puestos',
  'Sofá cama 3 puestos',
  'Personalizado',
]

const MATERIALES = [
  'Cuero natural',
  'Cuero sintético',
  'Tela lino',
  'Terciopelo',
  'Microfibra',
  'Tela bouclé',
  'Otro',
]

export default function NuevoPedido() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    cliente_id: '',
    tipo_sofa: TIPOS_SOFA[0],
    material: MATERIALES[0],
    color: '',
    cantidad: 1,
    fecha_entrega: '',
    prioridad: 'normal',
    precio_venta: '',
    observaciones: '',
    // Nuevo cliente inline
    nuevo_cliente_nombre: '',
    nuevo_cliente_telefono: '',
    nuevo_cliente_email: '',
    crear_cliente: false,
  })

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => {
      setClientes(data || [])
    })
  }, [])

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function guardar() {
    setError('')
    if (!form.tipo_sofa || !form.color || !form.fecha_entrega || !form.precio_venta) {
      setError('Completa todos los campos obligatorios.')
      return
    }

    setLoading(true)
    let clienteId = form.cliente_id

    // Crear cliente nuevo si es necesario
    if (form.crear_cliente && form.nuevo_cliente_nombre) {
      const { data: nuevoCliente, error: errCliente } = await supabase
        .from('clientes')
        .insert({ nombre: form.nuevo_cliente_nombre, telefono: form.nuevo_cliente_telefono, email: form.nuevo_cliente_email })
        .select().single()
      if (errCliente || !nuevoCliente) {
        setError('Error al crear el cliente.')
        setLoading(false)
        return
      }
      clienteId = nuevoCliente.id
    }

    const { error: errPedido } = await supabase.from('pedidos').insert({
      numero: '',
      cliente_id: clienteId || null,
      tipo_sofa: form.tipo_sofa,
      material: form.material,
      color: form.color,
      cantidad: Number(form.cantidad),
      fecha_entrega: form.fecha_entrega,
      prioridad: form.prioridad,
      estado: 'pendiente',
      precio_venta: Number(form.precio_venta.toString().replace(/\./g, '')),
      observaciones: form.observaciones,
    })

    if (errPedido) {
      setError('Error al guardar: ' + errPedido.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/pedidos'), 1500)
  }

  if (success) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <CheckCircle size={48} className="text-green-500" />
      <p className="text-lg font-medium text-gray-800">Pedido registrado</p>
      <p className="text-sm text-gray-400">Redirigiendo a la lista de pedidos...</p>
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
        {/* Cliente */}
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
              <input placeholder="Nombre del cliente *" value={form.nuevo_cliente_nombre} onChange={e => set('nuevo_cliente_nombre', e.target.value)} />
              <input placeholder="Teléfono" value={form.nuevo_cliente_telefono} onChange={e => set('nuevo_cliente_telefono', e.target.value)} />
              <input placeholder="Email" value={form.nuevo_cliente_email} onChange={e => set('nuevo_cliente_email', e.target.value)} />
            </div>
          )}
        </section>

        {/* Producto */}
        <section>
          <h2 className="text-sm font-medium mb-3 text-gray-700">Producto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo de sofá *</label>
              <select value={form.tipo_sofa} onChange={e => set('tipo_sofa', e.target.value)}>
                {TIPOS_SOFA.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Material *</label>
              <select value={form.material} onChange={e => set('material', e.target.value)}>
                {MATERIALES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Color *</label>
              <input placeholder="Ej. Café oscuro, gris perla..." value={form.color} onChange={e => set('color', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
              <input type="number" min="1" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Fecha y precio */}
        <section>
          <h2 className="text-sm font-medium mb-3 text-gray-700">Entrega y precio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha de entrega *</label>
              <input type="date" value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prioridad</label>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Precio de venta (COP) *</label>
              <input placeholder="Ej. 3200000" value={form.precio_venta} onChange={e => set('precio_venta', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Observaciones */}
        <section>
          <label className="text-xs text-gray-500 mb-1 block">Observaciones / especificaciones</label>
          <textarea
            rows={3}
            placeholder="Medidas especiales, acabados, instrucciones de entrega..."
            value={form.observaciones}
            onChange={e => set('observaciones', e.target.value)}
          />
        </section>

        <div className="flex gap-3 pt-2">
          <button className="btn btn-primary" onClick={guardar} disabled={loading}>
            {loading ? 'Guardando...' : '✓ Guardar pedido y programar producción'}
          </button>
          <button className="btn" onClick={() => router.push('/pedidos')}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
