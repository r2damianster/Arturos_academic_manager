import { LayoutDashboard, Video, BookOpen, Wrench, UserCog, GraduationCap } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  match?: string
  matchAlso?: string
}

export const NAV_ITEMS: NavItem[] = [
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
    href: '/dashboard/tutorias',
    label: 'Tutorías',
    icon: <GraduationCap className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />,
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

export const FOOTER_ITEMS: NavItem[] = [
  {
    href: '/dashboard/config',
    label: 'Administración',
    icon: <UserCog className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />,
  },
]
