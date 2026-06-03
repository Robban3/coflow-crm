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
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";

const PIPELINE_STAGES = [
  { key: "active", label: "Aktiv", color: "bg-blue-500", description: "Nya & aktiva leads" },
  { key: "contacted", label: "Kontaktad", color: "bg-indigo-500", description: "Kontakt etablerad" },
  { key: "meeting_booked", label: "Möte bokat", color: "bg-violet-500", description: "Möte inplanerat" },
  { key: "offer_sent", label: "Offert skickad", color: "bg-amber-500", description: "Offert/avtal skickat" },
  { key: "won", label: "Vunnen", color: "bg-emerald-500", description: "Avslutad affär" },
  { key: "lost", label: "Förlorad", color: "bg-destructive", description: "Ej konverterad" },
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
}

export default function PipelinePage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["pipeline-leads", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, company_name, contact_name, email, phone, website, lead_status, created_at, last_call_at")
        .not("is_not_interested", "eq", true)
        .order("created_at", { ascending: false });

      if (!isAdmin && user?.id) {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PipelineLead[];
    },
    enabled: !!user?.id,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ lead_status: newStatus })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-leads"] });
      toast.success("Lead flyttad");
    },
    onError: () => {
      toast.error("Kunde inte uppdatera lead");
    },
  });

  const getLeadsForStage = (stageKey: string) =>
    leads.filter((l) => l.lead_status === stageKey);

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
      if (lead && lead.lead_status !== stageKey) {
        updateStatus.mutate({ leadId, newStatus: stageKey });
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
    <AppLayout title="Pipeline">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Pipeline</h2>
            <p className="text-muted-foreground text-sm">
              Dra och släpp leads mellan stegen för att uppdatera status
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {totalValue} leads
            </Badge>
            {wonCount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-sm px-3 py-1">
                {wonCount} vunna
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
                    <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
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
                        Dra leads hit
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
                              {lead.company_name || "Namnlös lead"}
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
                            {format(new Date(lead.created_at), "d MMM yyyy", { locale: sv })}
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
    </AppLayout>
  );
}
