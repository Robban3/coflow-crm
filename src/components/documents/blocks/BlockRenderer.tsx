import { type DocumentBlock } from "./types";
import { TextBlockRenderer } from "./TextBlock";
import { ImageBlockRenderer } from "./ImageBlock";
import { DividerBlockRenderer } from "./DividerBlock";
import { ArticleTableBlockRenderer } from "./ArticleTableBlock";
import { KeyValueBlockRenderer } from "./KeyValueBlock";
import { SpacerBlockRenderer } from "./SpacerBlock";

interface BlockRendererProps {
  block: DocumentBlock;
  readOnly?: boolean;
  structureLocked?: boolean;
  onChange?: (config: DocumentBlock["config"]) => void;
}

const renderers: Record<string, React.FC<BlockRendererProps>> = {
  text: TextBlockRenderer,
  image: ImageBlockRenderer,
  divider: DividerBlockRenderer,
  article_table: ArticleTableBlockRenderer,
  key_value: KeyValueBlockRenderer,
  spacer: SpacerBlockRenderer,
};

export function BlockRenderer({ block, readOnly, structureLocked, onChange }: BlockRendererProps) {
  const Component = renderers[block.type];
  if (!Component) {
    return <div className="text-muted-foreground text-sm p-2">Okänd blocktyp: {block.type}</div>;
  }
  return <Component block={block} readOnly={readOnly} structureLocked={structureLocked} onChange={onChange} />;
}
