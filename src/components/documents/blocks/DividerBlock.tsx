import { type DocumentBlock, type DividerBlockConfig } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Props {
  block: DocumentBlock;
  readOnly?: boolean;
  structureLocked?: boolean;
  onChange?: (config: DocumentBlock["config"]) => void;
}

export function DividerBlockRenderer({ block, readOnly, structureLocked, onChange }: Props) {
  const { t } = useTranslation();
  const config = block.config as DividerBlockConfig;

  return (
    <div className="py-2">
      <hr
        className="border-border"
        style={{ borderStyle: config.style }}
      />
      {!readOnly && !structureLocked && (
        <div className="mt-2">
          <Select
            value={config.style}
            onValueChange={(v) =>
              onChange?.({ ...config, style: v as DividerBlockConfig["style"] })
            }
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">{t("offers.divider.solid")}</SelectItem>
              <SelectItem value="dashed">{t("offers.divider.dashed")}</SelectItem>
              <SelectItem value="dotted">{t("offers.divider.dotted")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
