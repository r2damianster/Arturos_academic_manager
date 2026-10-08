import { nombreParaLlamar } from '@/lib/format'

interface NombreLlamarProps {
  student: { nombre: string; nombre_preferido?: string | null }
  /** Muestra el nombre completo del apodo (sin acortar al formato Apellido Nombre). */
  className?: string
}

/**
 * Nombre para llamar en clase. Si es un apodo, agrega la marca ✎ y un tooltip
 * con el nombre registrado formalmente.
 */
export function NombreLlamar({ student, className }: NombreLlamarProps) {
  const preferredName = student.nombre_preferido?.trim()
  return (
    <span className={className}>
      {nombreParaLlamar(student)}
      {preferredName && (
        <span
          className="ml-1 text-[0.75em] text-brand-400 no-underline"
          title={`Apodo — nombre registrado: ${student.nombre}`}
        >
          ✎
        </span>
      )}
    </span>
  )
}
