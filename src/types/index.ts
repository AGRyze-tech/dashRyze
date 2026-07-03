export type ClientStatus = 'prospecto' | 'ativo' | 'inativo' | 'churned'
// 'churned' kept for legacy data; hidden from UI
export type ProjectStatus = 'briefing' | 'desenvolvimento' | 'revisao' | 'entregue' | 'concluido' | 'pausado'
export type ProjectType = 'site' | 'landing' | 'smartpage' | 'sistema' | 'gmb' | 'google_ads' | 'meta_ads' | 'identidade_visual' | 'outro'
export type AcquisitionSource = 'indicacao' | 'anuncio' | 'prospeccao' | 'organico'
export type LeadStatus = 'novo' | 'contatado' | 'qualificado' | 'descartado' | 'convertido'
export type TransactionType = 'entrada' | 'saida'
export type TransactionCategory = 'ferramentas' | 'infraestrutura' | 'marketing' | 'pessoal' | 'outros' | 'contrato' | 'hospedagem' | 'clientes' | 'meta_ads' | 'imposto' | 'dominio'
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
  acquisition_source?: AcquisitionSource | null
  notes?: string
  closed_at?: string
  delivery_date?: string
  total_value?: number
  paid_value?: number
  domain_included?: boolean
  created_at: string
}

export interface Hosting {
  id: string
  client_name: string
  domain: string
  plan?: string | null
  monthly_value: number
  renewal_date?: string | null
  status: 'ativo' | 'inativo' | 'vencido'
  notes?: string | null
  created_at: string
}

export type ModificationPriority = 'alta' | 'media' | 'baixa'
export type ModificationStatus = 'pendente' | 'em_andamento' | 'concluida'

export interface Modification {
  id: string
  title: string
  description?: string | null
  client_name?: string | null
  project_id?: string | null
  priority: ModificationPriority
  status: ModificationStatus
  deadline?: string | null
  assigned_to: 'isaac' | 'vinicius'
  labels?: string[] | null
  created_at: string
}

export type MeetingType = 'reuniao' | 'fechamento' | 'pos_call'
export type MeetingStatus = 'agendada' | 'concluida' | 'churned' | 'no_show'
export type ClosingMethod = 'whatsapp' | 'reuniao'

export interface Meeting {
  id: string
  title?: string | null
  client_name: string
  phone?: string | null
  date: string
  scheduled_time?: string | null
  type: MeetingType
  status: MeetingStatus
  closing_method?: ClosingMethod | null
  notes?: string | null
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

export interface PaymentProof {
  id: string
  name: string
  client_id?: string | null
  client_name: string
  description?: string | null
  amount: number
  payment_date?: string | null
  start_file_url?: string | null
  start_file_name?: string | null
  end_file_url?: string | null
  end_file_name?: string | null
  notes?: string | null
  created_at: string
}

export type GmbStatus = 'ativo' | 'pendente' | 'verificado' | 'suspenso'

export interface GmbProfile {
  id: string
  client_id?: string | null
  client_name: string
  business_name: string
  google_url?: string | null
  category?: string | null
  phone?: string | null
  address?: string | null
  rating?: number | null
  total_reviews?: number | null
  status: GmbStatus
  notes?: string | null
  created_at: string
}
