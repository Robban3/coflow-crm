import {
  type BlockType,
  type BlockRegistryEntry,
  type TextBlockConfig,
  type ImageBlockConfig,
  type DividerBlockConfig,
  type ArticleTableBlockConfig,
  type KeyValueBlockConfig,
  type SpacerBlockConfig,
} from "./types";

const registry = new Map<BlockType, BlockRegistryEntry>();

export function registerBlock(entry: BlockRegistryEntry) {
  registry.set(entry.type, entry);
}

export function getBlockEntry(type: BlockType): BlockRegistryEntry | undefined {
  return registry.get(type);
}

export function getAllBlockEntries(): BlockRegistryEntry[] {
  return Array.from(registry.values());
}

// ---- Register core blocks ----
registerBlock({
  type: "text",
  label: "offers.block.text",
  icon: "Type",
  defaultConfig: (): TextBlockConfig => ({
    level: "p",
    content: null,
  }),
});

registerBlock({
  type: "image",
  label: "offers.block.image",
  icon: "Image",
  defaultConfig: (): ImageBlockConfig => ({
    url: "",
    alt: "",
    alignment: "center",
    width: 100,
  }),
});

registerBlock({
  type: "divider",
  label: "offers.block.divider",
  icon: "Minus",
  defaultConfig: (): DividerBlockConfig => ({
    style: "solid",
  }),
});

registerBlock({
  type: "article_table",
  label: "offers.block.articleTable",
  icon: "Table",
  defaultConfig: (): ArticleTableBlockConfig => ({
    rows: [],
    show_vat: true,
  }),
});

registerBlock({
  type: "key_value",
  label: "offers.block.keyValue",
  icon: "List",
  defaultConfig: (): KeyValueBlockConfig => ({
    pairs: [{ label: "", value: "" }],
  }),
});

registerBlock({
  type: "spacer",
  label: "offers.block.spacer",
  icon: "Space",
  defaultConfig: (): SpacerBlockConfig => ({
    height: 32,
  }),
});
