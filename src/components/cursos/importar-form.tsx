'use client'

import { useState, useTransition } from 'react'
import { importarEstudiantesMasivo } from '@/lib/actions/estudiantes'

interface Props {
  cursoId: string
}

interface FilaEstudiante {
  nombre: string
  email: string
  valido: boolean
  error?: string
}

export function ImportarEstudiantesForm({ cursoId }: Props) {
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [resultado, setResultado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function parsearTexto(texto: string) {
    const lineas = texto.trim().split('\n').filter(l => l.trim())
    const parsed: FilaEstudiante[] = lineas.map(linea => {
      // Soporta: "Nombre, email" o "Nombre\temail" o "Nombre email@..."
      const partes = linea.split(/[\t,;]/).map(p => p.trim())
      if (partes.length >= 2) {
        const nombre = partes[0]
        const email = partes[1]
        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        return { nombre, email, valido: !!(nombre && emailValido), error: emailValido ? undefined : 'Email inválido' }
      }
      return { nombre: linea, email: '', valido: false, error: 'Formato incorrecto (se espera: Nombre, email)' }
    })
    setFilas(parsed)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Importar xlsx dinámicamente
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { header: 'A', defval: '' })

    const parsed: FilaEstudiante[] = rows.slice(1).map(row => {
      const nombre = (row['A'] || row['nombre'] || '').toString().trim()
      const email = (row['B'] || row['email'] || '').toString().trim().toLowerCase()
      const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      return { nombre, email, valido: !!(nombre && emailValido), error: emailValido ? undefined : 'Email inválido' }
    }).filter(r => r.nombre)

    setFilas(parsed)
  }

  function importar() {
    const validos = filas.filter(f => f.valido)
    if (validos.length === 0) return

    setError(null)
    setResultado(null)
    startTransition(async () => {
      const res = await importarEstudiantesMasivo(cursoId, validos)
      if (res.error) {
        setError(res.error)
      } else {
        setResultado(`${res.count} estudiantes importados correctamente.`)
        setFilas([])
      }
    })
  }

  const validos = filas.filter(f => f.valido).length
  const invalidos = filas.filter(f => !f.valido).length

  return (
    <div className="space-y-4">
      {/* Instrucciones */}
      <div className="card bg-blue-950/30 border-blue-900">
        <h3 className="font-medium text-blue-300 mb-2">Formato esperado</h3>
        <p className="text-sm text-gray-400">El archivo Excel/CSV debe tener columnas:</p>
        <div className="mt-2 font-mono text-xs bg-gray-900 rounded p-3 text-gray-300">
          <div className="grid grid-cols-2 gap-2 text-gray-500 mb-1">
            <span>Columna A</span><span>Columna B</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span>Juan García López</span><span>jgarcia@uni.edu</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span>María Pérez</span><span>mperez@uni.edu</span>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="card">
        <div className="space-y-4">
          <div>
            <label className="label">Subir archivo Excel (.xlsx) o CSV</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4
                         file:rounded-lg file:border-0 file:bg-brand-600 file:text-white
                         hover:file:bg-brand-700 file:cursor-pointer file:font-medium"
            />
          </div>

          <div>
            <label className="label">O pega el texto directamente (Nombre, email — una por línea)</label>
            <textarea
              className="input h-28 resize-none font-mono text-sm"
              placeholder={'Juan García, jgarcia@uni.edu\nMaría Pérez, mperez@uni.edu'}
              onChange={e => parsearTexto(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {filas.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Vista previa ({filas.length} filas)</h3>
            <div className="flex gap-3 text-sm">
              <span className="text-emerald-400">{validos} válidos</span>
              {invalidos > 0 && <span className="text-red-400">{invalidos} con errores</span>}
            </div>
          </div>

          <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
            {filas.map((fila, i) => (
              <div key={i} className={`flex items-center justify-between py-2 text-sm
                                       ${fila.valido ? '' : 'opacity-60'}`}>
                <div>
                  <span className={fila.valido ? 'text-gray-200' : 'text-red-400'}>{fila.nombre}</span>
                  <span className="text-gray-500 ml-2">{fila.email}</span>
                </div>
                {fila.valido
                  ? <span className="text-emerald-500 text-xs">✓</span>
                  : <span className="text-red-400 text-xs">{fila.error}</span>
                }
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-3 bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {resultado && (
            <div className="mt-3 bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm px-4 py-3 rounded-lg">
              {resultado}
            </div>
          )}

          <button
            onClick={importar}
            disabled={isPending || validos === 0}
            className="btn-primary w-full mt-4"
          >
            {isPending ? 'Importando...' : `Importar ${validos} estudiantes`}
          </button>
        </div>
      )}
    </div>
  )
}
