'use client'
import { createContext, useContext, useState } from 'react'
import { Sidebar } from './Sidebar'

interface MobileNavCtx {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const MobileNavContext = createContext<MobileNavCtx>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

export function useMobileNav() {
  return useContext(MobileNavContext)
}

interface Props {
  children: React.ReactNode
  userRole?: 'admin' | 'editor'
}

export function DashboardShell({ children, userRole }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <MobileNavContext.Provider value={{
      isOpen,
      toggle: () => setIsOpen(v => !v),
      close: () => setIsOpen(false),
    }}>
      <div className="flex min-h-screen bg-[#F8FBF9] dark:bg-[#0c0c0e]">
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
        <Sidebar userRole={userRole} mobileOpen={isOpen} />
        <main className="lg:ml-60 flex-1 min-w-0">
          {children}
        </main>
      </div>
    </MobileNavContext.Provider>
  )
}
