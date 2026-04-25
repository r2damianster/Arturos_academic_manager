import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EncuestaTablaCliente } from '@/components/cursos/encuesta-tabla-cliente'
import type { FilaEncuesta } from '@/components/cursos/encuesta-tabla-cliente'

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length > 0 ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : null
}

function pct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

function frecuencia<T extends string | null>(arr: T[]): { valor: string; n: number }[] {
  const map: Record<string, number> = {}
  for (const v of arr) {
    const k = v ?? '—'
    map[k] = (map[k] ?? 0) + 1
  }
  return Object.entries(map).map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n)
}

export default async function EncuestaPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('estudiantes').select('id, nombre, email, auth_user_id, nota_incidencia').eq('curso_id', cursoId).eq('estado', 'activo').order('nombre'),
  ])

  if (!cursoRes.data) notFound()
  const curso = cursoRes.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudiantes: any[] = estudiantesRes.data ?? []
  const authIds = estudiantes.map((e: any) => e.auth_user_id).filter(Boolean) as string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let encuestas: any[] = []
  if (authIds.length > 0) {
    const { data } = await db.from('encuesta_estudiante').select('*').in('auth_user_id', authIds)
    encuestas = data ?? []
  }

  const authToNombre: Record<string, string> = {}
  for (const e of estudiantes) if (e.auth_user_id) authToNombre[e.auth_user_id] = e.nombre

  const total = encuestas.length

  // ── métricas globales ─────────────────────────────────────────────────────
  const pctTrabaja    = pct(encuestas.filter(e => e.trabaja).length, total)
  const pctLaptop     = pct(encuestas.filter(e => e.tiene_laptop).length, total)
  const pctPC         = pct(encuestas.filter(e => e.tiene_pc_escritorio).length, total)
  const pctSinPC      = pct(encuestas.filter(e => e.sin_computadora).length, total)
  const pctForaneo    = pct(encuestas.filter(e => e.es_foraneo).length, total)
  const nivelTechProm = avg(encuestas.map(e => e.nivel_tecnologia))

  // ── carrera elegida ───────────────────────────────────────────────────────
  const promCarreraInicio = avg(encuestas.map(e => e.carrera_inicio_deseada))
  const promCarreraActual = avg(encuestas.map(e => e.carrera_actual_deseada))
  const pctCarreraAlta    = pct(encuestas.filter(e => (e.carrera_actual_deseada ?? 0) >= 4).length, total)

  // ── lectura ───────────────────────────────────────────────────────────────
  const promLibros       = avg(encuestas.map(e => e.libros_anio))
  const promEscritura    = avg(encuestas.map(e => e.gusto_escritura))

  // ── distribuciones ────────────────────────────────────────────────────────
  const distCarrera   = frecuencia(encuestas.map(e => e.carrera))
  const distModalidad = frecuencia(encuestas.map(e => e.modalidad_carrera))
  const distVivienda  = frecuencia(encuestas.map(e => e.situacion_vivienda))
  const distGenero    = frecuencia(encuestas.map(e => e.genero))
  const distTrabajo   = frecuencia(encuestas.filter(e => e.trabaja).map(e => e.tipo_trabajo))
  const distMovil     = frecuencia(encuestas.map(e => e.dispositivo_movil))

  const labelMovil: Record<string, string> = { android: 'Android', ios: 'iPhone (iOS)', ambos: 'Ambos', ninguno: 'Sin teléfono' }

  // ── uso de IA ────────────────────────────────────────────────────────────
  const iaFields = [
    { key: 'uso_ia_comprension',  label: 'Comprender textos' },
    { key: 'uso_ia_resumen',      label: 'Resumir contenido' },
    { key: 'uso_ia_ideas',        label: 'Generar ideas' },
    { key: 'uso_ia_redaccion',    label: 'Redactar textos' },
    { key: 'uso_ia_tareas',       label: 'Resolver tareas' },
    { key: 'uso_ia_verificacion', label: 'Verificar información' },
    { key: 'uso_ia_critico',      label: 'Análisis crítico' },
    { key: 'uso_ia_traduccion',   label: 'Traducción de textos' },
    { key: 'uso_ia_idiomas',      label: 'Aprender idiomas' },
  ]
  const iaPromedios = iaFields.map(f => ({
    label: f.label,
    prom: avg(encuestas.map(e => e[f.key])),
  })).sort((a, b) => (b.prom ?? 0) - (a.prom ?? 0))
  const promIAGlobal = avg(iaPromedios.map(f => f.prom))

  // Mapa auth_user_id → estudiante completo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authToEst: Record<string, any> = {}
  for (const e of estudiantes) if (e.auth_user_id) authToEst[e.auth_user_id] = e

  // ── tabla individual ──────────────────────────────────────────────────────
  const filas: FilaEncuesta[] = encuestas.map(e => {
    const est = authToEst[e.auth_user_id]
    return {
      estudianteId:   est?.id ?? '',
      authUserId:     e.auth_user_id,
      nombre:         authToNombre[e.auth_user_id] ?? '—',
      carrera:        e.carrera ?? '—',
      modalidad:      e.modalidad_carrera ?? '—',
      trabaja:        !!e.trabaja,
      laptop:         !!e.tiene_laptop,
      pc:             !!e.tiene_pc_escritorio,
      sinPC:          !!e.sin_computadora,
      foraneo:        !!e.es_foraneo,
      dispositivo:    e.dispositivo_movil ?? null,
      nivel_tech:     e.nivel_tecnologia ?? null,
      ia_prom:        avg(iaFields.map(f => e[f.key])),
      carrera_inicio: e.carrera_inicio_deseada ?? null,
      carrera_actual: e.carrera_actual_deseada ?? null,
      gusto_escritura: e.gusto_escritura ?? null,
      libros:         e.libros_anio ?? null,
      problemas:      e.problemas_reportados ?? null,
      nota_incidencia: est?.nota_incidencia ?? null,
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const conProblemas = filas.filter(f => f.problemas).length

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/cursos/${cursoId}`} className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Encuesta del grupo</h1>
          <p className="text-gray-400 text-sm">
            {curso.asignatura} · {curso.codigo} · {total} respuestas de {estudiantes.length} estudiantes
            {conProblemas > 0 && <span className="text-orange-400 ml-2">· ⚠ {conProblemas} reportaron situaciones</span>}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-gray-300 font-medium mb-1">Ningún estudiante ha respondido la encuesta</p>
          <p className="text-gray-500 text-sm">Los datos aparecerán cuando completen el onboarding del portal estudiantil.</p>
        </div>
      ) : (
        <>
          {/* Stat cards principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <span className="stat-value">{pctTrabaja}%</span>
              <span className="stat-label">Trabaja</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{pctLaptop}%</span>
              <span className="stat-label">Tiene laptop</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{pctForaneo}%</span>
              <span className="stat-label">Foráneo</span>
            </div>
            <div className="stat-card">
              <span className={`stat-value ${nivelTechProm !== null && nivelTechProm >= 4 ? 'text-emerald-400' : nivelTechProm !== null && nivelTechProm >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                {nivelTechProm !== null ? `${nivelTechProm}/5` : '—'}
              </span>
              <span className="stat-label">Nivel tecnología</span>
            </div>
          </div>

          {/* Tecnología + Móvil */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Acceso a tecnología</h2>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              {[
                { label: 'Laptop',          pct: pctLaptop, color: 'bg-emerald-500' },
                { label: 'PC escritorio',   pct: pctPC,     color: 'bg-blue-500' },
                { label: 'Sin computadora', pct: pctSinPC,  color: 'bg-red-500' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-2xl font-bold text-white">{item.pct}%</p>
                  <div className="w-full h-2 bg-gray-800 rounded-full mt-2 mb-1 overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Teléfono móvil</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {distMovil.filter(d => d.valor !== '—').map(({ valor, n }) => (
                  <div key={valor} className="bg-gray-800/50 rounded-lg px-3 py-2 text-center">
                    <p className="text-lg font-bold text-white">{n}</p>
                    <p className="text-xs text-gray-400">{labelMovil[valor] ?? valor}</p>
                    <p className="text-[10px] text-gray-600">{pct(n, total)}%</p>
                  </div>
                ))}
                {distMovil.find(d => d.valor === '—') && (
                  <div className="bg-gray-800/30 rounded-lg px-3 py-2 text-center">
                    <p className="text-lg font-bold text-gray-600">{distMovil.find(d => d.valor === '—')!.n}</p>
                    <p className="text-xs text-gray-600">No respondió</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Carrera elegida + Lectura */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* Carrera elegida */}
            <div className="card">
              <h2 className="font-semibold text-white mb-1">Elección de carrera</h2>
              <p className="text-xs text-gray-500 mb-4">Escala 1 (no era lo que quería) → 5 (exactamente lo que quería)</p>
              <div className="space-y-4">
                {[
                  { label: 'Al inicio de la carrera', prom: promCarreraInicio },
                  { label: 'Actualmente', prom: promCarreraActual },
                ].map(({ label, prom }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{label}</span>
                      <span className={`font-mono font-medium ${prom !== null && prom >= 4 ? 'text-emerald-400' : prom !== null && prom >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {prom !== null ? `${prom}/5` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${prom !== null && prom >= 4 ? 'bg-emerald-500' : prom !== null && prom >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: prom !== null ? `${(prom / 5) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
                {promCarreraInicio !== null && promCarreraActual !== null && (
                  <p className="text-xs text-gray-500 pt-1">
                    {promCarreraActual > promCarreraInicio
                      ? `↑ La satisfacción con la carrera mejoró (+${(promCarreraActual - promCarreraInicio).toFixed(1)} pts)`
                      : promCarreraActual < promCarreraInicio
                      ? `↓ La satisfacción bajó (${(promCarreraActual - promCarreraInicio).toFixed(1)} pts)`
                      : '→ Sin cambio en satisfacción'}
                    {' · '}{pctCarreraAlta}% siente que estudia lo que quiere (≥4/5)
                  </p>
                )}
              </div>
            </div>

            {/* Lectura y escritura */}
            <div className="card">
              <h2 className="font-semibold text-white mb-4">Lectura y escritura</h2>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Libros leídos al año</span>
                    <span className="font-mono text-gray-400 font-medium">
                      {promLibros !== null ? `${promLibros} libros` : '—'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: promLibros !== null ? `${Math.min((promLibros / 20) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">Barra relativa a 20 libros/año</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Gusto por escribir</span>
                    <span className={`font-mono font-medium ${promEscritura !== null && promEscritura >= 4 ? 'text-emerald-400' : promEscritura !== null && promEscritura >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {promEscritura !== null ? `${promEscritura}/5` : '—'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${promEscritura !== null && promEscritura >= 4 ? 'bg-emerald-500' : promEscritura !== null && promEscritura >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: promEscritura !== null ? `${(promEscritura / 5) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">1 = No me gusta nada · 5 = Me encanta escribir</p>
                </div>
              </div>
            </div>
          </div>

          {/* Distribuciones */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold text-white mb-4">Carrera</h2>
              <div className="space-y-2">
                {distCarrera.map(({ valor, n }) => (
                  <div key={valor}>
                    <div className="flex justify-between text-sm mb-0.5">
                      <span className="text-gray-300 truncate pr-2">{valor}</span>
                      <span className="text-gray-500 flex-shrink-0">{n} ({pct(n, total)}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct(n, total)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { title: 'Modalidad',   dist: distModalidad },
                { title: 'Vivienda',    dist: distVivienda },
                { title: 'Género',      dist: distGenero },
              ].map(({ title, dist }) => (
                <div key={title} className="card py-3">
                  <h3 className="font-semibold text-gray-300 text-sm mb-2">{title}</h3>
                  <div className="space-y-1">
                    {dist.map(({ valor, n }) => (
                      <div key={valor} className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">{valor}</span>
                        <span className="text-sm font-mono text-gray-500">{n} <span className="text-gray-700">({pct(n, total)}%)</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trabajo */}
          {distTrabajo.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-white mb-3">
                Tipo de trabajo <span className="text-gray-500 font-normal text-sm">— {pctTrabaja}% trabaja</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {distTrabajo.map(({ valor, n }) => (
                  <span key={valor} className="text-sm bg-gray-800 text-gray-300 rounded-full px-3 py-1">
                    {valor} <span className="text-gray-500">({n})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Uso de IA */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Uso de IA <span className="text-xs text-gray-500 font-normal ml-1">1 = Nunca · 5 = Siempre</span></h2>
              {promIAGlobal !== null && (
                <span className={`text-sm font-mono font-medium ${promIAGlobal >= 4 ? 'text-emerald-400' : promIAGlobal >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                  Promedio global: {promIAGlobal}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {iaPromedios.map(({ label, prom }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{label}</span>
                    <span className="font-mono text-gray-400">{prom ?? '—'}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(prom ?? 0) >= 4 ? 'bg-emerald-500' : (prom ?? 0) >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: prom !== null ? `${(prom / 5) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla individual con filtro */}
          <div className="card overflow-hidden">
            <h2 className="font-semibold text-white mb-4">
              Detalle por estudiante
              {conProblemas > 0 && (
                <span className="ml-2 text-xs font-normal text-orange-400">
                  ⚠ {conProblemas} con situación reportada — clic para expandir
                </span>
              )}
            </h2>
            <EncuestaTablaCliente filas={filas} cursoId={cursoId} />
          </div>
        </>
      )}
    </div>
  )
}
