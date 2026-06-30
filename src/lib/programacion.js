// Archivo: src/lib/programacion.js
// Lógica de cálculo de fechas de producción

export const ETAPAS = [
  { key: 'estructura', label: 'Estructura', horas: 1.5 },
  { key: 'espumado', label: 'Espumado', horas: 2 },
  { key: 'corte_tela', label: 'Corte de tela', horas: 1.5 },
  { key: 'tapizado', label: 'Tapizado', horas: 2 },
  { key: 'terminado', label: 'Terminado', horas: 1 },
  { key: 'control_calidad', label: 'Control de calidad', horas: 0.25 },
  { key: 'despacho', label: 'Despacho', horas: 0.25 },
]

const INICIO_JORNADA = 8 // 8:00 am
const HORAS_LUNES_VIERNES = 8 // 8am - 4pm
const HORAS_SABADO = 4 // 8am - 12pm
const UNIDADES_POR_DIA = 3

function esDiaHabil(fecha) {
  const dia = fecha.getDay() // 0=domingo, 6=sabado
  return dia !== 0
}

function horasJornada(fecha) {
  const dia = fecha.getDay()
  if (dia === 6) return HORAS_SABADO
  if (dia === 0) return 0
  return HORAS_LUNES_VIERNES
}

// Mueve la fecha al inicio de jornada del siguiente día hábil
function siguienteDiaHabil(fecha) {
  const nueva = new Date(fecha)
  nueva.setDate(nueva.getDate() + 1)
  nueva.setHours(INICIO_JORNADA, 0, 0, 0)
  while (!esDiaHabil(nueva)) {
    nueva.setDate(nueva.getDate() + 1)
  }
  return nueva
}

// Ajusta la fecha de inicio: si cae fuera de jornada o en día no hábil, mueve al próximo inicio de jornada hábil
function ajustarInicioJornada(fecha) {
  let f = new Date(fecha)

  // Si no es día hábil, saltar al siguiente
  while (!esDiaHabil(f)) {
    f.setDate(f.getDate() + 1)
    f.setHours(INICIO_JORNADA, 0, 0, 0)
  }

  const horaActual = f.getHours() + f.getMinutes() / 60
  const finJornada = INICIO_JORNADA + horasJornada(f)

  if (horaActual < INICIO_JORNADA) {
    // Antes de jornada -> ajustar al inicio
    f.setHours(INICIO_JORNADA, 0, 0, 0)
  } else if (horaActual >= finJornada) {
    // Después de jornada -> pasar al siguiente día hábil
    f = siguienteDiaHabil(f)
  }

  return f
}

// Avanza una fecha sumando horas de trabajo, respetando jornada laboral (8am inicio)
function sumarHorasLaborales(fechaInicio, horasASumar) {
  let fecha = ajustarInicioJornada(fechaInicio)
  let horasRestantes = horasASumar

  while (horasRestantes > 0) {
    const horaActual = fecha.getHours() + fecha.getMinutes() / 60
    const finJornadaHoy = INICIO_JORNADA + horasJornada(fecha)
    const horasDisponiblesHoy = Math.max(0, finJornadaHoy - horaActual)

    if (horasRestantes <= horasDisponiblesHoy) {
      const minutosASumar = horasRestantes * 60
      fecha = new Date(fecha.getTime() + minutosASumar * 60000)
      horasRestantes = 0
    } else {
      horasRestantes -= horasDisponiblesHoy
      fecha = siguienteDiaHabil(fecha)
    }
  }

  return fecha
}

// Calcula la fecha de inicio según la cola existente (capacidad de 3/día)
export function calcularFechaInicio(fechaBase, pedidosEnCola) {
  let fecha = ajustarInicioJornada(new Date(fechaBase))

  const conteoXDia = {}
  for (const p of pedidosEnCola) {
    const key = new Date(p.inicio_estructura).toDateString()
    conteoXDia[key] = (conteoXDia[key] || 0) + 1
  }

  let intentos = 0
  while (intentos < 365) {
    if (esDiaHabil(fecha)) {
      const key = fecha.toDateString()
      const ocupados = conteoXDia[key] || 0
      if (ocupados < UNIDADES_POR_DIA) {
        return fecha
      }
    }
    fecha = siguienteDiaHabil(fecha)
    intentos++
  }

  return fecha
}

// Calcula todas las fechas de las 7 etapas a partir de la fecha de inicio
export function calcularProgramacionCompleta(fechaInicio) {
  const resultado = {}
  let fechaActual = ajustarInicioJornada(new Date(fechaInicio))

  for (const etapa of ETAPAS) {
    const inicio = new Date(fechaActual)
    const fin = sumarHorasLaborales(inicio, etapa.horas)
    resultado[`inicio_${etapa.key}`] = inicio.toISOString()
    resultado[`fin_${etapa.key}`] = fin.toISOString()
    fechaActual = fin
  }

  return resultado
}

// Compara la fecha de despacho estimada contra la fecha de entrega prometida
export function verificarFechaEntrega(fechaDespachoISO, fechaEntregaStr) {
  const despacho = new Date(fechaDespachoISO)
  const entrega = new Date(fechaEntregaStr + 'T23:59:59')
  const seCumple = despacho <= entrega
  const diasDiferencia = Math.ceil((entrega - despacho) / (1000 * 60 * 60 * 24))
  return { seCumple, diasDiferencia, despacho, entrega }
}
