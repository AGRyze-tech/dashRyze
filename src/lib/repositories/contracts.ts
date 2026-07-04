import { createClient } from '@/lib/supabase'
import type { Contract, ContractInstallment, InstallmentStatus, PaymentMethod } from '@/types'

type Db = ReturnType<typeof createClient>

export type ContractInput = {
  client_id: string
  project_id?: string | null
  total_value: number
  payment_method: PaymentMethod
  installments_count: number
}

export type InstallmentInput = {
  number: number
  value: number
  due_date: string
  status: InstallmentStatus
}

export type ContractAttachmentInput = {
  pdf_url?: string | null
  pdf_name?: string | null
  initial_payment_proof_url?: string | null
  initial_payment_proof_name?: string | null
  final_payment_proof_url?: string | null
  final_payment_proof_name?: string | null
}

export function contractRepository(db: Db) {
  return {
    async findAll(): Promise<Contract[]> {
      const { data, error } = await db
        .from('contracts')
        .select('*, client:clients(*), project:projects(*), installments:contract_installments(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Contract[]
    },

    async findById(id: string): Promise<Contract> {
      const { data, error } = await db
        .from('contracts')
        .select('*, client:clients(*), project:projects(*), installments:contract_installments(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Contract
    },

    async updateAttachments(id: string, input: ContractAttachmentInput): Promise<Contract> {
      const { data, error } = await db
        .from('contracts')
        .update(input)
        .eq('id', id)
        .select('*, client:clients(*), project:projects(*), installments:contract_installments(*)')
        .single()
      if (error) throw error
      return data as Contract
    },

    async uploadFile(file: File, prefix: string): Promise<{ url: string; name: string }> {
      const path = `contratos/${prefix}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { error } = await db.storage.from('clientes').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = db.storage.from('clientes').getPublicUrl(path)
      return { url: data.publicUrl, name: file.name }
    },

    async generateNumber(): Promise<string> {
      const year = new Date().getFullYear()
      const { data } = await db
        .from('contracts')
        .select('number')
        .like('number', `RYZE-${year}-%`)
        .order('number', { ascending: false })
        .limit(1)
      const lastNum = data?.[0]?.number
      const next = lastNum ? (parseInt(lastNum.split('-')[2]) || 0) + 1 : 1
      return `RYZE-${year}-${String(next).padStart(3, '0')}`
    },

    async create(
      input: ContractInput,
      installments: InstallmentInput[],
    ): Promise<Contract & { installments: ContractInstallment[] }> {
      const number = await this.generateNumber()

      const { data: contract, error } = await db
        .from('contracts')
        .insert([{ number, ...input }])
        .select('*, client:clients(*), project:projects(*)')
        .single()
      if (error) throw error

      const installmentsPayload = installments.map((inst, i) => ({
        contract_id: contract.id,
        ...inst,
      }))
      const { data: createdInstallments, error: instError } = await db
        .from('contract_installments')
        .insert(installmentsPayload)
        .select()
      if (instError) throw instError

      return { ...contract, installments: createdInstallments ?? [] }
    },

    async remove(id: string): Promise<void> {
      const { error } = await db.from('contracts').delete().eq('id', id)
      if (error) throw error
    },
  }
}
