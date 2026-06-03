import { useState, useEffect, useMemo } from "react";
import { Telescope, Search, Clock, Send } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import ProspectingSearchTab from "./tabs/ProspectingSearchTab";
import ProspectingQueueTab from "./tabs/ProspectingQueueTab";
import ProspectingReviewTab from "./tabs/ProspectingReviewTab";

function useProspectingCounts(orgId: string | null) {
  const queryClient = useQueryClient();

  const draftsQuery = useQuery({
    queryKey: ["prospecting-draft-count", orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { count } = await (supabase as any)
        .from("prospecting_drafts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "draft");
      return count ?? 0;
    },
    enabled: !!orgId,
    refetchInterval: 10_000,
  });

  const queueQuery = useQuery({
    queryKey: ["prospecting-queue-count", orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("imported_via_prospecting", true)
        .in("enrichment_status", ["pending", "processing"]);
      return count ?? 0;
    },
    enabled: !!orgId,
    refetchInterval: 10_000,
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel("prospecting-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prospecting_drafts",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["prospecting-draft-count", orgId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["prospecting-queue-count", orgId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  return {
    draftCount: draftsQuery.data ?? 0,
    queueCount: queueQuery.data ?? 0,
  };
}

export default function ProspectingModule() {
  const orgId = useOrganizationId();
  const { draftCount, queueCount } = useProspectingCounts(orgId);
  const [activeTab, setActiveTab] = useState("search");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Telescope className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">Prospektering</h1>
            {draftCount > 0 && (
              <Badge variant="secondary">{draftCount} utkast att granska</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Hitta nya leads, analysera automatiskt och skicka mail i bulk
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-4 w-4" />
            Hämta leads
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Kö
            {queueCount > 0 && (
              <Badge variant="outline" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                {queueCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5">
            <Send className="h-4 w-4" />
            Granska & Skicka
            {draftCount > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-xs bg-primary text-primary-foreground">
                {draftCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <ProspectingSearchTab />
        </TabsContent>
        <TabsContent value="queue">
          <ProspectingQueueTab draftCount={draftCount} onGoToReview={() => setActiveTab("review")} />
        </TabsContent>
        <TabsContent value="review">
          <ProspectingReviewTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
