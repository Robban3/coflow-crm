import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  X,
  Eye,
  Edit,
  Loader2,
  Mail,
  Clock,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMarket } from "@/hooks/useMarket";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";

interface EmailExecution {
  id: string;
  lead_sequence_id: string;
  step_id: string;
  status: string;
  scheduled_at: string | null;
  generated_subject: string | null;
  generated_body: string | null;
  created_at: string;
  step?: {
    step_order: number;
    email_prompt: string | null;
  };
  lead_sequence?: {
    sequence?: {
      name: string;
    };
    lead?: {
      company_name: string | null;
      email: string | null;
    };
  };
}

interface EmailApprovalCardProps {
  execution: EmailExecution;
  onApproved: () => void;
  onRejected: () => void;
}

export function EmailApprovalCard({ execution, onApproved, onRejected }: EmailApprovalCardProps) {
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const { market } = useMarket();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editedSubject, setEditedSubject] = useState(execution.generated_subject || "");
  const [editedBody, setEditedBody] = useState(execution.generated_body || "");

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("sequence_step_executions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          generated_subject: editedSubject,
          generated_body: editedBody,
        })
        .eq("id", execution.id);

      if (error) throw error;

      toast({
        title: t("outreach.approval.approvedTitle"),
        description: t("outreach.approval.approvedDesc"),
      });
      onApproved();
    } catch (error) {
      toast({
        title: t("outreach.common.error"),
        description: t("outreach.approval.approveError"),
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const { error } = await supabase
        .from("sequence_step_executions")
        .update({
          status: "skipped",
        })
        .eq("id", execution.id);

      if (error) throw error;

      toast({
        title: t("outreach.approval.rejectedTitle"),
        description: t("outreach.approval.rejectedDesc"),
      });
      onRejected();
    } catch (error) {
      toast({
        title: t("outreach.common.error"),
        description: t("outreach.approval.rejectError"),
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get lead and step info
      const { data: execData } = await supabase
        .from("sequence_step_executions")
        .select(`
          *,
          lead_sequence:lead_sequences(
            lead_id,
            sequence_id
          ),
          step:sequence_steps(
            step_order,
            email_prompt,
            sequence_id
          )
        `)
        .eq("id", execution.id)
        .single();

      if (!execData) throw new Error("Execution not found");

      // Get total steps
      const { count } = await supabase
        .from("sequence_steps")
        .select("*", { count: "exact", head: true })
        .eq("sequence_id", execData.step?.sequence_id);

      const response = await supabase.functions.invoke("generate-outreach-email", {
        body: {
          leadId: execData.lead_sequence?.lead_id,
          stepNumber: execData.step?.step_order || 1,
          totalSteps: count || 1,
          emailPrompt: execData.step?.email_prompt,
          userId: user?.id,
          market,
        },
      });

      if (response.error) throw new Error(response.error.message);

      // Update with new content
      await supabase
        .from("sequence_step_executions")
        .update({
          generated_subject: response.data.subject,
          generated_body: response.data.body,
        })
        .eq("id", execution.id);

      setEditedSubject(response.data.subject);
      setEditedBody(response.data.body);

      toast({
        title: t("outreach.approval.regeneratedTitle"),
        description: t("outreach.approval.regeneratedDesc"),
      });
    } catch (error) {
      toast({
        title: t("outreach.common.error"),
        description: error instanceof Error ? error.message : t("outreach.approval.regenerateError"),
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const leadName = execution.lead_sequence?.lead?.company_name || t("outreach.common.unknownCompany");
  const sequenceName = execution.lead_sequence?.sequence?.name || t("outreach.approval.unknownSequence");
  const stepNumber = execution.step?.step_order || 1;

  return (
    <>
      <Card className="border-primary/50 bg-primary/5 min-w-0 overflow-hidden">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <CardTitle className="text-sm sm:text-base truncate">{leadName}</CardTitle>
            </div>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[10px] sm:text-xs self-start sm:self-auto shrink-0">
              <Clock className="mr-1 h-3 w-3" />
              <span className="hidden sm:inline">{t("outreach.approval.pendingApproval")}</span>
              <span className="sm:hidden">{t("outreach.approval.pendingShort")}</span>
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {sequenceName} • {t("outreach.approval.stepLabel", { step: stepNumber })}
            {execution.scheduled_at && (
              <> • {format(new Date(execution.scheduled_at), "d MMM HH:mm", { locale: dateLocale })}</>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 overflow-hidden">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("outreach.common.subject")}</Label>
            <div className="p-3 rounded-lg bg-background border text-sm font-medium truncate">
              {editedSubject || execution.generated_subject || t("outreach.approval.noSubjectGenerated")}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("outreach.approval.preview")}</Label>
            <div className="p-3 rounded-lg bg-background border text-sm whitespace-pre-wrap break-words overflow-hidden line-clamp-4">
              {editedBody || execution.generated_body || t("outreach.approval.noBodyGenerated")}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <Button onClick={handleApprove} disabled={isApproving || isRejecting} size="sm" className="text-xs sm:text-sm">
              {isApproving ? (
                <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              )}
              <span className="hidden sm:inline">{t("outreach.approval.approveAndSend")}</span>
              <span className="sm:hidden">{t("outreach.approval.approve")}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="text-xs sm:text-sm">
              <Edit className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t("outreach.approval.edit")}</span>
              <span className="sm:hidden">{t("outreach.approval.change")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="text-xs sm:text-sm"
            >
              {isRegenerating ? (
                <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              )}
              <span className="hidden sm:inline">{t("outreach.approval.generateNew")}</span>
              <span className="sm:hidden">{t("outreach.approval.new")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReject}
              disabled={isRejecting || isApproving}
              className="text-destructive hover:text-destructive text-xs sm:text-sm"
            >
              {isRejecting ? (
                <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <X className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              )}
              <span className="hidden sm:inline">{t("outreach.approval.skip")}</span>
              <span className="sm:hidden">{t("outreach.approval.skipShort")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {t("outreach.approval.editDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("outreach.approval.editDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("outreach.common.subject")}</Label>
              <Input
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                placeholder={t("outreach.approval.subjectPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("outreach.common.message")}</Label>
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                placeholder={t("outreach.approval.bodyPlaceholder")}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t("outreach.common.cancel")}
            </Button>
            <Button onClick={() => {
              setShowEditDialog(false);
              toast({
                title: t("outreach.approval.changesSavedTitle"),
                description: t("outreach.approval.changesSavedDesc"),
              });
            }}>
              {t("outreach.approval.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
