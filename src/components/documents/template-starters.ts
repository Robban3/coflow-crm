/**
 * Pre-built template block structures for starter templates.
 * Each function returns an array of block definitions (type + config)
 * matching the DocumentBlock shape used in template_versions.blocks_json.
 */

import { type TextBlockConfig, type KeyValueBlockConfig, type DividerBlockConfig, type SpacerBlockConfig, type ArticleTableBlockConfig } from "./blocks/types";

interface StarterBlock {
  id: string;
  type: string;
  config: Record<string, any>;
}

function uid() {
  return crypto.randomUUID();
}

function textBlock(level: "h1" | "h2" | "p", text: string): StarterBlock {
  return {
    id: uid(),
    type: "text",
    config: {
      level,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text }],
          },
        ],
      },
    } satisfies TextBlockConfig,
  };
}

function kvBlock(pairs: { label: string; value: string }[]): StarterBlock {
  return {
    id: uid(),
    type: "key_value",
    config: { pairs } satisfies KeyValueBlockConfig,
  };
}

function divider(): StarterBlock {
  return { id: uid(), type: "divider", config: { style: "solid" } satisfies DividerBlockConfig };
}

function spacer(height: 16 | 32 | 48 | 64 = 32): StarterBlock {
  return { id: uid(), type: "spacer", config: { height } satisfies SpacerBlockConfig };
}

function articleTable(): StarterBlock {
  return {
    id: uid(),
    type: "article_table",
    config: { rows: [], show_vat: true } satisfies ArticleTableBlockConfig,
  };
}

// ============================================================
// STANDARD OFFERT – CoFlow
// ============================================================
export function standardOfferBlocks(): StarterBlock[] {
  return [
    textBlock("h1", "Offert"),
    kvBlock([
      { label: "Offertnr", value: "{{document.document_number}}" },
      { label: "Datum", value: "{{document.created_at}}" },
      { label: "Giltig t.o.m", value: "{{document.valid_until}}" },
    ]),
    divider(),
    textBlock("h2", "Kund"),
    kvBlock([
      { label: "Kund", value: "{{customer.name}}" },
      { label: "Kontakt", value: "{{contact.name}}" },
      { label: "E-post", value: "{{contact.email}}" },
      { label: "Telefon", value: "{{contact.phone}}" },
      { label: "Adress", value: "{{customer.address}}" },
    ]),
    spacer(),
    textBlock("h2", "Sammanfattning"),
    textBlock("p", "Hej {{contact.first_name}}! Här kommer vår offert på {{deal.title}}."),
    articleTable(),
    divider(),
    kvBlock([
      { label: "Delsumma", value: "{{totals.subtotal}}" },
      { label: "Moms", value: "{{totals.vat_total}}" },
      { label: "Totalt", value: "{{totals.total}}" },
    ]),
    spacer(),
    textBlock("h2", "Villkor"),
    textBlock("p", "Betalningsvillkor: 10 dagar. Leverans enligt överenskommelse."),
    textBlock("p", "För att acceptera offerten, signera digitalt via länken nedan."),
  ];
}

// ============================================================
// ENKEL OFFERT
// ============================================================
export function simpleOfferBlocks(): StarterBlock[] {
  return [
    textBlock("h1", "Offert"),
    kvBlock([
      { label: "Datum", value: "{{document.created_at}}" },
      { label: "Kund", value: "{{customer.name}}" },
    ]),
    divider(),
    articleTable(),
    divider(),
    kvBlock([
      { label: "Totalt", value: "{{totals.total}}" },
    ]),
    spacer(),
    textBlock("p", "Betalningsvillkor: 10 dagar."),
  ];
}

