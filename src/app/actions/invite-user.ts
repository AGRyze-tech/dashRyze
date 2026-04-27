'use server'
import { createClient } from '@supabase/supabase-js'

export async function inviteUser(email: string, name: string, role: string) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Adicione SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente para habilitar convites.')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name, role },
  })

  if (error) throw new Error(error.message)
}
