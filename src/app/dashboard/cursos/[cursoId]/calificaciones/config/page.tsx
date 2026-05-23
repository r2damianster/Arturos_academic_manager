import { redirect } from 'next/navigation'

export default async function ConfigCalificacionesPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params
  redirect(`/dashboard/cursos/${cursoId}/editar?tab=evaluacion`)
}
