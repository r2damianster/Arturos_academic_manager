export default function Loading() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 bg-gray-100 rounded-xl" />
      ))}
    </div>
  )
}
