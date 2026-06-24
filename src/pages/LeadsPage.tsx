import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Zap, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadsList } from "@/components/leads/LeadsList";
import { LeadGeneration } from "@/components/leads/LeadGeneration";
import { CompanyRegistrySearch } from "@/components/leads/CompanyRegistrySearch";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useTranslation } from "@/i18n/LanguageProvider";
import { fetchLeadsData } from "@/lib/leadsQuery";

export type { LeadWithOutreachStatus } from "@/lib/leadsQuery";

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState("leads");
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const organizationId = useOrganizationId();

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-enriched'],
    queryFn: fetchLeadsData,
  });

  // Realtime subscription for enrichment_status changes
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('leads-enrichment')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads-enriched'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  const handleLeadCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['leads-enriched'] });
  };

  return (
    <AppLayout title={t("leads.title")}>
      <div className="space-y-4 md:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{t("leads.tabLeads")}</span>
              {leads.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded-full">
                  {leads.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>{t("leads.tabFind")}</span>
            </TabsTrigger>
            <TabsTrigger value="registry" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{t("leads.tabRegistry")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-6">
            <LeadsList leads={leads} onRefresh={handleLeadCreated} />
          </TabsContent>

          <TabsContent value="generate" className="mt-6">
            <LeadGeneration onLeadCreated={handleLeadCreated} />
          </TabsContent>

          <TabsContent value="registry" className="mt-6">
            <CompanyRegistrySearch onLeadCreated={handleLeadCreated} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}