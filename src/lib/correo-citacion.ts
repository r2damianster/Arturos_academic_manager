/**
 * Construye el correo de citación a tutoría y los enlaces para abrirlo en Gmail, Outlook web
 * o la app de correo del equipo. El sistema NO envía nada: solo abre el redactor con el texto listo.
 */

export interface DatosCorreoCitacion {
  nombreEstudiante: string
  asignatura: string
  nombreProfesor: string
  /** Motivos concretos, ya redactados (ej. "ACD1 (P1): 3/6 · 50 %"). */
  motivos: string[]
  /** Horarios de tutoría ya redactados (ej. "Martes 10:00 - 12:00"). */
  horarios: string[]
}

export interface CorreoRedactado {
  asunto: string
  cuerpo: string
}

export interface EnlacesCorreo {
  gmail: string
  outlook: string
  mailto: string
}

/** Nombre tal como está registrado; "estudiante" si viene vacío. */
const saludo = (nombre: string) => nombre.trim() || 'estudiante'

function bloqueHorarios(horarios: string[]): string[] {
  return horarios.length > 0
    ? ['Mis horarios de tutoría:', ...horarios.map(horario => `  - ${horario}`), '']
    : ['Por favor responde este correo para coordinar un horario de tutoría.', '']
}

/** Correo personalizado: menciona las notas concretas del estudiante. */
export function redactarCorreoIndividual(datos: DatosCorreoCitacion): CorreoRedactado {
  const lineas = [
    `Estimado/a ${saludo(datos.nombreEstudiante)},`,
    '',
    `Te escribo por la asignatura ${datos.asignatura}. Revisando tu avance, te cito a una tutoría para conversar sobre cómo mejorar tus resultados.`,
    '',
    ...(datos.motivos.length > 0 ? ['Motivo de la citación:', ...datos.motivos.map(motivo => `  - ${motivo}`), ''] : []),
    ...bloqueHorarios(datos.horarios),
    'Puedes reservar tu horario desde el portal del estudiante o respondiendo este correo.',
    '',
    'Saludos cordiales,',
    datos.nombreProfesor,
  ]
  return { asunto: `Citación a tutoría — ${datos.asignatura}`, cuerpo: lineas.join('\n') }
}

/** Correo genérico para envío en bloque (sin datos individuales: los destinatarios van en copia oculta). */
export function redactarCorreoBloque(datos: Omit<DatosCorreoCitacion, 'nombreEstudiante' | 'motivos'>): CorreoRedactado {
  const lineas = [
    'Estimado/a estudiante,',
    '',
    `Te escribo por la asignatura ${datos.asignatura}. Revisando el avance del curso, te cito a una tutoría para conversar sobre cómo mejorar tus resultados.`,
    '',
    ...bloqueHorarios(datos.horarios),
    'Puedes reservar tu horario desde el portal del estudiante o respondiendo este correo.',
    '',
    'Saludos cordiales,',
    datos.nombreProfesor,
  ]
  return { asunto: `Citación a tutoría — ${datos.asignatura}`, cuerpo: lineas.join('\n') }
}

/**
 * Enlaces de redacción. `para` son destinatarios visibles; `cco` van en copia oculta
 * (usar cco para el envío en bloque y no exponer correos entre estudiantes).
 */
export function construirEnlacesCorreo(params: {
  para?: string[]
  cco?: string[]
  correo: CorreoRedactado
}): EnlacesCorreo {
  const para = (params.para ?? []).filter(Boolean).join(',')
  const cco = (params.cco ?? []).filter(Boolean).join(',')
  const { asunto, cuerpo } = params.correo
  const codificar = encodeURIComponent

  const gmail =
    `https://mail.google.com/mail/?view=cm&fs=1&to=${codificar(para)}&bcc=${codificar(cco)}` +
    `&su=${codificar(asunto)}&body=${codificar(cuerpo)}`
  const outlook =
    `https://outlook.office.com/mail/deeplink/compose?to=${codificar(para)}&bcc=${codificar(cco)}` +
    `&subject=${codificar(asunto)}&body=${codificar(cuerpo)}`
  const mailto =
    `mailto:${para}?subject=${codificar(asunto)}&body=${codificar(cuerpo)}` + (cco ? `&bcc=${codificar(cco)}` : '')

  return { gmail, outlook, mailto }
}
