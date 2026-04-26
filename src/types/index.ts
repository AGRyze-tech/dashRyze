export type ClientStatus = 'prospecto' | 'ativo' | 'inativo' | 'churned'
export type ProjectStatus = 'briefing' | 'desenvolvimento' | 'revisao' | 'entregue' | 'concluido' | 'pausado'
export type ProjectType = 'site' | 'landing' | 'smartpage' | 'sistema' | 'outro'
export type LeadStatus = 'novo' | 'contatado' | 'qualificado' | 'descartado' | 'convertido'
export type TransactionType = 'entrada' | 'saida'
export type TransactionCategory = 'ferramentas' | 'infraestrutura' | 'marketing' | 'pessoal' | 'outros' | 'contrato'
export type PaymentMethod = 'avista' | 'parcelado'
export type InstallmentStatus = 'pendente' | 'pago' | 'atrasado'

export interface Client {
  id: string
  name: string
  specialty: string
  email: string
  whatsapp: string
  instagram?: string
  website?: string
  status: ClientStatus
  notes?: string
  created_at: string
}

export interface Project {
  id: string
  client_id: string
  client?: Client
  name: string
  type: ProjectType
  status: ProjectStatus
  responsible: 'isaac' | 'vinicius'
  value: number
  start_date: string
  deadline: string
  url?: string
  notes?: string
  created_at: string
}

export interface ContractInstallment {
  id: string
  contract_id: string
  number: number
  value: number
  due_date: string
  status: InstallmentStatus
  paid_at?: string
}

export interface Contract {
  id: string
  number: string
  client_id: string
  client?: Client
  project_id?: string
  project?: Project
  total_value: number
  payment_method: PaymentMethod
  installments_count: number
  pdf_url?: string
  created_at: string
  installments?: ContractInstallment[]
}

export interface Transaction {
  id: string
  type: TransactionType
  category: TransactionCategory
  description: string
  amount: number
  date: string
  contract_id?: string
  created_at: string
}

export interface Lead {
  id: string
  name: string
  whatsapp: string
  revenue: string
  patients_per_month: string
  has_site: string
  status: LeadStatus
  created_at: string
}

export interface MetaCampaign {
  id: string
  name: string
  status: string
  daily_budget: number
  spend: number
  impressions: number
  clicks: number
  cpm: number
  reach: number
}

export interface DashboardStats {
  total_clients: number
  active_clients: number
  active_projects: number
  monthly_revenue: number
  pending_leads: number
  overdue_contracts: number
}
