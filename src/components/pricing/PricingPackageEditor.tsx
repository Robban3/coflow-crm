import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { usePricingPackages, type PricingPackage } from "@/hooks/usePricingPackages";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg?: PricingPackage | null;
  defaultCategory?: string;
}

type Lang = "sv" | "en" | "es";
interface Vals {
  category: string;
  name: string;
  price: string;
  unit: string;
  description: string;
  featuresText: string;
}

const LANG_TABS: { code: Lang; label: string }[] = [
  { code: "sv", label: "Svenska" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

const splitFeatures = (text: string) =>
  text.split("\n").map((f) => f.trim()).filter(Boolean);

export function PricingPackageEditor({ open, onOpenChange, pkg, defaultCategory }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { createPackage, updatePackage } = usePricingPackages();

  const [lang, setLang] = useState<Lang>("sv");
  const [sv, setSv] = useState<Vals>({ category: "", name: "", price: "", unit: "", description: "", featuresText: "" });
  const [en, setEn] = useState<Vals>({ category: "", name: "", price: "", unit: "", description: "", featuresText: "" });
  const [es, setEs] = useState<Vals>({ category: "", name: "", price: "", unit: "", description: "", featuresText: "" });
  const [highlighted, setHighlighted] = useState(false);

  // Sync form state whenever the dialog opens (or the edited package changes).
  useEffect(() => {
    if (!open) return;
    setLang("sv");
    setHighlighted(pkg?.highlighted ?? false);
    setSv({
      category: pkg?.category ?? defaultCategory ?? "",
      name: pkg?.name ?? "",
      price: pkg?.price ?? "",
      unit: pkg?.unit ?? "",
      description: pkg?.description ?? "",
      featuresText: (pkg?.features ?? []).join("\n"),
    });
    setEn({
      category: pkg?.category_en ?? "",
      name: pkg?.name_en ?? "",
      price: pkg?.price_en ?? "",
      unit: pkg?.unit_en ?? "",
      description: pkg?.description_en ?? "",
      featuresText: (pkg?.features_en ?? []).join("\n"),
    });
    setEs({
      category: pkg?.category_es ?? "",
      name: pkg?.name_es ?? "",
      price: pkg?.price_es ?? "",
      unit: pkg?.unit_es ?? "",
      description: pkg?.description_es ?? "",
      featuresText: (pkg?.features_es ?? []).join("\n"),
    });
  }, [open, pkg, defaultCategory]);

  const cur = lang === "sv" ? sv : lang === "en" ? en : es;
  const setCur = lang === "sv" ? setSv : lang === "en" ? setEn : setEs;
  const upd = (patch: Partial<Vals>) => setCur((v) => ({ ...v, ...patch }));

  const isEditing = !!pkg;
  const isSaving = createPackage.isPending || updatePackage.isPending;

  // Optional localised value -> null when empty (so we don't store blank strings).
  const opt = (s: string) => (s.trim() ? s.trim() : null);
  const optFeatures = (text: string) => {
    const arr = splitFeatures(text);
    return arr.length ? arr : null;
  };

  const handleSave = async () => {
    if (!sv.name.trim() || !sv.category.trim()) {
      toast({ title: t("pricing.editor.required"), variant: "destructive" });
      return;
    }
    const payload = {
      category: sv.category.trim(),
      name: sv.name.trim(),
      price: sv.price.trim() || null,
      unit: sv.unit.trim() || null,
      description: sv.description.trim() || null,
      features: splitFeatures(sv.featuresText),
      highlighted,
      category_en: opt(en.category), category_es: opt(es.category),
      name_en: opt(en.name), name_es: opt(es.name),
      price_en: opt(en.price), price_es: opt(es.price),
      unit_en: opt(en.unit), unit_es: opt(es.unit),
      description_en: opt(en.description), description_es: opt(es.description),
      features_en: optFeatures(en.featuresText), features_es: optFeatures(es.featuresText),
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

        {/* Language tabs – Swedish is the base/fallback, EN/ES are optional. */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {LANG_TABS.map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setLang(tab.code)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                lang === tab.code ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.code === "sv" && <span className="text-muted-foreground"> *</span>}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.category")}</Label>
              <Input value={cur.category} onChange={(e) => upd({ category: e.target.value })} placeholder={t("pricing.editor.categoryPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.name")}</Label>
              <Input value={cur.name} onChange={(e) => upd({ name: e.target.value })} placeholder={t("pricing.editor.namePlaceholder")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.price")}</Label>
              <Input value={cur.price} onChange={(e) => upd({ price: e.target.value })} placeholder={t("pricing.editor.pricePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("pricing.editor.unit")}</Label>
              <Input value={cur.unit} onChange={(e) => upd({ unit: e.target.value })} placeholder={t("pricing.editor.unitPlaceholder")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("pricing.editor.descriptionField")}</Label>
            <Input value={cur.description} onChange={(e) => upd({ description: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("pricing.editor.features")}</Label>
            <Textarea
              rows={5}
              value={cur.featuresText}
              onChange={(e) => upd({ featuresText: e.target.value })}
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
