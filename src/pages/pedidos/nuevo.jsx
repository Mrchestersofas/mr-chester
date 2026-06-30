import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'

export default function NuevoPedido() {
  const router = useRouter()
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [telas, setTelas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '',
    referencia_id: '',
    tela_id: '',
    cantidad: 1,
    fecha_entrega: '',
    prioridad: 'normal',
    precio_venta: '',
    observaciones: '',
    crear_cliente: false,
    nuevo_nombre: '',
    nuevo_cedula: '',
    nuevo_direccion: '',
    nuevo_ciudad: '',
    nuevo_tel: '',
    nuevo_email: '',
    abono: '',
    medio_pago: '',
  })

  const prod = productos.find(p => p.id === form.referencia_id)
  const tela = telas.find(t => t.id === form.tela_id)
  const cats = [...new Set(productos.map(p => p.categoria))]

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('productos').select('*').order('categoria').then(({ data }) => setProductos(data || []))
    supabase.from('materiales').select('*').eq('unidad', 'metro').order('nombre').then(({ data }) => setTelas(data || []))
  }, [])

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function guardar() {
    if (!prod || !form.tela_id || !form.fecha_entrega || !form.precio_venta) return
    setGuardando(true)

    let cliente = null

    if (form.crear_cliente && form.nuevo_nombre) {
      const { data: nc } = await supabase.from('clientes').insert({
        nombre: form.nuevo_nombre,
        cedula: form.nuevo_cedula,
        direccion: form.nuevo_direccion,
        ciudad: form.nuevo_ciudad,
        telefono: form.nuevo_tel,
        email: form.nuevo_email,
      }).select().single()
      if (nc) cliente = nc
    } else if (form.cliente_id) {
      const { data: ec } = await supabase.from('clientes').select('*').eq('id', form.cliente_id).single()
      if (ec) cliente = ec
    }

    const { data: pedido } = await supabase.from('pedidos').insert({
      numero: '',
      cliente_id: cliente?.id || null,
      tipo_sofa: prod.referencia,
      material: tela ? tela.nombre : '',
      color: tela ? tela.nombre : '',
      cantidad: Number(form.cantidad),
      fecha_entrega: form.fecha_entrega,
      prioridad: form.prioridad,
      estado: 'pendiente',
      precio_venta: Number(form.precio_venta),
      observaciones: form.observaciones,
      abono: Number(form.abono) || 0,
      medio_pago: form.medio_pago,
    }).select().single()

    // Enviar email de confirmación si el cliente tiene email
    if (pedido && cliente?.email) {
      try {
        await fetch('/api/enviar-confirmacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedido, cliente }),
        })
      } catch (e) {
        console.error('No se pudo enviar el email:', e)
      }
    }

    // Programar automáticamente la producción del pedido
    if (pedido) {
      try {
        await fetch('/api/programar-pedido', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedido_id: pedido.id,
            cantidad: Number(form.cantidad),
            fecha_entrega: form.fecha_entrega,
            numero_pedido: pedido.numero,
          }),
        })
      } catch (e) {
        console.error('No se pudo programar la producción:', e)
      }
    }

    setGuardando(false)
    router.push('/pedidos')
  }

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-medium mb-5'>Nuevo pedido</h1>
      <div className='card space-y-6'>

        {/* SECCIÓN: CLIENTE */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Cliente</h2>
          <div className='flex gap-4 mb-3'>
            <label className='flex items-center gap-2 text-sm cursor-pointer'>
              <input type='radio' checked={!form.crear_cliente} onChange={() => set('crear_cliente', false)} /> Existente
            </label>
            <label className='flex items-center gap-2 text-sm cursor-pointer'>
              <input type='radio' checked={form.crear_cliente} onChange={() => set('crear_cliente', true)} /> Nuevo cliente
            </label>
          </div>

          {!form.crear_cliente ? (
            <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
              <option value=''>Seleccionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : (
            <div className='space-y-3'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Nombre completo *</label>
                  <input placeholder='Nombre completo' value={form.nuevo_nombre} onChange={e => set('nuevo_nombre', e.target.value)} />
                </div>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Cédula</label>
                  <input placeholder='Ej: 1234567890' value={form.nuevo_cedula} onChange={e => set('nuevo_cedula', e.target.value)} />
                </div>
              </div>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Teléfono / WhatsApp</label>
                  <input placeholder='Ej: 3001234567' value={form.nuevo_tel} onChange={e => set('nuevo_tel', e.target.value)} />
                </div>
                <div>
                  <label className='text-xs text-gray-500 mb-1 block'>Correo electrónico</label>
                  <input placeholder='correo@ejemplo.com' value={form.nuevo_email} onChange={e => set('nuevo_email', e.target.value)} />
                </div>
              </div>
              <div>
                <label className='text-xs text-gray-500 mb-1 block'>Dirección de entrega</label>
                <input placeholder='Ej: Calle 85 #19-20, Apto 301' value={form.nuevo_direccion} onChange={e => set('nuevo_direccion', e.target.value)} />
              </div>
              <div>
                <label className='text-xs text-gray-500 mb-1 block'>Ciudad</label>
                <input placeholder='Ej: Bogotá' value={form.nuevo_ciudad} onChange={e => set('nuevo_ciudad', e.target.value)} />
              </div>
            </div>
          )}
        </section>

        {/* SECCIÓN: PRODUCTO */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Producto</h2>
          <div className='space-y-3'>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <div>
                <label className='text-xs text-gray-500 mb-1 block'>Categoría</label>
                <select
                  value={cats.find(c => productos.filter(p => p.categoria === c).some(p => p.id === form.referencia_id)) || ''}
                  onChange={e => set('referencia_id', '')}
                >
                  <option value=''>Todas las categorías</option>
                  {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className='text-xs text-gray-500 mb-1 block'>Referencia *</label>
                <select value={form.referencia_id} onChange={e => set('referencia_id', e.target.value)}>
                  <option value=''>Seleccionar referencia</option>
                  {cats.map(cat => (
                    <optgroup key={cat} label={cat}>
                      {productos.filter(p => p.categoria === cat).map(p => (
                        <option key={p.id} value={p.id}>{p.referencia}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Tela *</label>
              <select value={form.tela_id} onChange={e => set('tela_id', e.target.value)}>
                <option value=''>Seleccionar tela</option>
                {telas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='text-xs text-gray-500 mb-1 block'>Cantidad</label>
                <input type='number' min='1' value={form.cantidad} onChange={e => set('cantidad', e.target.value)} />
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
          </div>

          {prod && (
            <div className='mt-3 bg-purple-50 rounded-lg p-3 text-sm grid grid-cols-3 gap-2'>
              <div><span className='text-gray-500 text-xs block'>Metros tela</span><b>{prod.metros_tela}m</b></div>
              <div><span className='text-gray-500 text-xs block'>Precio público</span><b>${prod.valor_publico?.toLocaleString('es-CO')}</b></div>
              <div><span className='text-gray-500 text-xs block'>Precio oferta</span><b>${prod.valor_oferta?.toLocaleString('es-CO')}</b></div>
            </div>
          )}
        </section>

        {/* SECCIÓN: PRECIO Y FECHA */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Precio y fecha</h2>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Precio venta COP *</label>
              <input placeholder='Ej: 2065000' value={form.precio_venta} onChange={e => set('precio_venta', e.target.value)} />
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Fecha de entrega *</label>
              <input type='date' value={form.fecha_entrega} onChange={e => set('fecha_entrega', e.target.value)} />
            </div>
          </div>
        </section>

        {/* SECCIÓN: ABONO Y PAGO */}
        <section>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3'>Abono</h2>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Valor del abono COP</label>
              <input placeholder='Ej: 1000000' value={form.abono} onChange={e => set('abono', e.target.value)} />
            </div>
            <div>
              <label className='text-xs text-gray-500 mb-1 block'>Medio de pago</label>
              <select value={form.medio_pago} onChange={e => set('medio_pago', e.target.value)}>
                <option value=''>Seleccionar</option>
                <option value='efectivo'>Efectivo</option>
                <option value='transferencia'>Transferencia bancaria</option>
                <option value='tarjeta_credito'>Tarjeta crédito</option>
                <option value='tarjeta_debito'>Tarjeta débito</option>
                <option value='nequi'>Nequi</option>
                <option value='daviplata'>Daviplata</option>
              </select>
            </div>
          </div>
          {form.precio_venta && form.abono && (
            <div className='mt-3 bg-green-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2'>
              <div><span className='text-gray-500 text-xs block'>Abono</span><b className='text-green-700'>${Number(form.abono).toLocaleString('es-CO')}</b></div>
              <div><span className='text-gray-500 text-xs block'>Saldo pendiente</span><b className='text-red-600'>${(Number(form.precio_venta) - Number(form.abono)).toLocaleString('es-CO')}</b></div>
            </div>
          )}
        </section>

        {/* SECCIÓN: OBSERVACIONES */}
        <section>
          <label className='text-xs text-gray-500 mb-1 block'>Observaciones</label>
          <textarea rows={3} placeholder='Instrucciones especiales, detalles de entrega, etc.' value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
        </section>

        <div className='flex gap-3 pt-2'>
          <button className='btn btn-primary flex-1' onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar pedido'}
          </button>
          <button className='btn' onClick={() => router.push('/pedidos')}>Cancelar</button>
        </div>

      </div>
    </div>
  )
}
