import { type DocumentBlock, type DocumentTotals, type ArticleTableBlockConfig } from "./types";

/**
 * Deterministisk total-beräkning från artikelrader.
 * Anropas vid sparning, skickande och publik rendering.
 */
export function calculateDocumentTotals(blocks: DocumentBlock[]): DocumentTotals {
  let subtotal = 0;
  let vat_total = 0;

  for (const block of blocks) {
    if (block.type !== "article_table") continue;
    const config = block.config as ArticleTableBlockConfig;
    for (const row of config.rows) {
      const rowSubtotal = row.qty * row.unit_price * (1 - (row.discount || 0) / 100);
      subtotal += rowSubtotal;
      if (config.show_vat) {
        vat_total += rowSubtotal * ((row.vat_rate || 0) / 100);
      }
    }
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat_total: Math.round(vat_total * 100) / 100,
    total: Math.round((subtotal + vat_total) * 100) / 100,
  };
}

/** Beräkna rad-total */
export function calculateRowTotal(row: { qty: number; unit_price: number; discount: number }): number {
  return Math.round(row.qty * row.unit_price * (1 - (row.discount || 0) / 100) * 100) / 100;
}
