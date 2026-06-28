import { supabase } from "@/integrations/supabase/client";
import { batchIn } from "@/lib/batchIn";

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
  is_test: boolean | null;
}

export interface LeadWithOutreachStatus extends Lead {
  outreach_status: "none" | "email_sent" | "sequence_active";
  email_count: number;
  sequence_status?: string;
  analysis_id?: string;
  has_analysis: boolean;
  member_ids: string[];
  has_activity: boolean;
  has_call: boolean;
  last_call_label?: string | null;
}

/**
 * Fetches every lead the current user can access (RLS-scoped), ordered
 * created_at DESC, enriched with outreach/activity metadata. Shared by the
 * leads list (LeadsPage) and the lead queue used for "next lead" paging, so
 * both read from the same React Query cache (key: ['leads-enriched']).
 */
export async function fetchLeadsData(): Promise<LeadWithOutreachStatus[]> {
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

  if (leadsData.length === 0) {
    return [];
  }

  const leadIds = leadsData.map(l => l.id);
  if (leadIds.length === 0) return leadsData.map(l => ({ ...l, outreach_status: "none" as const, email_count: 0, has_analysis: false, member_ids: [], has_activity: false }));

  // Use batched queries to avoid exceeding URL length limits with large .in() lists
  const [emailCounts, sequences, analyses, leadMembersData, callLogs, meetingsData] = await Promise.all([
    batchIn(ids => supabase.from('sent_emails').select('lead_id').in('lead_id', ids), leadIds),
    batchIn(ids => supabase.from('lead_sequences').select('lead_id, status').in('lead_id', ids), leadIds),
    batchIn(ids => supabase.from('web_analyses').select('id, lead_id, url').in('lead_id', ids).order('created_at', { ascending: false }), leadIds),
    batchIn(ids => supabase.from('lead_members').select('lead_id, user_id').in('lead_id', ids), leadIds),
    batchIn(ids => supabase.from('call_logs').select('lead_id, outcome_label, created_at').in('lead_id', ids).order('created_at', { ascending: false }), leadIds),
    batchIn(ids => supabase.from('meetings').select('lead_id').in('lead_id', ids), leadIds),
  ]);

  // A lead counts as "worked" once it has any logged activity (a call, a sent
  // email/active sequence, or a meeting). Worked leads move to the pipeline and
  // are hidden from the leads list by default.
  const callLogSet = new Set<string>();
  // Latest call outcome label per lead (rows arrive newest-first, so the first
  // one we see for a lead is the most recent).
  const lastCallLabel = new Map<string, string>();
  (callLogs as Array<{ lead_id: string | null; outcome_label: string | null }>).forEach(c => {
    if (!c.lead_id) return;
    callLogSet.add(c.lead_id);
    if (!lastCallLabel.has(c.lead_id) && c.outcome_label) lastCallLabel.set(c.lead_id, c.outcome_label);
  });
  const meetingSet = new Set<string>();
  (meetingsData as Array<{ lead_id: string | null }>).forEach(m => { if (m.lead_id) meetingSet.add(m.lead_id); });

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
      has_activity:
        emailCount > 0 || !!sequenceStatus ||
        callLogSet.has(lead.id) || meetingSet.has(lead.id),
      has_call: callLogSet.has(lead.id),
      last_call_label: lastCallLabel.get(lead.id) ?? null,
    };
  });
}
