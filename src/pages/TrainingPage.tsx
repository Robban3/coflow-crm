import { useState } from "react";
import { Navigate, useParams, Link } from "react-router-dom";
import { Loader2, Plus, Settings2, Pencil, Trash2, GraduationCap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useTrainingAccess } from "@/hooks/useTrainingAccess";
import { useTrainingCategories } from "@/hooks/useTrainingCategories";
import { useTrainingItems, type TrainingItem } from "@/hooks/useTrainingItems";
import { TrainingRichText } from "@/components/training/TrainingRichText";
import { TrainingItemEditor } from "@/components/training/TrainingItemEditor";
import { TrainingCategoryManager } from "@/components/training/TrainingCategoryManager";
import { SandboxApp } from "@/components/training/sandbox/SandboxApp";
import { QuizApp } from "@/components/training/quiz/QuizApp";

/** Pick the localized variant for the active language, falling back to Swedish. */
function pickLocalized<T>(language: string, base: T, en?: T | null, es?: T | null): T {
  if (language === "en" && en != null) return en;
  if (language === "es" && es != null) return es;
  return base;
}

/** Convert common video URLs to an embeddable URL; null if not embeddable. */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export default function TrainingPage() {
  const { t, language } = useTranslation();
  const { slug } = useParams();
  const { canView, canEdit } = useTrainingAccess();
  const { categories, isLoading: catLoading } = useTrainingCategories();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TrainingItem | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  // Email-domain gate (RLS is the real defense; this just keeps the page tidy).
  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  const activeCategory =
    categories.find((c) => c.slug === slug) ?? categories[0] ?? null;

  return (
    <AppLayout title={t("nav.training")}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              {activeCategory
                ? pickLocalized(language, activeCategory.name, activeCategory.name_en, activeCategory.name_es)
                : t("nav.training")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("training.subtitle")}</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCategoryManagerOpen(true)}>
                <Settings2 className="h-4 w-4 mr-1.5" />
                {t("training.manageCategories")}
              </Button>
              {activeCategory && activeCategory.kind !== "sandbox" && activeCategory.kind !== "quiz" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setEditorOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t("training.newItem")}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* In-page category navigation (mirrors the sidebar submenu) */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/utbildning/${c.slug}`}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  activeCategory?.id === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-accent"
                )}
              >
                {pickLocalized(language, c.name, c.name_en, c.name_es)}
              </Link>
            ))}
          </div>
        )}

        {catLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState text={t("training.empty")} />
        ) : activeCategory?.kind === "sandbox" ? (
          <SandboxApp />
        ) : activeCategory?.kind === "quiz" ? (
          <QuizApp />
        ) : (
          <CategoryContent
            categoryId={activeCategory!.id}
            canEdit={canEdit}
            onEdit={(item) => {
              setEditingItem(item);
              setEditorOpen(true);
            }}
          />
        )}
      </div>

      {activeCategory && (
        <TrainingItemEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          categoryId={activeCategory.id}
          item={editingItem}
        />
      )}
      <TrainingCategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} />
    </AppLayout>
  );
}

function CategoryContent({
  categoryId,
  canEdit,
  onEdit,
}: {
  categoryId: string;
  canEdit: boolean;
  onEdit: (item: TrainingItem) => void;
}) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { items, isLoading, deleteItem } = useTrainingItems(categoryId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState text={t("training.categoryEmpty")} />;
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("training.deleteItemConfirm"))) return;
    try {
      await deleteItem.mutateAsync(id);
    } catch (e: any) {
      toast({
        title: t("common.error"),
        description: e?.message ?? t("common.unexpectedError"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const embed = item.video_url ? toEmbedUrl(item.video_url) : null;
        const title = pickLocalized(language, item.title, item.title_en, item.title_es);
        const body = pickLocalized(language, item.body, item.body_en, item.body_es);
        return (
          <article key={item.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{title}</h2>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {item.video_url &&
              (embed ? (
                <div className="aspect-video w-full max-w-2xl">
                  <iframe
                    src={embed}
                    title={title}
                    className="w-full h-full rounded-lg border border-border"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a
                  href={item.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {item.video_url}
                </a>
              ))}

            {body != null && <TrainingRichText content={body} readOnly key={language} />}
          </article>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-xl border border-dashed border-border bg-muted/30">
      <GraduationCap className="h-10 w-10 text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground max-w-md">{text}</p>
    </div>
  );
}
