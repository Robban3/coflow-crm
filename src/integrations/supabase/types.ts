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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          scheduled_at: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          scheduled_at?: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          scheduled_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          actor_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          organization_id: string
          type: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          organization_id: string
          type: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_endpoints: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          name: string
          organization_id: string | null
          payload_type: string
          priority: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          name: string
          organization_id?: string | null
          payload_type?: string
          priority?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          name?: string
          organization_id?: string | null
          payload_type?: string
          priority?: number
        }
        Relationships: []
      }
      analysis_trigger_logs: {
        Row: {
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          kind: string
          lead_id: string | null
          ok: boolean
          organization_id: string | null
          payload_type: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          kind: string
          lead_id?: string | null
          ok?: boolean
          organization_id?: string | null
          payload_type: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          kind?: string
          lead_id?: string | null
          ok?: boolean
          organization_id?: string | null
          payload_type?: string
          status_code?: number | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          callback_task_id: string | null
          created_at: string
          created_by: string
          duration_seconds: number | null
          followup_task_id: string | null
          id: string
          lead_id: string | null
          note: string | null
          organization_id: string
          outcome_key: string
          outcome_label: string
        }
        Insert: {
          callback_task_id?: string | null
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          followup_task_id?: string | null
          id?: string
          lead_id?: string | null
          note?: string | null
          organization_id: string
          outcome_key: string
          outcome_label: string
        }
        Update: {
          callback_task_id?: string | null
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          followup_task_id?: string | null
          id?: string
          lead_id?: string | null
          note?: string | null
          organization_id?: string
          outcome_key?: string
          outcome_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_callback_task_id_fkey"
            columns: ["callback_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_followup_task_id_fkey"
            columns: ["followup_task_id"]
            isOneToOne: false
            referencedRelation: "call_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_outcomes: {
        Row: {
          category: string
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          lead_status_effect: string | null
          organization_id: string
          requires_note: boolean
          requires_task: boolean
          sort_order: number
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          lead_status_effect?: string | null
          organization_id: string
          requires_note?: boolean
          requires_task?: boolean
          sort_order?: number
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          lead_status_effect?: string | null
          organization_id?: string
          requires_note?: boolean
          requires_task?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_tasks: {
        Row: {
          assigned_to_user_id: string
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          lead_id: string | null
          note: string | null
          organization_id: string
          status: string
          type: string
        }
        Insert: {
          assigned_to_user_id: string
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          lead_id?: string | null
          note?: string | null
          organization_id: string
          status?: string
          type?: string
        }
        Update: {
          assigned_to_user_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          lead_id?: string | null
          note?: string | null
          organization_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_registry: {
        Row: {
          address: string | null
          city: string | null
          co_address: string | null
          company_form: string | null
          company_name: string
          country: string | null
          created_at: string
          id: string
          legal_form: string | null
          org_number: string
          phone: string | null
          postal_code: string | null
          registration_date: string | null
          sni_codes: string | null
          sni_descriptions: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          co_address?: string | null
          company_form?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          id?: string
          legal_form?: string | null
          org_number: string
          phone?: string | null
          postal_code?: string | null
          registration_date?: string | null
          sni_codes?: string | null
          sni_descriptions?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          co_address?: string | null
          company_form?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          id?: string
          legal_form?: string | null
          org_number?: string
          phone?: string | null
          postal_code?: string | null
          registration_date?: string | null
          sni_codes?: string | null
          sni_descriptions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          assigned_to: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          industry: string | null
          notes: string | null
          organization_id: string | null
          phone: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_blocks: {
        Row: {
          config: Json
          created_at: string
          document_id: string
          id: string
          sort_order: number
          type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          document_id: string
          id?: string
          sort_order?: number
          type: string
        }
        Update: {
          config?: Json
          created_at?: string
          document_id?: string
          id?: string
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_blocks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_recipients: {
        Row: {
          created_at: string
          document_id: string
          email: string
          id: string
          name: string | null
          sent_at: string | null
          sign_provider: string | null
          signed_at: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          email: string
          id?: string
          name?: string | null
          sent_at?: string | null
          sign_provider?: string | null
          signed_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          email?: string
          id?: string
          name?: string | null
          sent_at?: string | null
          sign_provider?: string | null
          signed_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_recipients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          brand_settings: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          brand_settings?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          brand_settings?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_percent: number | null
          document_number: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_signature_data: string | null
          recipient_signed_at: string | null
          rejected_at: string | null
          sender_signature_data: string | null
          sender_signed_at: string | null
          sent_at: string | null
          signature_status: string
          status: string
          subtotal: number | null
          template_id: string | null
          template_version: number | null
          terms: string | null
          title: string
          total: number | null
          type: string
          updated_at: string
          valid_until: string | null
          vat_total: number | null
          view_count: number | null
          view_token: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          document_number?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_signature_data?: string | null
          recipient_signed_at?: string | null
          rejected_at?: string | null
          sender_signature_data?: string | null
          sender_signed_at?: string | null
          sent_at?: string | null
          signature_status?: string
          status?: string
          subtotal?: number | null
          template_id?: string | null
          template_version?: number | null
          terms?: string | null
          title: string
          total?: number | null
          type?: string
          updated_at?: string
          valid_until?: string | null
          vat_total?: number | null
          view_count?: number | null
          view_token?: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          document_number?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_signature_data?: string | null
          recipient_signed_at?: string | null
          rejected_at?: string | null
          sender_signature_data?: string | null
          sender_signed_at?: string | null
          sent_at?: string | null
          signature_status?: string
          status?: string
          subtotal?: number | null
          template_id?: string | null
          template_version?: number | null
          terms?: string | null
          title?: string
          total?: number | null
          type?: string
          updated_at?: string
          valid_until?: string | null
          vat_total?: number | null
          view_count?: number | null
          view_token?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_replies: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          forwarded_at: string | null
          from_email: string
          from_name: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          original_email_id: string | null
          received_at: string
          sent_by: string
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          forwarded_at?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          original_email_id?: string | null
          received_at?: string
          sent_by: string
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          forwarded_at?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          original_email_id?: string | null
          received_at?: string
          sent_by?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_original_email_id_fkey"
            columns: ["original_email_id"]
            isOneToOne: false
            referencedRelation: "sent_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          subject: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          subject: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          subject?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_actions: {
        Row: {
          estimated_effort: string | null
          estimated_impact: string | null
          geo_analysis_id: string
          id: string
          priority: string
          steps: string | null
          title: string
        }
        Insert: {
          estimated_effort?: string | null
          estimated_impact?: string | null
          geo_analysis_id: string
          id?: string
          priority: string
          steps?: string | null
          title: string
        }
        Update: {
          estimated_effort?: string | null
          estimated_impact?: string | null
          geo_analysis_id?: string
          id?: string
          priority?: string
          steps?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_actions_geo_analysis_id_fkey"
            columns: ["geo_analysis_id"]
            isOneToOne: false
            referencedRelation: "geo_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_analyses: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          domain: string
          error_message: string | null
          geo_score: number | null
          id: string
          lead_id: string | null
          organization_id: string | null
          status: string
          summary: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          domain: string
          error_message?: string | null
          geo_score?: number | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string
          error_message?: string | null
          geo_score?: number | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_findings: {
        Row: {
          category: string
          description: string | null
          evidence: Json | null
          geo_analysis_id: string
          id: string
          recommendation: string | null
          severity: string
          title: string
        }
        Insert: {
          category: string
          description?: string | null
          evidence?: Json | null
          geo_analysis_id: string
          id?: string
          recommendation?: string | null
          severity: string
          title: string
        }
        Update: {
          category?: string
          description?: string | null
          evidence?: Json | null
          geo_analysis_id?: string
          id?: string
          recommendation?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_findings_geo_analysis_id_fkey"
            columns: ["geo_analysis_id"]
            isOneToOne: false
            referencedRelation: "geo_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_pages: {
        Row: {
          canonical: string | null
          geo_analysis_id: string
          h1: string | null
          id: string
          indexable: boolean | null
          internal_links: number | null
          meta_description: string | null
          schema_types: string[] | null
          status_code: number | null
          title: string | null
          url: string
          word_count: number | null
        }
        Insert: {
          canonical?: string | null
          geo_analysis_id: string
          h1?: string | null
          id?: string
          indexable?: boolean | null
          internal_links?: number | null
          meta_description?: string | null
          schema_types?: string[] | null
          status_code?: number | null
          title?: string | null
          url: string
          word_count?: number | null
        }
        Update: {
          canonical?: string | null
          geo_analysis_id?: string
          h1?: string | null
          id?: string
          indexable?: boolean | null
          internal_links?: number | null
          meta_description?: string | null
          schema_types?: string[] | null
          status_code?: number | null
          title?: string | null
          url?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_pages_geo_analysis_id_fkey"
            columns: ["geo_analysis_id"]
            isOneToOne: false
            referencedRelation: "geo_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_quick_scans: {
        Row: {
          company_name: string | null
          completed_at: string | null
          created_at: string
          domain: string
          email: string
          error_code: string | null
          error_message: string | null
          expires_at: string | null
          geo_score: number | null
          id: string
          lead_id: string | null
          organization_id: string | null
          progress_label: string
          progress_step: number
          public_token: string
          status: string
          summary_short: string | null
          top_actions: Json
          top_findings: Json
          website: string
        }
        Insert: {
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          domain: string
          email: string
          error_code?: string | null
          error_message?: string | null
          expires_at?: string | null
          geo_score?: number | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          progress_label?: string
          progress_step?: number
          public_token: string
          status?: string
          summary_short?: string | null
          top_actions?: Json
          top_findings?: Json
          website: string
        }
        Update: {
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          domain?: string
          email?: string
          error_code?: string | null
          error_message?: string | null
          expires_at?: string | null
          geo_score?: number | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          progress_label?: string
          progress_step?: number
          public_token?: string
          status?: string
          summary_short?: string | null
          top_actions?: Json
          top_findings?: Json
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_quick_scans_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_quick_scans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_analysis_status: {
        Row: {
          created_at: string
          geo_status: string
          geo_updated_at: string | null
          id: string
          lead_id: string
          organization_id: string
          updated_at: string
          web_status: string
          web_updated_at: string | null
        }
        Insert: {
          created_at?: string
          geo_status?: string
          geo_updated_at?: string | null
          id?: string
          lead_id: string
          organization_id: string
          updated_at?: string
          web_status?: string
          web_updated_at?: string | null
        }
        Update: {
          created_at?: string
          geo_status?: string
          geo_updated_at?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          updated_at?: string
          web_status?: string
          web_updated_at?: string | null
        }
        Relationships: []
      }
      lead_competitors: {
        Row: {
          added_at: string | null
          added_by: string | null
          competitor_name: string
          competitor_url: string
          id: string
          lead_id: string
          organization_id: string | null
          source: string | null
          web_analysis_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          competitor_name: string
          competitor_url: string
          id?: string
          lead_id: string
          organization_id?: string | null
          source?: string | null
          web_analysis_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          competitor_name?: string
          competitor_url?: string
          id?: string
          lead_id?: string
          organization_id?: string | null
          source?: string | null
          web_analysis_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_competitors_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_competitors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_competitors_web_analysis_id_fkey"
            columns: ["web_analysis_id"]
            isOneToOne: false
            referencedRelation: "web_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_fleet_data: {
        Row: {
          created_at: string
          fetched_at: string
          fetched_by: string | null
          id: string
          lead_id: string
          leasing_company: string | null
          org_number: string | null
          organization_id: string | null
          phone_numbers: Json | null
          phone_operator: string | null
          phone_subscription_count: number | null
          raw_data: Json | null
          source_url: string | null
          updated_at: string
          vehicle_count: number | null
          vehicles: Json | null
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          fetched_by?: string | null
          id?: string
          lead_id: string
          leasing_company?: string | null
          org_number?: string | null
          organization_id?: string | null
          phone_numbers?: Json | null
          phone_operator?: string | null
          phone_subscription_count?: number | null
          raw_data?: Json | null
          source_url?: string | null
          updated_at?: string
          vehicle_count?: number | null
          vehicles?: Json | null
        }
        Update: {
          created_at?: string
          fetched_at?: string
          fetched_by?: string | null
          id?: string
          lead_id?: string
          leasing_company?: string | null
          org_number?: string | null
          organization_id?: string | null
          phone_numbers?: Json | null
          phone_operator?: string | null
          phone_subscription_count?: number | null
          raw_data?: Json | null
          source_url?: string | null
          updated_at?: string
          vehicle_count?: number | null
          vehicles?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_fleet_data_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_fleet_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_members: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          lead_id: string
          organization_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          organization_id?: string | null
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_members_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pool: {
        Row: {
          city: string | null
          company_name: string
          created_at: string
          data: Json | null
          email: string | null
          id: string
          industry: string | null
          org_nr: string | null
          organization_id: string
          phone: string | null
          registered_at: string | null
          sni_codes: string[] | null
          source: string
          website: string | null
        }
        Insert: {
          city?: string | null
          company_name: string
          created_at?: string
          data?: Json | null
          email?: string | null
          id?: string
          industry?: string | null
          org_nr?: string | null
          organization_id: string
          phone?: string | null
          registered_at?: string | null
          sni_codes?: string[] | null
          source?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string
          created_at?: string
          data?: Json | null
          email?: string | null
          id?: string
          industry?: string | null
          org_nr?: string | null
          organization_id?: string
          phone?: string | null
          registered_at?: string | null
          sni_codes?: string[] | null
          source?: string
          website?: string | null
        }
        Relationships: []
      }
      lead_sequences: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_step: number
          id: string
          lead_id: string
          next_step_at: string | null
          organization_id: string | null
          sequence_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          lead_id: string
          next_step_at?: string | null
          organization_id?: string | null
          sequence_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          lead_id?: string
          next_step_at?: string | null
          organization_id?: string | null
          sequence_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sequences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sequences_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_snapshots: {
        Row: {
          created_at: string
          id: string
          month: string
          organization_id: string
          top1_meetings: number | null
          top1_user_id: string | null
          top2_meetings: number | null
          top2_user_id: string | null
          top3_meetings: number | null
          top3_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          organization_id: string
          top1_meetings?: number | null
          top1_user_id?: string | null
          top2_meetings?: number | null
          top2_user_id?: string | null
          top3_meetings?: number | null
          top3_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          organization_id?: string
          top1_meetings?: number | null
          top1_user_id?: string | null
          top2_meetings?: number | null
          top2_user_id?: string | null
          top3_meetings?: number | null
          top3_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          auto_draft_generated: boolean | null
          business_fit_score: number | null
          business_summary: string | null
          company_name: string | null
          contact_name: string | null
          converted_to_customer_id: string | null
          created_at: string
          created_by: string | null
          detected_problems: Json | null
          email: string | null
          enrichment_completed_at: string | null
          enrichment_error: string | null
          enrichment_started_at: string | null
          enrichment_status: string | null
          has_contact_form: boolean | null
          has_cta: boolean | null
          id: string
          imported_via_prospecting: boolean | null
          is_not_interested: boolean
          last_call_at: string | null
          last_call_outcome_key: string | null
          lead_pool_id: string | null
          lead_status: string
          not_interested_at: string | null
          not_interested_reason: string | null
          org_number: string | null
          organization_id: string | null
          phone: string | null
          prospecting_source: string | null
          site_copyright_year: number | null
          site_technology: string | null
          source: string
          source_data: Json | null
          website: string | null
        }
        Insert: {
          assigned_to?: string | null
          auto_draft_generated?: boolean | null
          business_fit_score?: number | null
          business_summary?: string | null
          company_name?: string | null
          contact_name?: string | null
          converted_to_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          detected_problems?: Json | null
          email?: string | null
          enrichment_completed_at?: string | null
          enrichment_error?: string | null
          enrichment_started_at?: string | null
          enrichment_status?: string | null
          has_contact_form?: boolean | null
          has_cta?: boolean | null
          id?: string
          imported_via_prospecting?: boolean | null
          is_not_interested?: boolean
          last_call_at?: string | null
          last_call_outcome_key?: string | null
          lead_pool_id?: string | null
          lead_status?: string
          not_interested_at?: string | null
          not_interested_reason?: string | null
          org_number?: string | null
          organization_id?: string | null
          phone?: string | null
          prospecting_source?: string | null
          site_copyright_year?: number | null
          site_technology?: string | null
          source: string
          source_data?: Json | null
          website?: string | null
        }
        Update: {
          assigned_to?: string | null
          auto_draft_generated?: boolean | null
          business_fit_score?: number | null
          business_summary?: string | null
          company_name?: string | null
          contact_name?: string | null
          converted_to_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          detected_problems?: Json | null
          email?: string | null
          enrichment_completed_at?: string | null
          enrichment_error?: string | null
          enrichment_started_at?: string | null
          enrichment_status?: string | null
          has_contact_form?: boolean | null
          has_cta?: boolean | null
          id?: string
          imported_via_prospecting?: boolean | null
          is_not_interested?: boolean
          last_call_at?: string | null
          last_call_outcome_key?: string | null
          lead_pool_id?: string | null
          lead_status?: string
          not_interested_at?: string | null
          not_interested_reason?: string | null
          org_number?: string | null
          organization_id?: string | null
          phone?: string | null
          prospecting_source?: string | null
          site_copyright_year?: number | null
          site_technology?: string | null
          source?: string
          source_data?: Json | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_to_customer_id_fkey"
            columns: ["converted_to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_pool_id_fkey"
            columns: ["lead_pool_id"]
            isOneToOne: false
            referencedRelation: "lead_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          booking_token: string | null
          created_at: string | null
          description: string | null
          end_time: string
          guest_email: string | null
          guest_name: string | null
          host_user_id: string
          id: string
          lead_id: string | null
          meeting_link: string | null
          organization_id: string | null
          start_time: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          booking_token?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          guest_email?: string | null
          guest_name?: string | null
          host_user_id: string
          id?: string
          lead_id?: string | null
          meeting_link?: string | null
          organization_id?: string | null
          start_time: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          booking_token?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          guest_email?: string | null
          guest_name?: string | null
          host_user_id?: string
          id?: string
          lead_id?: string | null
          meeting_link?: string | null
          organization_id?: string | null
          start_time?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_host_user_id_profiles_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          organization_id: string | null
          uses: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          organization_id?: string | null
          uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          organization_id?: string | null
          uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_pricing: {
        Row: {
          ai_visibility_dominate_monthly: number | null
          ai_visibility_growth_monthly: number | null
          ai_visibility_start_monthly: number | null
          billing_period_label: string | null
          booking_url: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          currency: string | null
          geo_dominate_monthly: number | null
          geo_growth_monthly: number | null
          geo_start_monthly: number | null
          id: string
          organization_id: string | null
          seo_dominate_monthly: number | null
          seo_growth_monthly: number | null
          seo_start_monthly: number | null
          show_website_upsell: boolean | null
          updated_at: string | null
          web_performance_fix_from: number | null
          website_rebuild_from_price: number | null
        }
        Insert: {
          ai_visibility_dominate_monthly?: number | null
          ai_visibility_growth_monthly?: number | null
          ai_visibility_start_monthly?: number | null
          billing_period_label?: string | null
          booking_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          currency?: string | null
          geo_dominate_monthly?: number | null
          geo_growth_monthly?: number | null
          geo_start_monthly?: number | null
          id?: string
          organization_id?: string | null
          seo_dominate_monthly?: number | null
          seo_growth_monthly?: number | null
          seo_start_monthly?: number | null
          show_website_upsell?: boolean | null
          updated_at?: string | null
          web_performance_fix_from?: number | null
          website_rebuild_from_price?: number | null
        }
        Update: {
          ai_visibility_dominate_monthly?: number | null
          ai_visibility_growth_monthly?: number | null
          ai_visibility_start_monthly?: number | null
          billing_period_label?: string | null
          booking_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          currency?: string | null
          geo_dominate_monthly?: number | null
          geo_growth_monthly?: number | null
          geo_start_monthly?: number | null
          id?: string
          organization_id?: string | null
          seo_dominate_monthly?: number | null
          seo_growth_monthly?: number | null
          seo_start_monthly?: number | null
          show_website_upsell?: boolean | null
          updated_at?: string | null
          web_performance_fix_from?: number | null
          website_rebuild_from_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_pricing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          auto_enrich_enabled: boolean
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          resend_api_key_configured: boolean | null
          sender_email: string | null
          sender_name: string | null
          slug: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          auto_enrich_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          resend_api_key_configured?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          auto_enrich_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          resend_api_key_configured?: boolean | null
          sender_email?: string | null
          sender_name?: string | null
          slug?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      outreach_sequences: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          market: string
          name: string
          organization_id: string | null
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          market?: string
          name: string
          organization_id?: string | null
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          market?: string
          name?: string
          organization_id?: string | null
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      power_call_lists: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          dynamic_filter: Json | null
          dynamic_sort: string
          dynamic_version: number
          filter_json: Json | null
          id: string
          is_team_list: boolean
          name: string
          organization_id: string
          owner_user_id: string | null
          shared_to_team: boolean
          source_type: string
          static_lead_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          dynamic_filter?: Json | null
          dynamic_sort?: string
          dynamic_version?: number
          filter_json?: Json | null
          id?: string
          is_team_list?: boolean
          name: string
          organization_id: string
          owner_user_id?: string | null
          shared_to_team?: boolean
          source_type?: string
          static_lead_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          dynamic_filter?: Json | null
          dynamic_sort?: string
          dynamic_version?: number
          filter_json?: Json | null
          id?: string
          is_team_list?: boolean
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          shared_to_team?: boolean
          source_type?: string
          static_lead_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_call_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      power_call_locks: {
        Row: {
          expires_at: string
          id: string
          lead_id: string
          locked_at: string
          locked_by_user_id: string
          organization_id: string
        }
        Insert: {
          expires_at?: string
          id?: string
          lead_id: string
          locked_at?: string
          locked_by_user_id: string
          organization_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          lead_id?: string
          locked_at?: string
          locked_by_user_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_call_locks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "power_call_locks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      power_call_queue: {
        Row: {
          created_at: string
          error_code: string | null
          id: string
          lead_id: string | null
          organization_id: string
          required_modules: Json
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          required_modules?: Json
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          required_modules?: Json
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      power_call_sessions: {
        Row: {
          created_at: string
          current_lead_id: string | null
          cursor: Json | null
          ended_at: string | null
          id: string
          last_served_lead_id: string | null
          list_id: string | null
          next_lead_id: string | null
          next_preparing: boolean
          next_ready: boolean
          next_required_modules: Json | null
          organization_id: string
          served_lead_ids: string[] | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_lead_id?: string | null
          cursor?: Json | null
          ended_at?: string | null
          id?: string
          last_served_lead_id?: string | null
          list_id?: string | null
          next_lead_id?: string | null
          next_preparing?: boolean
          next_ready?: boolean
          next_required_modules?: Json | null
          organization_id: string
          served_lead_ids?: string[] | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_lead_id?: string | null
          cursor?: Json | null
          ended_at?: string | null
          id?: string
          last_served_lead_id?: string | null
          list_id?: string | null
          next_lead_id?: string | null
          next_preparing?: boolean
          next_ready?: boolean
          next_required_modules?: Json | null
          organization_id?: string
          served_lead_ids?: string[] | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_call_sessions_current_lead_id_fkey"
            columns: ["current_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "power_call_sessions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "power_call_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "power_call_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          unit: string | null
          unit_price: number
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_logo_url: string | null
          company_name: string | null
          company_website: string | null
          created_at: string
          email: string
          email_footer: string | null
          email_signature: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          organization_id: string | null
          outreach_tone: string | null
          sender_display_name: string | null
          service_description: string | null
          service_industry: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          email: string
          email_footer?: string | null
          email_signature?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          organization_id?: string | null
          outreach_tone?: string | null
          sender_display_name?: string | null
          service_description?: string | null
          service_industry?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          email?: string
          email_footer?: string | null
          email_signature?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          organization_id?: string | null
          outreach_tone?: string | null
          sender_display_name?: string | null
          service_description?: string | null
          service_industry?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_drafts: {
        Row: {
          ai_confidence: number | null
          ai_summary: string | null
          body: string
          created_at: string | null
          id: string
          lead_id: string
          organization_id: string
          resend_message_id: string | null
          send_attempted_at: string | null
          send_error: string | null
          sent_at: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_summary?: string | null
          body: string
          created_at?: string | null
          id?: string
          lead_id: string
          organization_id: string
          resend_message_id?: string | null
          send_attempted_at?: string | null
          send_error?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_summary?: string | null
          body?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          resend_message_id?: string | null
          send_attempted_at?: string | null
          send_error?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          billing_type: string
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          line_total: number | null
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number
          unit: string | null
          unit_price: number
          vat_rate: number | null
        }
        Insert: {
          billing_type?: string
          created_at?: string
          description: string
          discount_percent?: number | null
          id?: string
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number
          unit?: string | null
          unit_price?: number
          vat_rate?: number | null
        }
        Update: {
          billing_type?: string
          created_at?: string
          description?: string
          discount_percent?: number | null
          id?: string
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit?: string | null
          unit_price?: number
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_percent: number | null
          document_label: string
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string | null
          quote_number: string
          recipient_email: string | null
          recipient_name: string | null
          recipient_signature_data: string | null
          recipient_signed_at: string | null
          rejected_at: string | null
          sender_signature_data: string | null
          sender_signed_at: string | null
          sent_at: string | null
          status: string
          subtotal: number | null
          terms: string | null
          title: string
          total: number | null
          updated_at: string
          valid_until: string | null
          vat_total: number | null
          view_count: number | null
          view_token: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          document_label?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          quote_number: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_signature_data?: string | null
          recipient_signed_at?: string | null
          rejected_at?: string | null
          sender_signature_data?: string | null
          sender_signed_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          terms?: string | null
          title: string
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          vat_total?: number | null
          view_count?: number | null
          view_token?: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_percent?: number | null
          document_label?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          quote_number?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_signature_data?: string | null
          recipient_signed_at?: string | null
          rejected_at?: string | null
          sender_signature_data?: string | null
          sender_signed_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number | null
          terms?: string | null
          title?: string
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          vat_total?: number | null
          view_count?: number | null
          view_token?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_shares: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          report_id: string
          token: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          report_id: string
          token?: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          report_id?: string
          token?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "report_shares_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_view_events: {
        Row: {
          created_at: string
          event_name: string | null
          event_type: string
          id: string
          meta: Json | null
          report_token: string
          session_key: string
          value_int: number | null
        }
        Insert: {
          created_at?: string
          event_name?: string | null
          event_type: string
          id?: string
          meta?: Json | null
          report_token: string
          session_key: string
          value_int?: number | null
        }
        Update: {
          created_at?: string
          event_name?: string | null
          event_type?: string
          id?: string
          meta?: Json | null
          report_token?: string
          session_key?: string
          value_int?: number | null
        }
        Relationships: []
      }
      report_view_sessions: {
        Row: {
          country_code: string | null
          ended_at: string | null
          id: string
          last_seen_at: string
          lead_id: string | null
          referrer: string | null
          report_id: string | null
          report_token: string
          session_key: string
          started_at: string
          total_active_ms: number
          user_agent_hash: string | null
        }
        Insert: {
          country_code?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          lead_id?: string | null
          referrer?: string | null
          report_id?: string | null
          report_token: string
          session_key: string
          started_at?: string
          total_active_ms?: number
          user_agent_hash?: string | null
        }
        Update: {
          country_code?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          lead_id?: string | null
          referrer?: string | null
          report_id?: string | null
          report_token?: string
          session_key?: string
          started_at?: string
          total_active_ms?: number
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          content_html: string | null
          created_at: string | null
          created_by: string | null
          data: Json | null
          id: string
          lead_id: string | null
          organization_id: string | null
          pdf_url: string | null
          report_type: string
          seo_analysis_id: string | null
          source_refs: Json | null
          title: string
          updated_at: string | null
          web_analysis_id: string | null
        }
        Insert: {
          content_html?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          pdf_url?: string | null
          report_type: string
          seo_analysis_id?: string | null
          source_refs?: Json | null
          title: string
          updated_at?: string | null
          web_analysis_id?: string | null
        }
        Update: {
          content_html?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          pdf_url?: string | null
          report_type?: string
          seo_analysis_id?: string | null
          source_refs?: Json | null
          title?: string
          updated_at?: string | null
          web_analysis_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_seo_analysis_id_fkey"
            columns: ["seo_analysis_id"]
            isOneToOne: false
            referencedRelation: "seo_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_web_analysis_id_fkey"
            columns: ["web_analysis_id"]
            isOneToOne: false
            referencedRelation: "web_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          body: string
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          opened_at: string | null
          opened_count: number | null
          organization_id: string | null
          recipient_email: string
          recipient_name: string | null
          reply_token: string | null
          resend_email_id: string | null
          send_attempted_at: string | null
          send_error: string | null
          sent_by: string
          sequence_execution_id: string | null
          source: string
          status: string | null
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          opened_at?: string | null
          opened_count?: number | null
          organization_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          reply_token?: string | null
          resend_email_id?: string | null
          send_attempted_at?: string | null
          send_error?: string | null
          sent_by: string
          sequence_execution_id?: string | null
          source?: string
          status?: string | null
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          opened_at?: string | null
          opened_count?: number | null
          organization_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          reply_token?: string | null
          resend_email_id?: string | null
          send_attempted_at?: string | null
          send_error?: string | null
          sent_by?: string
          sequence_execution_id?: string | null
          source?: string
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_sequence_execution_id_fkey"
            columns: ["sequence_execution_id"]
            isOneToOne: false
            referencedRelation: "sequence_step_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_analyses: {
        Row: {
          ai_opportunities: Json | null
          ai_summary: string | null
          analyzed_by: string | null
          canonical_url: string | null
          created_at: string
          estimated_keywords: Json | null
          external_links_count: number | null
          h1_count: number | null
          h2_count: number | null
          h3_count: number | null
          has_canonical: boolean | null
          has_open_graph: boolean | null
          has_robots_txt: boolean | null
          has_sitemap: boolean | null
          has_twitter_cards: boolean | null
          id: string
          images_count: number | null
          images_without_alt: number | null
          internal_links_count: number | null
          is_https: boolean | null
          keyword_density: Json | null
          lead_id: string | null
          meta_description: string | null
          mobile_friendly: boolean | null
          organization_id: string | null
          primary_keywords: Json | null
          raw_data: Json | null
          title_tag: string | null
          updated_at: string
          url: string
          visibility_score: number | null
          web_analysis_id: string | null
          word_count: number | null
        }
        Insert: {
          ai_opportunities?: Json | null
          ai_summary?: string | null
          analyzed_by?: string | null
          canonical_url?: string | null
          created_at?: string
          estimated_keywords?: Json | null
          external_links_count?: number | null
          h1_count?: number | null
          h2_count?: number | null
          h3_count?: number | null
          has_canonical?: boolean | null
          has_open_graph?: boolean | null
          has_robots_txt?: boolean | null
          has_sitemap?: boolean | null
          has_twitter_cards?: boolean | null
          id?: string
          images_count?: number | null
          images_without_alt?: number | null
          internal_links_count?: number | null
          is_https?: boolean | null
          keyword_density?: Json | null
          lead_id?: string | null
          meta_description?: string | null
          mobile_friendly?: boolean | null
          organization_id?: string | null
          primary_keywords?: Json | null
          raw_data?: Json | null
          title_tag?: string | null
          updated_at?: string
          url: string
          visibility_score?: number | null
          web_analysis_id?: string | null
          word_count?: number | null
        }
        Update: {
          ai_opportunities?: Json | null
          ai_summary?: string | null
          analyzed_by?: string | null
          canonical_url?: string | null
          created_at?: string
          estimated_keywords?: Json | null
          external_links_count?: number | null
          h1_count?: number | null
          h2_count?: number | null
          h3_count?: number | null
          has_canonical?: boolean | null
          has_open_graph?: boolean | null
          has_robots_txt?: boolean | null
          has_sitemap?: boolean | null
          has_twitter_cards?: boolean | null
          id?: string
          images_count?: number | null
          images_without_alt?: number | null
          internal_links_count?: number | null
          is_https?: boolean | null
          keyword_density?: Json | null
          lead_id?: string | null
          meta_description?: string | null
          mobile_friendly?: boolean | null
          organization_id?: string | null
          primary_keywords?: Json | null
          raw_data?: Json | null
          title_tag?: string | null
          updated_at?: string
          url?: string
          visibility_score?: number | null
          web_analysis_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_analyses_web_analysis_id_fkey"
            columns: ["web_analysis_id"]
            isOneToOne: false
            referencedRelation: "web_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_cache: {
        Row: {
          created_at: string
          data: Json
          domain: string
          id: string
          organization_id: string | null
          ttl_days: number
        }
        Insert: {
          created_at?: string
          data: Json
          domain: string
          id?: string
          organization_id?: string | null
          ttl_days?: number
        }
        Update: {
          created_at?: string
          data?: Json
          domain?: string
          id?: string
          organization_id?: string | null
          ttl_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_step_executions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          generated_body: string | null
          generated_subject: string | null
          id: string
          lead_sequence_id: string
          organization_id: string | null
          scheduled_at: string | null
          status: string
          step_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          generated_body?: string | null
          generated_subject?: string | null
          id?: string
          lead_sequence_id: string
          organization_id?: string | null
          scheduled_at?: string | null
          status?: string
          step_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          generated_body?: string | null
          generated_subject?: string | null
          id?: string
          lead_sequence_id?: string
          organization_id?: string | null
          scheduled_at?: string | null
          status?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_step_executions_lead_sequence_id_fkey"
            columns: ["lead_sequence_id"]
            isOneToOne: false
            referencedRelation: "lead_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_step_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_step_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          ai_generated: boolean | null
          created_at: string
          delay_days: number
          email_prompt: string | null
          email_subject: string | null
          id: string
          organization_id: string | null
          sequence_id: string
          step_order: number
          step_type: string
          task_description: string | null
          task_title: string | null
          template_id: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string
          delay_days?: number
          email_prompt?: string | null
          email_subject?: string | null
          id?: string
          organization_id?: string | null
          sequence_id: string
          step_order: number
          step_type: string
          task_description?: string | null
          task_title?: string | null
          template_id?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string
          delay_days?: number
          email_prompt?: string | null
          email_subject?: string | null
          id?: string
          organization_id?: string | null
          sequence_id?: string
          step_order?: number
          step_type?: string
          task_description?: string | null
          task_title?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          blocks_json: Json
          created_at: string
          created_by: string | null
          id: string
          template_id: string
          version: number
        }
        Insert: {
          blocks_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          template_id: string
          version?: number
        }
        Update: {
          blocks_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          document_id: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          organization_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          tags: string[] | null
          title: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[] | null
          title: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tags?: string[] | null
          title?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          organization_id: string | null
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          organization_id?: string | null
          start_time: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          organization_id?: string | null
          start_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_availability_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      web_analyses: {
        Row: {
          accessibility_score: number | null
          analyzed_by: string | null
          best_practices_score: number | null
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          performance_score: number | null
          raw_data: Json | null
          seo_score: number | null
          url: string
        }
        Insert: {
          accessibility_score?: number | null
          analyzed_by?: string | null
          best_practices_score?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          performance_score?: number | null
          raw_data?: Json | null
          seo_score?: number | null
          url: string
        }
        Update: {
          accessibility_score?: number | null
          analyzed_by?: string | null
          best_practices_score?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          performance_score?: number | null
          raw_data?: Json | null
          seo_score?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_analyses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
      consume_invite_code: { Args: { invite_code: string }; Returns: string }
      generate_quote_number: { Args: { org_id: string }; Returns: string }
      get_public_invite_by_code: {
        Args: { invite_code: string }
        Returns: {
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
          organization_id: string
          uses: number
        }[]
      }
      get_public_report_by_token: {
        Args: { share_token: string }
        Returns: {
          content_html: string | null
          created_at: string | null
          created_by: string | null
          data: Json | null
          id: string
          lead_id: string | null
          organization_id: string | null
          pdf_url: string | null
          report_type: string
          seo_analysis_id: string | null
          source_refs: Json | null
          title: string
          updated_at: string | null
          web_analysis_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_public_report_view: {
        Args: { share_token: string }
        Returns: undefined
      }
      is_admin_or_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_lead_member: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
      public_book_meeting: {
        Args: {
          _end: string
          _guest_email: string
          _guest_name: string
          _host_id: string
          _message?: string
          _start: string
        }
        Returns: string
      }
      public_get_document_blocks_by_token: {
        Args: { p_token: string }
        Returns: {
          config: Json
          created_at: string
          document_id: string
          id: string
          sort_order: number
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "document_blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_get_document_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_percent: number | null
          document_number: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_signature_data: string | null
          recipient_signed_at: string | null
          rejected_at: string | null
          sender_signature_data: string | null
          sender_signed_at: string | null
          sent_at: string | null
          signature_status: string
          status: string
          subtotal: number | null
          template_id: string | null
          template_version: number | null
          terms: string | null
          title: string
          total: number | null
          type: string
          updated_at: string
          valid_until: string | null
          vat_total: number | null
          view_count: number | null
          view_token: string
          viewed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_get_host_availability: {
        Args: { _host_id: string }
        Returns: {
          day_of_week: number
          end_time: string
          is_available: boolean
          start_time: string
        }[]
      }
      public_get_host_busy_slots: {
        Args: { _from: string; _host_id: string; _to: string }
        Returns: {
          end_time: string
          start_time: string
        }[]
      }
      public_get_quote_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_percent: number | null
          document_label: string
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string | null
          quote_number: string
          recipient_email: string | null
          recipient_name: string | null
          recipient_signature_data: string | null
          recipient_signed_at: string | null
          rejected_at: string | null
          sender_signature_data: string | null
          sender_signed_at: string | null
          sent_at: string | null
          status: string
          subtotal: number | null
          terms: string | null
          title: string
          total: number | null
          updated_at: string
          valid_until: string | null
          vat_total: number | null
          view_count: number | null
          view_token: string
          viewed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "quotes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_get_quote_items_by_token: {
        Args: { p_token: string }
        Returns: {
          billing_type: string
          created_at: string
          description: string
          discount_percent: number | null
          id: string
          line_total: number | null
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number
          unit: string | null
          unit_price: number
          vat_rate: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "quote_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_respond_document: {
        Args: { p_action: string; p_signature_data?: string; p_token: string }
        Returns: {
          created_by: string
          document_id: string
          recipient_name: string
          status: string
          title: string
        }[]
      }
      public_respond_quote: {
        Args: { p_action: string; p_signature_data?: string; p_token: string }
        Returns: {
          created_by: string
          document_label: string
          quote_id: string
          quote_number: string
          recipient_name: string
          status: string
        }[]
      }
      public_track_document_view: {
        Args: { p_token: string }
        Returns: {
          created_by: string
          document_id: string
          is_first_view: boolean
          recipient_name: string
          status: string
          title: string
        }[]
      }
      public_track_quote_view: {
        Args: { p_token: string }
        Returns: {
          created_by: string
          document_label: string
          is_first_view: boolean
          quote_id: string
          quote_number: string
          recipient_name: string
          status: string
        }[]
      }
      report_has_enabled_share: {
        Args: { _report_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note" | "task_completed"
      app_module:
        | "customers"
        | "web_analysis"
        | "outreach"
        | "tasks"
        | "reports"
        | "leads"
        | "pipeline"
        | "fleet_data"
        | "seo_intelligence"
        | "quotes"
        | "offers"
        | "documents"
        | "geo_analysis"
        | "statistics"
        | "outreach_pro"
        | "mail"
        | "tickets"
      app_role: "admin" | "user"
      customer_status: "lead" | "prospect" | "active" | "inactive" | "churned"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "completed" | "cancelled"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "new"
        | "open"
        | "in_progress"
        | "waiting"
        | "resolved"
        | "closed"
      ticket_type: "sales" | "support" | "onboarding" | "other"
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
      activity_type: ["call", "email", "meeting", "note", "task_completed"],
      app_module: [
        "customers",
        "web_analysis",
        "outreach",
        "tasks",
        "reports",
        "leads",
        "pipeline",
        "fleet_data",
        "seo_intelligence",
        "quotes",
        "offers",
        "documents",
        "geo_analysis",
        "statistics",
        "outreach_pro",
        "mail",
        "tickets",
      ],
      app_role: ["admin", "user"],
      customer_status: ["lead", "prospect", "active", "inactive", "churned"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "completed", "cancelled"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "new",
        "open",
        "in_progress",
        "waiting",
        "resolved",
        "closed",
      ],
      ticket_type: ["sales", "support", "onboarding", "other"],
    },
  },
} as const
