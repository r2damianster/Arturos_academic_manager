import { ProyectorClient } from './proyector-client'

export default async function ProyectorPage({
  params,
}: {
  params: Promise<{ bitacoraId: string }>
}) {
  const { bitacoraId } = await params
  return <ProyectorClient bitacoraId={bitacoraId} />
}
