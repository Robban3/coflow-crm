// Types for new document tables (not yet in auto-generated types)
export interface DocumentTemplate {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  description: string | null;
  brand_settings: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  blocks_json: any[];
  created_by: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  organization_id: string;
  document_number: string | null;
  title: string;
  type: string;
  status: string;
  signature_status: string;
  template_id: string | null;
  template_version: number | null;
  currency: string;
  valid_until: string | null;
  discount_percent: number;
  subtotal: number;
  vat_total: number;
  total: number;
  lead_id: string | null;
  customer_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  notes: string | null;
  terms: string | null;
  view_token: string;
  view_count: number;
  viewed_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  sender_signature_data: string | null;
  sender_signed_at: string | null;
  recipient_signature_data: string | null;
  recipient_signed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentBlockRow {
  id: string;
  document_id: string;
  type: string;
  sort_order: number;
  config: Record<string, any>;
  created_at: string;
}

export interface DocumentRecipient {
  id: string;
  document_id: string;
  email: string;
  name: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  sign_provider: string | null;
  created_at: string;
}
