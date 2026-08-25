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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      automation_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["automation_action_type"]
          created_at: string | null
          error_message: string | null
          executed_at: string | null
          execution_mode: Database["public"]["Enums"]["automation_mode"]
          id: string
          message_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          rule_id: string | null
          status: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["automation_action_type"]
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          execution_mode: Database["public"]["Enums"]["automation_mode"]
          id?: string
          message_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          rule_id?: string | null
          status: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["automation_action_type"]
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          execution_mode?: Database["public"]["Enums"]["automation_mode"]
          id?: string
          message_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_actions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json | null
          action_type: Database["public"]["Enums"]["automation_action_type"]
          ativo: boolean | null
          conditions: Json | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          priority: number | null
          requires_approval: boolean | null
          updated_at: string | null
        }
        Insert: {
          action_config?: Json | null
          action_type: Database["public"]["Enums"]["automation_action_type"]
          ativo?: boolean | null
          conditions?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          priority?: number | null
          requires_approval?: boolean | null
          updated_at?: string | null
        }
        Update: {
          action_config?: Json | null
          action_type?: Database["public"]["Enums"]["automation_action_type"]
          ativo?: boolean | null
          conditions?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          priority?: number | null
          requires_approval?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      extracted_links: {
        Row: {
          created_at: string | null
          extracted_text: string | null
          extraction_status: string | null
          failure_reason: string | null
          id: string
          message_id: string | null
          normalized_url: string | null
          original_url: string | null
          page_description: string | null
          page_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          extracted_text?: string | null
          extraction_status?: string | null
          failure_reason?: string | null
          id?: string
          message_id?: string | null
          normalized_url?: string | null
          original_url?: string | null
          page_description?: string | null
          page_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          extracted_text?: string | null
          extraction_status?: string | null
          failure_reason?: string | null
          id?: string
          message_id?: string | null
          normalized_url?: string | null
          original_url?: string | null
          page_description?: string | null
          page_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_links_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      interpreted_contents: {
        Row: {
          category: string | null
          confidence_score: number | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          event_date: string | null
          extracted_data: Json | null
          full_description: string | null
          id: string
          keywords: string[] | null
          location: string | null
          message_id: string | null
          missing_fields: string[] | null
          model_used: string | null
          price: string | null
          prompt_version: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
          warnings: string[] | null
        }
        Insert: {
          category?: string | null
          confidence_score?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          event_date?: string | null
          extracted_data?: Json | null
          full_description?: string | null
          id?: string
          keywords?: string[] | null
          location?: string | null
          message_id?: string | null
          missing_fields?: string[] | null
          model_used?: string | null
          price?: string | null
          prompt_version?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          warnings?: string[] | null
        }
        Update: {
          category?: string | null
          confidence_score?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          event_date?: string | null
          extracted_data?: Json | null
          full_description?: string | null
          id?: string
          keywords?: string[] | null
          location?: string | null
          message_id?: string | null
          missing_fields?: string[] | null
          model_used?: string | null
          price?: string | null
          prompt_version?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "interpreted_contents_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_media: {
        Row: {
          checksum: string | null
          created_at: string | null
          file_size: number | null
          id: string
          media_type: string | null
          message_id: string | null
          mime_type: string | null
          original_filename: string | null
          source_url: string | null
          storage_path: string | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string | null
          file_size?: number | null
          id?: string
          media_type?: string | null
          message_id?: string | null
          mime_type?: string | null
          original_filename?: string | null
          source_url?: string | null
          storage_path?: string | null
        }
        Update: {
          checksum?: string | null
          created_at?: string | null
          file_size?: number | null
          id?: string
          media_type?: string | null
          message_id?: string | null
          mime_type?: string | null
          original_filename?: string | null
          source_url?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      publication_destinations: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          endpoint_url: string | null
          field_mapping: Json | null
          id: string
          nome: string
          provider: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          endpoint_url?: string | null
          field_mapping?: Json | null
          id?: string
          nome: string
          provider?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          endpoint_url?: string | null
          field_mapping?: Json | null
          id?: string
          nome?: string
          provider?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      publication_records: {
        Row: {
          created_at: string | null
          destination_id: string | null
          error_message: string | null
          external_record_id: string | null
          id: string
          interpreted_content_id: string | null
          published_at: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          destination_id?: string | null
          error_message?: string | null
          external_record_id?: string | null
          id?: string
          interpreted_content_id?: string | null
          published_at?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          destination_id?: string | null
          error_message?: string | null
          external_record_id?: string | null
          id?: string
          interpreted_content_id?: string | null
          published_at?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_records_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "publication_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_records_interpreted_content_id_fkey"
            columns: ["interpreted_content_id"]
            isOneToOne: false
            referencedRelation: "interpreted_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error_message: string | null
          event_type: string | null
          external_event_id: string | null
          headers_sanitized: Json | null
          http_status: number | null
          id: string
          payload: Json | null
          processed_at: string | null
          processing_duration_ms: number | null
          processing_status: string | null
          provider: string | null
          received_at: string | null
        }
        Insert: {
          error_message?: string | null
          event_type?: string | null
          external_event_id?: string | null
          headers_sanitized?: Json | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_duration_ms?: number | null
          processing_status?: string | null
          provider?: string | null
          received_at?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string | null
          external_event_id?: string | null
          headers_sanitized?: Json | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_duration_ms?: number | null
          processing_status?: string | null
          provider?: string | null
          received_at?: string | null
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          ativo: boolean | null
          automation_mode: Database["public"]["Enums"]["automation_mode"] | null
          autorizado: boolean | null
          created_at: string | null
          descricao: string | null
          external_group_id: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          automation_mode?:
            | Database["public"]["Enums"]["automation_mode"]
            | null
          autorizado?: boolean | null
          created_at?: string | null
          descricao?: string | null
          external_group_id: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          automation_mode?:
            | Database["public"]["Enums"]["automation_mode"]
            | null
          autorizado?: boolean | null
          created_at?: string | null
          descricao?: string | null
          external_group_id?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          caption: string | null
          created_at: string | null
          error_message: string | null
          external_message_id: string
          group_id: string | null
          id: string
          message_type: string | null
          occurred_at: string | null
          processing_status:
            | Database["public"]["Enums"]["processing_status"]
            | null
          quoted_message_id: string | null
          raw_payload: Json | null
          received_at: string | null
          retry_count: number | null
          sender_external_id: string
          sender_name: string | null
          text_content: string | null
          updated_at: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          error_message?: string | null
          external_message_id: string
          group_id?: string | null
          id?: string
          message_type?: string | null
          occurred_at?: string | null
          processing_status?:
            | Database["public"]["Enums"]["processing_status"]
            | null
          quoted_message_id?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          retry_count?: number | null
          sender_external_id: string
          sender_name?: string | null
          text_content?: string | null
          updated_at?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          error_message?: string | null
          external_message_id?: string
          group_id?: string | null
          id?: string
          message_type?: string | null
          occurred_at?: string | null
          processing_status?:
            | Database["public"]["Enums"]["processing_status"]
            | null
          quoted_message_id?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          retry_count?: number | null
          sender_external_id?: string
          sender_name?: string | null
          text_content?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "revisor"
      automation_action_type:
        | "apenas_registrar"
        | "sinalizar"
        | "ignorar"
        | "enviar_para_revisao"
        | "aprovar"
        | "publicar"
        | "responder"
        | "solicitar_exclusao"
      automation_mode: "monitorar" | "simular" | "executar"
      processing_status:
        | "recebido"
        | "pendente"
        | "processando"
        | "interpretado"
        | "necessita_revisao"
        | "aprovado"
        | "publicado"
        | "ignorado"
        | "erro"
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
    Enums: {
      app_role: ["admin", "revisor"],
      automation_action_type: [
        "apenas_registrar",
        "sinalizar",
        "ignorar",
        "enviar_para_revisao",
        "aprovar",
        "publicar",
        "responder",
        "solicitar_exclusao",
      ],
      automation_mode: ["monitorar", "simular", "executar"],
      processing_status: [
        "recebido",
        "pendente",
        "processando",
        "interpretado",
        "necessita_revisao",
        "aprovado",
        "publicado",
        "ignorado",
        "erro",
      ],
    },
  },
} as const
