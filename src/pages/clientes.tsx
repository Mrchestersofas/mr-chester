import { useEffect, useState } from 'react'
import { supabase, Cliente, Pedido } from '@/lib/supabase'
import { EstadoBadge } from '@/components/Badges'
import { Mail, Phone, Plus } from 'lucide-react'

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pedidosPorCliente, setPedidosPorCliente] = useState<Record<string, Pedido[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '' })
  const [mensajeEnviado, setMensajeEnviado] = useState<string | null>(null)

  async function cargar() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('pedidos').select('*').order('created_at', { ascending: false }),
    ])
    setClientes(c || [])
    const agrupado: Record<string, Pedido[]> = {}
    for (const pedido of (p || [])) {
      if (pedido.cliente_id) {
        if (!agrupado[pedido.cliente_id]) agrupado[pedido.cliente_id] = []
        agrupado[pedido.cliente_id].push(pedido)
      }
    }
    setPedidosPorCliente(agrupado)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function agregarCliente() {
    if (!form.nombre) return
    await supabase.from('clientes').insert(form)
    setShowForm(false)
    setForm({ nombre: '', telefono: '', email: '' })
    cargar()
  }

  function notificarWhatsApp(cliente: Cliente, pedido: Pedido) {
    const estados: Record<string, string> = {
      pendiente: 'está pendiente de iniciar',
      estructura: 'está en la etapa de estructura',
      tapizado: 'está siendo tapizado',
      costura: 'está en costura',
      control_calidad: 'está en control de calidad',
      listo: 'está LISTO para entrega 🎉',
      entregado: 'fue entregado',
    }
    const texto = `Hola ${cliente.nombre}! Te informamos que tu pedido *${pedido.numero}* (${pedido.tipo_sofa} — ${pedido.color}) ${estados[pedido.estado] || pedido.estado}. Gracias por confiar en Mr. Chester! 🛋️`
    const num = cliente.telefono?.replace(/\D/g, '')
    const url = `https://wa.me/57${num}?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
    setMensajeEnviado(pedido.id)
    setTimeout(() => setMensajeEnviado(null), 3000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Clientes</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      {showForm && (
        <div className="card mb-5">
          <h2 className="text-sm font-medium mb-3">Nuevo cliente</h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
            <input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={agregarCliente}>Guardar</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {clientes.map(c => {
            const pedidos = pedidosPorCliente[c.id] || []
            const totalCompras = pedidos.reduce((s, p) => s + Number(p.precio_venta), 0)
            const activos = pedidos.filter(p => p.estado !== 'entregado')
            const isOpen = expandido === c.id

            return (
              <div key={c.id} className="card">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandido(isOpen ? null : c.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 font-medium text-sm">
                      {c.nombre.split(' ').map(w => w[0]).slice(0,2).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.nombre}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {c.telefono && <span><Phone size={10} className="inline mr-1" />{c.telefono}</span>}
                        {c.email && <span><Mail size={10} className="inline mr-1" />{c.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-xs text-gray-400">Pedidos</p>
                      <p className="text-sm font-medium">{pedidos.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Total compras</p>
                      <p className="text-sm font-medium">${totalCompras.toLocaleString('es-CO')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Activos</p>
                      <p className={`text-sm font-medium ${activos.length > 0 ? 'text-purple-600' : 'text-gray-400'}`}>{activos.length}</p>
                    </div>
                    <span className="text-gray-300 text-lg">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && pedidos.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 mb-3">Historial de pedidos</p>
                    <div className="space-y-2">
                      {pedidos.map(p => (
                        <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-purple-700 w-16">{p.numero}</span>
                          <div className="flex-1">
                            <p className="text-xs">{p.tipo_sofa} — {p.color}</p>
                            <p className="text-xs text-gray-400">Entrega: {p.fecha_entrega}</p>
                          </div>
                          <EstadoBadge estado={p.estado} />
                          <span className="text-xs font-medium">${Number(p.precio_venta).toLocaleString('es-CO')}</span>
                          {p.estado !== 'entregado' && c.telefono && (
                            <button
                              className={`btn text-xs py-1 px-2 ${mensajeEnviado === p.id ? 'btn-primary' : ''}`}
                              onClick={() => notificarWhatsApp(c, p)}
                            >
                              {mensajeEnviado === p.id ? '✓ Enviado' : '📱 WhatsApp'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isOpen && pedidos.length === 0 && (
                  <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">Sin pedidos registrados.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
