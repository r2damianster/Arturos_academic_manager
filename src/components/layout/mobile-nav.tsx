'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { LayoutDashboard, Video, BookOpen, Wrench, UserCog, GraduationCap, Menu, X, Inbox } from 'lucide-react'

interface MobileNavProps {
  nombreProfesor: string
}

const navItems: { href: string; label: string; match?: string; matchAlso?: string; icon: React.ReactNode }[] = [
  {
    href: '/dashboard',
    label: 'Panel',
    match: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/planificacion',
    label: 'Clases',
    matchAlso: '/dashboard/modo-clase',
    icon: <Video className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/tutorias',
    label: 'Tutorías',
    icon: <GraduationCap className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/cursos',
    label: 'Mis Cursos',
    icon: <BookOpen className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/herramientas',
    label: 'Herramientas',
    icon: <Wrench className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/actividades',
    label: 'Notas',
    icon: <Inbox className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    href: '/dashboard/config',
    label: 'Administración',
    icon: <UserCog className="w-5 h-5" strokeWidth={1.5} />,
  },
]

export function MobileNav({ nombreProfesor }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  function isActive(href: string, match?: string, matchAlso?: string) {
    if (match) return pathname === match
    if (matchAlso && pathname.startsWith(matchAlso)) return true
    return pathname.startsWith(href)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 text-gray-400 hover:text-white transition-colors active:scale-[0.95]"
        aria-label="Menú"
      >
        <Menu className="w-6 h-6" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/80 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className={clsx(
        'fixed top-0 left-0 h-screen w-4/5 max-w-xs bg-gray-900 border-r border-gray-800 z-50 flex flex-col transition-transform duration-200 ease-in-out md:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )} style={{ boxShadow: '8px 0 32px rgba(0,0,0,0.5)' }}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: '0 0 10px rgba(2,132,199,0.35)' }}>
              <GraduationCap className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">Gestor Univ.</p>
              <p className="text-gray-500 text-xs truncate">{nombreProfesor}</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 p-1 transition-colors">
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive(item.href, item.match, item.matchAlso)
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800 active:scale-[0.98]'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
