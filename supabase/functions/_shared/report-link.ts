// Returns a public, trackable report link (https://coflow.se/r/{token}) for a
// lead's most recent report, or null if the lead has no report. Reuses the
// report_shares token/enable pattern from ReportViewPage so opens/scroll/CTA are
// tracked by the existing report-track analytics. Uses whatever supabase client
// is passed (service-role in edge functions), so it bypasses RLS — callers must
// already be authorized for the lead's organization.
export async function getOrCreateReportLink(
  supabase: any,
  leadId: string,
  organizationId?: string | null,
): Promise<string | null> {
  try {
    let q = supabase
      .from("reports")
      .select("id")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (organizationId) q = q.eq("organization_id", organizationId);
    const { data: report } = await q.maybeSingle();
    if (!report?.id) return null;

    const { data: existing } = await supabase
      .from("report_shares")
      .select("token, enabled")
      .eq("report_id", report.id)
      .maybeSingle();

    let token: string | undefined = existing?.token;
    if (!existing) {
      const { data: created } = await supabase
        .from("report_shares")
        .insert({ report_id: report.id, enabled: true })
        .select("token")
        .single();
      token = created?.token;
    } else if (!existing.enabled) {
      await supabase.from("report_shares").update({ enabled: true }).eq("report_id", report.id);
    }

    return token ? `https://coflow.se/r/${token}` : null;
  } catch (e) {
    console.warn("[report-link] failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
