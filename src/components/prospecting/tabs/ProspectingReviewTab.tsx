import { useState, useEffect, useCallback, useRef } from "react";
import {
  Inbox, Send, ChevronDown, ChevronUp, RefreshCw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, ExternalLink, Mail, Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { useMarket } from "@/hooks/useMarket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

/* ---------- types ---------- */

type DraftStatus = "draft" | "approved" | "sent" | "failed" | "rejected";
type FilterKey = "draft" | "sent" | "failed" | "all";

interface DetectedProblem {
  key: string;
  label: string;
  value: string | null;
  weight: number;
}

interface ProspectingDraft {
  id: string;
  lead_id: string;
  subject: string;
  body: string;
  ai_summary: string | null;
  ai_confidence: number | null;
  status: DraftStatus;
  send_error: string | null;
  created_at: string;
  lead_company_name: string | null;
  lead_website: string | null;
  lead_email: string | null;
  lead_contact_name: string | null;
  lead_detected_problems: DetectedProblem[] | null;
  lead_business_summary: string | null;
  lead_business_fit_score: number | null;
}

/* ---------- helpers ---------- */

function fitBadge(score: number | null) {
  if (score == null) return null;
  if (score >= 7) return <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px] font-medium">{score}/10</Badge>;
  if (score >= 4) return <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[10px] font-medium">{score}/10</Badge>;
  return <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px] font-medium">{score}/10</Badge>;
}

function statusIcon(status: DraftStatus) {
  switch (status) {
    case "sent": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
    case "rejected": return <XCircle className="h-4 w-4 text-muted-foreground" />;
    default: return null;
  }
}

/* ---------- main component ---------- */

