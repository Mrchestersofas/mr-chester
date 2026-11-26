/* Mr. Nuts: colores, formatos y mensajes de error compartidos */

export const CARAMELO = '#663D1F' // marrón del logo
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

// Colores de marca (del logo) y de cada nuez, para que todo sea visual
export const MARRON = '#663D1F'
export const ARENA = '#C9A07A'
const COLOR_NUEZ = { 'marañón': '#E9C99A', 'almendra': '#B0703F', 'macadamia': '#F2E4C4', 'pecana': '#7A4527', 'maní': '#D6A262' }
export const colorNuez = nombre => COLOR_NUEZ[String(nombre || '').toLowerCase()] || '#C9A07A'

// Tipo de empaque según el nombre del producto (para el ícono)
export function tipoEmpaque(nombre) {
  const n = String(nombre || '').toLowerCase()
  if (n.includes('cono')) return 'cono'
  if (n.includes('frasco')) return 'frasco'
  if (n.includes('caja') || n.includes('box')) return 'caja'
  return 'tarro'
}

// Íconos simples dibujados (cono, frasco, tarro, caja)
export function Empaque({ tipo, color = '#fff', size = 40 }) {
  const s = { width: size, height: size, display: 'block' }
  const p = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (tipo === 'cono') return <svg viewBox='0 0 40 40' style={s} aria-hidden='true'><path {...p} d='M9 15 L20 37 L31 15 Z' /><circle cx='14' cy='12' r='4' fill={color} /><circle cx='21' cy='9' r='4.5' fill={color} /><circle cx='27' cy='12.5' r='4' fill={color} /></svg>
  if (tipo === 'frasco') return <svg viewBox='0 0 40 40' style={s} aria-hidden='true'><rect {...p} x='13' y='4' width='14' height='5' rx='1.5' /><path {...p} d='M11 12 Q11 9 14 9 H26 Q29 9 29 12 V33 Q29 36 26 36 H14 Q11 36 11 33 Z' /><circle cx='17' cy='26' r='2.6' fill={color} /><circle cx='23' cy='24' r='2.6' fill={color} /><circle cx='20' cy='30' r='2.6' fill={color} /></svg>
  if (tipo === 'caja') return <svg viewBox='0 0 40 40' style={s} aria-hidden='true'><rect {...p} x='6' y='14' width='28' height='21' rx='2' /><path {...p} d='M6 14 L10 7 H30 L34 14 M20 14 V35' /><path {...p} d='M15 7 Q20 13 25 7' /></svg>
  return <svg viewBox='0 0 40 40' style={s} aria-hidden='true'><rect {...p} x='9' y='5' width='22' height='6' rx='2' /><rect {...p} x='10' y='11' width='20' height='25' rx='3' /><circle cx='16' cy='24' r='2.8' fill={color} /><circle cx='23' cy='21' r='2.8' fill={color} /><circle cx='21' cy='29' r='2.8' fill={color} /></svg>
}
