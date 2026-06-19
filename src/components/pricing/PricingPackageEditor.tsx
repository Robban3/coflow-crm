import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { usePricingPackages, type PricingPackage } from "@/hooks/usePricingPackages";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg?: PricingPackage | null;
  defaultCategory?: string;
}

export function PricingPackageEditor({ open, onOpenChange, pkg, defaultCategory }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { createPackage, updatePackage } = usePricingPackages();

  const [category, setCategory] = useState(pkg?.category ?? defaultCategory ?? "");
  const [name, setName] = useState(pkg?.name ?? "");
  const [price, setPrice] = useState(pkg?.price ?? "");
  const [unit, setUnit] = useState(pkg?.unit ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [highlighted, setHighlighted] = useState(pkg?.highlighted ?? false);
  const [featuresText, setFeaturesText] = useState((pkg?.features ?? []).join("\n"));

  const isEditing = !!pkg;
  const isSaving = createPackage.isPending || updatePackage.isPending;

  const handleSave = async () => {
    if (!name.trim() || !category.trim()) {
      toast({ title: t("pricing.editor.required"), variant: "destructive" });
      return;
    }
    const features = featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const payload = {
      category: category.trim(),
      name: name.trim(),
      price: price.trim() || null,
      unit: unit.trim() || null,
      description: description.trim() || null,
      features,
      highlighted,
    };
    try {
      if (isEditing) {
        await updatePackage.mutateAsync({ id: pkg!.id, ...payload });
      } else {
        await createPackage.mutateAsync(payload);
      }
      toast({ title: t("pricing.editor.saved") });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: t("common.error"),
        description: e?.message ?? t("common.unexpectedError"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("pricing.editor.editTitle") : t("pricing.editor.newTitle")}
          </DialogTitle>
          <DialogDescription>{t("pricing.editor.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.category")}</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Hemsidor" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Företagshemsida" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.price")}</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="från 18 000 kr" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.unit")}</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="engångs / /mån" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("pricing.editor.descriptionField")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("pricing.editor.features")}</Label>
            <Textarea
              rows={5}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder={t("pricing.editor.featuresPlaceholder")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={highlighted}
              onChange={(e) => setHighlighted(e.target.checked)}
              className="h-4 w-4"
            />
            {t("pricing.editor.highlighted")}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("pricing.editor.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
