import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import {
  PhoneMissed,
  CalendarClock,
  XCircle,
  MessageSquare,
  CalendarCheck,
  PhoneOff,
  Loader2,
  Phone,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "phone-missed": PhoneMissed,
  "calendar-clock": CalendarClock,
  "x-circle": XCircle,
  "message-square": MessageSquare,
  "calendar-check": CalendarCheck,
  "phone-off": PhoneOff,
};

const COLOR_MAP: Record<string, string> = {
  slate: "border-muted-foreground/40 bg-muted/50 hover:bg-muted text-foreground",
  amber: "border-amber-400/60 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:text-amber-200",
  green: "border-green-400/60 bg-green-50 hover:bg-green-100 text-green-900 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:text-green-200",
  red: "border-red-400/60 bg-red-50 hover:bg-red-100 text-red-900 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-200",
};

const SELECTED_COLOR_MAP: Record<string, string> = {
  slate: "border-muted-foreground bg-muted ring-2 ring-muted-foreground/30",
  amber: "border-amber-500 bg-amber-100 ring-2 ring-amber-400/40 dark:bg-amber-950/60",
  green: "border-green-500 bg-green-100 ring-2 ring-green-400/40 dark:bg-green-950/60",
  red: "border-red-500 bg-red-100 ring-2 ring-red-400/40 dark:bg-red-950/60",
};

interface CallOutcome {
  id: string;
  key: string;
  label: string;
  category: string;
  requires_note: boolean;
  requires_task: boolean;
  lead_status_effect: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

// Fallback outcomes used when an organization has no call_outcomes rows yet
// (default outcomes were only seeded for orgs that existed at the seed
// migration; newer orgs would otherwise see an empty outcome picker). Mirrors
// the seed in 20260217143010. call_logs stores outcome_key/label as text, so
// these save correctly even without a matching DB row.
const DEFAULT_OUTCOMES: CallOutcome[] = [
  { id: "no_answer", key: "no_answer", label: "Ej svar", category: "neutral", requires_note: false, requires_task: false, lead_status_effect: null, icon: "phone-missed", color: "slate", sort_order: 1 },
  { id: "callback", key: "callback", label: "Återkoppling", category: "neutral", requires_note: false, requires_task: true, lead_status_effect: null, icon: "calendar-clock", color: "amber", sort_order: 2 },
  { id: "answered", key: "answered", label: "Svar", category: "positive", requires_note: true, requires_task: false, lead_status_effect: null, icon: "message-square", color: "green", sort_order: 3 },
  { id: "not_interested", key: "not_interested", label: "Ej intresserad", category: "negative", requires_note: true, requires_task: false, lead_status_effect: "not_interested", icon: "x-circle", color: "red", sort_order: 4 },
  { id: "booked", key: "booked", label: "Bokad", category: "positive", requires_note: true, requires_task: false, lead_status_effect: null, icon: "calendar-check", color: "green", sort_order: 5 },
  { id: "wrong_number", key: "wrong_number", label: "Nummer fel", category: "negative", requires_note: true, requires_task: false, lead_status_effect: "invalid_phone", icon: "phone-off", color: "red", sort_order: 6 },
];

interface LogCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName?: string | null;
  leadPhone?: string | null;
  onSaved?: () => void;
}

