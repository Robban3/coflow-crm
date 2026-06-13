import { useState, useEffect } from "react";
import { Clock, Loader2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, ThumbsUp, RotateCcw, Trash2, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";

type EnrichmentStatus = "pending" | "processing" | "ready" | "failed" | "skipped";
type FilterKey = "all" | "processing" | "ready" | "skipped" | "failed";

interface QueueLead {
  id: string;
  company_name: string | null;
  website: string | null;
  prospecting_source: string | null;
  enrichment_status: string | null;
  enrichment_error: string | null;
  created_at: string;
  auto_draft_generated: boolean | null;
  business_summary: string | null;
  business_fit_score: number | null;
}

const STATUS_CONFIG: Record<EnrichmentStatus, { icon: React.ReactNode; className: string }> = {
  pending: { icon: <Clock className="h-4 w-4" />, className: "text-muted-foreground" },
  processing: { icon: <Loader2 className="h-4 w-4 animate-spin" />, className: "text-primary" },
  ready: { icon: <CheckCircle2 className="h-4 w-4" />, className: "text-primary" },
  failed: { icon: <AlertCircle className="h-4 w-4" />, className: "text-destructive" },
  skipped: { icon: <ThumbsUp className="h-4 w-4" />, className: "text-muted-foreground" },
};

const FILTER_KEYS: FilterKey[] = ["all", "processing", "ready", "skipped", "failed"];

function sourceLabel(source: string | null, t: (k: string) => string): string {
  switch (source) {
    case "google_places": return "Google Places";
    case "company_registry": return t("prospecting.q_source_companyRegistry");
    case "csv_import": return t("prospecting.q_source_csv");
    default: return source || t("prospecting.q_source_manual");
  }
}

export default function ProspectingQueueTab({ draftCount = 0, onGoToReview }: { draftCount?: number; onGoToReview?: () => void }) {
  const orgId = useOrganizationId();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const leadsQuery = useQuery({
    queryKey: ["prospecting-queue", orgId, user?.id],
    queryFn: async () => {
      if (!orgId) return [];
      let q = supabase
        .from("leads")
        .select("id, company_name, website, prospecting_source, enrichment_status, enrichment_error, created_at, auto_draft_generated, business_summary, business_fit_score, created_by")
        .eq("organization_id", orgId)
        .eq("imported_via_prospecting", true)
        .in("enrichment_status", ["pending", "processing", "failed", "skipped"])
        .order("created_at", { ascending: false });
      // Non-admin users only see their own leads
      if (!isAdmin && user?.id) {
        q = q.eq("created_by", user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as QueueLead[];
    },
    enabled: !!orgId,
    refetchInterval: autoRefresh ? 8000 : false,
  });

  // Realtime
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("prospecting-queue-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["prospecting-queue", orgId] });
          queryClient.invalidateQueries({ queryKey: ["prospecting-queue-count", orgId] });
          queryClient.invalidateQueries({ queryKey: ["prospecting-draft-count", orgId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  // Process queue mutation
  const processMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error(t("prospecting.noOrg"));
      const { data: currentUser } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("process-enrichment-queue", {
        body: { organization_id: orgId, user_id: currentUser.user?.id },
      });
      if (error) throw error;
      return data as { processed: number; remaining: number };
    },
    onSuccess: (data) => {
      toast.success(data.remaining > 0 ? t("prospecting.q_processedRemaining", { processed: data.processed, remaining: data.remaining }) : t("prospecting.q_processedOnly", { processed: data.processed }));
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue", orgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Retry single lead
  const retryMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { data: currentUser } = await supabase.auth.getUser();
      await supabase.from("leads").update({ enrichment_status: "pending", enrichment_error: null }).eq("id", leadId);
      const { data, error } = await supabase.functions.invoke("auto-enrich-lead", {
        body: { lead_id: leadId, user_id: currentUser.user?.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue", orgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Clear all queue (admin only) – hides leads from queue without deleting, preserves sent emails
  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Ingen organisation");
      // Get leads that have already been emailed
      const { data: sentLeads } = await supabase
        .from("sent_emails")
        .select("lead_id")
        .eq("status", "sent")
        .not("lead_id", "is", null);
      const sentLeadIds = new Set((sentLeads ?? []).map((s: any) => s.lead_id));

      const leadsToHide = allLeads.filter((l) => !sentLeadIds.has(l.id));
      if (leadsToHide.length === 0) {
        toast.info(t("prospecting.q_nothingToClear"));
        return;
      }
      const { error } = await supabase
        .from("leads")
        .update({ imported_via_prospecting: false })
        .in("id", leadsToHide.map((l) => l.id));
      if (error) throw error;
      toast.success(t("prospecting.q_leadsRemoved", { count: leadsToHide.length }));
    },
    onSuccess: () => {
      setShowClearConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue", orgId] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue-count", orgId] });
    },
    onError: (err: Error) => {
      setShowClearConfirm(false);
      toast.error(err.message);
    },
  });

  // Force re-enrich for skipped leads
  const forceEnrichMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await supabase.from("leads").update({
        enrichment_status: "pending",
        enrichment_error: null,
        detected_problems: [],
      }).eq("id", leadId);
      toast.info(t("prospecting.q_markedPending"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue", orgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const allLeads = leadsQuery.data ?? [];
  const pendingCount = allLeads.filter((l) => l.enrichment_status === "pending").length;
  const readyCount = draftCount;
  const skippedCount = allLeads.filter((l) => l.enrichment_status === "skipped").length;
  const failedCount = allLeads.filter((l) => l.enrichment_status === "failed").length;

  // Filter leads: default "all" hides skipped
  const filteredLeads = allLeads.filter((lead) => {
    const status = lead.enrichment_status || "pending";
    if (activeFilter === "all") return status !== "skipped";
    if (activeFilter === "processing") return status === "pending" || status === "processing";
    return status === activeFilter;
  });

  if (!leadsQuery.isLoading && allLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{t("prospecting.q_emptyTitle")}</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          {t("prospecting.q_emptyDesc")}
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 mt-4">
        {/* Summary counters */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">{t("prospecting.q_readyCount", { count: readyCount })}</span>
          <span>|</span>
          <span>{t("prospecting.q_goodSitesCount", { count: skippedCount })}</span>
          <span>|</span>
          <span>{t("prospecting.q_failedCount", { count: failedCount })}</span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_KEYS.map((fk) => (
            <Button
              key={fk}
              variant={activeFilter === fk ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveFilter(fk)}
            >
              {t(`prospecting.q_filter_${fk}`)}
              {fk === "skipped" && skippedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{skippedCount}</Badge>
              )}
              {fk === "failed" && failedCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{failedCount}</Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold">{t("prospecting.q_inProcessing")}</h3>
          <div className="flex items-center gap-3">
            {isAdmin && allLeads.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t("prospecting.q_clearQueue")}
              </Button>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <span>{t("prospecting.q_autoRefresh")}</span>
            </div>
            <Button
              size="sm"
              disabled={pendingCount === 0 || processMutation.isPending}
              onClick={() => processMutation.mutate()}
            >
              {processMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" />{t("prospecting.q_analyzing")}</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1" />{t("prospecting.q_analyzePending", { count: pendingCount })}</>
              )}
            </Button>
          </div>
        </div>

        {/* Draft ready notification */}
        {draftCount > 0 && onGoToReview && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {t("prospecting.q_draftsReadyNotice", { count: draftCount })}
                </span>
              </div>
              <Button size="sm" onClick={onGoToReview} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {t("prospecting.tabReview")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Lead list */}
        <div className="space-y-2">
          {filteredLeads.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("prospecting.q_noMatch")}
            </p>
          )}
          {filteredLeads.map((lead) => {
            const status = (lead.enrichment_status as EnrichmentStatus) || "pending";
            const cfg = STATUS_CONFIG[status];

            return (
              <Card key={lead.id} className="transition-all">
                <CardContent className="py-3 px-4 flex items-center gap-4 flex-wrap">
                  {/* Company info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{lead.company_name || t("prospecting.q_unknownCompany")}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {sourceLabel(lead.prospecting_source, t)}
                      </Badge>
                      {lead.business_fit_score != null && (
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${
                            lead.business_fit_score >= 7
                              ? "border-primary/30 text-primary"
                              : lead.business_fit_score >= 4
                              ? "border-amber-500/30 text-amber-600"
                              : "border-destructive/30 text-destructive"
                          }`}
                        >
                          {t("prospecting.q_fit", { score: lead.business_fit_score })}
                        </Badge>
                      )}
                    </div>
                    {lead.business_summary && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{lead.business_summary}</p>
                    )}
                    {lead.website && (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {lead.website.replace(/^https?:\/\//, "").replace(/\/+$/, "")}
                      </a>
                    )}
                  </div>

                  {/* Status */}
                  {status === "skipped" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center gap-1.5 text-sm shrink-0 ${cfg.className}`}>
                          {cfg.icon}
                          <span>{t(`prospecting.q_status_${status}`)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{lead.enrichment_error || t("prospecting.q_skippedTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className={`flex items-center gap-1.5 text-sm shrink-0 ${cfg.className}`}>
                      {cfg.icon}
                      <span>{t(`prospecting.q_status_${status}`)}</span>
                    </div>
                  )}

                  {/* Time */}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: dateLocale })}
                  </span>

                  {/* Actions for failed */}
                  {status === "failed" && (
                    <div className="flex items-center gap-2 shrink-0">
                      {lead.enrichment_error && (
                        <span className="text-xs text-destructive max-w-[150px] truncate" title={lead.enrichment_error}>
                          {lead.enrichment_error}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retryMutation.isPending}
                        onClick={() => retryMutation.mutate(lead.id)}
                      >
                        {retryMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          t("prospecting.q_retry")
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Actions for skipped */}
                  {status === "skipped" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={forceEnrichMutation.isPending}
                      onClick={() => forceEnrichMutation.mutate(lead.id)}
                    >
                      {forceEnrichMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <><RotateCcw className="h-3 w-3 mr-1" />{t("prospecting.q_addManually")}</>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Clear confirm dialog */}
        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("prospecting.q_clearConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("prospecting.q_clearConfirmBody")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clearQueueMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {clearQueueMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />{t("prospecting.rev_clearing")}</>
                ) : t("prospecting.q_yesClearQueue")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
