import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Check, Tag, Sparkles, FileText, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pickLocalized } from "@/lib/localized";
import { useAuth } from "@/hooks/useAuth";
import { usePricingPackages, type PricingPackage } from "@/hooks/usePricingPackages";
import { PricingPackageEditor } from "@/components/pricing/PricingPackageEditor";
import { PROPOSAL_DECKS, deckUrl, LANG_LABEL } from "@/lib/proposalDecks";

export default function PricingPage() {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { packages, isLoading, deletePackage } = usePricingPackages();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PricingPackage | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<string | undefined>();

  // Group by category, preserving sort order
  const groups: { category: string; items: PricingPackage[] }[] = [];
  for (const p of packages) {
    let g = groups.find((x) => x.category === p.category);
    if (!g) {
      g = { category: p.category, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }

  const openNew = (category?: string) => {
    setEditing(null);
    setDefaultCategory(category);
    setEditorOpen(true);
  };
  const openEdit = (pkg: PricingPackage) => {
    setEditing(pkg);
    setDefaultCategory(undefined);
    setEditorOpen(true);
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm(t("pricing.deleteConfirm"))) return;
    try {
      await deletePackage.mutateAsync(id);
    } catch (e: any) {
      toast({ title: t("common.error"), description: e?.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout title={t("nav.pricing")}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="h-6 w-6" />
              {t("nav.pricing")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("pricing.subtitle")}</p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("pricing.newPackage")}
            </Button>
          )}
        </div>

        <Tabs defaultValue="packages" className="w-full">
          <TabsList>
            <TabsTrigger value="packages" className="gap-1.5">
              <Tag className="h-4 w-4" /> {t("nav.pricing")}
            </TabsTrigger>
            <TabsTrigger value="proposals" className="gap-1.5">
              <FileText className="h-4 w-4" /> {t("pricing.tabProposals")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-8 mt-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-xl border border-dashed border-border bg-muted/30">
            <Tag className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground max-w-md">{t("pricing.empty")}</p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.category} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {pickLocalized(language, group.category, group.items[0]?.category_en, group.items[0]?.category_es)}
                </h2>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => openNew(group.category)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("pricing.addToCategory")}
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((pkg) => {
                  const name = pickLocalized(language, pkg.name, pkg.name_en, pkg.name_es);
                  const price = pickLocalized(language, pkg.price, pkg.price_en, pkg.price_es);
                  const unit = pickLocalized(language, pkg.unit, pkg.unit_en, pkg.unit_es);
                  const description = pickLocalized(language, pkg.description, pkg.description_en, pkg.description_es);
                  const features = pickLocalized(language, pkg.features, pkg.features_en, pkg.features_es) ?? [];
                  return (
                  <article
                    key={pkg.id}
                    className={cn(
                      "relative rounded-xl border bg-card p-5 flex flex-col",
                      pkg.highlighted ? "border-primary ring-1 ring-primary shadow-sm" : "border-border"
                    )}
                  >
                    {pkg.highlighted && (
                      <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        <Sparkles className="h-3 w-3" />
                        {t("pricing.popular")}
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{name}</h3>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(pkg)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(pkg.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {price && (
                      <div className="mt-1 mb-3">
                        <span className="text-xl font-bold">{price}</span>
                        {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
                      </div>
                    )}

                    {description && (
                      <p className="text-sm text-muted-foreground mb-3">{description}</p>
                    )}

                    {features.length > 0 && (
                      <ul className="space-y-1.5 mt-auto">
                        {features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
          </TabsContent>

          <TabsContent value="proposals" className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("pricing.decksHint")}</p>
            {PROPOSAL_DECKS.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-xl border border-dashed border-border bg-muted/30">
                <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground max-w-md">{t("pricing.decksEmpty")}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PROPOSAL_DECKS.map((deck) => (
                  <article key={deck.slug} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-semibold">{deck.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{deck.category}</p>
                    <div className="flex flex-wrap gap-2">
                      {deck.langs.map((lang) => (
                        <Button key={lang} asChild size="sm" variant="outline">
                          <a href={deckUrl(deck.slug, lang)} target="_blank" rel="noopener noreferrer">
                            {LANG_LABEL[lang]} <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PricingPackageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pkg={editing}
        defaultCategory={defaultCategory}
      />
    </AppLayout>
  );
}
