// Archivo: src/lib/programacion.js
// Lógica de cálculo de fechas de producción
// IMPORTANTE: Todas las horas se calculan en hora de Colombia (UTC-5), sin DST

const OFFSET_COLOMBIA = -5 // UTC-5, todo el año

export const ETAPAS = [
  { key: 'estructura', label: 'Estructura', horas: 1.5 },
  { key: 'espumado', label: 'Espumado', horas: 2 },
  { key: 'corte_tela', label: 'Corte de tela', horas: 1.5 },
  { key: 'tapizado', label: 'Tapizado', horas: 2 },
  { key: 'terminado', label: 'Terminado', horas: 1 },
  { key: 'control_calidad', label: 'Control de calidad', horas: 0.25 },
  { key: 'despacho', label: 'Despacho', horas: 0.25 },
]

const UNIDADES_POR_DIA = 3

// Horario laboral en minutos desde medianoche (hora Colombia)
const JORNADA_LUNES_VIERNES = { inicio: 8 * 60, fin: 17 * 60 + 30 } // 8:00 - 17:30
const JORNADA_SABADO = { inicio: 8 * 60, fin: 13 * 60 } // 8:00 - 13:00

// Descansos en minutos desde medianoche, aplican lunes a sábado
const DESCANSOS_LUNES_VIERNES = [
  { inicio: 10 * 60, fin: 10 * 60 + 20 },      // desayuno 10:00-10:20
  { inicio: 13 * 60, fin: 14 * 60 },           // almuerzo 1:00-2:00pm
  { inicio: 16 * 60, fin: 16 * 60 + 20 },      // recreo 4:00-4:20pm
]
const DESCANSOS_SABADO = [
  { inicio: 10 * 60, fin: 10 * 60 + 20 },      // desayuno 10:00-10:20
]

