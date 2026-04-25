import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

// ── helpers ──────────────────────────────────────────────────────────────────

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
  return Object.entries(map)
    .map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => b.n - a.n)
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function EncuestaPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [cursoRes, estudiantesRes] = await Promise.all([
    db.from('cursos').select('id, asignatura, codigo').eq('id', cursoId).single(),
    db.from('estudiantes')
      .select('id, nombre, email, auth_user_id')
      .eq('curso_id', cursoId)
      .eq('estado', 'activo')
      .order('nombre'),
  ])

  if (!cursoRes.data) notFound()
  const curso = cursoRes.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estudiantes: any[] = estudiantesRes.data ?? []

  const authIds = estudiantes.map((e: any) => e.auth_user_id).filter(Boolean) as string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let encuestas: any[] = []
  if (authIds.length > 0) {
    const { data } = await db
      .from('encuesta_estudiante')
      .select('*')
      .in('auth_user_id', authIds)
    encuestas = data ?? []
  }

  // Mapa auth_user_id → nombre
  const authToNombre: Record<string, string> = {}
  for (const e of estudiantes) if (e.auth_user_id) authToNombre[e.auth_user_id] = e.nombre

  const total = encuestas.length

  // ── métricas globales ──────────────────────────────────────────────────────
  const pctTrabaja       = pct(encuestas.filter(e => e.trabaja).length, total)
  const pctLaptop        = pct(encuestas.filter(e => e.tiene_laptop).length, total)
  const pctPC            = pct(encuestas.filter(e => e.tiene_pc_escritorio).length, total)
  const pctSinPC         = pct(encuestas.filter(e => e.sin_computadora).length, total)
  const pctForaneo       = pct(encuestas.filter(e => e.es_foraneo).length, total)
  const nivelTechProm    = avg(encuestas.map(e => e.nivel_tecnologia))

  // ── distribuciones ────────────────────────────────────────────────────────
  const distCarrera    = frecuencia(encuestas.map(e => e.carrera))
  const distModalidad  = frecuencia(encuestas.map(e => e.modalidad_carrera))
  const distVivienda   = frecuencia(encuestas.map(e => e.situacion_vivienda))
  const distGenero     = frecuencia(encuestas.map(e => e.genero))
  const distTrabajo    = frecuencia(encuestas.filter(e => e.trabaja).map(e => e.tipo_trabajo))

  // ── uso de IA (escala 1-5) ────────────────────────────────────────────────
  const iaFields: { key: string; label: string }[] = [
    { key: 'uso_ia_comprension', label: 'Comprensión' },
    { key: 'uso_ia_resumen',     label: 'Resumen' },
    { key: 'uso_ia_ideas',       label: 'Ideas' },
    { key: 'uso_ia_redaccion',   label: 'Redacción' },
    { key: 'uso_ia_tareas',      label: 'Tareas' },
    { key: 'uso_ia_verificacion',label: 'Verificación' },
    { key: 'uso_ia_critico',     label: 'Pensamiento crítico' },
    { key: 'uso_ia_traduccion',  label: 'Traducción' },
    { key: 'uso_ia_idiomas',     label: 'Idiomas' },
  ]
  const iaPromedios = iaFields.map(f => ({
    label: f.label,
    prom: avg(encuestas.map(e => e[f.key])),
  })).sort((a, b) => (b.prom ?? 0) - (a.prom ?? 0))

  const promIAGlobal = avg(iaPromedios.map(f => f.prom))

  // ── tabla individual ──────────────────────────────────────────────────────
  const filas = encuestas.map(e => ({
    nombre:        authToNombre[e.auth_user_id] ?? '—',
    carrera:       e.carrera ?? '—',
    modalidad:     e.modalidad_carrera ?? '—',
    trabaja:       e.trabaja,
    tipo_trabajo:  e.tipo_trabajo ?? '—',
    laptop:        e.tiene_laptop,
    pc:            e.tiene_pc_escritorio,
    sinPC:         e.sin_computadora,
    foraneo:       e.es_foraneo,
    nivel_tech:    e.nivel_tecnologia,
    ia_prom:       avg(iaFields.map(f => e[f.key])),
    problemas:     e.problemas_reportados ?? null,
  })).sort((a, b) => a.nombre.localeCompare(b.nombre))

  // ── render ────────────────────────────────────────────────────────────────
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
          <p className="text-gray-400 text-sm">{curso.asignatura} · {curso.codigo} · {total} respuestas de {estudiantes.length} estudiantes</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-gray-300 font-medium mb-1">Ningún estudiante ha respondido la encuesta</p>
          <p className="text-gray-500 text-sm">Los datos aparecerán aquí cuando completen el onboarding del portal estudiantil.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
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

          {/* Dispositivos */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Acceso a tecnología</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Laptop', pct: pctLaptop, color: 'bg-emerald-500' },
                { label: 'PC escritorio', pct: pctPC, color: 'bg-blue-500' },
                { label: 'Sin computadora', pct: pctSinPC, color: 'bg-red-500' },
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
          </div>

          {/* Distribuciones en grid */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* Carrera */}
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

            {/* Modalidad + Vivienda */}
            <div className="space-y-6">
              <div className="card">
                <h2 className="font-semibold text-white mb-3">Modalidad de carrera</h2>
                <div className="space-y-2">
                  {distModalidad.map(({ valor, n }) => (
                    <div key={valor} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{valor}</span>
                      <span className="text-sm font-mono text-gray-400">{n} <span className="text-gray-600">({pct(n, total)}%)</span></span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2 className="font-semibold text-white mb-3">Situación de vivienda</h2>
                <div className="space-y-2">
                  {distVivienda.map(({ valor, n }) => (
                    <div key={valor} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{valor}</span>
                      <span className="text-sm font-mono text-gray-400">{n} <span className="text-gray-600">({pct(n, total)}%)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Género + Trabajo */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold text-white mb-3">Género</h2>
              <div className="space-y-2">
                {distGenero.map(({ valor, n }) => (
                  <div key={valor} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{valor}</span>
                    <span className="text-sm font-mono text-gray-400">{n} <span className="text-gray-600">({pct(n, total)}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h2 className="font-semibold text-white mb-3">Tipo de trabajo <span className="text-gray-600 font-normal text-xs">({pctTrabaja}% trabaja)</span></h2>
              {distTrabajo.length === 0 ? (
                <p className="text-sm text-gray-600">Ningún estudiante reportó trabajar.</p>
              ) : (
                <div className="space-y-2">
                  {distTrabajo.map(({ valor, n }) => (
                    <div key={valor} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{valor}</span>
                      <span className="text-sm font-mono text-gray-400">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Uso de IA */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Uso de IA <span className="text-xs text-gray-500 font-normal ml-1">(escala 1–5)</span></h2>
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
                    <span className="font-mono text-gray-400">{prom !== null ? prom : '—'}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${(prom ?? 0) >= 4 ? 'bg-emerald-500' : (prom ?? 0) >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: prom !== null ? `${(prom / 5) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla individual */}
          <div className="card overflow-hidden">
            <h2 className="font-semibold text-white mb-4">Detalle por estudiante</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-[11px] uppercase tracking-widest text-gray-500">
                    <th className="text-left py-2 px-3 min-w-[160px]">Estudiante</th>
                    <th className="text-left py-2 px-3 min-w-[130px]">Carrera</th>
                    <th className="text-center py-2 px-2 w-16">Trabaja</th>
                    <th className="text-center py-2 px-2 w-16">Laptop</th>
                    <th className="text-center py-2 px-2 w-16">Foráneo</th>
                    <th className="text-center py-2 px-2 w-16">Tech</th>
                    <th className="text-center py-2 px-2 w-16">IA prom</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filas.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="text-gray-200 font-medium truncate max-w-[160px]">{f.nombre}</p>
                        {f.problemas && (
                          <p className="text-[11px] text-orange-400 truncate max-w-[160px]" title={f.problemas}>
                            ⚠ {f.problemas}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-xs truncate max-w-[130px]">
                        {f.carrera}
                        {f.modalidad !== '—' && <span className="block text-gray-600">{f.modalidad}</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center">{f.trabaja ? <span className="text-emerald-500">✓</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="py-2.5 px-2 text-center">{f.laptop ? <span className="text-emerald-500">✓</span> : f.sinPC ? <span className="text-red-400 text-xs">sin PC</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="py-2.5 px-2 text-center">{f.foraneo ? <span className="text-yellow-400">✓</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="py-2.5 px-2 text-center">
                        {f.nivel_tech !== null ? (
                          <span className={`font-mono text-sm ${f.nivel_tech >= 4 ? 'text-emerald-400' : f.nivel_tech >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {f.nivel_tech}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {f.ia_prom !== null ? (
                          <span className={`font-mono text-sm ${f.ia_prom >= 4 ? 'text-emerald-400' : f.ia_prom >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {f.ia_prom}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
