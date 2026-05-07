'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { LayoutDashboard, Video, BookOpen, Wrench, UserCog, GraduationCap } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  match?: string
  matchAlso?: string
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Panel',
    match: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/planificacion',
    label: 'Clases',
    matchAlso: '/dashboard/modo-clase',
    icon: <Video className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/cursos',
    label: 'Mis Cursos',
    icon: <BookOpen className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/herramientas',
    label: 'Herramientas',
    icon: <Wrench className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />,
  },
]

export function Sidebar({ nombreProfesor }: { nombreProfesor: string }) {
  const pathname = usePathname()

  function isActive(item: NavItem) {
    if (item.match) return pathname === item.match
    if (item.matchAlso && pathname.startsWith(item.matchAlso)) return true
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="hidden md:flex fixed top-0 left-0 h-full w-16 hover:w-[260px] bg-gray-900 border-r border-gray-800 flex-col z-30 transition-all duration-200 ease-in-out overflow-hidden group"
      style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.3)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-[14px] py-5 border-b border-gray-800 min-w-[260px]">
        <div className="flex-shrink-0 w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center"
          style={{ boxShadow: '0 0 12px rgba(2,132,199,0.4)' }}>
          <GraduationCap className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <p className="text-white font-semibold text-sm whitespace-nowrap">Gestor Universitario</p>
          <p className="text-gray-500 text-xs truncate">{nombreProfesor}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto min-w-[260px]">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              isActive(item)
                ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800 active:scale-[0.98]'
            )}
          >
            {item.icon}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-4 border-t border-gray-800 space-y-1 min-w-[260px]">
        <Link
          href="/dashboard/config"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
            pathname.startsWith('/dashboard/config')
              ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800 active:scale-[0.98]'
          )}
        >
          <UserCog className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
            Administración
          </span>
        </Link>
      </div>
    </aside>
  )
}
