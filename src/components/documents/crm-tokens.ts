/**
 * CRM Variable Token definitions for use in document templates.
 * Tokens are stored as plain text {{group.field}} in Tiptap content
 * and resolved at render time (public view, email, PDF).
 */

export interface CrmToken {
  token: string;     // e.g. "document.document_number"
  labelKey: string;  // i18n key for the display label
  placeholder: string; // full {{token}} string
}

export interface CrmTokenGroup {
  group: string;
  labelKey: string;
  tokens: CrmToken[];
}

export const CRM_TOKEN_GROUPS: CrmTokenGroup[] = [
  {
    group: "document",
    labelKey: "offers.token.group.document",
    tokens: [
      { token: "document.document_number", labelKey: "offers.token.document.document_number", placeholder: "{{document.document_number}}" },
      { token: "document.created_at", labelKey: "offers.token.document.created_at", placeholder: "{{document.created_at}}" },
      { token: "document.valid_until", labelKey: "offers.token.document.valid_until", placeholder: "{{document.valid_until}}" },
    ],
  },
  {
    group: "contact",
    labelKey: "offers.token.group.contact",
    tokens: [
      { token: "contact.name", labelKey: "offers.token.contact.name", placeholder: "{{contact.name}}" },
      { token: "contact.first_name", labelKey: "offers.token.contact.first_name", placeholder: "{{contact.first_name}}" },
      { token: "contact.email", labelKey: "offers.token.contact.email", placeholder: "{{contact.email}}" },
      { token: "contact.phone", labelKey: "offers.token.contact.phone", placeholder: "{{contact.phone}}" },
    ],
  },
  {
    group: "customer",
    labelKey: "offers.token.group.customer",
    tokens: [
      { token: "customer.name", labelKey: "offers.token.customer.name", placeholder: "{{customer.name}}" },
      { token: "customer.address", labelKey: "offers.token.customer.address", placeholder: "{{customer.address}}" },
      { token: "customer.org_number", labelKey: "offers.token.customer.org_number", placeholder: "{{customer.org_number}}" },
    ],
  },
  {
    group: "lead",
    labelKey: "offers.token.group.lead",
    tokens: [
      { token: "lead.source", labelKey: "offers.token.lead.source", placeholder: "{{lead.source}}" },
      { token: "lead.campaign", labelKey: "offers.token.lead.campaign", placeholder: "{{lead.campaign}}" },
    ],
  },
  {
    group: "deal",
    labelKey: "offers.token.group.deal",
    tokens: [
      { token: "deal.title", labelKey: "offers.token.deal.title", placeholder: "{{deal.title}}" },
      { token: "deal.owner_name", labelKey: "offers.token.deal.owner_name", placeholder: "{{deal.owner_name}}" },
    ],
  },
  {
    group: "totals",
    labelKey: "offers.token.group.totals",
    tokens: [
      { token: "totals.subtotal", labelKey: "offers.token.totals.subtotal", placeholder: "{{totals.subtotal}}" },
      { token: "totals.vat_total", labelKey: "offers.token.totals.vat_total", placeholder: "{{totals.vat_total}}" },
      { token: "totals.total", labelKey: "offers.token.totals.total", placeholder: "{{totals.total}}" },
    ],
  },
];

export function getAllTokens(): CrmToken[] {
  return CRM_TOKEN_GROUPS.flatMap((g) => g.tokens);
}
