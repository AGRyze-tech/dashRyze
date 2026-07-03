import { Header } from '@/components/layout/Header'

interface TableSetupNoticeProps {
  title: string
  subtitle: string
  icon: React.ElementType
  iconBgClass?: string
  iconColorClass?: string
  sql: string
}

export function TableSetupNotice({
  title, subtitle, icon: Icon,
  iconBgClass = 'bg-blue-50 dark:bg-blue-900/20',
  iconColorClass = 'text-blue-500 dark:text-blue-400',
  sql,
}: TableSetupNoticeProps) {
  return (
    <div>
      <Header title={title} subtitle={subtitle} />
      <div className="p-4 sm:p-6">
        <div className="card-light p-8 flex flex-col items-center text-center gap-4 max-w-xl mx-auto">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBgClass}`}>
            <Icon size={20} className={iconColorClass} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-[#D1FAE5] mb-1">Tabela não encontrada</p>
            <p className="text-[13px] text-gray-500 dark:text-[#00a02a]">Execute o SQL abaixo no Supabase para ativar esta seção.</p>
          </div>
          <pre className="w-full text-left text-[11px] bg-gray-900 text-emerald-400 rounded-xl p-4 overflow-x-auto leading-relaxed">{sql}</pre>
        </div>
      </div>
    </div>
  )
}
