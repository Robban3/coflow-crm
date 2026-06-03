/**
 * CRM Variable Token definitions for use in document templates.
 * Tokens are stored as plain text {{group.field}} in Tiptap content
 * and resolved at render time (public view, email, PDF).
 */

export interface CrmToken {
  token: string;     // e.g. "document.document_number"
  label: string;     // Swedish display label
  placeholder: string; // full {{token}} string
}

export interface CrmTokenGroup {
  group: string;
  label: string;
  tokens: CrmToken[];
}

export const CRM_TOKEN_GROUPS: CrmTokenGroup[] = [
  {
    group: "document",
    label: "Dokument",
    tokens: [
      { token: "document.document_number", label: "Dokumentnummer", placeholder: "{{document.document_number}}" },
      { token: "document.created_at", label: "Skapad datum", placeholder: "{{document.created_at}}" },
      { token: "document.valid_until", label: "Giltig t.o.m.", placeholder: "{{document.valid_until}}" },
    ],
  },
  {
    group: "contact",
    label: "Kontakt",
    tokens: [
      { token: "contact.name", label: "Kontaktnamn", placeholder: "{{contact.name}}" },
      { token: "contact.first_name", label: "Förnamn", placeholder: "{{contact.first_name}}" },
      { token: "contact.email", label: "E-post", placeholder: "{{contact.email}}" },
      { token: "contact.phone", label: "Telefon", placeholder: "{{contact.phone}}" },
    ],
  },
  {
    group: "customer",
    label: "Kund",
    tokens: [
      { token: "customer.name", label: "Kundnamn", placeholder: "{{customer.name}}" },
      { token: "customer.address", label: "Adress", placeholder: "{{customer.address}}" },
      { token: "customer.org_number", label: "Org.nummer", placeholder: "{{customer.org_number}}" },
    ],
  },
  {
    group: "lead",
    label: "Lead",
    tokens: [
      { token: "lead.source", label: "Källa", placeholder: "{{lead.source}}" },
      { token: "lead.campaign", label: "Kampanj", placeholder: "{{lead.campaign}}" },
    ],
  },
  {
    group: "deal",
    label: "Affär",
    tokens: [
      { token: "deal.title", label: "Affärstitel", placeholder: "{{deal.title}}" },
      { token: "deal.owner_name", label: "Ansvarig", placeholder: "{{deal.owner_name}}" },
    ],
  },
  {
    group: "totals",
    label: "Totaler",
    tokens: [
      { token: "totals.subtotal", label: "Delsumma", placeholder: "{{totals.subtotal}}" },
      { token: "totals.vat_total", label: "Moms", placeholder: "{{totals.vat_total}}" },
      { token: "totals.total", label: "Totalt", placeholder: "{{totals.total}}" },
    ],
  },
];

export function getAllTokens(): CrmToken[] {
  return CRM_TOKEN_GROUPS.flatMap((g) => g.tokens);
}
