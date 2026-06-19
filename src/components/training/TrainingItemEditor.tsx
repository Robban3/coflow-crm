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

export function TrainingItemEditor({ open, onOpenChange, categoryId, item }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { createItem, updateItem } = useTrainingItems(categoryId);

  const [title, setTitle] = useState(item?.title ?? "");
  const [videoUrl, setVideoUrl] = useState(item?.video_url ?? "");
  const [body, setBody] = useState<unknown>(item?.body ?? null);

  // The dialog stays mounted, so sync the form from the chosen item each time it
  // opens (or the item changes) — otherwise the initial useState values stick
  // and the editor shows up empty when editing an existing item.
  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? "");
      setVideoUrl(item?.video_url ?? "");
      setBody(item?.body ?? null);
    }
  }, [open, item]);

  const isEditing = !!item;
  const isSaving = createItem.isPending || updateItem.isPending;

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: t("training.editor.titleRequired"), variant: "destructive" });
      return;
    }
    try {
      const payload = { title: title.trim(), body, video_url: videoUrl.trim() || null };
      if (isEditing) {
        await updateItem.mutateAsync({ id: item!.id, ...payload });
      } else {
        await createItem.mutateAsync(payload);
      }
      toast({ title: t("training.editor.saved") });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("training.editor.editTitle") : t("training.editor.newTitle")}
          </DialogTitle>
          <DialogDescription>{t("training.editor.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="training-item-title">{t("training.editor.fieldTitle")}</Label>
            <Input
              id="training-item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("training.editor.titlePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="training-item-video">{t("training.editor.fieldVideo")}</Label>
            <Input
              id="training-item-video"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label>{t("training.editor.fieldBody")}</Label>
            <div className="rounded-md border border-input p-3">
              {/* Key by item so the editor remounts with the right initial
                  content; TipTap only reads `content` once at mount. */}
              <TrainingRichText
                key={`${item?.id ?? "new"}:${open}`}
                content={item?.body ?? null}
                onChange={setBody}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("training.editor.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
