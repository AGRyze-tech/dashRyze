import { createClient } from '@/lib/supabase'
import type { Lead, LeadStatus } from '@/types'

type Db = ReturnType<typeof createClient>

export type LeadInput = {
  name: string
  whatsapp: string
  revenue?: string | null
  patients_per_month?: string | null
  has_site: string
  status: LeadStatus
}

export function leadRepository(db: Db) {
  return {
    async findAll(): Promise<Lead[]> {
      const { data, error } = await db
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    async create(input: LeadInput): Promise<Lead> {
      const { data, error } = await db
        .from('leads')
        .insert([input])
        .select()
        .single()
      if (error) throw error
      return data
    },

    async updateStatus(id: string, status: LeadStatus): Promise<void> {
      const { error } = await db.from('leads').update({ status }).eq('id', id)
      if (error) throw error
    },

    async remove(id: string): Promise<void> {
      const { error } = await db.from('leads').delete().eq('id', id)
      if (error) throw error
    },
  }
}
