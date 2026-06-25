import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

export default function NuevoPedido() {
  const router = useRouter()
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [telas, setTelas] = useState([])
  const [form, setForm] = useState({
    cliente_id: '', referencia_id: '', tela_id: '',
    cantidad: 1, fecha_entrega: '', prioridad: 'normal',
    precio_venta: '', observaciones: '',
    crear_cliente: false, nuevo_nombre: '', nuevo_tel: '', nuevo_email: ''
  })
  const prod = productos.find(p => p.id === form.referencia_id)
  const tela = telas.find(t => t.id === form.tela_id)
  const cats = [...new Set(productos.map(p => p.categoria))]

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({data}) => setClientes(data || []))
    supabase.from('productos').select('*').order('categoria').then(({data}) => setProductos(data || []))
    supabase.from('materiales').select('*').eq('unidad','metro').order('nombre').then(({data}) => setTelas(data || []))
  }, [])

  function set(f, v) { setForm(p => ({...p, [f]: v})) }

  async function guardar() {
    if (!prod || !form.tela_id || !form.fecha_entrega || !form.precio_venta) return
    let cid = form.cliente_id
    if (form.crear_cliente && form.nuevo_nombre) {
      const { data: nc } = await supabase.from('clientes').insert({
        nombre: form.nuevo_nombre, telefono: form.nuevo_tel, email: form.nuevo_email
      }).select().single()
      if (nc) cid = nc.id
    }
    await supabase.from('pedidos').insert({
      numero: '', cliente_id: cid || null,
      tipo_sofa: prod.referencia, material: tela ? tela.nombre : '',
      color: tela ? tela.nombre : '', cantidad: Number(form.cantidad),
      fecha_entrega: form.fecha_entrega, prioridad: form.prioridad,
      estado: 'pendiente', precio_venta: Number(form.precio_venta),
      observaciones: form.observaciones
    })
    router.push('/pedidos')
  }

  return (
    <div className='p-6 max-w-3xl mx-auto'>
      <h1 className='text-xl font-medium mb-6'>Nuevo pedido</h1>
      <div className='card space-y-5'>
        <section>
          <h2 className='text-sm font-medium mb-3'>Cliente</h2>
          <div className='flex gap-3 mb-3'>
            <label className='flex items-center gap-2 text-sm'>
              <input type='radio' checked={!form.crear_cliente} onChange={() => set('crear_cliente', false)}/> Existente
            </label>
            <label className='flex items-center gap-2 text-sm'>
              <input type='radio' checked={form.crear_cliente} onChange={() => set('crear_cliente', true)}/> Nuevo
            </label>
          </div>
          {!form.crear_cliente
            ? <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                <option value=''>Seleccionar cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            : <div className='grid grid-cols-3 gap-3'>
                <input placeholder='Nombre' value={form.nuevo_nombre} onChange={e => set('nuevo_nombre', e.target.value)}/>
                <input placeholder='Telefono' value={form.nuevo_tel} onChange={e => set('nuevo_tel', e.target.value)}/>
                <input placeholder='Email' value={form.nuevo_email} onChange={e => set('nuevo_email', e.target.value)}/>
              </div>
          }
        </section>
        <section>
          <h2 className='text-sm font-medium mb-3'>Producto</h2>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Referencia</label>
              <select value={form.referencia_id} onChange={e => set('referencia_id', e.target.value)}>
                <option value=''>Seleccionar</option>
                {cats.map(cat => (
                  <optgroup key={cat} label={cat}>
                    {productos.filter(p => p.categoria === cat).map(p => (
                      <option key={p.id} value={p.id}>{p.referencia}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Tela</label>
              <select value={form.tela_id} onChange={e => set('tela_id', e.target.value)}>
                <option value=''>Seleccionar</option>
                {telas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Cantidad</label>
              <input type='number' min='1' value={form.cantidad} onChange={e => set('cantidad', e.target.value)}/>
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Prioridad</label>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                <option value='normal'>Normal</option>
                <option value='alta'>Alta</option>
                <option value='urgente'>Urgente</option>
              </select>
            </div>
          </div>
          {prod && (
            <div className='mt-3 bg-purple-50 rounded-lg p-3 text-sm grid grid-cols-3 gap-2'>
              <div><span className='text-gray-500 text-xs block'>Metros tela</span><b>{prod.metros_tela}m</b></div>
              <div><span className='text-gray-500 text-xs block'>Precio publico</span><b>${prod.valor_publico}</b></div>
              <div><span className='text-gray-500 text-xs block'>Precio oferta</span><b>${prod.valor_oferta}</b></div>
            </div>
          )}
        </section>
        <section>
          <h2 className='text-sm font-medium mb-3'>Precio y fecha</h2>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Precio venta COP</label>
              <input placeholder='Ej 2065000' value={form.precio_venta} onChange={e => set('precio_venta', e.target.value)}/>
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Fecha entrega</label>
              <input type='date' value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)}/>
            </div>
          </div>
        </section>
        <section>
          <label className='text-xs text-gray-500 mb-1 block'>Observaciones</label>
          <textarea rows={2} value={form.observaciones} onChange={e => set('observaciones', e.target.value)}/>
        </section>
        <div className='flex gap-3'>
          <button className='btn btn-primary' onClick={guardar}>Guardar pedido</button>
          <button className='btn' onClick={() => router.push('/pedidos')}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}