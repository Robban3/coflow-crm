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
import { sv } from "date-fns/locale";

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

const STATUS_CONFIG: Record<EnrichmentStatus, { icon: React.ReactNode; label: string; className: string }> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    label: "Väntar",
    className: "text-muted-foreground",
  },
  processing: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: "Analyserar...",
    className: "text-primary",
  },
  ready: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Klar – utkast genererat",
    className: "text-primary",
  },
  failed: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Misslyckades",
    className: "text-destructive",
  },
  skipped: {
    icon: <ThumbsUp className="h-4 w-4" />,
    label: "Bra sida – ingen åtgärd",
    className: "text-muted-foreground",
  },
};

const FILTER_BUTTONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Alla" },
  { key: "processing", label: "Analyseras" },
  { key: "ready", label: "Redo" },
  { key: "skipped", label: "Bra sidor" },
  { key: "failed", label: "Misslyckades" },
];

function sourceLabel(source: string | null): string {
  switch (source) {
    case "google_places": return "Google Places";
    case "company_registry": return "Bolagsregister";
    case "csv_import": return "CSV-import";
    default: return source || "Manuell";
  }
}

export default function ProspectingQueueTab({ draftCount = 0, onGoToReview }: { draftCount?: number; onGoToReview?: () => void }) {
  const orgId = useOrganizationId();
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
      if (!orgId) throw new Error("Ingen organisation");
      const { data: currentUser } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("process-enrichment-queue", {
        body: { organization_id: orgId, user_id: currentUser.user?.id },
      });
      if (error) throw error;
      return data as { processed: number; remaining: number };
    },
    onSuccess: (data) => {
      toast.success(`${data.processed} leads analyserade${data.remaining > 0 ? `, ${data.remaining} kvar` : ""}`);
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
        toast.info("Inga leads att rensa (alla har redan fått utskick)");
        return;
      }
      const { error } = await supabase
        .from("leads")
        .update({ imported_via_prospecting: false })
        .in("id", leadsToHide.map((l) => l.id));
      if (error) throw error;
      toast.success(`${leadsToHide.length} leads borttagna från kön`);
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
      toast.info("Lead markerad som väntande – kommer analyseras igen");
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
        <h3 className="text-lg font-semibold mb-1">Inga leads under bearbetning</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Importera leads från fliken Hämta leads för att komma igång
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 mt-4">
        {/* Summary counters */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">{readyCount} redo</span>
          <span>|</span>
          <span>{skippedCount} bra sidor (ej kontaktade)</span>
          <span>|</span>
          <span>{failedCount} misslyckades</span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_BUTTONS.map((f) => (
            <Button
              key={f.key}
              variant={activeFilter === f.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
              {f.key === "skipped" && skippedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{skippedCount}</Badge>
              )}
              {f.key === "failed" && failedCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{failedCount}</Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold">Leads under bearbetning</h3>
          <div className="flex items-center gap-3">
            {isAdmin && allLeads.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Rensa kö
              </Button>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <span>Uppdatera automatiskt</span>
            </div>
            <Button
              size="sm"
              disabled={pendingCount === 0 || processMutation.isPending}
              onClick={() => processMutation.mutate()}
            >
              {processMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" />Analyserar…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1" />Analysera väntande ({pendingCount} leads)</>
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
                  {draftCount} utkast redo att granska och skicka
                </span>
              </div>
              <Button size="sm" onClick={onGoToReview} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Granska & Skicka
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Lead list */}
        <div className="space-y-2">
          {filteredLeads.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Inga leads matchar filtret
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
                      <span className="font-semibold text-sm truncate">{lead.company_name || "Okänt företag"}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {sourceLabel(lead.prospecting_source)}
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
                          Fit: {lead.business_fit_score}/10
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
                          <span>{cfg.label}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{lead.enrichment_error || "Inga säljbara problem hittades – bra sida"}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className={`flex items-center gap-1.5 text-sm shrink-0 ${cfg.className}`}>
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </div>
                  )}

                  {/* Time */}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: sv })}
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
                          "Försök igen"
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
                        <><RotateCcw className="h-3 w-3 mr-1" />Lägg till manuellt</>
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
              <AlertDialogTitle>Rensa hela kön?</AlertDialogTitle>
              <AlertDialogDescription>
                Detta tar bort alla leads från kö-vyn. Leads som redan fått utskick bevaras.
                Leadsen raderas inte från databasen utan döljs bara från prospekteringskön.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clearQueueMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {clearQueueMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Rensar…</>
                ) : "Ja, rensa kön"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