// ============================================================
// AVTAL – STANDARD
// ============================================================
export function standardContractBlocks(): StarterBlock[] {
  return [
    textBlock("h1", "Avtal"),
    kvBlock([
      { label: "Datum", value: "{{document.created_at}}" },
      { label: "Avtalsnummer", value: "{{document.document_number}}" },
    ]),
    divider(),
    textBlock("h2", "Parter"),
    kvBlock([
      { label: "Leverantör", value: "Ert företagsnamn" },
      { label: "Kund", value: "{{customer.name}}" },
      { label: "Kontaktperson", value: "{{contact.name}}" },
      { label: "Org.nr", value: "{{customer.org_number}}" },
    ]),
    spacer(),
    textBlock("h2", "Omfattning"),
    textBlock("p", "Beskriv avtalets omfattning och leverans här."),
    spacer(),
    textBlock("h2", "Prissättning"),
    articleTable(),
    divider(),
    kvBlock([
      { label: "Totalt", value: "{{totals.total}}" },
    ]),
    spacer(),
    textBlock("h2", "Villkor"),
    textBlock("p", "Avtalet gäller från signeringsdatum. Uppsägningstid: 3 månader."),
    textBlock("p", "Betalningsvillkor: 30 dagar netto."),
  ];
}

// ============================================================
// DETAILED OFFER
// ============================================================
export function detailedOfferBlocks(): StarterBlock[] {
  return [
    textBlock("h1", "Offert"),
    kvBlock([
      { label: "Offertnr", value: "{{document.document_number}}" },
      { label: "Datum", value: "{{document.created_at}}" },
      { label: "Giltig t.o.m", value: "{{document.valid_until}}" },
      { label: "Ansvarig", value: "{{deal.owner_name}}" },
    ]),
    divider(),
    textBlock("h2", "Kund"),
    kvBlock([
      { label: "Kund", value: "{{customer.name}}" },
      { label: "Org.nr", value: "{{customer.org_number}}" },
      { label: "Kontakt", value: "{{contact.name}}" },
      { label: "E-post", value: "{{contact.email}}" },
      { label: "Telefon", value: "{{contact.phone}}" },
      { label: "Adress", value: "{{customer.address}}" },
    ]),
    spacer(),
    textBlock("h2", "Bakgrund"),
    textBlock("p", "Beskriv projektets bakgrund och kundens behov här."),
    spacer(),
    textBlock("h2", "Vår lösning"),
    textBlock("p", "Beskriv er lösning och leveransinnehåll här."),
    spacer(),
    textBlock("h2", "Prissättning"),
    articleTable(),
    divider(),
    kvBlock([
      { label: "Delsumma", value: "{{totals.subtotal}}" },
      { label: "Moms", value: "{{totals.vat_total}}" },
      { label: "Totalt", value: "{{totals.total}}" },
    ]),
    spacer(),
    textBlock("h2", "Leveranstid"),
    textBlock("p", "Beräknad leveranstid: X veckor från accepterat avtal."),
    spacer(),
    textBlock("h2", "Villkor"),
    textBlock("p", "Betalningsvillkor: 10 dagar netto. Offerten gäller i 30 dagar."),
    textBlock("p", "För att acceptera offerten, signera digitalt via länken nedan."),
  ];
}

/**
 * Starter templates to seed for a new organization.
 */
export interface StarterTemplateDef {
  name: string;
  type: string;
  description: string;
  blocks: StarterBlock[];
}

export function getStarterTemplates(): StarterTemplateDef[] {
  return [
    {
      name: "Standard Offert – CoFlow",
      type: "offer",
      description: "Komplett offertmall med CRM-fält, artikeltabell och villkor",
      blocks: standardOfferBlocks(),
    },
    {
      name: "Enkel Offert",
      type: "offer",
      description: "Minimalistisk offert med artikeltabell och totaler",
      blocks: simpleOfferBlocks(),
    },
    {
      name: "Avtal – Standard",
      type: "contract",
      description: "Standardavtal med parter, omfattning och villkor",
      blocks: standardContractBlocks(),
    },
  ];
}

/**
 * Get blocks for a given structure type and document type.
 */
export function getBlocksForStructure(
  docType: string,
  structure: "standard" | "simple" | "detailed"
): StarterBlock[] {
  if (docType === "contract") return standardContractBlocks();
  if (structure === "simple") return simpleOfferBlocks();
  if (structure === "detailed") return detailedOfferBlocks();
  return standardOfferBlocks();
}
