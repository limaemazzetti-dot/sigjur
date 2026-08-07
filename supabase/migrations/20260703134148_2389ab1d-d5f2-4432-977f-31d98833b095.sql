
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'advogado', 'secretaria');

-- Enum de tipos de lançamento
CREATE TYPE public.tipo_lancamento AS ENUM ('entrada', 'saida');
CREATE TYPE public.status_lancamento AS ENUM ('pago', 'pendente');
CREATE TYPE public.tipo_categoria AS ENUM ('receita', 'despesa', 'deducao');

-- Trigger genérico updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger para criar profile + role inicial ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), NEW.email);
  -- Primeiro usuário vira admin; demais viram advogado por padrão
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'advogado');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- plano_contas (hierárquico)
CREATE TABLE public.plano_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo public.tipo_categoria NOT NULL,
  parent_id UUID REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_contas TO authenticated;
GRANT ALL ON public.plano_contas TO service_role;
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plano_contas_all_authenticated" ON public.plano_contas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_plano_contas_updated BEFORE UPDATE ON public.plano_contas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lancamentos
CREATE TABLE public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  tipo public.tipo_lancamento NOT NULL,
  categoria_id UUID REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  status public.status_lancamento NOT NULL DEFAULT 'pago',
  tipo_honorario TEXT,
  processo_ref TEXT,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lancamentos_data ON public.lancamentos(data);
CREATE INDEX idx_lancamentos_categoria ON public.lancamentos(categoria_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos TO authenticated;
GRANT ALL ON public.lancamentos TO service_role;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lancamentos_all_authenticated" ON public.lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_lancamentos_updated BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed plano de contas
INSERT INTO public.plano_contas (codigo, nome, tipo, ordem) VALUES
  ('3.1', 'Receita Bruta', 'receita', 10),
  ('3.1.01', 'Honorários Contratuais', 'receita', 11),
  ('3.1.02', 'Honorários Sucumbenciais', 'receita', 12),
  ('3.1.03', 'Honorários de Êxito', 'receita', 13),
  ('3.1.04', 'Consultoria Jurídica', 'receita', 14),
  ('3.2', 'Deduções da Receita', 'deducao', 20),
  ('3.2.01', 'Impostos sobre Serviços (ISS)', 'deducao', 21),
  ('3.2.02', 'Devoluções e Estornos', 'deducao', 22),
  ('4.1', 'Despesas com Pessoal', 'despesa', 30),
  ('4.1.01', 'Salários e Ordenados', 'despesa', 31),
  ('4.1.02', 'Encargos Sociais', 'despesa', 32),
  ('4.2', 'Despesas Operacionais', 'despesa', 40),
  ('4.2.01', 'Material de Escritório', 'despesa', 41),
  ('4.2.02', 'Aluguel', 'despesa', 42),
  ('4.2.03', 'Energia Elétrica', 'despesa', 43),
  ('4.2.04', 'Internet e Telefonia', 'despesa', 44),
  ('4.2.05', 'Custas Processuais', 'despesa', 45),
  ('4.2.06', 'Deslocamentos', 'despesa', 46),
  ('4.3', 'Despesas Administrativas', 'despesa', 50),
  ('4.3.01', 'Honorários Contábeis', 'despesa', 51),
  ('4.3.02', 'OAB e Anuidades', 'despesa', 52),
  ('4.3.03', 'Softwares e Assinaturas', 'despesa', 53);
