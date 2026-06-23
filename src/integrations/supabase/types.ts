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
      acessos_orcamento: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          orcamento_id: string | null
          referrer: string | null
          tempo_leitura_segundos: number | null
          tipo_dispositivo: string | null
          token_orcamento: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          orcamento_id?: string | null
          referrer?: string | null
          tempo_leitura_segundos?: number | null
          tipo_dispositivo?: string | null
          token_orcamento?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          orcamento_id?: string | null
          referrer?: string | null
          tempo_leitura_segundos?: number | null
          tipo_dispositivo?: string | null
          token_orcamento?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acessos_orcamento_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acessos_orcamento_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "vw_orcamentos_abertos"
            referencedColumns: ["id"]
          },
        ]
      }
      acessos_site: {
        Row: {
          codigoObra: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          pagina: string | null
          referrer: string | null
          tempo_sessao_segundos: number | null
          tipo_dispositivo: string | null
          token_rastreio: string | null
          url_acessada: string | null
          user_agent: string | null
        }
        Insert: {
          codigoObra?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          pagina?: string | null
          referrer?: string | null
          tempo_sessao_segundos?: number | null
          tipo_dispositivo?: string | null
          token_rastreio?: string | null
          url_acessada?: string | null
          user_agent?: string | null
        }
        Update: {
          codigoObra?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          pagina?: string | null
          referrer?: string | null
          tempo_sessao_segundos?: number | null
          tipo_dispositivo?: string | null
          token_rastreio?: string | null
          url_acessada?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acessos_site_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "acessos_site_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_acao_hoje"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "acessos_site_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_followups_pendentes"
            referencedColumns: ["codigoObra"]
          },
        ]
      }
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
      cadencia_prospeccao: {
        Row: {
          ativa: boolean | null
          canais_sugeridos: string | null
          descricao: string | null
          deve_propor_reuniao: boolean | null
          dias_apos_anterior: number
          id: string
          numero_abordagem: number
          template_email_assunto: string | null
          template_email_corpo: string | null
          template_whatsapp: string | null
          titulo: string | null
        }
        Insert: {
          ativa?: boolean | null
          canais_sugeridos?: string | null
          descricao?: string | null
          deve_propor_reuniao?: boolean | null
          dias_apos_anterior: number
          id?: string
          numero_abordagem: number
          template_email_assunto?: string | null
          template_email_corpo?: string | null
          template_whatsapp?: string | null
          titulo?: string | null
        }
        Update: {
          ativa?: boolean | null
          canais_sugeridos?: string | null
          descricao?: string | null
          deve_propor_reuniao?: boolean | null
          dias_apos_anterior?: number
          id?: string
          numero_abordagem?: number
          template_email_assunto?: string | null
          template_email_corpo?: string | null
          template_whatsapp?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          atualizado_em: string | null
          chave: string
          descricao: string | null
          id: string
          tipo_valor: string | null
          valor: string | null
        }
        Insert: {
          atualizado_em?: string | null
          chave: string
          descricao?: string | null
          id?: string
          tipo_valor?: string | null
          valor?: string | null
        }
        Update: {
          atualizado_em?: string | null
          chave?: string
          descricao?: string | null
          id?: string
          tipo_valor?: string | null
          valor?: string | null
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
      conversas_michele: {
        Row: {
          created_at: string
          id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_eventos: {
        Row: {
          codigoObra: string | null
          created_at: string | null
          id: string
          idAtividade: string | null
          ip_address: string | null
          link_clicado: string | null
          tipo_evento: string | null
          user_agent: string | null
        }
        Insert: {
          codigoObra?: string | null
          created_at?: string | null
          id?: string
          idAtividade?: string | null
          ip_address?: string | null
          link_clicado?: string | null
          tipo_evento?: string | null
          user_agent?: string | null
        }
        Update: {
          codigoObra?: string | null
          created_at?: string | null
          id?: string
          idAtividade?: string | null
          ip_address?: string | null
          link_clicado?: string | null
          tipo_evento?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_eventos_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "email_eventos_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_acao_hoje"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "email_eventos_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_followups_pendentes"
            referencedColumns: ["codigoObra"]
          },
        ]
      }
      follow_ups: {
        Row: {
          canal_sugerido: string | null
          codigoObra: string | null
          completado_em: string | null
          created_at: string | null
          data_prevista: string
          descricao: string
          hora_prevista: string | null
          id: string
          notas: string | null
          prioridade: string | null
          responsavel: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          canal_sugerido?: string | null
          codigoObra?: string | null
          completado_em?: string | null
          created_at?: string | null
          data_prevista: string
          descricao: string
          hora_prevista?: string | null
          id?: string
          notas?: string | null
          prioridade?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          canal_sugerido?: string | null
          codigoObra?: string | null
          completado_em?: string | null
          created_at?: string | null
          data_prevista?: string
          descricao?: string
          hora_prevista?: string | null
          id?: string
          notas?: string | null
          prioridade?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "follow_ups_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_acao_hoje"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "follow_ups_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_followups_pendentes"
            referencedColumns: ["codigoObra"]
          },
        ]
      }
      log_automacao: {
        Row: {
          codigoObra: string | null
          created_at: string | null
          criado_por: string | null
          dados_json: Json | null
          descricao: string | null
          id: string
          mensagem_erro: string | null
          sucesso: boolean | null
          tipo_acao: string | null
        }
        Insert: {
          codigoObra?: string | null
          created_at?: string | null
          criado_por?: string | null
          dados_json?: Json | null
          descricao?: string | null
          id?: string
          mensagem_erro?: string | null
          sucesso?: boolean | null
          tipo_acao?: string | null
        }
        Update: {
          codigoObra?: string | null
          created_at?: string | null
          criado_por?: string | null
          dados_json?: Json | null
          descricao?: string | null
          id?: string
          mensagem_erro?: string | null
          sucesso?: boolean | null
          tipo_acao?: string | null
        }
        Relationships: []
      }
      memoria_michele: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string
          escopo: string
          id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          conteudo: string
          created_at?: string
          escopo?: string
          id?: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          escopo?: string
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      mensagens_michele: {
        Row: {
          acao_dados: Json | null
          acao_status: string | null
          content: string
          conversa_id: string
          created_at: string
          id: string
          imagem_url: string | null
          memoria_dados: Json | null
          memoria_status: string | null
          role: string
        }
        Insert: {
          acao_dados?: Json | null
          acao_status?: string | null
          content: string
          conversa_id: string
          created_at?: string
          id?: string
          imagem_url?: string | null
          memoria_dados?: Json | null
          memoria_status?: string | null
          role: string
        }
        Update: {
          acao_dados?: Json | null
          acao_status?: string | null
          content?: string
          conversa_id?: string
          created_at?: string
          id?: string
          imagem_url?: string | null
          memoria_dados?: Json | null
          memoria_status?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_michele_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas_michele"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_email: {
        Row: {
          assunto: string
          corpo_html: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          assunto?: string
          corpo_html?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          corpo_html?: string
          created_at?: string
          id?: string
          nome?: string
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
          data_proxima_acao: string | null
          dataCadastro: string
          dataOrcamentoEnviado: string
          dataUltimaVisita: string
          email: string
          estagioObra: string
          fase_michele: string | null
          foto_url: string | null
          gerenciada_michele: boolean | null
          link_unico: string | null
          linkOrcamentoImab: string
          linkOrcamentoPrado: string
          linkOrcamentoRhoden: string
          localizacao: string
          marcouReuniao: string
          nome: string
          numero_tentativa: number | null
          observacoes: string
          potencial: string | null
          produtoOferecido: string
          prospeccaoIA: string
          proximoContato: string
          responsavel: string
          statusDesde: string
          statusProspeccao: string
          telefone: string
          temperatura: string | null
          token_rastreio: string | null
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
          data_proxima_acao?: string | null
          dataCadastro?: string
          dataOrcamentoEnviado?: string
          dataUltimaVisita?: string
          email?: string
          estagioObra?: string
          fase_michele?: string | null
          foto_url?: string | null
          gerenciada_michele?: boolean | null
          link_unico?: string | null
          linkOrcamentoImab?: string
          linkOrcamentoPrado?: string
          linkOrcamentoRhoden?: string
          localizacao?: string
          marcouReuniao?: string
          nome?: string
          numero_tentativa?: number | null
          observacoes?: string
          potencial?: string | null
          produtoOferecido?: string
          prospeccaoIA?: string
          proximoContato?: string
          responsavel?: string
          statusDesde?: string
          statusProspeccao?: string
          telefone?: string
          temperatura?: string | null
          token_rastreio?: string | null
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
          data_proxima_acao?: string | null
          dataCadastro?: string
          dataOrcamentoEnviado?: string
          dataUltimaVisita?: string
          email?: string
          estagioObra?: string
          fase_michele?: string | null
          foto_url?: string | null
          gerenciada_michele?: boolean | null
          link_unico?: string | null
          linkOrcamentoImab?: string
          linkOrcamentoPrado?: string
          linkOrcamentoRhoden?: string
          localizacao?: string
          marcouReuniao?: string
          nome?: string
          numero_tentativa?: number | null
          observacoes?: string
          potencial?: string | null
          produtoOferecido?: string
          prospeccaoIA?: string
          proximoContato?: string
          responsavel?: string
          statusDesde?: string
          statusProspeccao?: string
          telefone?: string
          temperatura?: string | null
          token_rastreio?: string | null
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
      orcamento_aberturas: {
        Row: {
          aberto_em: string
          id: string
          pagina_id: string
          tipo: string
        }
        Insert: {
          aberto_em?: string
          id?: string
          pagina_id: string
          tipo: string
        }
        Update: {
          aberto_em?: string
          id?: string
          pagina_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_aberturas_pagina_id_fkey"
            columns: ["pagina_id"]
            isOneToOne: false
            referencedRelation: "orcamento_paginas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_paginas: {
        Row: {
          ativo: boolean
          blocos: Json
          codigo_obra: string
          created_at: string
          id: string
          titulo_versao: string
          token_apresentacao: string
          token_orcamento: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          blocos?: Json
          codigo_obra: string
          created_at?: string
          id?: string
          titulo_versao?: string
          token_apresentacao: string
          token_orcamento: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          blocos?: Json
          codigo_obra?: string
          created_at?: string
          id?: string
          titulo_versao?: string
          token_apresentacao?: string
          token_orcamento?: string
          updated_at?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          codigoObra: string | null
          created_at: string | null
          criado_por: string | null
          data_envio: string
          data_validade: string | null
          id: string
          link_orcamento: string | null
          notas: string | null
          numero_orcamento: string | null
          produto: string | null
          status: string | null
          token_orcamento: string | null
          updated_at: string | null
          valor_final: number | null
          valor_total: number | null
        }
        Insert: {
          codigoObra?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_envio: string
          data_validade?: string | null
          id?: string
          link_orcamento?: string | null
          notas?: string | null
          numero_orcamento?: string | null
          produto?: string | null
          status?: string | null
          token_orcamento?: string | null
          updated_at?: string | null
          valor_final?: number | null
          valor_total?: number | null
        }
        Update: {
          codigoObra?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_envio?: string
          data_validade?: string | null
          id?: string
          link_orcamento?: string | null
          notas?: string | null
          numero_orcamento?: string | null
          produto?: string | null
          status?: string | null
          token_orcamento?: string | null
          updated_at?: string | null
          valor_final?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "orcamentos_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_acao_hoje"
            referencedColumns: ["codigoObra"]
          },
          {
            foreignKeyName: "orcamentos_codigoObra_fkey"
            columns: ["codigoObra"]
            isOneToOne: false
            referencedRelation: "vw_followups_pendentes"
            referencedColumns: ["codigoObra"]
          },
        ]
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
          canal_preferido: string | null
          cargo: string
          codigoConstrutora: string
          codigoObraAtual: string
          codigoPessoa: string
          created_at: string
          dataCadastro: string
          dataUltimaAtualizacao: string
          email: string
          melhor_horario: string | null
          nome: string
          observacoes: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          canal_preferido?: string | null
          cargo?: string
          codigoConstrutora?: string
          codigoObraAtual?: string
          codigoPessoa: string
          created_at?: string
          dataCadastro?: string
          dataUltimaAtualizacao?: string
          email?: string
          melhor_horario?: string | null
          nome?: string
          observacoes?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          canal_preferido?: string | null
          cargo?: string
          codigoConstrutora?: string
          codigoObraAtual?: string
          codigoPessoa?: string
          created_at?: string
          dataCadastro?: string
          dataUltimaAtualizacao?: string
          email?: string
          melhor_horario?: string | null
          nome?: string
          observacoes?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          cidade_fabrica: string | null
          descricao: string | null
          id: string
          nome: string
          url_pagina: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          cidade_fabrica?: string | null
          descricao?: string | null
          id?: string
          nome: string
          url_pagina?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          cidade_fabrica?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          url_pagina?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_acao_hoje: {
        Row: {
          codigoObra: string | null
          data_proxima_acao: string | null
          fase_michele: string | null
          nome_obra: string | null
          numero_tentativa: number | null
          produtoOferecido: string | null
          responsavel: string | null
          temperatura: string | null
        }
        Insert: {
          codigoObra?: string | null
          data_proxima_acao?: string | null
          fase_michele?: string | null
          nome_obra?: string | null
          numero_tentativa?: number | null
          produtoOferecido?: string | null
          responsavel?: string | null
          temperatura?: string | null
        }
        Update: {
          codigoObra?: string | null
          data_proxima_acao?: string | null
          fase_michele?: string | null
          nome_obra?: string | null
          numero_tentativa?: number | null
          produtoOferecido?: string | null
          responsavel?: string | null
          temperatura?: string | null
        }
        Relationships: []
      }
      vw_followups_pendentes: {
        Row: {
          canal_sugerido: string | null
          codigoObra: string | null
          data_prevista: string | null
          descricao: string | null
          dias_atraso: number | null
          email: string | null
          id: string | null
          nome_obra: string | null
          prioridade: string | null
          responsavel: string | null
          telefone: string | null
        }
        Relationships: []
      }
      vw_funil: {
        Row: {
          fase: string | null
          quentes: number | null
          total: number | null
        }
        Relationships: []
      }
      vw_orcamentos_abertos: {
        Row: {
          data_envio: string | null
          dias_desde_envio: number | null
          id: string | null
          nome_obra: string | null
          numero_orcamento: string | null
          produto: string | null
          responsavel: string | null
          status: string | null
          total_acessos: number | null
          ultimo_acesso: string | null
          valor_final: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      buscar_construtoras_fuzzy: {
        Args: { limite?: number; termo: string }
        Returns: {
          cnpj: string
          codigo: string
          nome: string
          observacoes: string
          score: number
          status: string
        }[]
      }
      buscar_obras_fuzzy: {
        Args: { limite?: number; termo: string }
        Returns: {
          cidade: string
          codigoObra: string
          construtora: string
          fase_michele: string
          nome: string
          observacoes: string
          responsavel: string
          score: number
        }[]
      }
      buscar_pessoas_fuzzy: {
        Args: { limite?: number; termo: string }
        Returns: {
          cargo: string
          codigoConstrutora: string
          codigoObraAtual: string
          codigoPessoa: string
          email: string
          nome: string
          observacoes: string
          score: number
          whatsapp: string
        }[]
      }
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
