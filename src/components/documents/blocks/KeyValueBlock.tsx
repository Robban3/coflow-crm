import { useTranslation } from "@/i18n/LanguageProvider";
import { type DocumentBlock, type KeyValueBlockConfig } from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  block: DocumentBlock;
  readOnly?: boolean;
  structureLocked?: boolean;
  onChange?: (config: DocumentBlock["config"]) => void;
}

export function KeyValueBlockRenderer({ block, readOnly, structureLocked, onChange }: Props) {
  const { t } = useTranslation();
  const config = block.config as KeyValueBlockConfig;
  const pairs = config.pairs || [];

  const updatePair = (idx: number, partial: Partial<{ label: string; value: string }>) => {
    const updated = pairs.map((p, i) => (i === idx ? { ...p, ...partial } : p));
    onChange?.({ ...config, pairs: updated });
  };

  const addPair = () => {
    onChange?.({ ...config, pairs: [...pairs, { label: "", value: "" }] });
  };

  const removePair = (idx: number) => {
    onChange?.({ ...config, pairs: pairs.filter((_, i) => i !== idx) });
  };

  if (readOnly) {
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {pairs.map((p, i) => (
          <div key={i} className="contents">
            <span className="font-medium text-muted-foreground">{p.label}:</span>
            <span>{p.value}</span>
          </div>
        ))}
      </div>
    );
  }

  // Structure locked: only allow editing values, not labels, and no add/remove
  if (structureLocked) {
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {pairs.map((p, i) => (
          <div key={i} className="contents">
            <span className="font-medium text-muted-foreground pt-1">{p.label}:</span>
            <Input
              value={p.value}
              placeholder="–"
              className="h-8 text-sm"
              onChange={(e) => updatePair(i, { value: e.target.value })}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={p.label}
            placeholder={t("templates.kvLabelPlaceholder")}
            className="h-8 text-sm w-1/3"
            onChange={(e) => updatePair(i, { label: e.target.value })}
          />
          <Input
            value={p.value}
            placeholder={t("templates.kvValuePlaceholder")}
            className="h-8 text-sm flex-1"
            onChange={(e) => updatePair(i, { value: e.target.value })}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePair(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addPair}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Lägg till rad
      </Button>
    </div>
  );
}