export function LogCallDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
  onSaved,
}: LogCallDialogProps) {
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("09:00");
  const [callbackNote, setCallbackNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedOutcome(null);
      setNote("");
      setCallbackDate("");
      setCallbackTime("09:00");
      setCallbackNote("");
    }
  }, [open]);

  const { data: outcomes = [] } = useQuery<CallOutcome[]>({
    queryKey: ["call-outcomes", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("call_outcomes")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as CallOutcome[];
    },
    enabled: !!organizationId && open,
  });

  const canSave = selectedOutcome && (
    (!selectedOutcome.requires_note || note.trim().length > 0) &&
    (!selectedOutcome.requires_task || callbackDate)
  );

  const handleSave = async () => {
    if (!selectedOutcome || !organizationId || !canSave) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let callbackTaskId: string | null = null;

      // Create callback task if required
      if (selectedOutcome.requires_task && callbackDate) {
        const dueDate = new Date(`${callbackDate}T${callbackTime}:00`);
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            lead_id: leadId,
            title: t("leadDetail.lc_callbackTaskTitle", { name: leadName || t("leadDetail.lc_leadFallback") }),
            description: callbackNote || null,
            priority: "medium",
            due_date: dueDate.toISOString(),
            status: "todo",
            assigned_to: user.id,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (taskError) throw taskError;
        callbackTaskId = task.id;
      }

      // Create call log
      const { error: callError } = await supabase
        .from("call_logs")
        .insert({
          organization_id: organizationId,
          lead_id: leadId,
          outcome_key: selectedOutcome.key,
          outcome_label: selectedOutcome.label,
          note: note || null,
          callback_task_id: callbackTaskId,
          created_by: user.id,
        });

      if (callError) throw callError;

      // Update lead status if needed
      if (selectedOutcome.lead_status_effect) {
        const updateData: Record<string, unknown> = {
          lead_status: selectedOutcome.lead_status_effect,
        };
        if (selectedOutcome.lead_status_effect === "not_interested") {
          updateData.not_interested_at = new Date().toISOString();
          updateData.not_interested_reason = note || null;
        }
        await supabase.from("leads").update(updateData).eq("id", leadId);
      }

      // Logging a call claims the lead for the caller — but only if it is
      // currently unassigned, so it never takes a lead someone else owns.
      await supabase
        .from("leads")
        .update({ assigned_to: user.id })
        .eq("id", leadId)
        .is("assigned_to", null);

      toast({
        title: t("leadDetail.lc_savedTitle"),
        description: `${selectedOutcome.label}${callbackTaskId ? t("leadDetail.lc_followUpCreated") : ""}`,
      });

      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error("Error saving call:", error);
      toast({
        title: t("leadDetail.ac_toastErrorTitle"),
        description: t("leadDetail.lc_couldNotSave"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />{t("leadDetail.lc_dialogTitle")}</DialogTitle>
          <DialogDescription>
            {leadName && <span className="font-medium text-foreground">{leadName}</span>}
            {leadPhone && <span className="ml-2 text-muted-foreground">• {leadPhone}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Outcome picker grid */}
          <div>
            <Label className="text-sm mb-2 block">{t("leadDetail.lc_outcomeLabel")}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(outcomes.length > 0 ? outcomes : DEFAULT_OUTCOMES).map((outcome) => {
                const Icon = ICON_MAP[outcome.icon || ""] || Phone;
                const isSelected = selectedOutcome?.key === outcome.key;
                const baseColor = COLOR_MAP[outcome.color || "slate"] || COLOR_MAP.slate;
                const selectedColor = SELECTED_COLOR_MAP[outcome.color || "slate"] || SELECTED_COLOR_MAP.slate;

                return (
                  <button
                    key={outcome.id}
                    onClick={() => setSelectedOutcome(outcome)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all",
                      isSelected ? selectedColor : baseColor,
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {outcome.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note field (shown when requires_note or always for some outcomes) */}
          {selectedOutcome && (selectedOutcome.requires_note || selectedOutcome.key === "callback") && (
            <div className="space-y-2 animate-in fade-in-50 duration-200">
              <Label>
                Notering {selectedOutcome.requires_note && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  selectedOutcome.key === "not_interested"
                    ? t("leadDetail.lc_notePlaceholderNotInterested")
                    : selectedOutcome.key === "answered"
                    ? t("leadDetail.lcd_summaryPlaceholder")
                    : t("leadDetail.lc_notePlaceholderDefault")
                }
                rows={3}
              />
            </div>
          )}

          {/* Callback scheduler */}
          {selectedOutcome?.requires_task && (
            <div className="space-y-3 p-3 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 animate-in fade-in-50 duration-200">
              <Label className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <CalendarClock className="h-4 w-4" />{t("leadDetail.lc_scheduleFollowUp")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("leadDetail.lc_dateLabel")}</Label>
                  <Input
                    type="date"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("leadDetail.lc_timeLabel")}</Label>
                  <Input
                    type="time"
                    value={callbackTime}
                    onChange={(e) => setCallbackTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("leadDetail.lc_extraNoteLabel")}</Label>
                <Input
                  value={callbackNote}
                  onChange={(e) => setCallbackNote(e.target.value)}
                  placeholder={t("leadDetail.lc_extraNotePlaceholder")}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("leadDetail.ef_cancel")}</Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("leadDetail.lc_saving")}</>
            ) : (
              "Spara"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
