import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F8FBF9]">
      <Sidebar userRole="admin" />
      <main className="ml-60 flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
