'use client'

import { useState } from 'react'
import { exportarDatasetInvestigacion } from '@/lib/actions/cursos'

export function ExportDatasetButton({ cursoId }: { cursoId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    const { csv, error } = await exportarDatasetInvestigacion(cursoId)
    if (error || !csv) {
      alert(error ?? 'Error al exportar')
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dataset_${cursoId.slice(0, 8)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:border-indigo-600/60 hover:text-indigo-400 hover:bg-indigo-900/10 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <span>📊</span>
      )}
      Exportar datos (.csv)
    </button>
  )
}
