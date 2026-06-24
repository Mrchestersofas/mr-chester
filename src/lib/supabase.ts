import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type OrderStatus =
  | 'pendiente'
  | 'estructura'
  | 'tapizado'
  | 'costura'
  | 'control_calidad'
  | 'listo'
  | 'entregado'

export type Priority = 'normal' | 'alta' | 'urgente'

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  email: string
  created_at: string
}

export interface Pedido {
  id: string
  numero: string
  cliente_id: string
  cliente?: Cliente
  tipo_sofa: string
  material: string
  color: string
  cantidad: number
  fecha_entrega: string
  prioridad: Priority
  estado: OrderStatus
  precio_venta: number
  observaciones: string
  created_at: string
}

export interface Material {
  id: string
  nombre: string
  stock_actual: number
  stock_minimo: number
  unidad: string
  costo_unitario: number
  proveedor: string
}

export interface ComponenteSofa {
  id: string
  tipo_sofa: string
  material_id: string
  material?: Material
  cantidad_requerida: number
}
