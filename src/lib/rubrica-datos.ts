import type { DatosEstudianteRubrica } from './rubrica-calculo'

interface ItemFuente {
  estudiante_id: string
  parcial: number
  nombre_item: string
  nota: number | null
}

interface RegistroParticipacion {
  estudiante_id: string
  fecha: string
  nivel: number | null
}

/**
 * Agrupa por estudiante los datos que la rúbrica puede consumir.
 * `itemsFuente` no debe incluir columnas de rúbrica (evita referencias circulares).
 */
export function armarDatosPorEstudiante(params: {
  estudianteIds: string[]
  itemsFuente: ItemFuente[]
  participacion: RegistroParticipacion[]
  mapaAsistencia: Record<string, Record<string, { estado: string }>>
}): Map<string, DatosEstudianteRubrica> {
  const datosPorEstudiante = new Map<string, DatosEstudianteRubrica>(
    params.estudianteIds.map(estudianteId => [
      estudianteId,
      {
        items: [],
        participacion: [],
        asistencia: Object.entries(params.mapaAsistencia[estudianteId] ?? {}).map(([fecha, registro]) => ({
          fecha,
          estado: registro.estado,
        })),
      },
    ])
  )
  for (const item of params.itemsFuente) {
    datosPorEstudiante.get(item.estudiante_id)?.items.push({
      nombre: item.nombre_item,
      parcial: item.parcial,
      nota: item.nota === null ? null : Number(item.nota),
    })
  }
  for (const registro of params.participacion) {
    datosPorEstudiante.get(registro.estudiante_id)?.participacion.push({
      fecha: registro.fecha,
      nivel: registro.nivel,
    })
  }
  return datosPorEstudiante
}
