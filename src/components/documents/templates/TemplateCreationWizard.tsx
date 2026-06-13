import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { fromTable } from "../supabaseHelper";
import { getBlocksForStructure } from "../template-starters";
import { type DocumentTemplate } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, ScrollText, File, LayoutTemplate, Minus, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DocType = "offer" | "contract" | "other";
type Structure = "standard" | "simple" | "detailed";

export function TemplateCreationWizard({ open, onOpenChange }: Props) {
  const { t } = useTranslation();

  const DOC_TYPES: { value: DocType; label: string; description: string; icon: React.ReactNode }[] = [
    { value: "offer", label: t("templates.docType.offer"), description: t("templates.docType.offerDesc"), icon: <FileText className="h-5 w-5" /> },
    { value: "contract", label: t("templates.docType.contract"), description: t("templates.docType.contractDesc"), icon: <ScrollText className="h-5 w-5" /> },
    { value: "other", label: t("templates.docType.other"), description: t("templates.docType.otherDesc"), icon: <File className="h-5 w-5" /> },
  ];

  const STRUCTURES: { value: Structure; label: string; description: string; icon: React.ReactNode; recommended?: boolean }[] = [
    { value: "standard", label: t("templates.structure.standard"), description: t("templates.structure.standardDesc"), icon: <LayoutTemplate className="h-5 w-5" />, recommended: true },
    { value: "simple", label: t("templates.structure.simple"), description: t("templates.structure.simpleDesc"), icon: <Minus className="h-5 w-5" /> },
    { value: "detailed", label: t("templates.structure.detailed"), description: t("templates.structure.detailedDesc"), icon: <ListChecks className="h-5 w-5" /> },
  ];

  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = useOrganizationId();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<DocType>("offer");
  const [structure, setStructure] = useState<Structure>("standard");
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a1a2e");
  const [footerText, setFooterText] = useState("");

  const reset = () => {
    setStep(1);
    setDocType("offer");
    setStructure("standard");
    setName("");
    setLogoUrl("");
    setPrimaryColor("#1a1a2e");
    setFooterText("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const templateName = name.trim() || `${DOC_TYPES.find((d) => d.value === docType)?.label || t("templates.wizard.fallbackDocName")} – ${STRUCTURES.find((s) => s.value === structure)?.label || ""}`;

      const brandSettings: Record<string, any> = {};
      if (logoUrl) brandSettings.logo_url = logoUrl;
      if (primaryColor) brandSettings.primary_color = primaryColor;
      if (footerText) brandSettings.footer_text = footerText;

      const { data, error } = await fromTable("document_templates")
        .insert({
          name: templateName,
          type: docType,
          description: `Skapad med guiden (${structure})`,
          organization_id: orgId!,
          created_by: user?.id,
          brand_settings: brandSettings,
        })
        .select()
        .single();
      if (error) throw error;
      const tpl = data as DocumentTemplate;

      const blocks = getBlocksForStructure(docType, structure);

      await fromTable("template_versions").insert({
        template_id: tpl.id,
        version: 1,
        blocks_json: blocks,
        created_by: user?.id,
      });

      return tpl;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      onOpenChange(false);
      reset();
      navigate(`/settings/templates/${data.id}`);
      toast.success(t("templates.wizard.createdTitle"));
    },
    onError: () => toast.error(t("templates.wizard.createError")),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("templates.wizard.title")}
            <span className="text-xs text-muted-foreground ml-2">{t("templates.wizard.stepOf", { step })}</span>
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("templates.wizard.step1Question")}</p>
            <div className="grid gap-2">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => setDocType(dt.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    docType === dt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className={docType === dt.value ? "text-primary" : "text-muted-foreground"}>
                    {dt.icon}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{dt.label}</p>
                    <p className="text-xs text-muted-foreground">{dt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("templates.wizard.step2Question")}</p>
            <div className="grid gap-2">
              {STRUCTURES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStructure(s.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    structure === s.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className={structure === s.value ? "text-primary" : "text-muted-foreground"}>
                    {s.icon}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm flex items-center gap-2">
                      {s.label}
                      {s.recommended && (
                        <Badge variant="secondary" className="text-[10px]">{t("templates.structure.recommended")}</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("templates.wizard.step3Question")}</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t("templates.wizard.nameLabel")}</Label>
                <Input
                  placeholder={`${DOC_TYPES.find((d) => d.value === docType)?.label} – ${STRUCTURES.find((s) => s.value === structure)?.label}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">{t("templates.wizard.logoLabel")}</Label>
                <Input
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t("templates.wizard.primaryColorLabel")}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t("templates.wizard.footerLabel")}</Label>
                  <Input
                    placeholder={t("templates.wizard.footerPlaceholder")}
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                {t("templates.wizard.back")}
              </Button>
            )}
          </div>
          <div>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)}>{t("templates.wizard.next")}</Button>
            ) : (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {t("templates.wizard.create")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
