/**
 * Document Context Resolution
 *
 * Resolves CRM variable tokens ({{group.field}}) in document content.
 * Used in public view, email preview, and PDF rendering.
 */

import { fromTable } from "./supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { type DocumentBlock, type ArticleTableBlockConfig } from "./blocks/types";
import { calculateDocumentTotals } from "./blocks/totals";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

export interface DocumentContext {
  document: Record<string, string>;
  contact: Record<string, string>;
  customer: Record<string, string>;
  lead: Record<string, string>;
  deal: Record<string, string>;
  totals: Record<string, string>;
  org: Record<string, string>;
}

/**
 * Build a full CRM context object for a given document.
 * All values are strings (ready for token replacement).
 */
export async function resolveDocumentContext(
  documentId: string,
  blocks: DocumentBlock[]
): Promise<DocumentContext> {
  const ctx: DocumentContext = {
    document: {},
    contact: {},
    customer: {},
    lead: {},
    deal: {},
    totals: {},
    org: {},
  };

  try {
    // Load document
    const { data: doc } = await fromTable("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (!doc) return ctx;

    // Document fields
    ctx.document.document_number = doc.document_number || "";
    ctx.document.created_at = doc.created_at
      ? format(new Date(doc.created_at), "d MMMM yyyy", { locale: sv })
      : "";
    ctx.document.valid_until = doc.valid_until
      ? format(new Date(doc.valid_until), "d MMMM yyyy", { locale: sv })
      : "";

    // Totals from blocks (deterministic)
    const totals = calculateDocumentTotals(blocks);
    ctx.totals.subtotal = totals.subtotal.toLocaleString("sv-SE") + " kr";
    ctx.totals.vat_total = totals.vat_total.toLocaleString("sv-SE") + " kr";
    ctx.totals.total = totals.total.toLocaleString("sv-SE") + " kr";

    // Customer
    if (doc.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", doc.customer_id)
        .maybeSingle();
      if (customer) {
        ctx.customer.name = customer.company_name || "";
        ctx.customer.address = "";  // no address column in customers yet
        ctx.customer.org_number = "";
        ctx.contact.name = customer.contact_name || "";
        ctx.contact.first_name = (customer.contact_name || "").split(" ")[0];
        ctx.contact.email = customer.email || "";
        ctx.contact.phone = customer.phone || "";
      }
    }

    // Lead (fallback if no customer)
    if (doc.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", doc.lead_id)
        .maybeSingle();
      if (lead) {
        ctx.lead.source = lead.source || "";
        ctx.lead.campaign = "";
        // Fill contact/customer from lead if not already set
        if (!ctx.customer.name) ctx.customer.name = lead.company_name || "";
        if (!ctx.customer.org_number) ctx.customer.org_number = lead.org_number || "";
        if (!ctx.contact.name) ctx.contact.name = lead.contact_name || "";
        if (!ctx.contact.first_name)
          ctx.contact.first_name = (lead.contact_name || "").split(" ")[0];
        if (!ctx.contact.email) ctx.contact.email = lead.email || "";
        if (!ctx.contact.phone) ctx.contact.phone = lead.phone || "";
      }
    }

    // Recipient fallback
    if (!ctx.contact.name && doc.recipient_name) {
      ctx.contact.name = doc.recipient_name;
      ctx.contact.first_name = doc.recipient_name.split(" ")[0];
    }
    if (!ctx.contact.email && doc.recipient_email) {
      ctx.contact.email = doc.recipient_email;
    }

    // Deal (uses document title as deal title for now)
    ctx.deal.title = doc.title || "";
    ctx.deal.owner_name = "";

    // Org info
    if (doc.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, logo_url, website")
        .eq("id", doc.organization_id)
        .maybeSingle();
      if (org) {
        ctx.org.name = org.name || "";
      }
    }
  } catch (e) {
    console.error("Context resolution error:", e);
  }

  return ctx;
}

/**
 * Replace all {{group.field}} tokens in a string with resolved values.
 * Missing tokens are replaced with empty string.
 */
export function replaceTokens(text: string, context: DocumentContext): string {
  return text.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, group, field) => {
    const groupData = context[group as keyof DocumentContext];
    if (!groupData) return "";
    return groupData[field] ?? "";
  });
}

/**
 * Deep-replace tokens in a Tiptap JSON structure.
 */
export function replaceTokensInJson(json: any, context: DocumentContext): any {
  if (!json) return json;
  if (typeof json === "string") return replaceTokens(json, context);
  if (Array.isArray(json)) return json.map((item) => replaceTokensInJson(item, context));
  if (typeof json === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(json)) {
      result[key] = replaceTokensInJson(value, context);
    }
    return result;
  }
  return json;
}

/**
 * Resolve all blocks' content with CRM context.
 * Returns new block array with tokens replaced.
 */
export function resolveBlockTokens(
  blocks: DocumentBlock[],
  context: DocumentContext
): DocumentBlock[] {
  return blocks.map((block) => {
    const config = { ...block.config } as Record<string, any>;

    if (block.type === "text" && config.content) {
      config.content = replaceTokensInJson(config.content, context);
    }

    if (block.type === "key_value" && config.pairs) {
      config.pairs = (config.pairs as any[]).map((p) => ({
        ...p,
        value: replaceTokens(p.value || "", context),
      }));
    }

    return { ...block, config } as DocumentBlock;
  });
}
