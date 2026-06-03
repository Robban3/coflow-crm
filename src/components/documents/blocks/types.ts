import { type JSONContent } from "@tiptap/react";

// ---- Block types ----
export type BlockType =
  | "text"
  | "image"
  | "divider"
  | "article_table"
  | "key_value"
  | "spacer";

// ---- Config per block type ----
export interface TextBlockConfig {
  level: "h1" | "h2" | "p";
  content: JSONContent | null;
}

export interface ImageBlockConfig {
  url: string;
  alt: string;
  alignment: "left" | "center" | "right";
  width: number; // 25-100
}

export interface DividerBlockConfig {
  style: "solid" | "dashed" | "dotted";
}

export interface ArticleRow {
  id: string;
  title: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  discount: number;
  vat_rate: number;
}

export interface ArticleTableBlockConfig {
  rows: ArticleRow[];
  show_vat: boolean;
}

export interface KeyValuePair {
  label: string;
  value: string;
}

export interface KeyValueBlockConfig {
  pairs: KeyValuePair[];
}

export interface SpacerBlockConfig {
  height: 16 | 32 | 48 | 64;
}

export type BlockConfig =
  | TextBlockConfig
  | ImageBlockConfig
  | DividerBlockConfig
  | ArticleTableBlockConfig
  | KeyValueBlockConfig
  | SpacerBlockConfig;

// ---- Block data ----
export interface DocumentBlock {
  id: string;
  type: BlockType;
  sort_order: number;
  config: BlockConfig;
}

// ---- Block registry entry ----
export interface BlockRegistryEntry {
  type: BlockType;
  label: string;
  icon: string; // lucide icon name
  defaultConfig: () => BlockConfig;
}

// ---- Totals ----
export interface DocumentTotals {
  subtotal: number;
  vat_total: number;
  total: number;
}
