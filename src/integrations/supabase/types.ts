export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      atividades: {
        Row: {
          comentario: string
          created_at: string
          dataAtividade: string
          idAtividade: string
          idObra: string
          proximoContato: string
          status: string
          tipoContato: string
          updated_at: string
        }
        Insert: {
          comentario?: string
          created_at?: string
          dataAtividade?: string
          idAtividade: string
          idObra?: string
          proximoContato?: string
          status?: string
          tipoContato?: string
          updated_at?: string
        }
        Update: {
          comentario?: string
          created_at?: string
          dataAtividade?: string
          idAtividade?: string
          idObra?: string
          proximoContato?: string
          status?: string
          tipoContato?: string
          updated_at?: string
        }
        Relationships: []
      }
      construtoras: {
        Row: {
          cnpj: string
          codigo: string
          created_at: string
          nome: string
          observacoes: string
          produto: string
          prospeccaoIA: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string
          codigo: string
          created_at?: string
          nome?: string
          observacoes?: string
          produto?: string
          prospeccaoIA?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          codigo?: string
          created_at?: string
          nome?: string
          observacoes?: string
          produto?: string
          prospeccaoIA?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      construtoras_atividades: {
        Row: {
          codigoConstrutora: string
          comentario: string
          created_at: string
          criarFollowUp: string
          data: string
          horario: string
          idAtividade: string
          proximoContato: string
          status: string
          tipoContato: string
          tipoRegistro: string
          updated_at: string
        }
        Insert: {
          codigoConstrutora?: string
          comentario?: string
          created_at?: string
          criarFollowUp?: string
          data?: string
          horario?: string
          idAtividade: string
          proximoContato?: string
          status?: string
          tipoContato?: string
          tipoRegistro?: string
          updated_at?: string
        }
        Update: {
          codigoConstrutora?: string
          comentario?: string
          created_at?: string
          criarFollowUp?: string
          data?: string
          horario?: string
          idAtividade?: string
          proximoContato?: string
          status?: string
          tipoContato?: string
          tipoRegistro?: string
          updated_at?: string
        }
        Relationships: []
      }
      obras: {
        Row: {
          cidade: string
          classificacao: string
          codigoConstrutora: string
          codigoObra: string
          concorrentes: string
          construtora: string
          created_at: string
          dataCadastro: string
          dataOrcamentoEnviado: string
          dataUltimaVisita: string
          email: string
          estagioObra: string
          linkOrcamentoImab: string
          linkOrcamentoPrado: string
          linkOrcamentoRhoden: string
          localizacao: string
          marcouReuniao: string
          nome: string
          observacoes: string
          produtoOferecido: string
          prospeccaoIA: string
          proximoContato: string
          responsavel: string
          statusProspeccao: string
          telefone: string
          updated_at: string
          visita: string
        }
        Insert: {
          cidade?: string
          classificacao?: string
          codigoConstrutora?: string
          codigoObra: string
          concorrentes?: string
          construtora?: string
          created_at?: string
          dataCadastro?: string
          dataOrcamentoEnviado?: string
          dataUltimaVisita?: string
          email?: string
          estagioObra?: string
          linkOrcamentoImab?: string
          linkOrcamentoPrado?: string
          linkOrcamentoRhoden?: string
          localizacao?: string
          marcouReuniao?: string
          nome?: string
          observacoes?: string
          produtoOferecido?: string
          prospeccaoIA?: string
          proximoContato?: string
          responsavel?: string
          statusProspeccao?: string
          telefone?: string
          updated_at?: string
          visita?: string
        }
        Update: {
          cidade?: string
          classificacao?: string
          codigoConstrutora?: string
          codigoObra?: string
          concorrentes?: string
          construtora?: string
          created_at?: string
          dataCadastro?: string
          dataOrcamentoEnviado?: string
          dataUltimaVisita?: string
          email?: string
          estagioObra?: string
          linkOrcamentoImab?: string
          linkOrcamentoPrado?: string
          linkOrcamentoRhoden?: string
          localizacao?: string
          marcouReuniao?: string
          nome?: string
          observacoes?: string
          produtoOferecido?: string
          prospeccaoIA?: string
          proximoContato?: string
          responsavel?: string
          statusProspeccao?: string
          telefone?: string
          updated_at?: string
          visita?: string
        }
        Relationships: []
      }
      obras_coordenadas: {
        Row: {
          created_at: string
          lat: number | null
          lng: number | null
          not_found: boolean
          obra_id: string
          query_normalizada: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          lat?: number | null
          lng?: number | null
          not_found?: boolean
          obra_id: string
          query_normalizada: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          lat?: number | null
          lng?: number | null
          not_found?: boolean
          obra_id?: string
          query_normalizada?: string
          updated_at?: string
        }
        Relationships: []
      }
      pautas_reuniao: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          obra_id: string
          updated_at: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          obra_id: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          obra_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pessoas: {
        Row: {
          cargo: string
          codigoConstrutora: string
          codigoObraAtual: string
          codigoPessoa: string
          created_at: string
          dataCadastro: string
          dataUltimaAtualizacao: string
          email: string
          nome: string
          observacoes: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          cargo?: string
          codigoConstrutora?: string
          codigoObraAtual?: string
          codigoPessoa: string
          created_at?: string
          dataCadastro?: string
          dataUltimaAtualizacao?: string
          email?: string
          nome?: string
          observacoes?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          cargo?: string
          codigoConstrutora?: string
          codigoObraAtual?: string
          codigoPessoa?: string
          created_at?: string
          dataCadastro?: string
          dataUltimaAtualizacao?: string
          email?: string
          nome?: string
          observacoes?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
