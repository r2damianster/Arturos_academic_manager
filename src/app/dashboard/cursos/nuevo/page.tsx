'use client'

import { useState, useEffect } from 'react'
import { crearCursoAction } from '@/lib/actions/cursos'
import Link from 'next/link'

function generarCodigo(asignatura: string, periodo: string): string {
  const skip = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'de', 'la', 'el', 'en', 'y', 'o', 'con', 'para', 'por', 'del', 'los', 'las'])
  const palabras = asignatura.trim().split(/\s+/)
  const siglas = palabras
    .filter(p => p.length > 0 && !skip.has(p.toLowerCase()))
    .map(p => p[0].toLowerCase())
    .join('')
  const periodoCode = periodo.replace(/^20/, '').replace(/[-_\s]/g, '').toLowerCase().slice(0, 3)
  return (siglas + periodoCode).slice(0, 15)
}

export default function NuevoCursoPage() {
  const [asignatura, setAsignatura] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoManual, setCodigoManual] = useState(false)
  const [numParciales, setNumParciales] = useState(2)

  type HorarioInput = { dia_semana: string, hora_inicio: string, hora_fin: string }
  const [horariosClases, setHorariosClases] = useState<HorarioInput[]>([])


  useEffect(() => {
    if (!codigoManual && (asignatura || periodo)) {
      setCodigo(generarCodigo(asignatura, periodo))
    }
  }, [asignatura, periodo, codigoManual])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/cursos" className="btn-ghost p-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo curso</h1>
          <p className="text-gray-400 text-sm">Completa la información del curso</p>
        </div>
      </div>

      <form action={crearCursoAction} className="card space-y-5">
        <input type="hidden" name="horarios_clases" value={JSON.stringify(horariosClases)} />
        {/* Asignatura + Período */}
        <div>
          <label className="label">Nombre de la asignatura *</label>
          <input name="asignatura" className="input" placeholder="Academic Reading and Writing II"
            required maxLength={100} value={asignatura}
            onChange={e => setAsignatura(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Período *</label>
            <input name="periodo" className="input" placeholder="2026-1" required maxLength={20}
              value={periodo} onChange={e => setPeriodo(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Ej: 2026-1, 2025-II</p>
          </div>
          <div>
            <label className="label">
              Código
              {!codigoManual && (
                <span className="ml-2 text-xs text-brand-400 font-normal">auto</span>
              )}
            </label>
            <input name="codigo" className="input" placeholder="arwi261"
              required maxLength={30} value={codigo}
              onChange={e => { setCodigo(e.target.value); setCodigoManual(true) }}
              onFocus={() => setCodigoManual(true)}
            />
            {codigoManual && (
              <button type="button" onClick={() => { setCodigoManual(false); setCodigo(generarCodigo(asignatura, periodo)) }}
                className="text-xs text-gray-500 hover:text-gray-300 mt-1">
                ↺ Regenerar automáticamente
              </button>
            )}
          </div>
        </div>

        {/* Horarios de Clases */}
        <div className="space-y-3 pt-2 pb-2 border-y border-gray-800">
          <div className="flex justify-between items-center">
            <label className="label !mb-0">Horarios de Clases</label>
            <button type="button" className="text-xs text-brand-400 font-semibold"
              onClick={() => setHorariosClases([...horariosClases, { dia_semana: 'lunes', hora_inicio: '15:00', hora_fin: '17:00' }])}>
              + Añadir horario
            </button>
          </div>
          {horariosClases.length === 0 ? (
            <p className="text-xs text-gray-500">No se han añadido horarios. (Útil para cruce automático con tutorías)</p>
          ) : (
            <div className="space-y-2">
              {horariosClases.map((h, i) => (
                <div key={i} className="flex gap-2 items-center bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                  <select 
                    className="input text-xs py-1" 
                    value={h.dia_semana}
                    onChange={e => {
                      const newH = [...horariosClases]
                      newH[i].dia_semana = e.target.value
                      setHorariosClases(newH)
                    }}>
                    {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-xs text-center w-8">De</span>
                  <input type="time" className="input text-xs py-1" required value={h.hora_inicio}
                    onChange={e => {
                      const newH = [...horariosClases]
                      newH[i].hora_inicio = e.target.value
                      setHorariosClases(newH)
                    }} />
                  <span className="text-gray-500 text-xs text-center w-8">a</span>
                  <input type="time" className="input text-xs py-1" required value={h.hora_fin}
                    onChange={e => {
                      const newH = [...horariosClases]
                      newH[i].hora_fin = e.target.value
                      setHorariosClases(newH)
                    }} />
                  <button type="button" onClick={() => setHorariosClases(horariosClases.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-300 ml-2">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha de inicio</label>
            <input name="fecha_inicio" type="date" className="input" />
          </div>
          <div>
            <label className="label">Fecha de fin</label>
            <input name="fecha_fin" type="date" className="input" />
          </div>
        </div>

        {/* Horas */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Horas/semana</label>
            <input name="horas_semana" type="number" className="input" defaultValue={64} min={1} max={200} />
          </div>
          <div>
            <label className="label">Nº sesiones</label>
            <input name="num_sesiones" type="number" className="input" defaultValue={32} min={1} max={200} />
          </div>
          <div>
            <label className="label">Horas teóricas</label>
            <input name="horas_teoricas" type="number" className="input" defaultValue={64} min={1} max={200} />
          </div>
        </div>

        {/* Parciales */}
        <div>
          <label className="label">Número de parciales</label>
          <div className="flex gap-3">
            {[2, 3, 4].map(n => (
              <label key={n} className="flex-1 cursor-pointer">
                <input type="radio" name="num_parciales" value={n}
                  checked={numParciales === n}
                  onChange={() => setNumParciales(n)}
                  className="sr-only" />
                <div className={`text-center py-2.5 rounded-lg border transition-colors ${
                  numParciales === n
                    ? 'border-brand-500 bg-brand-600/20 text-brand-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>
                  <span className="text-lg font-bold block">{n}</span>
                  <span className="text-xs">parciales</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1">Crear curso</button>
          <Link href="/dashboard/cursos" className="btn-ghost flex-1 text-center">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}

