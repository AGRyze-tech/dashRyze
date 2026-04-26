'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, FolderKanban, FileText,
  TrendingUp, UserPlus, BarChart2, Settings, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/dashboard/clientes', icon: Users, label: 'Clientes' },
  { href: '/dashboard/projetos', icon: FolderKanban, label: 'Projetos' },
  { href: '/dashboard/contratos', icon: FileText, label: 'Contratos' },
  { href: '/dashboard/financeiro', icon: TrendingUp, label: 'Financeiro' },
  { href: '/dashboard/leads', icon: UserPlus, label: 'Leads' },
  { href: '/dashboard/meta', icon: BarChart2, label: 'Meta Ads' },
]

interface SidebarProps {
  userRole?: 'admin' | 'editor'
}

export function Sidebar({ userRole = 'admin' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="sidebar fixed left-0 top-0 h-screen w-60 flex flex-col z-30 select-none">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1E3020]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1">
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
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-[#2A4030] uppercase tracking-[0.15em]">Menu</p>
        {navItems.map(({ href, icon: Icon, label, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn('nav-item', isActive(href, exact) && 'active')}
          >
            <Icon size={16} strokeWidth={isActive(href, exact) ? 2 : 1.75} />
            <span>{label}</span>
          </Link>
        ))}

        {userRole === 'admin' && (
          <>
            <div className="my-3 border-t border-[#1E3020]" />
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-[#2A4030] uppercase tracking-[0.15em]">Sistema</p>
            <Link href="/dashboard/configuracoes" className={cn('nav-item', isActive('/dashboard/configuracoes') && 'active')}>
              <Settings size={16} strokeWidth={1.75} />
              <span>Configurações</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#1E3020]">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-[#40916C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userRole === 'admin' ? 'I' : 'V'}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#F8FBF9] truncate">
              {userRole === 'admin' ? 'Isaac' : 'Vinícius'}
            </div>
            <div className="text-[11px] text-[#4A6B52] capitalize">{userRole}</div>
          </div>
        </div>
        <button onClick={handleSignOut} className="nav-item w-full text-[#4A6B52] hover:text-red-400 hover:bg-red-400/5">
          <LogOut size={15} strokeWidth={1.75} />
          <span className="text-[13px]">Sair</span>
        </button>
      </div>
    </aside>
  )
}
