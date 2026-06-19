import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { TrainingRichText } from "./TrainingRichText";
import { useTrainingItems, type TrainingItem } from "@/hooks/useTrainingItems";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  /** When set, edit this item; otherwise create a new one. */
  item?: TrainingItem | null;
}

/**
 * The dialog stays mounted, so the form lives in an inner component that is only
 * rendered while open and keyed by item id. That way its useState initializers
 * read the chosen item's values directly (no stale-empty fields), and switching
 * items remounts it cleanly.
 */
export function TrainingItemEditor({ open, onOpenChange, categoryId, item }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && (
          <EditorForm
            key={item?.id ?? "new"}
            item={item}
            categoryId={categoryId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorForm({
  item,
  categoryId,
  onClose,
}: {
  item?: TrainingItem | null;
  categoryId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { createItem, updateItem } = useTrainingItems(categoryId);

  const [videoUrl, setVideoUrl] = useState(item?.video_url ?? "");
  const [titleSv, setTitleSv] = useState(item?.title ?? "");
  const [titleEn, setTitleEn] = useState(item?.title_en ?? "");
  const [titleEs, setTitleEs] = useState(item?.title_es ?? "");
  const [bodySv, setBodySv] = useState<unknown>(item?.body ?? null);
  const [bodyEn, setBodyEn] = useState<unknown>(item?.body_en ?? null);
  const [bodyEs, setBodyEs] = useState<unknown>(item?.body_es ?? null);

  const isEditing = !!item;
  const isSaving = createItem.isPending || updateItem.isPending;

  // Swedish is the base language; en/es fall back to it when left empty.
  const langs = [
    { code: "sv", label: "Svenska", title: titleSv, setTitle: setTitleSv, body: bodySv, setBody: setBodySv },
    { code: "en", label: "English", title: titleEn, setTitle: setTitleEn, body: bodyEn, setBody: setBodyEn },
    { code: "es", label: "Español", title: titleEs, setTitle: setTitleEs, body: bodyEs, setBody: setBodyEs },
  ] as const;

  const handleSave = async () => {
    if (!titleSv.trim()) {
      toast({ title: t("training.editor.titleRequired"), variant: "destructive" });
      return;
    }
    try {
      const payload = {
        title: titleSv.trim(),
        title_en: titleEn.trim() || null,
        title_es: titleEs.trim() || null,
        body: bodySv,
        body_en: bodyEn,
        body_es: bodyEs,
        video_url: videoUrl.trim() || null,
      };
      if (isEditing) {
        await updateItem.mutateAsync({ id: item!.id, ...payload });
      } else {
        await createItem.mutateAsync(payload);
      }
      toast({ title: t("training.editor.saved") });
      onClose();
    } catch (e: any) {
      toast({
        title: t("common.error"),
        description: e?.message ?? t("common.unexpectedError"),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? t("training.editor.editTitle") : t("training.editor.newTitle")}
        </DialogTitle>
        <DialogDescription>{t("training.editor.description")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="training-item-video">{t("training.editor.fieldVideo")}</Label>
          <Input
            id="training-item-video"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/..."
          />
        </div>

        <Tabs defaultValue="sv">
          <TabsList className="grid w-full grid-cols-3">
            {langs.map((l) => (
              <TabsTrigger key={l.code} value={l.code}>
                {l.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {langs.map((l) => (
            <TabsContent key={l.code} value={l.code} className="space-y-4 mt-4">
              {l.code !== "sv" && (
                <p className="text-xs text-muted-foreground">
                  {t("training.editor.fallbackHint")}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor={`training-item-title-${l.code}`}>
                  {t("training.editor.fieldTitle")}
                </Label>
                <Input
                  id={`training-item-title-${l.code}`}
                  value={l.title}
                  onChange={(e) => l.setTitle(e.target.value)}
                  placeholder={t("training.editor.titlePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("training.editor.fieldBody")}</Label>
                <div className="rounded-md border border-input p-3">
                  {/* Keyed per language; content comes from state so edits
                      survive switching tabs (Radix remounts inactive tabs). */}
                  <TrainingRichText key={l.code} content={l.body} onChange={l.setBody} />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("training.editor.save")}
        </Button>
      </DialogFooter>
    </>
  );
}
