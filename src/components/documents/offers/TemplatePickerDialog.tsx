import { useTranslation } from "@/i18n/LanguageProvider";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "../supabaseHelper";
import { type DocumentTemplate } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
  isLoading?: boolean;
}

export function TemplatePickerDialog({
  open,
  onOpenChange,
  onSelect,
  isLoading,
}: TemplatePickerDialogProps) {
  const { t } = useTranslation();
  const orgId = useOrganizationId();

  const { data: templates } = useQuery({
    queryKey: ["document_templates", orgId],
    queryFn: async () => {
      const { data, error } = await fromTable("document_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as DocumentTemplate[];
    },
    enabled: !!orgId && open,
  });

  const typeLabels: Record<string, string> = {
    offer: "Offert",
    contract: "Avtal",
    other: t("templates.list.typeOther"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("templates.picker.title")}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !templates?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t("templates.picker.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-2 max-h-80 overflow-y-auto">
            {templates.map((t) => (
              <Card
                key={t.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(t.id)}
              >
                <CardContent className="py-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[t.type] || t.type}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