function aComponentesColombia(fechaUTC) {
  const ms = fechaUTC.getTime() + OFFSET_COLOMBIA * 3600000
  const d = new Date(ms)
  return {
    año: d.getUTCFullYear(),
    mes: d.getUTCMonth(),
    dia: d.getUTCDate(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
    diaSemana: d.getUTCDay(),
    minutosDelDia: d.getUTCHours() * 60 + d.getUTCMinutes(),
  }
}

function deComponentesColombia(año, mes, dia, minutosDelDia) {
  const hora = Math.floor(minutosDelDia / 60)
  const minuto = minutosDelDia % 60
  const ms = Date.UTC(año, mes, dia, hora - OFFSET_COLOMBIA, minuto)
  return new Date(ms)
}

function esDiaHabil(diaSemana) {
  return diaSemana !== 0 // todo excepto domingo
}

function jornadaDelDia(diaSemana) {
  if (diaSemana === 6) return JORNADA_SABADO
  if (diaSemana === 0) return null
  return JORNADA_LUNES_VIERNES
}

function descansosDelDia(diaSemana) {
  if (diaSemana === 6) return DESCANSOS_SABADO
  return DESCANSOS_LUNES_VIERNES
}

// Dado un punto en minutos del día, si cae dentro de un descanso, lo mueve al final del descanso
function saltarDescanso(minutosDelDia, diaSemana) {
  const descansos = descansosDelDia(diaSemana)
  for (const d of descansos) {
    if (minutosDelDia >= d.inicio && minutosDelDia < d.fin) {
      return d.fin
    }
  }
  return minutosDelDia
}

// Calcula minutos productivos disponibles entre `desde` y el fin de jornada, descontando descansos
function minutosProductivosDisponibles(desdeMin, diaSemana) {
  const jornada = jornadaDelDia(diaSemana)
  if (!jornada) return 0
  if (desdeMin >= jornada.fin) return 0
  const inicio = Math.max(desdeMin, jornada.inicio)
  let total = jornada.fin - inicio
  for (const d of descansosDelDia(diaSemana)) {
    const solapInicio = Math.max(inicio, d.inicio)
    const solapFin = Math.min(jornada.fin, d.fin)
    if (solapFin > solapInicio) total -= (solapFin - solapInicio)
  }
  return Math.max(0, total)
}

function siguienteDiaHabil(fechaUTC) {
  let c = aComponentesColombia(fechaUTC)
  let resultado = deComponentesColombia(c.año, c.mes, c.dia + 1, JORNADA_LUNES_VIERNES.inicio)
  let cr = aComponentesColombia(resultado)
  while (!esDiaHabil(cr.diaSemana)) {
    resultado = deComponentesColombia(cr.año, cr.mes, cr.dia + 1, JORNADA_LUNES_VIERNES.inicio)
    cr = aComponentesColombia(resultado)
  }
  const jornada = jornadaDelDia(cr.diaSemana)
  return deComponentesColombia(cr.año, cr.mes, cr.dia, jornada.inicio)
}

// Ajusta una fecha al inicio de jornada hábil más cercano (saltando descansos y fuera de horario)
function ajustarInicioJornada(fechaUTC) {
  let c = aComponentesColombia(fechaUTC)

  while (!esDiaHabil(c.diaSemana)) {
    const ajustada = deComponentesColombia(c.año, c.mes, c.dia + 1, JORNADA_LUNES_VIERNES.inicio)
    c = aComponentesColombia(ajustada)
  }

  const jornada = jornadaDelDia(c.diaSemana)
  let minutos = c.minutosDelDia

  if (minutos < jornada.inicio) {
    minutos = jornada.inicio
  } else if (minutos >= jornada.fin) {
    return siguienteDiaHabil(deComponentesColombia(c.año, c.mes, c.dia, minutos))
  } else {
    minutos = saltarDescanso(minutos, c.diaSemana)
  }

  return deComponentesColombia(c.año, c.mes, c.dia, minutos)
}

// Avanza una fecha sumando horas productivas, respetando jornada y descansos
function sumarHorasLaborales(fechaInicioUTC, horasASumar) {
  let fecha = ajustarInicioJornada(fechaInicioUTC)
  let minutosRestantes = horasASumar * 60

  while (minutosRestantes > 0) {
    const c = aComponentesColombia(fecha)
    const disponibles = minutosProductivosDisponibles(c.minutosDelDia, c.diaSemana)

    if (disponibles <= 0) {
      fecha = siguienteDiaHabil(fecha)
      continue
    }

    if (minutosRestantes <= disponibles) {
      // Avanzar minuto a minuto saltando descansos
      let minutosDelDia = c.minutosDelDia
      let porAvanzar = minutosRestantes
      while (porAvanzar > 0) {
        minutosDelDia = saltarDescanso(minutosDelDia, c.diaSemana)
        const descansos = descansosDelDia(c.diaSemana)
        const proximoDescanso = descansos.find(d => d.inicio > minutosDelDia)
        const limite = proximoDescanso ? proximoDescanso.inicio : jornadaDelDia(c.diaSemana).fin
        const disponibleHastaLimite = limite - minutosDelDia
        if (porAvanzar <= disponibleHastaLimite) {
          minutosDelDia += porAvanzar
          porAvanzar = 0
        } else {
          porAvanzar -= disponibleHastaLimite
          minutosDelDia = limite
        }
      }
      fecha = deComponentesColombia(c.año, c.mes, c.dia, minutosDelDia)
      minutosRestantes = 0
    } else {
      minutosRestantes -= disponibles
      fecha = siguienteDiaHabil(fecha)
    }
  }

  return fecha
}

export function calcularFechaInicio(fechaBase, pedidosEnCola) {
  // Siempre arrancar al inicio de jornada (8am) del día correspondiente,
  // sin importar la hora exacta a la que se crea el pedido.
  let fecha = ajustarInicioJornada(new Date(fechaBase))
  const c0 = aComponentesColombia(fecha)
  const jornada0 = jornadaDelDia(c0.diaSemana)
  if (jornada0 && c0.minutosDelDia > jornada0.inicio) {
    fecha = deComponentesColombia(c0.año, c0.mes, c0.dia, jornada0.inicio)
  }  const conteoXDia = {}
  for (const p of pedidosEnCola) {
    const c = aComponentesColombia(new Date(p.inicio_estructura))
    const key = `${c.año}-${c.mes}-${c.dia}`
    conteoXDia[key] = (conteoXDia[key] || 0) + 1
  }

  let intentos = 0
  while (intentos < 365) {
    const c = aComponentesColombia(fecha)
    if (esDiaHabil(c.diaSemana)) {
      const key = `${c.año}-${c.mes}-${c.dia}`
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

export function verificarFechaEntrega(fechaDespachoISO, fechaEntregaStr) {
  const despacho = new Date(fechaDespachoISO)
  const entrega = new Date(fechaEntregaStr + 'T23:59:59-05:00')
  const seCumple = despacho <= entrega
  const diasDiferencia = Math.ceil((entrega - despacho) / (1000 * 60 * 60 * 24))
  return { seCumple, diasDiferencia, despacho, entrega }
}