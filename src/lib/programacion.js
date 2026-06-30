// Archivo: src/lib/programacion.js
// Lógica de cálculo de fechas de producción

const ETAPAS = [
  { key: 'estructura', label: 'Estructura', horas: 1.5 },
  { key: 'espumado', label: 'Espumado', horas: 2 },
  { key: 'corte_tela', label: 'Corte de tela', horas: 1.5 },
  { key: 'tapizado', label: 'Tapizado', horas: 2 },
  { key: 'terminado', label: 'Terminado', horas: 1 },
  { key: 'control_calidad', label: 'Control de calidad', horas: 0.25 },
  { key: 'despacho', label: 'Despacho', horas: 0.25 },
]

const HORAS_LUNES_VIERNES = 8
const HORAS_SABADO = 4
const UNIDADES_POR_DIA = 3

// Devuelve true si la fecha es día hábil (lunes a sábado)
function esDiaHabil(fecha) {
  const dia = fecha.getDay() // 0=domingo, 6=sabado
  return dia !== 0
}

function horasDisponiblesDelDia(fecha) {
  const dia = fecha.getDay()
  if (dia === 6) return HORAS_SABADO // sabado
  if (dia === 0) return 0 // domingo
  return HORAS_LUNES_VIERNES
}

// Avanza una fecha sumando horas de trabajo, respetando jornada laboral
function sumarHorasLaborales(fechaInicio, horasASumar) {
  let fecha = new Date(fechaInicio)
  let horasRestantes = horasASumar

  // Si la fecha cae fuera de horario, ajustar al inicio del siguiente día hábil
  while (!esDiaHabil(fecha)) {
    fecha.setDate(fecha.getDate() + 1)
    fecha.setHours(8, 0, 0, 0)
  }

  while (horasRestantes > 0) {
    const horaActual = fecha.getHours() + fecha.getMinutes() / 60
    const horasMaxHoy = horasDisponiblesDelDia(fecha)
    const inicioJornada = 8
    const finJornada = inicioJornada + horasMaxHoy

    // Si estamos antes del inicio de jornada, ajustar
    if (horaActual < inicioJornada) {
      fecha.setHours(inicioJornada, 0, 0, 0)
    }

    const horaActualizada = fecha.getHours() + fecha.getMinutes() / 60
    const horasDisponiblesHoy = Math.max(0, finJornada - horaActualizada)

    if (horasRestantes <= horasDisponiblesHoy) {
      // Cabe completo en el día actual
      const minutosASumar = horasRestantes * 60
      fecha = new Date(fecha.getTime() + minutosASumar * 60000)
      horasRestantes = 0
    } else {
      // Usar lo que queda del día y pasar al siguiente día hábil
      horasRestantes -= horasDisponiblesHoy
      fecha.setDate(fecha.getDate() + 1)
      fecha.setHours(8, 0, 0, 0)
      while (!esDiaHabil(fecha)) {
        fecha.setDate(fecha.getDate() + 1)
      }
    }
  }

  return fecha
}

// Calcula la fecha de inicio según la cola existente (capacidad de 3/día)
export function calcularFechaInicio(fechaBase, pedidosEnCola) {
  let fecha = new Date(fechaBase)
  fecha.setHours(8, 0, 0, 0)

  while (!esDiaHabil(fecha)) {
    fecha.setDate(fecha.getDate() + 1)
  }

  // Contar cuántos pedidos ya están programados para iniciar cada día
  const conteoXDia = {}
  for (const p of pedidosEnCola) {
    const key = new Date(p.inicio_estructura).toDateString()
    conteoXDia[key] = (conteoXDia[key] || 0) + 1
  }

  // Buscar el primer día con cupo disponible (< 3 unidades)
  let intentos = 0
  while (intentos < 365) {
    if (esDiaHabil(fecha)) {
      const key = fecha.toDateString()
      const ocupados = conteoXDia[key] || 0
      if (ocupados < UNIDADES_POR_DIA) {
        return fecha
      }
    }
    fecha.setDate(fecha.getDate() + 1)
    fecha.setHours(8, 0, 0, 0)
    intentos++
  }

  return fecha
}

// Calcula todas las fechas de las 7 etapas a partir de la fecha de inicio
export function calcularProgramacionCompleta(fechaInicio) {
  const resultado = {}
  let fechaActual = new Date(fechaInicio)

  for (const etapa of ETAPAS) {
    const inicio = new Date(fechaActual)
    const fin = sumarHorasLaborales(inicio, etapa.horas)
    resultado[`inicio_${etapa.key}`] = inicio.toISOString()
    resultado[`fin_${etapa.key}`] = fin.toISOString()
    fechaActual = fin
  }

  return resultado
}

export { ETAPAS }
