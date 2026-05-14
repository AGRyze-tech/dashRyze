import { createClient } from '@/lib/supabase'
import type { Client, ClientStatus } from '@/types'

type Db = ReturnType<typeof createClient>

export type ClientInput = {
  name: string
  specialty: string
  email: string
  whatsapp: string
  instagram?: string
  website?: string
  status: ClientStatus
  notes?: string
  closed_at?: string | null
  delivery_date?: string | null
  contract_url?: string | null
}

export function clientRepository(db: Db) {
  return {
    async findAll(): Promise<Client[]> {
      const { data, error } = await db
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    async findSummary(): Promise<{ id: string; name: string; status: ClientStatus }[]> {
      const { data, error } = await db
        .from('clients')
        .select('id, name, status')
        .order('name')
      if (error) throw error
      return (data ?? []) as { id: string; name: string; status: ClientStatus }[]
    },

    async findForSelect(): Promise<Pick<Client, 'id' | 'name' | 'specialty'>[]> {
      const { data, error } = await db
        .from('clients')
        .select('id, name, specialty')
        .order('name')
      if (error) throw error
      return (data ?? []) as Pick<Client, 'id' | 'name' | 'specialty'>[]
    },

    async create(input: ClientInput): Promise<Client> {
      const { data, error } = await db
        .from('clients')
        .insert([input])
        .select()
        .single()
      if (error) throw error
      return data
    },

    async update(id: string, input: Partial<ClientInput>): Promise<Client> {
      const { data, error } = await db
        .from('clients')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async remove(id: string): Promise<void> {
      const { error } = await db.from('clients').delete().eq('id', id)
      if (error) throw error
    },

    async uploadContract(file: File): Promise<string | null> {
      const path = `contratos/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { error } = await db.storage.from('clientes').upload(path, file, { upsert: true })
      if (error) return null
      const { data } = db.storage.from('clientes').getPublicUrl(path)
      return data.publicUrl
    },
  }
}
