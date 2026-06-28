import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  GripVertical,
  ArrowRight,
  Users,
  Calendar,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { WonDealDialog } from "@/components/deals/WonDealDialog";
import { useTranslation } from "@/i18n/LanguageProvider";
import { batchIn } from "@/lib/batchIn";

const PIPELINE_STAGES = [
  { key: "active", color: "bg-blue-500" },
  { key: "callback", color: "bg-indigo-500" },
  { key: "meeting_booked", color: "bg-violet-500" },
  { key: "offer_sent", color: "bg-amber-500" },
  { key: "won", color: "bg-emerald-500" },
  { key: "lost", color: "bg-destructive" },
] as const;

type StageKey = typeof PIPELINE_STAGES[number]["key"];

interface PipelineLead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  lead_status: string;
  created_at: string;
  last_call_at: string | null;
  last_call_outcome_key: string | null;
}

export default function PipelinePage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [wonDeal, setWonDeal] = useState<
    | { leadId: string; prefill: { company_name?: string | null; contact_name?: string | null; email?: string | null; phone?: string | null } }
    | null
  >(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["pipeline-leads", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, company_name, contact_name, email, phone, website, lead_status, created_at, last_call_at, last_call_outcome_key")
        .not("is_not_interested", "eq", true)
        .eq("is_test", false) // demo/test leads never appear in the pipeline
        .order("created_at", { ascending: false });

      if (!isAdmin && user?.id) {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as PipelineLead[];
      if (rows.length === 0) return rows;

      // The pipeline only shows worked leads: those with logged activity
      // (call/email/meeting/sequence) OR an advanced status. Untouched new
      // 'active' leads stay on the leads page until they're worked.
      const ids = rows.map((r) => r.id);
      const [calls, emails, meetings, seqs] = await Promise.all([
        batchIn((qIds) => supabase.from("call_logs").select("lead_id").in("lead_id", qIds), ids),
        batchIn((qIds) => supabase.from("sent_emails").select("lead_id").in("lead_id", qIds), ids),
        batchIn((qIds) => supabase.from("meetings").select("lead_id").in("lead_id", qIds), ids),
        batchIn((qIds) => supabase.from("lead_sequences").select("lead_id").in("lead_id", qIds), ids),
      ]);
      const activity = new Set<string>();
      [calls, emails, meetings, seqs].forEach((list) =>
        (list as Array<{ lead_id: string | null }>).forEach((r) => {
          if (r.lead_id) activity.add(r.lead_id);
        })
      );
      return rows.filter(
        (l) =>
          l.lead_status !== "active" ||
          l.last_call_outcome_key != null ||
          activity.has(l.id)
      );
    },
    enabled: !!user?.id,
    refetchOnMount: "always",
  });

  // Live updates: refetch whenever a lead changes (status moves, callbacks,
  // assignments) so cards land in the right column without a page reload.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("pipeline-leads-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const updateLead = useMutation({
    mutationFn: async ({ leadId, patch }: { leadId: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("leads")
        .update(patch)
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
      toast.success(t("pipeline.moved"));
    },
    onError: () => {
      toast.error(t("pipeline.moveError"));
    },
  });

  // The "Återkopplingar" column auto-collects leads whose latest call outcome is
  // a callback. Such leads live ONLY there until the next call is logged (which
  // overwrites last_call_outcome_key) or they're dragged to another stage.
  const getLeadsForStage = (stageKey: string) => {
    if (stageKey === "callback") {
      return leads.filter((l) => l.last_call_outcome_key === "callback");
    }
    return leads.filter(
      (l) => l.last_call_outcome_key !== "callback" && l.lead_status === stageKey
    );
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId);
    setDraggingId(leadId);
  };

  const handleDragEnd = () => setDraggingId(null);

  const handleDrop = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        if (stageKey === "callback") {
          if (lead.last_call_outcome_key !== "callback") {
            updateLead.mutate({ leadId, patch: { last_call_outcome_key: "callback" } });
          }
        } else if (lead.lead_status !== stageKey || lead.last_call_outcome_key === "callback") {
          // Move to a real stage and clear the pending-callback marker.
          updateLead.mutate({ leadId, patch: { lead_status: stageKey, last_call_outcome_key: null } });
          if (stageKey === "won" && lead.lead_status !== "won") {
            // Notify org admins of the won deal (best-effort).
            supabase.functions
              .invoke("notify-deal-won", { body: { leadId, sellerId: user?.id, event: "won" } })
              .catch(() => {});
            // Open the onboarding handoff form for the seller.
            setWonDeal({
              leadId,
              prefill: {
                company_name: lead.company_name,
                contact_name: lead.contact_name,
                email: lead.email,
                phone: lead.phone,
              },
            });
          }
        }
      }
    }
    setDraggingId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const totalValue = leads.length;
  const wonCount = getLeadsForStage("won").length;

  return (
    <AppLayout title={t("pipeline.title")}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-foreground truncate">{t("pipeline.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("pipeline.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {t("pipeline.leadsCount", { count: totalValue })}
            </Badge>
            {wonCount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-sm px-3 py-1">
                {t("pipeline.wonCount", { count: wonCount })}
              </Badge>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = getLeadsForStage(stage.key);
              return (
                <div
                  key={stage.key}
                  className="w-72 shrink-0"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.key)}
                >
                  {/* Stage Header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={cn("w-2.5 h-2.5 rounded-full", stage.color)} />
                    <h3 className="text-sm font-semibold text-foreground">{t(`pipeline.stage.${stage.key}`)}</h3>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {stageLeads.length}
                    </Badge>
                  </div>

                  {/* Stage Column */}
                  <div
                    className={cn(
                      "min-h-[60vh] rounded-xl border border-border/50 bg-muted/20 p-2 space-y-2 transition-colors",
                      draggingId && "border-primary/30 bg-primary/5"
                    )}
                  >
                    {stageLeads.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">
                        {t("pipeline.dragHere")}
                      </div>
                    )}
                    {stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "cursor-grab active:cursor-grabbing hover:shadow-md transition-all group",
                          draggingId === lead.id && "opacity-50 rotate-1 scale-95"
                        )}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to={`/leads/${lead.id}`}
                              className="text-sm font-semibold text-foreground hover:text-primary truncate flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {lead.company_name || t("pipeline.unnamedLead")}
                            </Link>
                            <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {lead.contact_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {lead.contact_name}
                            </p>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            {lead.email && (
                              <Mail className="h-3 w-3 text-muted-foreground/50" />
                            )}
                            {lead.phone && (
                              <Phone className="h-3 w-3 text-muted-foreground/50" />
                            )}
                            {lead.website && (
                              <Globe className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>

                          <p className="text-[10px] text-muted-foreground/40">
                            {format(new Date(lead.created_at), "d MMM yyyy", { locale: dateLocale })}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <WonDealDialog
        open={!!wonDeal}
        onOpenChange={(o) => !o && setWonDeal(null)}
        leadId={wonDeal?.leadId}
        prefill={wonDeal?.prefill}
      />
    </AppLayout>
  );
}
