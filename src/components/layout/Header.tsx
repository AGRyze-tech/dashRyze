'use client'
import { Search, Bell, Menu } from 'lucide-react'
import { useState } from 'react'
import { useMobileNav } from './DashboardShell'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [search, setSearch] = useState('')
  const { toggle } = useMobileNav()

  return (
    <header className="sticky top-0 z-20 bg-[#F8FBF9]/90 dark:bg-[#121214]/90 backdrop-blur-md border-b border-gray-200/80 dark:border-[#2a2a2e]">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
        <button
          type="button"
          onClick={toggle}
          aria-label="Abrir menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-500 dark:text-[#017e26] hover:bg-gray-100 dark:hover:bg-[#2a2a2e] transition-colors"
        >
          <Menu size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-[#F8FBF9] leading-none truncate">{title}</h1>
          {subtitle && <p className="text-[12px] text-gray-500 dark:text-[#01992e] mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="relative hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#017e26]" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-1.5 text-sm bg-white dark:bg-[#111A14] border border-gray-200 dark:border-[#33333a] rounded-lg w-48 focus:outline-none focus:border-[#01CA3C] focus:ring-2 focus:ring-[#01CA3C]/10 transition-all placeholder:text-gray-400 dark:placeholder:text-[#017e26] text-gray-900 dark:text-[#F8FBF9]"
            />
          </div>
          <button type="button" aria-label="Notificações" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2e] text-gray-500 dark:text-[#017e26] hover:text-gray-700 dark:hover:text-[#01992e] transition-colors">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#01CA3C]" />
          </button>
          <div className="w-7 h-7 rounded-full bg-[#01CA3C] flex items-center justify-center text-white text-xs font-bold cursor-pointer">
            I
          </div>
        </div>
      </div>
    </header>
  )
}
