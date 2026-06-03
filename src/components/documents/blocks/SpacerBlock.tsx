import { type DocumentBlock, type SpacerBlockConfig } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  block: DocumentBlock;
  readOnly?: boolean;
  onChange?: (config: DocumentBlock["config"]) => void;
}

export function SpacerBlockRenderer({ block, readOnly, onChange }: Props) {
  const config = block.config as SpacerBlockConfig;

  return (
    <div>
      <div style={{ height: config.height }} className={readOnly ? "" : "bg-muted/30 rounded border border-dashed border-border"} />
      {!readOnly && (
        <div className="mt-2">
          <Select
            value={String(config.height)}
            onValueChange={(v) => onChange?.({ ...config, height: Number(v) as SpacerBlockConfig["height"] })}
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16">Litet (16px)</SelectItem>
              <SelectItem value="32">Medium (32px)</SelectItem>
              <SelectItem value="48">Stort (48px)</SelectItem>
              <SelectItem value="64">Extra stort (64px)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
