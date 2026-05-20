'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, FolderKanban,
  TrendingUp, BarChart2, Target, Settings, LogOut, Sun, Moon, CalendarCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useTheme } from './ThemeProvider'

type NavItem = { href: string; icon: React.ElementType; label: string; exact?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Visão Geral',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/dashboard/financeiro', icon: TrendingUp, label: 'Financeiro' },
      { href: '/dashboard/metas', icon: Target, label: 'Metas' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/dashboard/clientes', icon: Users, label: 'Clientes' },
      { href: '/dashboard/reunioes', icon: CalendarCheck, label: 'Reuniões' },
    ],
  },
  {
    label: 'Projetos',
    items: [
      { href: '/dashboard/projetos', icon: FolderKanban, label: 'Projetos' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/dashboard/meta', icon: BarChart2, label: 'Meta Ads', exact: true },
    ],
  },
]

interface SidebarProps {
  userRole?: 'admin' | 'editor'
  mobileOpen?: boolean
}

export function Sidebar({ userRole = 'admin', mobileOpen = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className={cn(
      'sidebar fixed left-0 top-0 h-screen w-60 flex flex-col z-30 select-none',
      'transition-transform duration-300 ease-in-out',
      '-translate-x-full lg:translate-x-0',
      mobileOpen && 'translate-x-0',
    )}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1E3020]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1 ring-1 ring-[#40916C]/30 shadow-[0_0_14px_rgba(64,145,108,0.28)]">
            <Image
              src="/logotipo-removebg-preview.png"
              alt="RyzeSystems"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-bold text-white tracking-tight">RYZE</div>
            <div className="text-[10px] font-medium text-[#4A6B52] tracking-[0.15em] uppercase">Systems</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-3">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[10px] font-semibold text-[#2A4030] uppercase tracking-[0.15em]">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ href, icon: Icon, label, exact }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href, exact) ? 'page' : undefined}
                  className={cn('nav-item', isActive(href, exact) && 'active')}
                >
                  <Icon size={16} strokeWidth={isActive(href, exact) ? 2 : 1.75} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {userRole === 'admin' && (
          <div>
            <p className="px-3 pb-1 text-[10px] font-semibold text-[#2A4030] uppercase tracking-[0.15em]">Administração</p>
            <div className="space-y-0.5">
              <Link href="/dashboard/configuracoes" className={cn('nav-item', isActive('/dashboard/configuracoes') && 'active')}>
                <Settings size={16} strokeWidth={1.75} />
                <span>Configurações</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#1E3020]">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-[#40916C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userRole === 'admin' ? 'I' : 'V'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#F8FBF9] truncate">
              {userRole === 'admin' ? 'Isaac' : 'Vinícius'}
            </div>
            <div className="text-[11px] text-[#4A6B52] capitalize">{userRole}</div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            className="p-1.5 rounded-md text-[#4A6B52] hover:text-[#8BA891] hover:bg-[#1E3020] transition-colors flex-shrink-0"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
        <button type="button" onClick={handleSignOut} className="nav-item w-full text-[#4A6B52] hover:text-red-400 hover:bg-red-400/5">
          <LogOut size={15} strokeWidth={1.75} />
          <span className="text-[13px]">Sair</span>
        </button>
      </div>
    </aside>
  )
}
