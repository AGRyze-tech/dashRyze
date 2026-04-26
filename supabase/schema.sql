-- ================================
-- RYZESYSTEMS DASHBOARD — SCHEMA
-- ================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- ENUM TYPES
-- ========================

CREATE TYPE client_status AS ENUM ('prospecto', 'ativo', 'inativo', 'churned');
CREATE TYPE project_status AS ENUM ('briefing', 'desenvolvimento', 'revisao', 'entregue', 'concluido', 'pausado');
CREATE TYPE project_type AS ENUM ('site', 'landing', 'smartpage', 'sistema', 'outro');
CREATE TYPE lead_status AS ENUM ('novo', 'contatado', 'qualificado', 'descartado', 'convertido');
CREATE TYPE transaction_type AS ENUM ('entrada', 'saida');
CREATE TYPE transaction_category AS ENUM ('ferramentas', 'infraestrutura', 'marketing', 'pessoal', 'outros', 'contrato');
CREATE TYPE payment_method AS ENUM ('avista', 'parcelado');
CREATE TYPE installment_status AS ENUM ('pendente', 'pago', 'atrasado');

-- ========================
-- CLIENTS
-- ========================

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  specialty text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  instagram text,
  website text,
  status client_status NOT NULL DEFAULT 'prospecto',
  notes text,
  closed_at date,
  delivery_date date,
  created_at timestamptz DEFAULT now()
);

-- ========================
-- PROJECTS
-- ========================

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  type project_type NOT NULL DEFAULT 'site',
  status project_status NOT NULL DEFAULT 'briefing',
  responsible text NOT NULL CHECK (responsible IN ('isaac', 'vinicius')),
  value numeric(10,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  deadline date NOT NULL,
  url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ========================
-- CONTRACTS
-- ========================

CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  total_value numeric(10,2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'avista',
  installments_count integer NOT NULL DEFAULT 1,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- ========================
-- CONTRACT INSTALLMENTS
-- ========================

CREATE TABLE contract_installments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  number integer NOT NULL,
  value numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status installment_status NOT NULL DEFAULT 'pendente',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ========================
-- TRANSACTIONS
-- ========================

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type transaction_type NOT NULL,
  category transaction_category NOT NULL DEFAULT 'outros',
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  date date NOT NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ========================
-- LEADS
-- ========================

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  revenue text,
  patients_per_month text,
  has_site text,
  status lead_status NOT NULL DEFAULT 'novo',
  created_at timestamptz DEFAULT now()
);

-- ========================
-- PROFILES (RBAC)
-- ========================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  role text NOT NULL DEFAULT 'visualizador' CHECK (role IN ('admin', 'gerente', 'visualizador')),
  created_at timestamptz DEFAULT now()
);

-- ========================
-- ROW LEVEL SECURITY
-- ========================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Helper: returns the role of the current logged-in user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT role FROM profiles WHERE id = auth.uid()), 'visualizador')
$$;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id OR get_user_role() = 'admin');
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (get_user_role() = 'admin');

-- Clients: admin + gerente write, all read
CREATE POLICY "clients_select" ON clients FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (get_user_role() = 'admin');

-- Projects: admin + gerente write, all read
CREATE POLICY "projects_select" ON projects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (get_user_role() = 'admin');

-- Contracts: admin + gerente write, all read
CREATE POLICY "contracts_select" ON contracts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "contracts_insert" ON contracts FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "contracts_update" ON contracts FOR UPDATE USING (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "contracts_delete" ON contracts FOR DELETE USING (get_user_role() = 'admin');

-- Installments: admin + gerente write, all read
CREATE POLICY "installments_select" ON contract_installments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "installments_insert" ON contract_installments FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "installments_update" ON contract_installments FOR UPDATE USING (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "installments_delete" ON contract_installments FOR DELETE USING (get_user_role() = 'admin');

-- Transactions: admin only (financeiro)
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (get_user_role() = 'admin');

-- Leads: admin + gerente write, all read
CREATE POLICY "leads_select" ON leads FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (get_user_role() IN ('admin', 'gerente'));
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (get_user_role() = 'admin');

-- ========================
-- INDEXES
-- ========================

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contract_installments_contract_id ON contract_installments(contract_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- ========================
-- FUNCTION: auto-generate transaction on installment paid
-- ========================

CREATE OR REPLACE FUNCTION create_transaction_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    INSERT INTO transactions (type, category, description, amount, date, contract_id)
    SELECT
      'entrada',
      'contrato',
      'Parcela ' || NEW.number || '/' || c.installments_count || ' — ' || cl.name,
      NEW.value,
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      c.id
    FROM contracts c
    JOIN clients cl ON cl.id = c.client_id
    WHERE c.id = NEW.contract_id;

    NEW.paid_at = COALESCE(NEW.paid_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_installment_paid
  BEFORE UPDATE ON contract_installments
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_on_payment();

-- ========================
-- FUNCTION: auto-create profile on signup
-- ========================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'visualizador')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
