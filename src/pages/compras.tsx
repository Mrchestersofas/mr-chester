import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShoppingCart, AlertTriangle, CheckCircle, RefreshCw, MessageCircle, Package, Layers } from 'lucide-react'

interface ItemCompra {
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
  origen: 'programacion' | 'stock_minimo' | 'ambos'
}

interface GrupoProveedor {
  proveedor: string
  items: ItemCompra[]
  total: number
}

const ESTADOS_ACTIVOS = ['pendiente', 'estructura', 'tapizado', 'costura', 'control_calidad']

function TabBtn({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function TarjetasResumen({ pedidosCount, itemsCount, total, fmt }: any) {
  return (
    <div className='grid grid-cols-3 gap-4 mb-6'>
      {pedidosCount !== undefined && (
        <div className='card text-center py-4'>
          <p className='text-2xl font-bold text-purple-600'>{pedidosCount}</p>
          <p className='text-xs text-gray-400 mt-1'>Pedidos activos</p>
        </div>
      )}
      <div className='card text-center py-4'>
        <p className='text-2xl font-bold text-orange-500'>{itemsCount}</p>
        <p className='text-xs text-gray-400 mt-1'>Materiales a comprar</p>
      </div>
      <div className='card text-center py-4'>
        <p className='text-2xl font-bold text-gray-800'>{fmt(total)}</p>
        <p className='text-xs text-gray-400 mt-1'>Inversión estimada</p>
      </div>
    </div>
  )
}

function TablaGrupos({ grupos, fmt, generarMsg }: { grupos: GrupoProveedor[], fmt: (n: number) => string, generarMsg: (g: GrupoProveedor) => string }) {
  if (grupos.length === 0) return (
    <div className='card text-center py-16'>
      <CheckCircle size={40} className='mx-auto text-green-400 mb-4' />
      <p className='text-green-600 font-medium'>¡Todo en orden!</p>
      <p className='text-gray-400 text-sm mt-1'>No hay materiales que comprar en esta categoría.</p>
    </div>
  )
  return (
    <>
      {grupos.map(grupo => (
        <div key={grupo.proveedor} className='card mb-4'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h2 className='font-medium text-gray-800'>{grupo.proveedor}</h2>
              <p className='text-xs text-gray-400'>{grupo.items.length} material(es) · Total: <b>{fmt(grupo.total)}</b></p>
            </div>
            <a
              href={`https://wa.me/57?text=${generarMsg(grupo)}`}
              target='_blank'
              rel='noreferrer'
              className='btn flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50'
            >
              <MessageCircle size={15} />
              WhatsApp
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
                  <td><span className='font-semibold text-orange-600'>{item.cantidad_a_comprar} {item.unidad}</span></td>
                  <td className='text-gray-500'>{fmt(item.costo_unitario)}</td>
                  <td className='font-medium'>{fmt(item.costo_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

function agruparPorProveedor(lista: ItemCompra[]): GrupoProveedor[] {
  const mapa: Record<string, ItemCompra[]> = {}
  for (const item of lista) {
    if (!mapa[item.proveedor]) mapa[item.proveedor] = []
    mapa[item.proveedor].push(item)
  }
  return Object.entries(mapa).map(([proveedor, items]) => ({
    proveedor,
    items,
    total: items.reduce((s, i) => s + i.costo_total, 0),
  }))
}

export default function Compras() {
  const [tab, setTab] = useState<'programacion' | 'stock' | 'consolidado'>('programacion')
  const [loading, setLoading] = useState(false)
  const [calculado, setCalculado] = useState(false)
  const [pedidosCount, setPedidosCount] = useState(0)

  const [gruposProgramacion, setGruposProgramacion] = useState<GrupoProveedor[]>([])
  const [gruposStock, setGruposStock] = useState<GrupoProveedor[]>([])
  const [gruposConsolidado, setGruposConsolidado] = useState<GrupoProveedor[]>([])

  const fmt = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

  function generarMensaje(grupo: GrupoProveedor, tipo: string) {
    const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    let msg = `🛋️ *Mr. Chester Sofás — Orden de Compra*\n`
    msg += `📅 ${fecha} · ${tipo}\n\n`
    msg += `Hola, necesitamos los siguientes materiales:\n\n`
    for (const item of grupo.items) {
      msg += `• *${item.nombre}*: ${item.cantidad_a_comprar} ${item.unidad}\n`
    }
    msg += `\nQuedamos atentos a disponibilidad y precio. Gracias 🙏`
    return encodeURIComponent(msg)
  }

  async function calcular() {
    setLoading(true)
    setCalculado(false)

    const { data: materiales } = await supabase.from('materiales').select('*')
    if (!materiales) { setLoading(false); return }

    // ── TAB 1: Por programación ──────────────────────────────
    const { data: pedidos } = await supabase
      .from('pedidos').select('tipo_sofa, cantidad').in('estado', ESTADOS_ACTIVOS)

    setPedidosCount(pedidos?.length || 0)
    const necesidades: Record<string, number> = {}

    if (pedidos) {
      for (const pedido of pedidos) {
        const { data: comps } = await supabase
          .from('componentes_sofa').select('material_id, cantidad_requerida').eq('tipo_sofa', pedido.tipo_sofa)
        if (comps) {
          for (const c of comps) {
            necesidades[c.material_id] = (necesidades[c.material_id] || 0) + c.cantidad_requerida * pedido.cantidad
          }
        }
      }
    }

    const listaProg: ItemCompra[] = []
    for (const [mid, cant] of Object.entries(necesidades)) {
      const mat = materiales.find(m => m.id === mid)
      if (!mat) continue
      const falta = Math.max(0, cant - mat.stock_actual)
      if (falta > 0) {
        listaProg.push({
          material_id: mid, nombre: mat.nombre, unidad: mat.unidad,
          proveedor: mat.proveedor || 'Sin proveedor',
          stock_actual: mat.stock_actual, stock_minimo: mat.stock_minimo,
          cantidad_necesaria: cant, cantidad_a_comprar: falta,
          costo_unitario: mat.costo_unitario, costo_total: falta * mat.costo_unitario,
          origen: 'programacion'
        })
      }
    }

    // ── TAB 2: Stock mínimo ──────────────────────────────────
    const listaStock: ItemCompra[] = []
    for (const mat of materiales) {
      if (mat.stock_actual < mat.stock_minimo) {
        const falta = mat.stock_minimo - mat.stock_actual
        listaStock.push({
          material_id: mat.id, nombre: mat.nombre, unidad: mat.unidad,
          proveedor: mat.proveedor || 'Sin proveedor',
          stock_actual: mat.stock_actual, stock_minimo: mat.stock_minimo,
          cantidad_necesaria: mat.stock_minimo, cantidad_a_comprar: falta,
          costo_unitario: mat.costo_unitario, costo_total: falta * mat.costo_unitario,
          origen: 'stock_minimo'
        })
      }
    }

    // ── TAB 3: Consolidado ───────────────────────────────────
    const mapaConsolidado: Record<string, ItemCompra> = {}

    for (const item of listaProg) {
      mapaConsolidado[item.material_id] = { ...item, origen: 'programacion' }
    }
    for (const item of listaStock) {
      if (mapaConsolidado[item.material_id]) {
        // Ya está por programación — tomar el máximo
        const existing = mapaConsolidado[item.material_id]
        const maxComprar = Math.max(existing.cantidad_a_comprar, item.cantidad_a_comprar)
        mapaConsolidado[item.material_id] = {
          ...existing,
          cantidad_a_comprar: maxComprar,
          costo_total: maxComprar * existing.costo_unitario,
          origen: 'ambos'
        }
      } else {
        mapaConsolidado[item.material_id] = { ...item, origen: 'stock_minimo' }
      }
    }

    setGruposProgramacion(agruparPorProveedor(listaProg))
    setGruposStock(agruparPorProveedor(listaStock))
    setGruposConsolidado(agruparPorProveedor(Object.values(mapaConsolidado)))
    setLoading(false)
    setCalculado(true)
  }

  const totalProg = gruposProgramacion.reduce((s, g) => s + g.total, 0)
  const totalStock = gruposStock.reduce((s, g) => s + g.total, 0)
  const totalConsol = gruposConsolidado.reduce((s, g) => s + g.total, 0)
  const itemsProg = gruposProgramacion.reduce((s, g) => s + g.items.length, 0)
  const itemsStock = gruposStock.reduce((s, g) => s + g.items.length, 0)
  const itemsConsol = gruposConsolidado.reduce((s, g) => s + g.items.length, 0)

  return (
    <div className='p-6 max-w-5xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-xl font-medium'>Compras</h1>
          <p className='text-sm text-gray-400 mt-1'>Planificación inteligente de materiales</p>
        </div>
        <button className='btn btn-primary flex items-center gap-2' onClick={calcular} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Calculando...' : 'Calcular necesidades'}
        </button>
      </div>

      {/* Tabs */}
      <div className='flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit'>
        <TabBtn active={tab === 'programacion'} onClick={() => setTab('programacion')}>
          📋 Por programación {calculado && itemsProg > 0 && <span className='ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5'>{itemsProg}</span>}
        </TabBtn>
        <TabBtn active={tab === 'stock'} onClick={() => setTab('stock')}>
          📦 Stock mínimo {calculado && itemsStock > 0 && <span className='ml-1 bg-red-500 text-white text-xs rounded-full px-1.5'>{itemsStock}</span>}
        </TabBtn>
        <TabBtn active={tab === 'consolidado'} onClick={() => setTab('consolidado')}>
          🧾 Orden consolidada {calculado && itemsConsol > 0 && <span className='ml-1 bg-purple-600 text-white text-xs rounded-full px-1.5'>{itemsConsol}</span>}
        </TabBtn>
      </div>

      {!calculado && !loading && (
        <div className='card text-center py-16'>
          <ShoppingCart size={40} className='mx-auto text-gray-300 mb-4' />
          <p className='text-gray-400 text-sm'>Haz clic en <b>Calcular necesidades</b> para analizar qué materiales debes comprar.</p>
        </div>
      )}

      {calculado && (
        <>
          {tab === 'programacion' && (
            <>
              <TarjetasResumen pedidosCount={pedidosCount} itemsCount={itemsProg} total={totalProg} fmt={fmt} />
              <TablaGrupos grupos={gruposProgramacion} fmt={fmt} generarMsg={g => generarMensaje(g, 'Pedidos activos')} />
            </>
          )}
          {tab === 'stock' && (
            <>
              <TarjetasResumen itemsCount={itemsStock} total={totalStock} fmt={fmt} />
              <TablaGrupos grupos={gruposStock} fmt={fmt} generarMsg={g => generarMensaje(g, 'Reposición stock')} />
            </>
          )}
          {tab === 'consolidado' && (
            <>
              <div className='bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 text-sm text-purple-700'>
                <b>Orden consolidada:</b> combina los materiales de programación y stock mínimo, tomando la cantidad mayor para cada material. Un solo mensaje por proveedor.
              </div>
              <TarjetasResumen itemsCount={itemsConsol} total={totalConsol} fmt={fmt} />
              <TablaGrupos grupos={gruposConsolidado} fmt={fmt} generarMsg={g => generarMensaje(g, 'Orden consolidada')} />
            </>
          )}
        </>
      )}
    </div>
  )
}
