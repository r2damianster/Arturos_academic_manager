'use client'

import { useState, useTransition } from 'react'
import { upsertTutoradoPerfil, type TutoradoItem } from '@/lib/actions/tutorados'

const NIVELES_PROGRAMA = [
  { value: 'pregrado',   label: 'Pregrado' },
  { value: 'maestria',   label: 'Maestría' },
  { value: 'doctorado',  label: 'Doctorado' },
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'otro',       label: 'Otro' },
]

const TIPOS_TRABAJO = [
  { value: 'articulo_cientifico',         label: 'Artículo científico' },
  { value: 'sistematizacion_experiencias',label: 'Sistematización de experiencias' },
  { value: 'creacion_productos',          label: 'Creación de productos' },
  { value: 'examen_complexivo',           label: 'Examen complexivo' },
  { value: 'proyecto_investigacion',      label: 'Proyecto de investigación' },
  { value: 'disertacion_academica',       label: 'Disertación académica' },
  { value: 'ensayo_academico',            label: 'Ensayo académico' },
  { value: 'producto_educomunicacional',  label: 'Producto educomunicacional' },
  { value: 'otro',                        label: 'Otro' },
]
const MODALIDADES_SESION = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual',    label: 'Virtual' },
  { value: 'whatsapp',   label: 'WhatsApp' },
  { value: 'telefono',   label: 'Teléfono' },
  { value: 'otro',       label: 'Otro' },
]
const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado']

interface Props {
  tutorado: TutoradoItem
  onClose: () => void
}

