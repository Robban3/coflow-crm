import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BrandSettingsPanelProps {
  settings: Record<string, any>;
  onChange: (settings: Record<string, any>) => void;
}

const fontOptions = [
  { value: "system-ui", label: "System" },
  { value: "Inter", label: "Inter" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
];

export function BrandSettingsPanel({ settings, onChange }: BrandSettingsPanelProps) {
  const update = (key: string, value: string) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-5 mt-6">
      <div className="space-y-2">
        <Label>Logotyp-URL</Label>
        <Input
          placeholder="https://..."
          value={settings.logo_url || ""}
          onChange={(e) => update("logo_url", e.target.value)}
        />
        {settings.logo_url && (
          <img
            src={settings.logo_url}
            alt="Logotyp"
            className="h-12 object-contain mt-1"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Primärfärg</Label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={settings.primary_color || "#3b82f6"}
            onChange={(e) => update("primary_color", e.target.value)}
            className="h-8 w-8 rounded cursor-pointer"
          />
          <Input
            value={settings.primary_color || "#3b82f6"}
            onChange={(e) => update("primary_color", e.target.value)}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Typsnitt</Label>
        <Select
          value={settings.font_family || "system-ui"}
          onValueChange={(v) => update("font_family", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontOptions.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Sidfotstext</Label>
        <Textarea
          placeholder="Text som visas längst ned i dokumentet..."
          value={settings.footer_text || ""}
          onChange={(e) => update("footer_text", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
