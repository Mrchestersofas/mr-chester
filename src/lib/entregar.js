// Archivo: src/lib/entregar.js
// Marca como entregados pedidos que se entregaron por fuera del ERP (sin pasar por Despachos).
// Si queda saldo, pregunta si ya se pagó para registrarlo.
import { supabase } from '@/lib/supabase'

const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')

/** pedidos: [{ id, numero, estado, precio_venta, abono }] */
export async function marcarEntregado(pedidos) {
  const lista = (pedidos || []).filter(Boolean)
  if (!lista.length) return false
  const numeros = lista.map(p => p.numero).join(', ')
  const saldo = lista.reduce((a, p) => a + Math.max(0, Number(p.precio_venta || 0) - Number(p.abono || 0)), 0)
  if (!confirm(`¿Marcar ${numeros} como ENTREGADO?\n\nSale de Atención al cliente, Producción y Programación. (Para entregas normales usa Despachos, que hace la remisión.)`)) return false
  let pagoSaldo = false
  if (saldo > 0) pagoSaldo = confirm(`Queda un saldo de ${pesos(saldo)}.\n\n¿El cliente ya lo pagó? Aceptar = registrar el pago del saldo · Cancelar = dejarlo pendiente en cartera.`)
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
  for (const p of lista) {
    const s = Math.max(0, Number(p.precio_venta || 0) - Number(p.abono || 0))
    const cambios = { estado: 'entregado' }
    if (pagoSaldo && s > 0) {
      await supabase.from('pedido_pagos').insert({ pedido_id: p.id, fecha: hoy, valor: s, medio_pago: 'transferencia', nota: 'Saldo registrado al marcar entregado (fuera de Despachos)' })
      cambios.abono = Number(p.precio_venta || 0)
    }
    const { error } = await supabase.from('pedidos').update(cambios).eq('id', p.id)
    if (error) { alert('No se pudo marcar ' + p.numero + ': ' + error.message); return false }
    await supabase.from('programacion_produccion').update({ etapa_actual: 'completado' }).eq('pedido_id', p.id)
    await supabase.from('historial_estados').insert({ pedido_id: p.id, estado_anterior: p.estado, estado_nuevo: 'entregado', nota: `Marcado como entregado (fuera de Despachos)${pagoSaldo && s > 0 ? ` · saldo ${pesos(s)} registrado como pagado` : s > 0 ? ` · queda saldo ${pesos(s)}` : ''}` })
  }
  return true
}
