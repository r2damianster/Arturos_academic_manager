import { z } from 'zod'

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')

export const FuenteRubricaSchema = z
  .object({
    tipo: z.enum(['item', 'participacion', 'asistencia']),
    etiqueta: z.string().max(80).optional(),
    itemNombre: z.string().min(1).optional(),
    itemParcial: z.number().int().min(1).max(4).optional(),
    escalaMax: z.number().positive('La escala debe ser mayor a 0'),
    escalaMin: z.number().min(0).optional(),
    peso: z.number().positive().optional(),
    obligatoria: z.boolean(),
    desde: fechaIso.optional(),
    hasta: fechaIso.optional(),
    valorAtraso: z.number().min(0).max(1).optional(),
  })
  .refine(fuente => fuente.tipo !== 'item' || (!!fuente.itemNombre && fuente.itemParcial !== undefined), {
    message: 'Una fuente de tipo actividad requiere nombre de columna y parcial',
  })
  .refine(fuente => fuente.escalaMin === undefined || fuente.escalaMin < fuente.escalaMax, {
    message: 'El valor mínimo debe ser menor que la escala',
  })
  .refine(fuente => !fuente.desde || !fuente.hasta || fuente.desde <= fuente.hasta, {
    message: 'La fecha "desde" no puede ser posterior a "hasta"',
  })

export const BandaRubricaSchema = z.object({
  desde: z.number().min(0).max(1),
  puntos: z.number().min(0),
})

export const CriterioRubricaSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El criterio necesita nombre').max(120),
    puntosMax: z.number().positive('Los puntos máximos deben ser mayores a 0'),
    modo: z.enum(['lineal', 'bandas']),
    bandas: z.array(BandaRubricaSchema).optional(),
    fuentes: z.array(FuenteRubricaSchema).min(1, 'Cada criterio necesita al menos una fuente'),
  })
  .refine(criterio => criterio.modo !== 'bandas' || (criterio.bandas?.length ?? 0) > 0, {
    message: 'El modo por bandas requiere al menos una banda',
  })

export const IngresoTardioSchema = z.object({
  estudianteId: z.string().uuid(),
  desde: fechaIso,
})

export const DefinicionRubricaSchema = z.object({
  criterios: z.array(CriterioRubricaSchema).min(1, 'La rúbrica necesita al menos un criterio'),
  ingresoTardio: z.array(IngresoTardioSchema).optional(),
})

export const GuardarRubricaSchema = z.object({
  cursoId: z.string().uuid(),
  parcial: z.number().int().min(1).max(4),
  nombreColumna: z.string().trim().min(1, 'Escribe el nombre de la columna').max(80),
  escalaSalida: z.number().positive().max(100).nullable().optional(),
  definicion: DefinicionRubricaSchema,
})

export type GuardarRubricaInput = z.input<typeof GuardarRubricaSchema>
