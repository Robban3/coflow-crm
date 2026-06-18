import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check, Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useTrainingCategories } from "@/hooks/useTrainingCategories";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrainingCategoryManager({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { categories, createCategory, updateCategory, deleteCategory } =
    useTrainingCategories();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const onError = (e: any) =>
    toast({
      title: t("common.error"),
      description: e?.message ?? t("common.unexpectedError"),
      variant: "destructive",
    });

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createCategory.mutateAsync(newName.trim());
      setNewName("");
    } catch (e) {
      onError(e);
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updateCategory.mutateAsync({ id, name: editingName.trim() });
      setEditingId(null);
    } catch (e) {
      onError(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("training.categories.deleteConfirm"))) return;
    try {
      await deleteCategory.mutateAsync(id);
    } catch (e) {
      onError(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("training.categories.title")}</DialogTitle>
          <DialogDescription>{t("training.categories.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              {editingId === c.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(c.id)}
                    autoFocus
                    className="h-9"
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => handleRename(c.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate">{c.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditingName(c.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-destructive"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={t("training.categories.newPlaceholder")}
            className="h-9"
          />
          <Button onClick={handleAdd} disabled={createCategory.isPending || !newName.trim()}>
            {createCategory.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
