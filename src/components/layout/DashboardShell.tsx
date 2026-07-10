'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Sidebar } from './Sidebar'
import { DateFilterProvider } from '@/contexts/DateFilterContext'
import { createClient } from '@/lib/supabase'

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

export type UserRole = 'admin' | 'gerente' | 'visualizador'

interface CurrentUser {
  name: string
  role: UserRole
  initial: string
  loading: boolean
}

const CurrentUserContext = createContext<CurrentUser>({
  name: '', role: 'visualizador', initial: '', loading: true,
})

// Usuário realmente logado (nome + cargo do profiles), pra Sidebar/Header
// mostrarem quem está de fato na sessão — não mais valores fixos.
export function useCurrentUser() {
  return useContext(CurrentUserContext)
}

interface Props {
  children: React.ReactNode
}

export function DashboardShell({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<CurrentUser>({ name: '', role: 'visualizador', initial: '', loading: true })

  useEffect(() => {
    let cancelled = false
    const db = createClient()
    ;(async () => {
      try {
        const { data: auth } = await db.auth.getUser()
        const u = auth.user
        if (!u) { if (!cancelled) setUser(s => ({ ...s, loading: false })); return }
        const { data: p } = await db.from('profiles').select('name, role').eq('id', u.id).single()
        const name = (p?.name && p.name.trim()) || u.email?.split('@')[0] || 'Usuário'
        const role = (p?.role as UserRole) || 'visualizador'
        if (!cancelled) setUser({ name, role, initial: name.charAt(0).toUpperCase(), loading: false })
      } catch {
        if (!cancelled) setUser(s => ({ ...s, loading: false }))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const mobileNav = useMemo(() => ({
    isOpen,
    toggle: () => setIsOpen(v => !v),
    close: () => setIsOpen(false),
  }), [isOpen])

  return (
    <DateFilterProvider>
      <CurrentUserContext.Provider value={user}>
        <MobileNavContext.Provider value={mobileNav}>
          <div className="flex min-h-screen bg-[#F8FBF9] dark:bg-[#0c0c0e]">
            {isOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                onClick={() => setIsOpen(false)}
              />
            )}
            <Sidebar mobileOpen={isOpen} />
            <main className="lg:ml-60 flex-1 min-w-0">
              {children}
            </main>
          </div>
        </MobileNavContext.Provider>
      </CurrentUserContext.Provider>
    </DateFilterProvider>
  )
}