export default function ProspectingReviewTab() {
  const orgId = useOrganizationId();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const { market } = useMarket();
  const [filter, setFilter] = useState<FilterKey>("draft");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  /* ---- query ---- */
  const draftsQuery = useQuery({
    queryKey: ["prospecting-review", orgId, filter, user?.id],
    queryFn: async () => {
      if (!orgId) return [];

      let q = (supabase as any)
        .from("prospecting_drafts")
        .select("id, lead_id, subject, body, ai_summary, ai_confidence, status, send_error, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        q = q.eq("status", filter);
      }

      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) return [];

      // For non-admin users, filter drafts to only show their own leads
      let filteredData = data as any[];
      if (!isAdmin && user?.id) {
        const leadIds = [...new Set(filteredData.map((d: any) => d.lead_id))];
        const { data: userLeads } = await supabase
          .from("leads")
          .select("id")
          .in("id", leadIds)
          .eq("created_by", user.id);
        const userLeadIds = new Set((userLeads ?? []).map((l) => l.id));
        filteredData = filteredData.filter((d: any) => userLeadIds.has(d.lead_id));
        if (!filteredData.length) return [];
      }

      const leadIds = [...new Set(filteredData.map((d: any) => d.lead_id))];
      const { data: leads } = await supabase
        .from("leads")
        .select("id, company_name, website, email, contact_name, detected_problems, business_summary, business_fit_score")
        .in("id", leadIds);

      const leadMap = new Map((leads ?? []).map((l) => [l.id, l]));

      // Deduplicate: keep only latest draft per lead_id
      const seenLeads = new Map<string, any>();
      for (const d of filteredData) {
        const existing = seenLeads.get(d.lead_id);
        if (!existing || new Date(d.created_at) > new Date(existing.created_at)) {
          seenLeads.set(d.lead_id, d);
        }
      }
      // Also dedup by company name (different lead_ids, same company)
      const enrichedDedup = [...seenLeads.values()].map((d: any) => ({
        ...d,
        _companyName: leadMap.get(d.lead_id)?.company_name?.toLowerCase()?.trim() || d.lead_id,
      }));
      const seenNames = new Map<string, any>();
      for (const d of enrichedDedup) {
        const existing = seenNames.get(d._companyName);
        if (!existing || new Date(d.created_at) > new Date(existing.created_at)) {
          seenNames.set(d._companyName, d);
        }
      }
      const dedupedData = [...seenNames.values()];

      // Check which leads already received outreach – but only hide if the draft is OLDER than the last send
      const { data: sentLeads } = await supabase
        .from("sent_emails")
        .select("lead_id, created_at")
        .eq("status", "sent")
        .in("lead_id", leadIds)
        .not("lead_id", "is", null)
        .order("created_at", { ascending: false });
      // Build map: lead_id → latest sent_at
      const latestSentMap = new Map<string, string>();
      for (const s of (sentLeads ?? []) as any[]) {
        if (!latestSentMap.has(s.lead_id)) latestSentMap.set(s.lead_id, s.created_at);
      }

      return dedupedData
        .filter((d: any) => {
          // Hide drafts for leads that already received outreach, UNLESS the draft is newer (re-import)
          if (d.status === "draft" && latestSentMap.has(d.lead_id)) {
            const lastSent = new Date(latestSentMap.get(d.lead_id)!);
            const draftCreated = new Date(d.created_at);
            if (draftCreated <= lastSent) return false;
          }
          return true;
        })
        .map((d: any): ProspectingDraft => {
          const lead = leadMap.get(d.lead_id);
          return {
            ...d,
            lead_company_name: lead?.company_name ?? null,
            lead_website: lead?.website ?? null,
            lead_email: lead?.email ?? null,
            lead_contact_name: lead?.contact_name ?? null,
            lead_detected_problems: (lead?.detected_problems as unknown as DetectedProblem[] | null) ?? null,
            lead_business_summary: (lead as any)?.business_summary ?? null,
            lead_business_fit_score: (lead as any)?.business_fit_score ?? null,
          };
        });
    },
    enabled: !!orgId,
    refetchInterval: 15_000,
  });

  const drafts = draftsQuery.data ?? [];

  // Realtime
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("prospecting-review-rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "prospecting_drafts",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["prospecting-review", orgId] });
        queryClient.invalidateQueries({ queryKey: ["prospecting-draft-count", orgId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  /* ---- selection ---- */
  const draftItems = drafts.filter((d) => d.status === "draft");
  const sendableItems = draftItems.filter((d) => !!d.lead_email?.trim());
  const missingEmailCount = draftItems.filter((d) => !d.lead_email?.trim()).length;

  const allSendableSelected = sendableItems.length > 0 && sendableItems.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allSendableSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sendableItems.map((d) => d.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---- auto-save ---- */
  const saveDraft = useCallback(async (draftId: string, field: "subject" | "body", value: string) => {
    await (supabase as any)
      .from("prospecting_drafts")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", draftId);
  }, []);

  /* ---- reject ---- */
  const rejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from("prospecting_drafts")
        .update({ status: "rejected" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["prospecting-review"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-draft-count"] });
      toast.success(t("prospecting.rev_draftsRejected"));
    },
  });

  /* ---- regenerate ---- */
  const regenerateMutation = useMutation({
    mutationFn: async (draft: ProspectingDraft) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("generate-outreach-email", {
        body: { leadId: draft.lead_id, stepNumber: 1, totalSteps: 1, userId: userData.user?.id, market },
      });
      if (error) throw error;
      await (supabase as any)
        .from("prospecting_drafts")
        .update({ subject: data.subject, body: data.body_without_signature, updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospecting-review"] });
      toast.success(t("prospecting.rev_draftRegenerated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ---- clear all drafts (admin only) ---- */
  const clearDraftsMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error(t("prospecting.noOrg"));
      // Only reject drafts that haven't been sent
      const { error } = await (supabase as any)
        .from("prospecting_drafts")
        .update({ status: "rejected" })
        .eq("organization_id", orgId)
        .in("status", ["draft", "approved", "failed"]);
      if (error) throw error;
      // Also hide the leads from the queue
      const { data: nonSentLeads } = await (supabase as any)
        .from("prospecting_drafts")
        .select("lead_id")
        .eq("organization_id", orgId)
        .eq("status", "rejected");
      if (nonSentLeads?.length) {
        const { data: sentLeads } = await supabase
          .from("sent_emails")
          .select("lead_id")
          .eq("status", "sent")
          .not("lead_id", "is", null);
        const sentIds = new Set((sentLeads ?? []).map((s: any) => s.lead_id));
        const toHide = ([...new Set(nonSentLeads.map((d: any) => d.lead_id))] as string[]).filter((id) => !sentIds.has(id));
        if (toHide.length > 0) {
          await supabase
            .from("leads")
            .update({ imported_via_prospecting: false })
            .in("id", toHide);
        }
      }
    },
    onSuccess: () => {
      setShowClearConfirm(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["prospecting-review"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-draft-count"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue"] });
      toast.success(t("prospecting.rev_allCleared"));
    },
    onError: (err: Error) => {
      setShowClearConfirm(false);
      toast.error(err.message);
    },
  });

  /* ---- batch send ---- */
  const sendMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      setSendProgress({ current: 0, total: ids.length });
      const { data, error } = await supabase.functions.invoke("send-prospecting-batch", {
        body: { draftIds: ids },
      });
      if (error) throw error;
      return data as { sent: number; failed: number };
    },
    onSuccess: (data) => {
      setSendProgress(null);
      setSelectedIds(new Set());
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["prospecting-review"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-draft-count"] });
      if (data.failed > 0) {
        toast.error(t("prospecting.rev_sentFailed", { sent: data.sent, failed: data.failed }));
      } else {
        toast.success(t("prospecting.rev_sentOk", { sent: data.sent }));
      }
    },
    onError: (err: Error) => {
      setSendProgress(null);
      toast.error(err.message);
    },
  });

  /* ---- email save for lead ---- */
  const saveLeadEmail = useCallback(async (leadId: string, email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast.error(t("prospecting.rev_invalidEmail"));
      return;
    }
    const { error } = await supabase.from("leads").update({ email: trimmed }).eq("id", leadId);
    if (error) {
      toast.error(t("prospecting.rev_couldNotSaveEmail"));
    } else {
      toast.success(t("prospecting.rev_emailSaved"));
      queryClient.invalidateQueries({ queryKey: ["prospecting-review"] });
    }
  }, [queryClient]);

  /* ---- select strong leads ---- */
  const selectStrong = useCallback(() => {
    const strongIds = draftItems
      .filter((d) => (d.lead_business_fit_score ?? 0) >= 6 && !!d.lead_email?.trim())
      .map((d) => d.id);
    if (strongIds.length === 0) {
      toast.info(t("prospecting.rev_noStrong"));
      return;
    }
    setSelectedIds(new Set(strongIds));
    toast.success(t("prospecting.rev_strongSelected", { count: strongIds.length }));
  }, [draftItems]);

  /* ---- empty state ---- */
  if (!draftsQuery.isLoading && drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">{t("prospecting.rev_emptyTitle")}</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          {t("prospecting.rev_emptyDesc")}
        </p>
      </div>
    );
  }

  const selectedSendable = [...selectedIds].filter((id) => {
    const d = drafts.find((x) => x.id === id);
    return d && d.status === "draft" && !!d.lead_email?.trim();
  });
  const selectedCount = selectedSendable.length;

  return (
    <div className="space-y-4 mt-4">
      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([["draft", t("prospecting.rev_filterDraft")], ["sent", t("prospecting.rev_filterSent")], ["failed", t("prospecting.rev_filterFailed")], ["all", t("prospecting.rev_filterAll")]] as [FilterKey, string][]).map(
            ([key, label]) => (
              <Button
                key={key}
                variant={filter === key ? "secondary" : "ghost"}
                size="sm"
                className="text-xs"
                onClick={() => setFilter(key)}
              >
                {label}
                {key === "draft" && draftItems.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-bold">
                    {draftItems.length}
                  </span>
                )}
              </Button>
            )
          )}
        </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={selectStrong}
            >
              ⚡ {t("prospecting.rev_selectStrong")}
            </Button>
          {isAdmin && drafts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t("prospecting.rev_clearAll")}
            </Button>
          )}
          {draftsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Action bar – only when there are drafts */}
      {filter === "draft" && sendableItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSendableSelected}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              {t("prospecting.rev_readyCount", { count: sendableItems.length })}
              {missingEmailCount > 0 && (
                <span className="text-amber-600 ml-1">{t("prospecting.rev_missingEmailCount", { count: missingEmailCount })}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive text-xs"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(selectedSendable)}
              >
                {t("prospecting.rev_reject")}
              </Button>
            )}
            <Button
              size="sm"
              disabled={selectedCount === 0 || sendMutation.isPending}
              onClick={() => setShowConfirm(true)}
              className="gap-1.5"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("prospecting.rev_sending")}</>
              ) : (
                <><Send className="h-3.5 w-3.5" />{selectedCount > 0 ? t("prospecting.rev_sendCount", { count: selectedCount }) : t("prospecting.rev_send")}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Draft list */}
      <div className="space-y-2">
        {drafts.map((draft) => (
          <DraftRow
            key={draft.id}
            draft={draft}
            selected={selectedIds.has(draft.id)}
            expanded={expandedId === draft.id}
            onToggleSelect={() => toggleSelect(draft.id)}
            onToggleExpand={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
            onSave={saveDraft}
            onSaveEmail={saveLeadEmail}
            onReject={() => rejectMutation.mutate([draft.id])}
            onRegenerate={() => regenerateMutation.mutate(draft)}
            isRegenerating={regenerateMutation.isPending && regenerateMutation.variables?.id === draft.id}
          />
        ))}
      </div>

      {/* Confirm send dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("prospecting.rev_confirmSendTitle", { count: selectedCount })}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">{t("prospecting.rev_confirmSendBody")}</p>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  {selectedSendable.slice(0, 5).map((id) => {
                    const d = drafts.find((x) => x.id === id);
                    return <li key={id}>{d?.lead_company_name || t("prospecting.rev_unknownCompany")}</li>;
                  })}
                  {selectedCount > 5 && <li>{t("prospecting.rev_andMore", { count: selectedCount - 5 })}</li>}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => sendMutation.mutate(selectedSendable)}>
              Skicka
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all confirm dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("prospecting.rev_clearConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("prospecting.rev_clearConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearDraftsMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearDraftsMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />{t("prospecting.rev_clearing")}</>
              ) : t("prospecting.rev_yesClearAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- DraftRow – compact, clean ---------- */

interface DraftRowProps {
  draft: ProspectingDraft;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onSave: (id: string, field: "subject" | "body", value: string) => Promise<void>;
  onSaveEmail: (leadId: string, email: string) => Promise<void>;
  onReject: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

function DraftRow({
  draft, selected, expanded, onToggleSelect, onToggleExpand, onSave, onSaveEmail, onReject, onRegenerate, isRegenerating,
}: DraftRowProps) {
  const { t } = useTranslation();
  const [localSubject, setLocalSubject] = useState(draft.subject);
  const [localBody, setLocalBody] = useState(draft.body);
  const [localEmail, setLocalEmail] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const hasEmail = !!draft.lead_email?.trim();
  const isFinal = draft.status === "sent" || draft.status === "failed" || draft.status === "rejected";
  const canSelect = draft.status === "draft" && hasEmail;

  useEffect(() => { setLocalSubject(draft.subject); }, [draft.subject]);
  useEffect(() => { setLocalBody(draft.body); }, [draft.body]);

  const debouncedSave = useCallback(
    (field: "subject" | "body", value: string) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => onSave(draft.id, field, value), 500);
    },
    [draft.id, onSave]
  );

  return (
    <div className={`rounded-lg border transition-all ${isFinal ? "opacity-50" : ""} ${selected ? "border-primary/50 bg-primary/5" : "border-border"}`}>
      {/* Missing email banner */}
      {!hasEmail && !isFinal && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center gap-2 text-amber-700 text-xs rounded-t-lg">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          {t("prospecting.rev_missingEmail")}
          <div className="flex-1" />
          <Input
            type="email"
            placeholder={t("prospecting.rev_emailPlaceholder")}
            value={localEmail}
            onChange={(e) => setLocalEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && localEmail.trim()) onSaveEmail(draft.lead_id, localEmail); }}
            className="h-6 text-xs w-48 bg-background"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            disabled={!localEmail.trim()}
            onClick={() => onSaveEmail(draft.lead_id, localEmail)}
          >
            {t("prospecting.rev_save")}
          </Button>
        </div>
      )}

      {/* Compact header row */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggleExpand}
      >
        {canSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect()}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {statusIcon(draft.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{draft.lead_company_name || t("prospecting.rev_unknownCompany")}</span>
            {fitBadge(draft.lead_business_fit_score)}
            {draft.lead_website && (
              <a
                href={draft.lead_website.startsWith("http") ? draft.lead_website : `https://${draft.lead_website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{draft.subject}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3">
          {/* Business context */}
          {draft.lead_business_summary && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
              {draft.lead_business_summary}
            </p>
          )}

          {/* Email editor */}
          <div className="space-y-2">
            <Input
              value={localSubject}
              onChange={(e) => {
                setLocalSubject(e.target.value);
                debouncedSave("subject", e.target.value);
              }}
              disabled={isFinal}
              className="text-sm font-medium h-9"
              placeholder={t("prospecting.rev_subjectPlaceholder")}
            />
            <Textarea
              value={localBody}
              onChange={(e) => {
                setLocalBody(e.target.value);
                debouncedSave("body", e.target.value);
              }}
              disabled={isFinal}
              className="text-sm min-h-[140px] resize-y leading-relaxed"
            />
            {!isFinal && (
              <p className="text-[10px] text-muted-foreground">{t("prospecting.rev_autoSaveHint")}</p>
            )}
            {draft.status === "failed" && draft.send_error && (
              <p className="text-xs text-destructive">{draft.send_error}</p>
            )}
          </div>

          {/* Actions */}
          {!isFinal && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                disabled={isRegenerating}
                onClick={onRegenerate}
              >
                {isRegenerating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("prospecting.rev_generating")}</>
                ) : (
                  <><RefreshCw className="h-3.5 w-3.5" />{t("prospecting.rev_regenerate")}</>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive"
                onClick={onReject}
              >
                {t("prospecting.rev_reject")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
