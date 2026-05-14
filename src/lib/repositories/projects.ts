import { createClient } from '@/lib/supabase'
import type { Project, ProjectStatus, ProjectType } from '@/types'

type Db = ReturnType<typeof createClient>

export type ProjectInput = {
  client_id: string
  name: string
  type: ProjectType
  status: ProjectStatus
  responsible: 'isaac' | 'vinicius'
  value: number
  start_date: string
  deadline: string
  url?: string | null
  notes?: string | null
}

export type DashboardProject = {
  id: string
  name: string
  status: ProjectStatus
  deadline: string
  client_id: string
  client?: { name: string }
}

export function projectRepository(db: Db) {
  return {
    async findAll(): Promise<Project[]> {
      const { data, error } = await db
        .from('projects')
        .select('*, client:clients(id, name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Project[]
    },

    async findDashboard(): Promise<DashboardProject[]> {
      const { data, error } = await db
        .from('projects')
        .select('id, name, status, deadline, client_id, client:clients(name)')
        .order('deadline')
      if (error) throw error
      return (data ?? []) as unknown as DashboardProject[]
    },

    async findByClientId(clientId: string): Promise<Pick<Project, 'id' | 'name'>[]> {
      const { data, error } = await db
        .from('projects')
        .select('id, name')
        .eq('client_id', clientId)
        .order('name')
      if (error) throw error
      return (data ?? []) as Pick<Project, 'id' | 'name'>[]
    },

    async create(input: ProjectInput): Promise<void> {
      const { error } = await db.from('projects').insert(input)
      if (error) throw error
    },

    async update(id: string, input: Partial<ProjectInput>): Promise<void> {
      const { error } = await db.from('projects').update(input).eq('id', id)
      if (error) throw error
    },

    async updateStatus(id: string, status: ProjectStatus): Promise<void> {
      const { error } = await db.from('projects').update({ status }).eq('id', id)
      if (error) throw error
    },

    async remove(id: string): Promise<void> {
      const { error } = await db.from('projects').delete().eq('id', id)
      if (error) throw error
    },
  }
}
