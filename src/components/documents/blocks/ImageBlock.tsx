import { useTranslation } from "@/i18n/LanguageProvider";
import { type DocumentBlock, type ImageBlockConfig } from "./types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Image as ImageIcon } from "lucide-react";

interface Props {
  block: DocumentBlock;
  readOnly?: boolean;
  onChange?: (config: DocumentBlock["config"]) => void;
}

export function ImageBlockRenderer({ block, readOnly, onChange }: Props) {
  const { t } = useTranslation();
  const config = block.config as ImageBlockConfig;

  const alignmentClass =
    config.alignment === "left"
      ? "mr-auto"
      : config.alignment === "right"
      ? "ml-auto"
      : "mx-auto";

  if (!config.url && readOnly) return null;

  if (!config.url) {
    return (
      <div className="space-y-3">
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex flex-col items-center gap-2">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Ange en bild-URL</p>
        </div>
        <Input
          placeholder="Bild-URL (https://...)"
          value={config.url}
          onChange={(e) => onChange?.({ ...config, url: e.target.value })}
        />
        <Input
          placeholder={t("templates.imgAltPlaceholder")}
          value={config.alt}
          onChange={(e) => onChange?.({ ...config, alt: e.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <img
        src={config.url}
        alt={config.alt}
        className={`rounded-md ${alignmentClass} block`}
        style={{ width: `${config.width}%` }}
      />
      {!readOnly && (
        <div className="flex items-center gap-4">
          <Input
            placeholder={t("templates.imgUrlPlaceholder")}
            value={config.url}
            onChange={(e) => onChange?.({ ...config, url: e.target.value })}
            className="flex-1"
          />
          <Select
            value={config.alignment}
            onValueChange={(v) =>
              onChange?.({ ...config, alignment: v as ImageBlockConfig["alignment"] })
            }
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">{t("templates.alignLeft")}</SelectItem>
              <SelectItem value="center">{t("templates.alignCenter")}</SelectItem>
              <SelectItem value="right">{t("templates.alignRight")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-32">
            <Slider
              value={[config.width]}
              min={25}
              max={100}
              step={5}
              onValueChange={([v]) => onChange?.({ ...config, width: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
