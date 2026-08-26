export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      andamentos: {
        Row: {
          created_at: string;
          criado_por: string | null;
          data: string;
          descricao: string | null;
          id: string;
          processo_id: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          criado_por?: string | null;
          data?: string;
          descricao?: string | null;
          id?: string;
          processo_id: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          criado_por?: string | null;
          data?: string;
          descricao?: string | null;
          id?: string;
          processo_id?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "andamentos_processo_id_fkey";
            columns: ["processo_id"];
            isOneToOne: false;
            referencedRelation: "processos";
            referencedColumns: ["id"];
          },
        ];
      };
      backups_snapshots: {
        Row: {
          created_at: string;
          created_by: string | null;
          data: Json;
          id: string;
          size_bytes: number;
          tag: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          data: Json;
          id?: string;
          size_bytes?: number;
          tag?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          id?: string;
          size_bytes?: number;
          tag?: string | null;
        };
        Relationships: [];
      };
      catalogo_opcoes: {
        Row: {
          ativo: boolean;
          categoria: string;
          created_at: string;
          id: string;
          updated_at: string;
          valor: string;
        };
        Insert: {
          ativo?: boolean;
          categoria: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          valor: string;
        };
        Update: {
          ativo?: boolean;
          categoria?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          valor?: string;
        };
        Relationships: [];
      };
      indicacoes: {
        Row: {
          ativo: boolean;
          cpf_cnpj: string | null;
          created_at: string;
          email: string | null;
          endereco: string | null;
          id: string;
          nome: string;
          observacoes: string | null;
          telefone: string | null;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          cpf_cnpj?: string | null;
          created_at?: string;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          nome: string;
          observacoes?: string | null;
          telefone?: string | null;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          cpf_cnpj?: string | null;
          created_at?: string;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          nome?: string;
          observacoes?: string | null;
          telefone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      status_processo_opcoes: {
        Row: {
          ativo: boolean;
          codigo: string;
          created_at: string;
          id: string;
          nome: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          codigo: string;
          created_at?: string;
          id?: string;
          nome: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          codigo?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cliente_vinculos: {
        Row: {
          cliente_principal_id: string;
          cliente_vinculado_id: string;
          created_at: string;
          id: string;
          parentesco: string | null;
          updated_at: string;
        };
        Insert: {
          cliente_principal_id: string;
          cliente_vinculado_id: string;
          created_at?: string;
          id?: string;
          parentesco?: string | null;
          updated_at?: string;
        };
        Update: {
          cliente_principal_id?: string;
          cliente_vinculado_id?: string;
          created_at?: string;
          id?: string;
          parentesco?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cliente_vinculos_cliente_principal_id_fkey";
            columns: ["cliente_principal_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cliente_vinculos_cliente_vinculado_id_fkey";
            columns: ["cliente_vinculado_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          bairro: string | null;
          cep: string | null;
          cidade: string | null;
          como_conheceu: string | null;
          cpf_cnpj: string | null;
          created_at: string;
          criado_por: string | null;
          data_aniversario: string | null;
          email: string | null;
          endereco: string | null;
          estado: string | null;
          estado_civil: string | null;
          fornecedor: boolean;
          id: string;
          nacionalidade: string | null;
          nome: string;
          observacoes: string | null;
          profissao: string | null;
          representante_cpf: string | null;
          representante_data_nascimento: string | null;
          representante_nacionalidade: string | null;
          representante_nome: string | null;
          representante_parentesco: string | null;
          representante_profissao: string | null;
          representante_rg: string | null;
          rg: string | null;
          senha_gov_br: string | null;
          sexo: string | null;
          telefone: string | null;
          template_ids: string[];
          tipo: Database["public"]["Enums"]["tipo_cliente"];
          updated_at: string;
        };
        Insert: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          como_conheceu?: string | null;
          cpf_cnpj?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data_aniversario?: string | null;
          email?: string | null;
          endereco?: string | null;
          estado?: string | null;
          estado_civil?: string | null;
          fornecedor?: boolean;
          id?: string;
          nacionalidade?: string | null;
          nome: string;
          observacoes?: string | null;
          profissao?: string | null;
          representante_cpf?: string | null;
          representante_data_nascimento?: string | null;
          representante_nacionalidade?: string | null;
          representante_nome?: string | null;
          representante_parentesco?: string | null;
          representante_profissao?: string | null;
          representante_rg?: string | null;
          rg?: string | null;
          senha_gov_br?: string | null;
          sexo?: string | null;
          telefone?: string | null;
          template_ids?: string[];
          tipo?: Database["public"]["Enums"]["tipo_cliente"];
          updated_at?: string;
        };
        Update: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          como_conheceu?: string | null;
          cpf_cnpj?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data_aniversario?: string | null;
          email?: string | null;
          endereco?: string | null;
          estado?: string | null;
          estado_civil?: string | null;
          fornecedor?: boolean;
          id?: string;
          nacionalidade?: string | null;
          nome?: string;
          observacoes?: string | null;
          profissao?: string | null;
          representante_cpf?: string | null;
          representante_data_nascimento?: string | null;
          representante_nacionalidade?: string | null;
          representante_nome?: string | null;
          representante_parentesco?: string | null;
          representante_profissao?: string | null;
          representante_rg?: string | null;
          rg?: string | null;
          senha_gov_br?: string | null;
          sexo?: string | null;
          telefone?: string | null;
          template_ids?: string[];
          tipo?: Database["public"]["Enums"]["tipo_cliente"];
          updated_at?: string;
        };
        Relationships: [];
      };
      documento_templates: {
        Row: {
          ativo: boolean;
          conteudo: string;
          created_at: string;
          criado_por: string | null;
          id: string;
          nome: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          conteudo?: string;
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          nome: string;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          conteudo?: string;
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documentos_gerados: {
        Row: {
          cliente_id: string;
          conteudo: string;
          created_at: string;
          id: string;
          nome: string;
          template_id: string | null;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          cliente_id: string;
          conteudo: string;
          created_at?: string;
          id?: string;
          nome: string;
          template_id?: string | null;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          cliente_id?: string;
          conteudo?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          template_id?: string | null;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documentos_gerados_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documentos_gerados_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "documento_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      lancamentos: {
        Row: {
          categoria_id: string | null;
          created_at: string;
          criado_por: string | null;
          data: string;
          descricao: string;
          fornecedor_id: string | null;
          id: string;
          juros_percentual: number | null;
          nota_fiscal_path: string | null;
          observacoes: string | null;
          parcela_grupo_id: string | null;
          parcela_num: number | null;
          parcela_total: number | null;
          processo_id: string | null;
          processo_ref: string | null;
          status: Database["public"]["Enums"]["status_lancamento"];
          tipo: Database["public"]["Enums"]["tipo_lancamento"];
          tipo_honorario: string | null;
          updated_at: string;
          valor: number;
        };
        Insert: {
          categoria_id?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data: string;
          descricao: string;
          fornecedor_id?: string | null;
          id?: string;
          juros_percentual?: number | null;
          nota_fiscal_path?: string | null;
          observacoes?: string | null;
          parcela_grupo_id?: string | null;
          parcela_num?: number | null;
          parcela_total?: number | null;
          processo_id?: string | null;
          processo_ref?: string | null;
          status?: Database["public"]["Enums"]["status_lancamento"];
          tipo: Database["public"]["Enums"]["tipo_lancamento"];
          tipo_honorario?: string | null;
          updated_at?: string;
          valor: number;
        };
        Update: {
          categoria_id?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data?: string;
          descricao?: string;
          fornecedor_id?: string | null;
          id?: string;
          juros_percentual?: number | null;
          nota_fiscal_path?: string | null;
          observacoes?: string | null;
          parcela_grupo_id?: string | null;
          parcela_num?: number | null;
          parcela_total?: number | null;
          processo_id?: string | null;
          processo_ref?: string | null;
          status?: Database["public"]["Enums"]["status_lancamento"];
          tipo?: Database["public"]["Enums"]["tipo_lancamento"];
          tipo_honorario?: string | null;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lancamentos_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "plano_contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_processo_id_fkey";
            columns: ["processo_id"];
            isOneToOne: false;
            referencedRelation: "processos";
            referencedColumns: ["id"];
          },
        ];
      };
      plano_contas: {
        Row: {
          ativa: boolean;
          codigo: string;
          created_at: string;
          id: string;
          nome: string;
          ordem: number;
          parent_id: string | null;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
          updated_at: string;
        };
        Insert: {
          ativa?: boolean;
          codigo: string;
          created_at?: string;
          id?: string;
          nome: string;
          ordem?: number;
          parent_id?: string | null;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
          updated_at?: string;
        };
        Update: {
          ativa?: boolean;
          codigo?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          parent_id?: string | null;
          tipo?: Database["public"]["Enums"]["tipo_categoria"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plano_contas_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "plano_contas";
            referencedColumns: ["id"];
          },
        ];
      };
      prazos: {
        Row: {
          created_at: string;
          criado_por: string | null;
          data_conclusao: string | null;
          data_prazo: string;
          descricao: string | null;
          id: string;
          prioridade: Database["public"]["Enums"]["prioridade_prazo"];
          processo_id: string | null;
          status: Database["public"]["Enums"]["status_prazo"];
          titulo: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          criado_por?: string | null;
          data_conclusao?: string | null;
          data_prazo: string;
          descricao?: string | null;
          id?: string;
          prioridade?: Database["public"]["Enums"]["prioridade_prazo"];
          processo_id?: string | null;
          status?: Database["public"]["Enums"]["status_prazo"];
          titulo: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          criado_por?: string | null;
          data_conclusao?: string | null;
          data_prazo?: string;
          descricao?: string | null;
          id?: string;
          prioridade?: Database["public"]["Enums"]["prioridade_prazo"];
          processo_id?: string | null;
          status?: Database["public"]["Enums"]["status_prazo"];
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prazos_processo_id_fkey";
            columns: ["processo_id"];
            isOneToOne: false;
            referencedRelation: "processos";
            referencedColumns: ["id"];
          },
        ];
      };
      processos: {
        Row: {
          advogado: string | null;
          area: string | null;
          autor: string;
          cliente_id: string | null;
          cliente_qualificacao: string | null;
          comarca: string | null;
          created_at: string;
          criado_por: string | null;
          data_encerramento: string | null;
          data_inicio: string | null;
          data_prazo: string | null;
          data_protocolo: string | null;
          detalhes_prazo: string | null;
          fase: string | null;
          honorarios_percentual: number | null;
          honorarios_valor: number | null;
          id: string;
          instancia: string | null;
          indicacao_id: string | null;
          link_pasta: string | null;
          link_processo: string | null;
          materia: string | null;
          numero_cnj: string | null;
          observacoes: string | null;
          origem: string | null;
          outro_envolvido: string | null;
          outro_envolvido_cliente_id: string | null;
          outro_envolvido_qualificacao: string | null;
          pasta: string | null;
          prazo_em_aberto: boolean;
          resultado: string | null;
          reu: string;
          status: string;
          sucumbencias_percentual: number | null;
          tipo: string | null;
          tipo_acao: string | null;
          tribunal: string | null;
          updated_at: string;
          valor_acordo: number | null;
          valor_causa: number | null;
          vara: string | null;
        };
        Insert: {
          advogado?: string | null;
          area?: string | null;
          autor: string;
          cliente_id?: string | null;
          cliente_qualificacao?: string | null;
          comarca?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data_encerramento?: string | null;
          data_inicio?: string | null;
          data_prazo?: string | null;
          data_protocolo?: string | null;
          detalhes_prazo?: string | null;
          fase?: string | null;
          honorarios_percentual?: number | null;
          honorarios_valor?: number | null;
          id?: string;
          instancia?: string | null;
          indicacao_id?: string | null;
          link_pasta?: string | null;
          link_processo?: string | null;
          materia?: string | null;
          numero_cnj?: string | null;
          observacoes?: string | null;
          origem?: string | null;
          outro_envolvido?: string | null;
          outro_envolvido_cliente_id?: string | null;
          outro_envolvido_qualificacao?: string | null;
          pasta?: string | null;
          prazo_em_aberto?: boolean;
          resultado?: string | null;
          reu: string;
          status?: string;
          sucumbencias_percentual?: number | null;
          tipo?: string | null;
          tipo_acao?: string | null;
          tribunal?: string | null;
          updated_at?: string;
          valor_acordo?: number | null;
          valor_causa?: number | null;
          vara?: string | null;
        };
        Update: {
          advogado?: string | null;
          area?: string | null;
          autor?: string;
          cliente_id?: string | null;
          cliente_qualificacao?: string | null;
          comarca?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data_encerramento?: string | null;
          data_inicio?: string | null;
          data_prazo?: string | null;
          data_protocolo?: string | null;
          detalhes_prazo?: string | null;
          fase?: string | null;
          honorarios_percentual?: number | null;
          honorarios_valor?: number | null;
          id?: string;
          instancia?: string | null;
          indicacao_id?: string | null;
          link_pasta?: string | null;
          link_processo?: string | null;
          materia?: string | null;
          numero_cnj?: string | null;
          observacoes?: string | null;
          origem?: string | null;
          outro_envolvido?: string | null;
          outro_envolvido_cliente_id?: string | null;
          outro_envolvido_qualificacao?: string | null;
          pasta?: string | null;
          prazo_em_aberto?: boolean;
          resultado?: string | null;
          reu?: string;
          status?: string;
          sucumbencias_percentual?: number | null;
          tipo?: string | null;
          tipo_acao?: string | null;
          tribunal?: string | null;
          updated_at?: string;
          valor_acordo?: number | null;
          valor_causa?: number | null;
          vara?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "processos_outro_envolvido_cliente_id_fkey";
            columns: ["outro_envolvido_cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "processos_indicacao_id_fkey";
            columns: ["indicacao_id"];
            isOneToOne: false;
            referencedRelation: "indicacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          genero: string | null;
          id: string;
          nome: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          genero?: string | null;
          id: string;
          nome?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          genero?: string | null;
          id?: string;
          nome?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_mappings: {
        Row: {
          ano: number | null;
          created_at: string;
          id: string;
          label: string;
          last_synced_at: string | null;
          modulo: string;
          sheet_name: string;
          spreadsheet_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ano?: number | null;
          created_at?: string;
          id?: string;
          label: string;
          last_synced_at?: string | null;
          modulo: string;
          sheet_name: string;
          spreadsheet_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ano?: number | null;
          created_at?: string;
          id?: string;
          label?: string;
          last_synced_at?: string | null;
          modulo?: string;
          sheet_name?: string;
          spreadsheet_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_page_permissions: {
        Row: {
          created_at: string;
          id: string;
          page: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          page: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          page?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "advogado" | "secretaria";
      prioridade_prazo: "baixa" | "media" | "alta";
      status_lancamento: "pago" | "pendente";
      status_prazo: "aberto" | "cumprido" | "cancelado";
      status_processo:
        | "inicial"
        | "em_andamento"
        | "execucao"
        | "recurso"
        | "concluso_sentenca"
        | "suspenso"
        | "arquivado"
        | "julgado_procedente"
        | "julgado_improcedente"
        | "acordo";
      tipo_categoria: "receita" | "despesa" | "deducao";
      tipo_cliente: "pf" | "pj";
      tipo_lancamento: "entrada" | "saida";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "advogado", "secretaria"],
      prioridade_prazo: ["baixa", "media", "alta"],
      status_lancamento: ["pago", "pendente"],
      status_prazo: ["aberto", "cumprido", "cancelado"],
      status_processo: [
        "inicial",
        "em_andamento",
        "execucao",
        "recurso",
        "concluso_sentenca",
        "suspenso",
        "arquivado",
        "julgado_procedente",
        "julgado_improcedente",
        "acordo",
      ],
      tipo_categoria: ["receita", "despesa", "deducao"],
      tipo_cliente: ["pf", "pj"],
      tipo_lancamento: ["entrada", "saida"],
    },
  },
} as const;
