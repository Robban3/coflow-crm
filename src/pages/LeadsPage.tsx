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

interface Lead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  source: string;
  source_data: any;
  created_at: string;
  assigned_to: string | null;
  lead_status: string;
  not_interested_at: string | null;
  not_interested_reason: string | null;
  enrichment_status: string | null;
  auto_draft_generated: boolean | null;
}

export interface LeadWithOutreachStatus extends Lead {
  outreach_status: "none" | "email_sent" | "sequence_active";
  email_count: number;
  sequence_status?: string;
  analysis_id?: string;
  has_analysis: boolean;
  member_ids: string[];
}

// Batch helper: split an array into chunks and run .in() queries in parallel, then merge results
async function batchIn<T>(
  queryFn: (ids: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  ids: string[],
  batchSize = 100,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    chunks.push(ids.slice(i, i + batchSize));
  }
  const results = await Promise.all(chunks.map(chunk => queryFn(chunk)));
  return results.flatMap(r => r.data ?? []);
}

async function fetchLeadsData(): Promise<LeadWithOutreachStatus[]> {
  // Paginate to fetch ALL leads (PostgREST caps at 1000 per request)
  const PAGE_SIZE = 1000;
  let allLeads: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error || !data) {
      console.error("Error fetching leads:", error);
      break;
    }
    allLeads = allLeads.concat(data);
    hasMore = data.length === PAGE_SIZE;
    page++;
  }

  const leadsData = allLeads;
  const leadsError = allLeads.length === 0 && page === 0;

  if (leadsData.length === 0) {
    return [];
  }

  const leadIds = leadsData.map(l => l.id);
  if (leadIds.length === 0) return leadsData.map(l => ({ ...l, outreach_status: "none" as const, email_count: 0, has_analysis: false, member_ids: [] }));

  // Use batched queries to avoid exceeding URL length limits with large .in() lists
  const [emailCounts, sequences, analyses, leadMembersData] = await Promise.all([
    batchIn(ids => supabase.from('sent_emails').select('lead_id').in('lead_id', ids), leadIds),
    batchIn(ids => supabase.from('lead_sequences').select('lead_id, status').in('lead_id', ids), leadIds),
    batchIn(ids => supabase.from('web_analyses').select('id, lead_id, url').in('lead_id', ids).order('created_at', { ascending: false }), leadIds),
    batchIn(ids => supabase.from('lead_members').select('lead_id, user_id').in('lead_id', ids), leadIds),
  ]);

  const emailCountMap = new Map<string, number>();
  emailCounts?.forEach(e => {
    const current = emailCountMap.get(e.lead_id!) || 0;
    emailCountMap.set(e.lead_id!, current + 1);
  });

  const sequenceMap = new Map<string, string>();
  sequences?.forEach(s => {
    const existing = sequenceMap.get(s.lead_id);
    if (!existing || s.status === 'active') {
      sequenceMap.set(s.lead_id, s.status);
    }
  });

  const normalizeUrl = (url: string | null): string => {
    if (!url) return '';
    return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  };

  const analysisMapByLeadId = new Map<string, string>();
  const analysisMapByUrl = new Map<string, string>();
  analyses?.forEach(a => {
    if (a.lead_id && !analysisMapByLeadId.has(a.lead_id)) {
      analysisMapByLeadId.set(a.lead_id, a.id);
    }
    const normalizedUrl = normalizeUrl(a.url);
    if (normalizedUrl && !analysisMapByUrl.has(normalizedUrl)) {
      analysisMapByUrl.set(normalizedUrl, a.id);
    }
  });

  const leadMembersMap = new Map<string, string[]>();
  leadMembersData.forEach((lm: any) => {
    const existing = leadMembersMap.get(lm.lead_id) || [];
    existing.push(lm.user_id);
    leadMembersMap.set(lm.lead_id, existing);
  });

  return leadsData.map(lead => {
    const emailCount = emailCountMap.get(lead.id) || 0;
    const sequenceStatus = sequenceMap.get(lead.id);
    let outreach_status: "none" | "email_sent" | "sequence_active" = "none";
    if (sequenceStatus === 'active') outreach_status = "sequence_active";
    else if (emailCount > 0 || sequenceStatus) outreach_status = "email_sent";

    const normalizedLeadUrl = normalizeUrl(lead.website);
    const analysisId = analysisMapByLeadId.get(lead.id) || (normalizedLeadUrl ? analysisMapByUrl.get(normalizedLeadUrl) : undefined);

    return {
      ...lead,
      outreach_status,
      email_count: emailCount,
      sequence_status: sequenceStatus,
      analysis_id: analysisId,
      has_analysis: !!analysisId,
      member_ids: leadMembersMap.get(lead.id) || [],
    };
  });
}

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