export function EditarPerfilTutorado({ tutorado, onClose }: Props) {
  const p = tutorado.perfil
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [progreso, setProgreso] = useState(p?.progreso_pct ?? 0)
  const [tieneDia, setTieneDia] = useState(!!(p?.dia_semana))
  const [publicado, setPublicado] = useState(p?.publicado ?? false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('progreso_pct', String(progreso))
    fd.set('publicado', publicado ? 'true' : 'false')
    if (!tieneDia) {
      fd.delete('dia_semana')
      fd.delete('hora_inicio')
      fd.delete('hora_fin')
    }
    startTransition(async () => {
      const res = await upsertTutoradoPerfil(tutorado.id, tutorado.curso_id, fd)
      if (res.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Perfil del tutorado</h2>
            <p className="text-gray-400 text-sm">{tutorado.nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nivel + Modalidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nivel / Programa</label>
              <select name="modalidad_trabajo" className="input" defaultValue={p?.modalidad_trabajo ?? ''}>
                <option value="">— Sin especificar —</option>
                {NIVELES_PROGRAMA.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Modalidad de titulación</label>
              <select name="tipo_trabajo" className="input" defaultValue={(p as any)?.tipo_trabajo ?? ''}>
                <option value="">— Sin especificar —</option>
                {TIPOS_TRABAJO.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Título del trabajo</label>
            <input name="titulo_trabajo" className="input" maxLength={300}
              defaultValue={p?.titulo_trabajo ?? ''}
              placeholder="Título de la tesis, artículo o proyecto…" />
          </div>

          <div>
            <label className="label">Etapa actual</label>
            <input name="etapa" className="input" maxLength={100}
              defaultValue={p?.etapa ?? ''}
              placeholder="Ej: Diseño, Resultados, Revisión final…" />
          </div>

          <div>
            <label className="label">Progreso — {progreso}%</label>
            <input type="range" min={0} max={100} step={5}
              value={progreso} onChange={e => setProgreso(Number(e.target.value))}
              className="w-full accent-brand-500" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          {/* Institución del tutorado */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Institución del tutorado</p>
            <div>
              <label className="label text-xs">Universidad</label>
              <input name="universidad" className="input text-sm" maxLength={200}
                defaultValue={p?.universidad ?? ''}
                placeholder="Ej: ULEAM, UTM, ESPOL…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Facultad</label>
                <input name="facultad" className="input text-sm" maxLength={200}
                  defaultValue={p?.facultad ?? ''}
                  placeholder="Ej: Cs. Informáticas" />
              </div>
              <div>
                <label className="label text-xs">Carrera</label>
                <input name="carrera_tutorado" className="input text-sm" maxLength={200}
                  defaultValue={p?.carrera_tutorado ?? ''}
                  placeholder="Ej: Ingeniería en Sistemas" />
              </div>
            </div>
            <div>
              <label className="label text-xs">Asignatura / materia</label>
              <input name="asignatura_tutorado" className="input text-sm" maxLength={200}
                defaultValue={p?.asignatura_tutorado ?? ''}
                placeholder="Ej: Trabajo de Titulación, Proyecto de Grado…" />
            </div>
          </div>

          {/* Gestión administrativa */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Datos administrativos</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Fecha de asignación</label>
                <input name="fecha_asignacion" type="date" className="input text-sm"
                  defaultValue={p?.fecha_asignacion ?? ''} />
              </div>
              <div>
                <label className="label text-xs">Nº de períodos</label>
                <input name="num_periodos" type="number" className="input text-sm"
                  min={1} max={10} defaultValue={p?.num_periodos ?? 1} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Fecha proyectada de fin</label>
                <input name="fecha_proyectada_fin" type="date" className="input text-sm"
                  defaultValue={p?.fecha_proyectada_fin ?? ''} />
              </div>
              <div>
                <label className="label text-xs">N° de oficio</label>
                <input name="numero_oficio" className="input text-sm" maxLength={100}
                  defaultValue={p?.numero_oficio ?? ''}
                  placeholder="Ej: OF-2026-0234" />
              </div>
            </div>
          </div>

          {/* Horario diferenciado */}
          <div className="border-t border-gray-800 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="label mb-0 text-xs uppercase tracking-wide font-medium text-gray-500">Horario diferenciado</label>
              <button type="button" onClick={() => setTieneDia(!tieneDia)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${tieneDia ? 'bg-brand-600' : 'bg-gray-700'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${tieneDia ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {tieneDia && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label text-xs">Día</label>
                    <select name="dia_semana" className="input text-sm" defaultValue={p?.dia_semana ?? ''}>
                      <option value="">—</option>
                      {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Desde</label>
                    <input name="hora_inicio" type="time" className="input text-sm" defaultValue={p?.hora_inicio ?? ''} />
                  </div>
                  <div>
                    <label className="label text-xs">Hasta</label>
                    <input name="hora_fin" type="time" className="input text-sm" defaultValue={p?.hora_fin ?? ''} />
                  </div>
                </div>
                <div>
                  <label className="label text-xs">Modalidad preferida</label>
                  <select name="modalidad_sesion" className="input text-sm" defaultValue={p?.modalidad_sesion ?? 'presencial'}>
                    {MODALIDADES_SESION.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="mt-3">
              <label className="label text-xs">Nota sobre el horario</label>
              <input name="nota_horario" className="input text-sm" maxLength={300}
                defaultValue={p?.nota_horario ?? ''}
                placeholder="Horario asignado martes 10h, pero acordamos miércoles por WhatsApp…" />
            </div>
          </div>

          {/* Publicación */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium flex-1">Publicación</p>
              <button type="button" onClick={() => setPublicado(!publicado)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${publicado ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${publicado ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-xs ${publicado ? 'text-emerald-400' : 'text-gray-600'}`}>
                {publicado ? 'Publicado' : 'No publicado'}
              </span>
            </div>

            {publicado && (
              <>
                <div>
                  <label className="label text-xs">Fecha de publicación</label>
                  <input name="fecha_publicacion" type="date" className="input text-sm"
                    defaultValue={p?.fecha_publicacion ?? ''} />
                </div>
                <div>
                  <label className="label text-xs">Referencia (revista, DOI, ISBN, URL…)</label>
                  <textarea name="referencia_publicacion" className="input text-sm" rows={2}
                    maxLength={500}
                    defaultValue={p?.referencia_publicacion ?? ''}
                    placeholder="Ej: Revista Científica ULEAM, Vol. 3, DOI: 10.1234/…" />
                </div>
              </>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="flex-1 btn-primary">
              {pending ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
