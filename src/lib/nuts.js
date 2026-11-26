/* Mr. Nuts: colores, formatos y mensajes de error compartidos */

export const CARAMELO = '#9A5B12'
export const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
export const gramos = n => Math.round(Number(n || 0)).toLocaleString('es-CO') + ' g'

const ERRORES = {
  acceso: 'Usuario o PIN incorrecto.',
  permiso: 'Tu usuario no tiene permiso para esto.',
  pin_corto: 'El PIN debe tener mínimo 4 números.',
  sesion_erp: 'Para crear el primer administrador abre esta página en el celular o computador donde tienes la sesión del ERP de Mr. Chester abierta.',
  ya_existe: 'Ya existe un administrador. Entra con tu usuario y PIN.',
  vacia: 'Agrega al menos un producto.',
  gramos: 'Revisa los gramos.',
  kg: 'Revisa los kilos.',
  cantidad: 'Revisa la cantidad.',
  receta: 'Revisa los gramos de cada nuez.',
  nombre: 'Falta el nombre.',
  propio_rol: 'No puedes quitarte a ti mismo el rol de administrador.',
}
export function mensaje(e) {
  const m = String(e?.message || e || '')
  const [k, extra] = m.split(':')
  if (k === 'sin_lote') return `No alcanza la bandeja de ${extra}. Hay que registrar un lote nuevo de ${extra}.`
  if (k === 'sin_crudo') return `No hay suficiente ${extra} crudo. Registra primero la compra.`
  if (k === 'sin_batch') return `No hay batches armados de ${extra}.`
  if (m.includes('duplicate key')) return 'Ese nombre o usuario ya existe.'
  return ERRORES[k] || 'No se pudo guardar: ' + m
}
