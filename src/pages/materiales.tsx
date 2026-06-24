import { useEffect, useState } from 'react'
import { supabase, Material } from '@/lib/supabase'
import { AlertTriangle, Plus, CheckCircle } from 'lucide-react'

export default function Materiales() {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [nuevoStock, setNuevoStock] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', stock_actual: '', stock_minimo: '', unidad: 'kg', costo_unitario: '', proveedor: '' })

  async function cargar() {
    const { data } = await supabase.from('materiales').select('*').order('nombre')
    setMateriales(data || [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function actualizarStock(id: string) {
    await supabase.from('materiales').update({ stock_actual: Number(nuevoStock) }).eq('id', id)
    setEditando(null)
    setNuevoStock('')
    cargar()
  }

  async function agregarMaterial() {
    await supabase.from('materiales').insert({
      nombre: form.nombre,
      stock_actual: Number(form.stock_actual),
      stock_minimo: Number(form.stock_minimo),
      unidad: form.unidad,
      costo_unitario: Number(form.costo_unitario),
      proveedor: form.proveedor,
    })
    setShowForm(false)
    setForm({ nombre: '', stock_actual: '', stock_minimo: '', unidad: 'kg', costo_unitario: '', proveedor: '' })
    cargar()
  }

  const alertas = materiales.filter(m => m.stock_actual < m.stock_minimo)
  const ok = materiales.filter(m => m.stock_actual >= m.stock_minimo)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Materiales</h1>
          <p className="text-sm text-gray-400">{alertas.length} material(es) por reabastecer</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> Agregar material
        </button>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="card mb-5 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-medium text-amber-800">Materiales por comprar hoy</h2>
          </div>
          <div className="space-y-2">
            {alertas.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{m.nombre}</p>
                  <p className="text-xs text-gray-400">{m.proveedor}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-red-600 font-medium">
                    {m.stock_actual} {m.unidad} disponibles
                  </p>
                  <p className="text-xs text-gray-400">Mínimo: {m.stock_minimo} {m.unidad}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs text-gray-500">Pedir mínimo:</p>
                  <p className="text-sm font-medium text-amber-700">
                    {Math.ceil(m.stock_minimo * 2 - m.stock_actual)} {m.unidad}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario nuevo material */}
      {showForm && (
        <div className="card mb-5">
          <h2 className="text-sm font-medium mb-4">Nuevo material</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            <input placeholder="Stock actual" type="number" value={form.stock_actual} onChange={e => setForm({...form, stock_actual: e.target.value})} />
            <input placeholder="Stock mínimo" type="number" value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: e.target.value})} />
            <select value={form.unidad} onChange={e => setForm({...form, unidad: e.target.value})}>
              <option value="kg">kg</option>
              <option value="metro">metro</option>
              <option value="m2">m²</option>
              <option value="unidad">unidad</option>
              <option value="rollo">rollo</option>
              <option value="litro">litro</option>
            </select>
            <input placeholder="Costo unitario (COP)" type="number" value={form.costo_unitario} onChange={e => setForm({...form, costo_unitario: e.target.value})} />
            <input placeholder="Proveedor" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={agregarMaterial}>Guardar material</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla completa */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400 text-center">Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Proveedor</th>
                <th>Stock actual</th>
                <th>Mínimo</th>
                <th>Unidad</th>
                <th>Costo unit.</th>
                <th>Estado</th>
                <th>Actualizar stock</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map(m => {
                const bajo = m.stock_actual < m.stock_minimo
                return (
                  <tr key={m.id}>
                    <td className="font-medium">{m.nombre}</td>
                    <td className="text-gray-400 text-xs">{m.proveedor || '—'}</td>
                    <td className={`font-medium ${bajo ? 'text-red-600' : 'text-gray-800'}`}>
                      {m.stock_actual}
                    </td>
                    <td className="text-gray-400">{m.stock_minimo}</td>
                    <td className="text-gray-400">{m.unidad}</td>
                    <td>${Number(m.costo_unitario).toLocaleString('es-CO')}</td>
                    <td>
                      {bajo
                        ? <span className="badge badge-warning"><AlertTriangle size={10} className="mr-1" />Reabastecer</span>
                        : <span className="badge badge-ready"><CheckCircle size={10} className="mr-1" />OK</span>
                      }
                    </td>
                    <td>
                      {editando === m.id ? (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            className="w-20 text-xs py-1"
                            value={nuevoStock}
                            onChange={e => setNuevoStock(e.target.value)}
                            autoFocus
                          />
                          <button className="btn btn-primary text-xs py-1 px-2" onClick={() => actualizarStock(m.id)}>✓</button>
                          <button className="btn text-xs py-1 px-2" onClick={() => setEditando(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="btn text-xs py-1 px-2" onClick={() => { setEditando(m.id); setNuevoStock(m.stock_actual.toString()) }}>
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
