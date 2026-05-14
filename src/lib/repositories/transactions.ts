import { createClient } from '@/lib/supabase'
import type { Transaction, TransactionType, TransactionCategory } from '@/types'

type Db = ReturnType<typeof createClient>

export type TransactionInput = {
  type: TransactionType
  category: TransactionCategory
  description: string
  amount: number
  date: string
}

export function transactionRepository(db: Db) {
  return {
    async findAll(): Promise<Transaction[]> {
      const { data, error } = await db
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    async findSince(isoDate: string): Promise<Pick<Transaction, 'type' | 'amount'>[]> {
      const { data, error } = await db
        .from('transactions')
        .select('type, amount')
        .gte('date', isoDate)
      if (error) throw error
      return (data ?? []) as Pick<Transaction, 'type' | 'amount'>[]
    },

    async create(input: TransactionInput): Promise<Transaction> {
      const { data, error } = await db
        .from('transactions')
        .insert([input])
        .select()
        .single()
      if (error) throw error
      return data
    },

    async remove(id: string): Promise<void> {
      const { error } = await db.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
  }
}
