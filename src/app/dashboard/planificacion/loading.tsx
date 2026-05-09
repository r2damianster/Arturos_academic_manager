export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-100 rounded-lg w-48" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 21 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
