'use client'
import { Search, Bell } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const [search, setSearch] = useState('')

  return (
    <header className="sticky top-0 z-20 bg-[#F8FBF9]/90 backdrop-blur-md border-b border-gray-200/80">
      <div className="flex items-center justify-between px-6 h-14">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 leading-none">{title}</h1>
          {subtitle && <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-4 py-1.5 text-sm bg-white border border-gray-200 rounded-lg w-48 focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10 transition-all placeholder:text-gray-400"
            />
          </div>
          <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#40916C]" />
          </button>
          <div className="w-7 h-7 rounded-full bg-[#40916C] flex items-center justify-center text-white text-xs font-bold cursor-pointer">
            I
          </div>
        </div>
      </div>
    </header>
  )
}
