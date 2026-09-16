export interface ActividadPlan {
  actividad: string
  recurso: string
}

// Bitácoras antiguas guardaban texto libre en `materiales` con formato "Etiqueta: URL | Etiqueta: URL"
function parseMaterialesLegacy(materiales: string | null | undefined): ActividadPlan[] {
  if (!materiales) return []
  return materiales
    .split('|')
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => {
      const httpIdx = chunk.search(/https?:\/\//)
      if (httpIdx === -1) return { actividad: chunk, recurso: '' }
      const label = chunk.slice(0, httpIdx).replace(/:\s*$/, '').trim()
      const url = chunk.slice(httpIdx).trim()
      return { actividad: label || 'Recurso', recurso: url }
    })
}

// Antes de existir `actividades_json`, la bitácora guardaba la sesión en dos columnas de texto
// libre: `actividades` (descripción) y `materiales` (links). Si `actividades_json` viene vacío,
// se reconstruyen actividades a partir de esos campos legacy para no perder el contenido.
export function actividadesDesdeBitacora(params: {
  actividades_json: unknown
  actividades?: string | null
  materiales?: string | null
}): ActividadPlan[] {
  const jsonActs = Array.isArray(params.actividades_json)
    ? (params.actividades_json as ActividadPlan[]).filter(a => a && typeof a.actividad === 'string')
    : []
  if (jsonActs.length > 0) return jsonActs

  const legacy: ActividadPlan[] = []
  if (params.actividades && params.actividades.trim()) {
    legacy.push({ actividad: params.actividades.trim(), recurso: '' })
  }
  legacy.push(...parseMaterialesLegacy(params.materiales))
  return legacy
}
