import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShoppingCart, AlertTriangle, CheckCircle, RefreshCw, MessageCircle } from 'lucide-react'

interface NecesidadCompra {
  material_id: string
  nombre: string
  unidad: string
  proveedor: string
  stock_actual: number
  stock_minimo: number
  cantidad_necesaria: number
  cantidad_a_comprar: number
  costo_unitario: number
  costo_total: number
}

interface GrupoProveedor {
  proveedor: string
  items: NecesidadCompra[]
  total: number
}

const ESTADOS_ACTIVOS = ['pendiente', 'estructura', 'tapizado', 'costura', 'control_calidad']

export default function Compras() {
  const [loading, setLoading] = useState(false)
  const [grupos, setGrupos] = useState<GrupoProveedor[]>([])
  const [totalGeneral, setTotalGeneral] = useState(0)
  const [pedidosCount, setPedidosCount] = useState(0)
  const [calculado, setCalculado] = useState(false)

  async function calcularCompras() {
    setLoading(true)
    setCalculado(false)

    // 1. Obtener pedidos activos
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('tipo_sofa, cantidad')
      .in('estado', ESTADOS_ACTIVOS)

    if (!pedidos || pedidos.length === 0) {
      setGrupos([])
      setPedidosCount(0)
      setLoading(false)
      setCalculado(true)
      return
    }

    setPedidosCount(pedidos.length)

    // 2. Sumar materiales necesarios por tipo de sofá
    const necesidades: Record<string, number> = {}

    for (const pedido of pedidos) {
      const { data: componentes } = await supabase
        .from('componentes_sofa')
        .select('material_id, cantidad_requerida')
        .eq('tipo_sofa', pedido.tipo_sofa)

      if (componentes) {
        for (const comp of componentes) {
          const key = comp.material_id
          necesidades[key] = (necesidades[key] || 0) + (comp.cantidad_requerida * pedido.cantidad)
        }
      }
    }

    // 3. Obtener info de materiales y calcular qué comprar
    const { data: materiales } = await supabase
      .from('materiales')
      .select('*')

    if (!materiales) {
      setLoading(false)
      return
    }

    const lista: NecesidadCompra[] = []

    for (const [material_id, cantidad_necesaria] of Object.entries(necesidades)) {
      const mat = materiales.find(m => m.id === material_id)
      if (!mat) continue

      const disponible = mat.stock_actual
      const cantidad_a_comprar = Math.max(0, cantidad_necesaria - disponible)

      if (cantidad_a_comprar > 0) {
        lista.push({
          material_id,
          nombre: mat.nombre,
          unidad: mat.unidad,
          proveedor: mat.proveedor || 'Sin proveedor',
          stock_actual: disponible,
          stock_minimo: mat.stock_minimo,
          cantidad_necesaria,
          cantidad_a_comprar,
          costo_unitario: mat.costo_unitario,
          costo_total: cantidad_a_comprar * mat.costo_unitario,
        })
      }
    }

    // 4. Agrupar por proveedor
    const mapaProveedores: Record<string, NecesidadCompra[]> = {}
    for (const item of lista) {
      if (!mapaProveedores[item.proveedor]) mapaProveedores[item.proveedor] = []
      mapaProveedores[item.proveedor].push(item)
    }

    const gruposFinales: GrupoProveedor[] = Object.entries(mapaProveedores).map(([proveedor, items]) => ({
      proveedor,
      items,
      total: items.reduce((s, i) => s + i.costo_total, 0),
    }))

    const total = gruposFinales.reduce((s, g) => s + g.total, 0)

    setGrupos(gruposFinales)
    setTotalGeneral(total)
    setLoading(false)
    setCalculado(true)
  }

  function generarMensajeWhatsApp(grupo: GrupoProveedor) {
    const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    let msg = `🛋️ *Mr. Chester Sofás — Orden de Compra*\n`
    msg += `📅 ${fecha}\n\n`
    msg += `Hola, necesitamos los siguientes materiales:\n\n`
    for (const item of grupo.items) {
      msg += `• *${item.nombre}*: ${item.cantidad_a_comprar} ${item.unidad}\n`
    }
    msg += `\nQuedamos atentos a disponibilidad y precio. Gracias 🙏`
    return encodeURIComponent(msg)
  }

  const fmt = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

  return (
    <div className='p-6 max-w-5xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-xl font-medium'>Compras</h1>
          <p className='text-sm text-gray-400 mt-1'>Calcula automáticamente qué materiales debes comprar según los pedidos activos</p>
        </div>
        <button className='btn btn-primary flex items-center gap-2' onClick={calcularCompras} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Calculando...' : 'Calcular necesidades'}
        </button>
      </div>

      {!calculado && !loading && (
        <div className='card text-center py-16'>
          <ShoppingCart size={40} className='mx-auto text-gray-300 mb-4' />
          <p className='text-gray-400 text-sm'>Haz clic en <b>Calcular necesidades</b> para ver qué materiales debes comprar según los pedidos en producción.</p>
        </div>
      )}

      {calculado && grupos.length === 0 && (
        <div className='card text-center py-16'>
          <CheckCircle size={40} className='mx-auto text-green-400 mb-4' />
          <p className='text-green-600 font-medium'>¡Tienes todo el stock necesario!</p>
          <p className='text-gray-400 text-sm mt-1'>No hay materiales que comprar para los {pedidosCount} pedidos activos.</p>
        </div>
      )}

      {calculado && grupos.length > 0 && (
        <>
          {/* Resumen */}
          <div className='grid grid-cols-3 gap-4 mb-6'>
            <div className='card text-center py-4'>
              <p className='text-2xl font-bold text-purple-600'>{pedidosCount}</p>
              <p className='text-xs text-gray-400 mt-1'>Pedidos activos</p>
            </div>
            <div className='card text-center py-4'>
              <p className='text-2xl font-bold text-orange-500'>{grupos.reduce((s, g) => s + g.items.length, 0)}</p>
              <p className='text-xs text-gray-400 mt-1'>Materiales a comprar</p>
            </div>
            <div className='card text-center py-4'>
              <p className='text-2xl font-bold text-gray-800'>{fmt(totalGeneral)}</p>
              <p className='text-xs text-gray-400 mt-1'>Inversión estimada</p>
            </div>
          </div>

          {/* Órdenes por proveedor */}
          {grupos.map(grupo => (
            <div key={grupo.proveedor} className='card mb-4'>
              <div className='flex items-center justify-between mb-4'>
                <div>
                  <h2 className='font-medium text-gray-800'>{grupo.proveedor}</h2>
                  <p className='text-xs text-gray-400'>{grupo.items.length} material(es) · Total: <b>{fmt(grupo.total)}</b></p>
                </div>
                <a
                  href={`https://wa.me/57?text=${generarMensajeWhatsApp(grupo)}`}
                  target='_blank'
                  rel='noreferrer'
                  className='btn flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50'
                >
                  <MessageCircle size={15} />
                  Enviar por WhatsApp
                </a>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Stock actual</th>
                    <th>Necesario</th>
                    <th>A comprar</th>
                    <th>Costo unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.items.map(item => (
                    <tr key={item.material_id}>
                      <td>
                        <span className='font-medium'>{item.nombre}</span>
                        <span className='text-xs text-gray-400 ml-1'>({item.unidad})</span>
                      </td>
                      <td>
                        <span className={item.stock_actual < item.stock_minimo ? 'text-red-500 font-medium' : ''}>
                          {item.stock_actual} {item.unidad}
                        </span>
                      </td>
                      <td>{item.cantidad_necesaria} {item.unidad}</td>
                      <td>
                        <span className='font-semibold text-orange-600'>{item.cantidad_a_comprar} {item.unidad}</span>
                      </td>
                      <td className='text-gray-500'>{fmt(item.costo_unitario)}</td>
                      <td className='font-medium'>{fmt(item.costo_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
