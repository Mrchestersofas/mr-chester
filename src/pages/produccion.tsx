// @ts-nocheck
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import VistaTaller from '@/components/VistaTaller'
import { SECCIONES, normalizar, siguiente, anterior, estadoPedido, etiqueta } from '@/lib/etapas'

/* Producción (ERP): Joseph / jefe de producción ven todas las secciones y mueven los pedidos.
   Etapas: Programación → Esqueletería → Espumado → Corte y costura → Tapizado → Terminado → Despacho.
   Al llegar a Despacho el cliente recibe el aviso "¡Tu sofá está listo!" (automático). */

export default function Produccion() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  async function cargar() {
    const { data, error: e } = await supabase.from('programacion_produccion')
      .select('*, pedido:pedidos(numero, grupo, tipo_sofa, material, cantidad, fecha_entrega, prioridad, observaciones, estado, cliente:clientes(nombre))')
      .neq('etapa_actual', 'completado')
    if (e) { setError(e.message); setItems([]); return }
    setItems((data || []).filter(f => f.pedido && !['entregado', 'cancelado'].includes(f.pedido.estado)).map(normalizar))
  }
  useEffect(() => { cargar() }, [])

  async function mover(it, dir) {
    const nueva = dir > 0 ? siguiente(it.etapa) : anterior(it.etapa)
    if (nueva === it.etapa) return
    if (nueva === 'despacho' && !confirm(`Al pasar ${it.numero} a Despacho, al cliente le llega el correo "¡Tu sofá está listo!". ¿Continuar?`)) return
    await supabase.from('programacion_produccion').update({ etapa_actual: nueva }).eq('id', it.id)
    await supabase.from('pedidos').update({ estado: estadoPedido(nueva) }).eq('id', it.pedido_id)
    await supabase.from('historial_estados').insert({ pedido_id: it.pedido_id, estado_anterior: it.estado, estado_nuevo: estadoPedido(nueva), nota: `${dir > 0 ? 'Pasó' : 'Devuelto'} a ${etiqueta(nueva)}` })
    await cargar()
  }

  if (error) return <div className='p-4 max-w-2xl mx-auto'><p className='rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700'>No se pudo cargar: {error}</p></div>
  if (!items) return <div className='p-4 text-gray-500'>Cargando…</div>

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <div className='flex items-start justify-between gap-2 mb-4'>
        <div>
          <h1 className='text-xl font-medium'>Producción</h1>
          <p className='text-sm text-gray-500'>{items.filter(i => i.etapa !== 'cola' && i.etapa !== 'despacho').length} en fábrica · {items.filter(i => i.etapa === 'cola').length} programados · {items.filter(i => i.etapa === 'despacho').length} listos</p>
        </div>
        <Link href='/programacion' className='btn text-sm whitespace-nowrap'>📅 Programación</Link>
      </div>
      <VistaTaller
        items={items}
        secciones={SECCIONES.map(s => s.key)}
        mostrarCliente
        puedeMover={() => true}
        mover={mover}
        pieDespacho={<Link href='/despachos' className='btn w-full text-center block mt-2'>🚚 Ir a Despachos</Link>}
      />
    </div>
  )
}
