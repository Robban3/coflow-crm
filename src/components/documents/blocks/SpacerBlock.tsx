import { useTranslation } from "@/i18n/LanguageProvider";
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
  const { t } = useTranslation();
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
              <SelectItem value="16">{t("templates.spacerSmall")}</SelectItem>
              <SelectItem value="32">{t("templates.spacerMedium")}</SelectItem>
              <SelectItem value="48">{t("templates.spacerLarge")}</SelectItem>
              <SelectItem value="64">{t("templates.spacerXLarge")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
