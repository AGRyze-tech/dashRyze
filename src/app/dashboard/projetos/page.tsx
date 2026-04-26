'use client'
import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, Clock, Plus, ExternalLink, User } from 'lucide-react'
import { projectStatusConfig, formatDate, formatCurrency, daysUntil, isDeadlineWarning, isOverdue, projectTypeLabels, deadlineLabel } from '@/lib/utils'
import { Project, ProjectStatus } from '@/types'

const columns: { status: ProjectStatus; label: string; color: string }[] = [
  { status: 'briefing', label: 'Briefing', color: '#3B82F6' },
  { status: 'desenvolvimento', label: 'Desenvolvimento', color: '#7C3AED' },
  { status: 'revisao', label: 'Revisão', color: '#F59E0B' },
  { status: 'entregue', label: 'Entregue', color: '#10B981' },
  { status: 'concluido', label: 'Concluído', color: '#6B7280' },
  { status: 'pausado', label: 'Pausado', color: '#EF4444' },
]


function ProjectCard({ project, onMoveStatus }: { project: Project; onMoveStatus: (id: string, status: ProjectStatus) => void }) {
  const days = daysUntil(project.deadline)
  const warn = isDeadlineWarning(project.deadline)
  const over = isOverdue(project.deadline)
  const active = !['concluido', 'entregue'].includes(project.status)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-[13px] leading-tight mb-1">{project.name}</p>
          <p className="text-[11px] text-gray-400 truncate">{project.client?.name ?? '—'}</p>
        </div>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
          {projectTypeLabels[project.type]}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <User size={11} className="text-gray-400" />
          <span className="text-[11px] text-gray-500 capitalize">{project.responsible}</span>
        </div>
        <span className="tabular text-[12px] font-semibold text-[#40916C]">{formatCurrency(project.value)}</span>
      </div>

      {/* Deadline */}
      {active && (
        <div className={`flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 ${over ? 'text-red-500' : warn ? 'text-amber-500' : 'text-gray-400'}`}>
          {(over || warn) ? <AlertTriangle size={11} /> : <Clock size={11} />}
          <span className="text-[11px] font-medium">{deadlineLabel(days)}</span>
          <span className="ml-auto text-[10px]">{formatDate(project.deadline)}</span>
        </div>
      )}

      {project.url && (
        <a href={`https://${project.url}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 mt-2 text-[11px] text-[#40916C] hover:underline">
          <ExternalLink size={10} />
          {project.url}
        </a>
      )}
    </div>
  )
}

export default function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<ProjectStatus | null>(null)

  function handleDragStart(id: string) {
    setDragging(id)
  }

  function handleDrop(status: ProjectStatus) {
    if (!dragging) return
    setProjects(prev => prev.map(p => p.id === dragging ? { ...p, status } : p))
    setDragging(null)
    setDragOver(null)
  }

  const totalValue = projects.filter(p => p.status !== 'concluido').reduce((sum, p) => sum + p.value, 0)

  return (
    <div>
      <Header title="Projetos" subtitle={`${projects.length} projetos · ${formatCurrency(totalValue)} em aberto`} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-4">
            {columns.map(col => {
              const count = projects.filter(p => p.status === col.status).length
              return (
                <div key={col.status} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-[12px] text-gray-500">{col.label} <strong className="text-gray-700">{count}</strong></span>
                </div>
              )
            })}
          </div>
          <Button>
            <Plus size={14} /> Novo projeto
          </Button>
        </div>

        {/* Kanban */}
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {columns.map(col => {
            const colProjects = projects.filter(p => p.status === col.status)
            const isOver = dragOver === col.status

            return (
              <div
                key={col.status}
                className={`flex-shrink-0 w-[270px] rounded-xl transition-all duration-150 ${isOver ? 'ring-2 ring-[#40916C]/40' : ''}`}
                style={{ background: isOver ? 'rgba(64,145,108,0.04)' : '#F3F4F6' }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.status) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col.status)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200/70">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="text-[12px] font-semibold text-gray-700">{col.label}</span>
                    <span className="text-[11px] text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 py-px font-medium">
                      {colProjects.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2.5 space-y-2.5 min-h-[200px]">
                  {colProjects.map(project => (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={() => handleDragStart(project.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className={`transition-all ${dragging === project.id ? 'opacity-50 scale-[0.97]' : ''}`}
                    >
                      <ProjectCard project={project} onMoveStatus={(id, status) => setProjects(p => p.map(pr => pr.id === id ? { ...pr, status } : pr))} />
                    </div>
                  ))}
                  {colProjects.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center">
                      <span className="text-[11px] text-gray-400">Soltar aqui</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
