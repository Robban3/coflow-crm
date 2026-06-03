import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) throw new Error("No organization");
    const orgId = profile.organization_id;

    // Get user role
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = (roleRows || []).map((r: any) => r.role);
    const userRole: string = roles.includes("admin")
      ? "admin"
      : roles.includes("moderator")
      ? "moderator"
      : "user";

    // Check module enabled
    const { data: moduleRow } = await supabase
      .from("user_modules")
      .select("enabled")
      .eq("user_id", user.id)
      .eq("module", "statistics")
      .maybeSingle();

    if (moduleRow && moduleRow.enabled === false) {
      return new Response(JSON.stringify({ error: "Module disabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse query params
    const url = new URL(req.url);
    const granularity = url.searchParams.get("granularity") || "week";
    const startStr = url.searchParams.get("start");
    const endStr = url.searchParams.get("end");

    const now = new Date();
    const end = endStr ? new Date(endStr + "T23:59:59.999Z") : now;
    const start = startStr
      ? new Date(startStr + "T00:00:00.000Z")
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // Previous period for delta calculations
    const periodMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodMs).toISOString();
    const prevEnd = startISO;

    // ---- Current period events ----
    let eventsQuery = supabase
      .from("activity_events")
      .select("id, actor_user_id, type, occurred_at, metadata")
      .eq("organization_id", orgId)
      .gte("occurred_at", startISO)
      .lte("occurred_at", endISO)
      .order("occurred_at", { ascending: false })
      .limit(5000);

    // Role-based filtering: USER only sees their own events
    if (userRole === "user") {
      eventsQuery = eventsQuery.eq("actor_user_id", user.id);
    }

    const { data: events } = await eventsQuery;

    // ---- Previous period events (for deltas) ----
    let prevEventsQuery = supabase
      .from("activity_events")
      .select("id, actor_user_id, type")
      .eq("organization_id", orgId)
      .gte("occurred_at", prevStart)
      .lt("occurred_at", prevEnd)
      .limit(5000);

    if (userRole === "user") {
      prevEventsQuery = prevEventsQuery.eq("actor_user_id", user.id);
    }

    const { data: prevEvents } = await prevEventsQuery;

    const currentEvents = events || [];
    const previousEvents = prevEvents || [];

    // ---- Call outcome stats from call_logs ----
    let callLogsQuery = supabase
      .from("call_logs")
      .select("id, created_by, outcome_key, outcome_label, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .limit(5000);

    if (userRole === "user") {
      callLogsQuery = callLogsQuery.eq("created_by", user.id);
    }

    const { data: callLogs } = await callLogsQuery;
    const currentCallLogs = callLogs || [];

    // Call outcome summary
    const callOutcomeCounts: Record<string, number> = {};
    const callOutcomeByUser: Record<string, Record<string, number>> = {};
    const callOutcomeByDate: Record<string, Record<string, number>> = {};

    for (const cl of currentCallLogs) {
      callOutcomeCounts[cl.outcome_key] = (callOutcomeCounts[cl.outcome_key] || 0) + 1;
      if (!callOutcomeByUser[cl.created_by]) callOutcomeByUser[cl.created_by] = {};
      callOutcomeByUser[cl.created_by][cl.outcome_key] = (callOutcomeByUser[cl.created_by][cl.outcome_key] || 0) + 1;
      const dateKey = cl.created_at.substring(0, 10);
      if (!callOutcomeByDate[dateKey]) callOutcomeByDate[dateKey] = {};
      callOutcomeByDate[dateKey][cl.outcome_key] = (callOutcomeByDate[dateKey][cl.outcome_key] || 0) + 1;
    }

    const totalCalls = currentCallLogs.length;
    const answered = callOutcomeCounts["answered"] || 0;
    const booked = callOutcomeCounts["booked"] || 0;

    const callOutcomeStats = {
      summary: {
        total: totalCalls,
        answered,
        no_answer: callOutcomeCounts["no_answer"] || 0,
        callback: callOutcomeCounts["callback"] || 0,
        not_interested: callOutcomeCounts["not_interested"] || 0,
        booked,
        wrong_number: callOutcomeCounts["wrong_number"] || 0,
        answer_rate: totalCalls > 0 ? Math.round((answered / totalCalls) * 100) : 0,
        booked_rate: totalCalls > 0 ? Math.round((booked / totalCalls) * 100) : 0,
      },
      per_user: [] as any[],
      trend: Object.entries(callOutcomeByDate)
        .map(([date, outcomes]) => ({
          date,
          answered: outcomes["answered"] || 0,
          no_answer: outcomes["no_answer"] || 0,
          callback: outcomes["callback"] || 0,
          not_interested: outcomes["not_interested"] || 0,
          booked: outcomes["booked"] || 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    // ---- Totals by type ----
    const countByType = (evts: typeof currentEvents) => {
      const counts: Record<string, number> = {};
      for (const e of evts) {
        counts[e.type] = (counts[e.type] || 0) + 1;
      }
      return counts;
    };

    const currentCounts = countByType(currentEvents);
    const prevCounts = countByType(previousEvents);

    const calcDelta = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const totals = {
      emails_sent: currentCounts["email.sent"] || 0,
      calls_logged: currentCounts["call.logged"] || 0,
      documents_sent: currentCounts["document.sent"] || 0,
      meetings_booked: currentCounts["meeting.booked"] || 0,
      tasks_completed: currentCounts["task.completed"] || 0,
      total: currentEvents.length,
    };

    const deltas = {
      emails_sent: calcDelta(totals.emails_sent, prevCounts["email.sent"] || 0),
      calls_logged: calcDelta(totals.calls_logged, prevCounts["call.logged"] || 0),
      documents_sent: calcDelta(totals.documents_sent, prevCounts["document.sent"] || 0),
      meetings_booked: calcDelta(totals.meetings_booked, prevCounts["meeting.booked"] || 0),
      tasks_completed: calcDelta(totals.tasks_completed, prevCounts["task.completed"] || 0),
      total: calcDelta(totals.total, previousEvents.length),
    };

    // ---- Per user aggregation ----
    const userMap: Record<string, Record<string, number>> = {};
    for (const e of currentEvents) {
      if (!userMap[e.actor_user_id]) userMap[e.actor_user_id] = {};
      userMap[e.actor_user_id][e.type] = (userMap[e.actor_user_id][e.type] || 0) + 1;
    }

    const prevUserMap: Record<string, number> = {};
    for (const e of previousEvents) {
      prevUserMap[e.actor_user_id] = (prevUserMap[e.actor_user_id] || 0) + 1;
    }

    // Get team profiles
    const { data: teamProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("organization_id", orgId);

    const profileMap = new Map((teamProfiles || []).map(p => [p.id, p]));

    const weights = { emails: 1, calls: 2, meetings: 5, documents: 3, tasks: 1 };

    const leaderboard = Object.entries(userMap).map(([userId, types]) => {
      const p = profileMap.get(userId);
      const emails = types["email.sent"] || 0;
      const calls = types["call.logged"] || 0;
      const meetings = types["meeting.booked"] || 0;
      const documents = types["document.sent"] || 0;
      const tasks = types["task.completed"] || 0;

      const score =
        emails * weights.emails +
        calls * weights.calls +
        meetings * weights.meetings +
        documents * weights.documents +
        tasks * weights.tasks;

      const prevTotal = prevUserMap[userId] || 0;
      const currentTotal = Object.values(types).reduce((a, b) => a + b, 0);

      const daysSet = new Set<string>();
      for (const e of currentEvents) {
        if (e.actor_user_id === userId) {
          daysSet.add(e.occurred_at.substring(0, 10));
        }
      }

      const lastEvent = currentEvents.find(e => e.actor_user_id === userId);

      return {
        user_id: userId,
        full_name: p?.full_name || p?.email || "Okänd",
        avatar_url: p?.avatar_url,
        email: p?.email,
        emails,
        calls,
        meetings,
        documents,
        tasks,
        score,
        total: currentTotal,
        delta: calcDelta(currentTotal, prevTotal),
        active_days: daysSet.size,
        last_activity_type: lastEvent?.type || null,
        last_activity_at: lastEvent?.occurred_at || null,
      };
    }).sort((a, b) => b.score - a.score);

    // Add users with zero activity (only for admin/moderator)
    if (userRole !== "user") {
      for (const p of teamProfiles || []) {
        if (!userMap[p.id]) {
          leaderboard.push({
            user_id: p.id,
            full_name: p.full_name || p.email || "Okänd",
            avatar_url: p.avatar_url,
            email: p.email,
            emails: 0, calls: 0, meetings: 0, documents: 0, tasks: 0,
            score: 0, total: 0, delta: 0, active_days: 0,
            last_activity_type: null, last_activity_at: null,
          });
        }
      }
    }

    // Fill per_user call outcome stats
    callOutcomeStats.per_user = Object.entries(callOutcomeByUser)
      .map(([userId, outcomes]) => {
        const p = profileMap.get(userId);
        const userTotal = Object.values(outcomes).reduce((a, b) => a + b, 0);
        const userAnswered = outcomes["answered"] || 0;
        const userBooked = outcomes["booked"] || 0;
        return {
          user_id: userId,
          full_name: p?.full_name || p?.email || "Okänd",
          avatar_url: p?.avatar_url || null,
          total: userTotal, answered: userAnswered,
          no_answer: outcomes["no_answer"] || 0,
          callback: outcomes["callback"] || 0,
          not_interested: outcomes["not_interested"] || 0,
          booked: userBooked,
          wrong_number: outcomes["wrong_number"] || 0,
          answer_rate: userTotal > 0 ? Math.round((userAnswered / userTotal) * 100) : 0,
          booked_rate: userTotal > 0 ? Math.round((userBooked / userTotal) * 100) : 0,
        };
      })
      .sort((a, b) => b.booked_rate - a.booked_rate || b.answer_rate - a.answer_rate);

    // ---- Time series ----
    const truncKey = (dateStr: string, gran: string) => {
      const d = new Date(dateStr);
      if (gran === "day") return d.toISOString().substring(0, 10);
      if (gran === "week") {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().substring(0, 10);
      }
      return d.toISOString().substring(0, 7);
    };

    const tsMap: Record<string, Record<string, number>> = {};
    for (const e of currentEvents) {
      const key = truncKey(e.occurred_at, granularity);
      if (!tsMap[key]) tsMap[key] = {};
      tsMap[key][e.type] = (tsMap[key][e.type] || 0) + 1;
      tsMap[key]["total"] = (tsMap[key]["total"] || 0) + 1;
    }

    const timeSeries = Object.entries(tsMap)
      .map(([date, types]) => ({
        date,
        emails: types["email.sent"] || 0,
        calls: types["call.logged"] || 0,
        meetings: types["meeting.booked"] || 0,
        documents: types["document.sent"] || 0,
        tasks: types["task.completed"] || 0,
        total: types["total"] || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byType = Object.entries(currentCounts).map(([type, count]) => ({
      type, count, label: typeLabel(type),
    }));

    // ---- Coaching insights ----
    const insights: Array<{ title: string; reason: string; users: string[]; action: string }> = [];

    if (userRole !== "user") {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const recentlyActive = new Set<string>();
      for (const e of currentEvents) {
        if (e.occurred_at >= threeDaysAgo) recentlyActive.add(e.actor_user_id);
      }
      const inactive = (teamProfiles || []).filter(p => !recentlyActive.has(p.id));
      if (inactive.length > 0) {
        insights.push({
          title: "Ingen aktivitet senaste 3 dagar",
          reason: "Dessa användare har inte loggat någon aktivitet de senaste 3 dagarna.",
          users: inactive.map(p => p.full_name || p.email),
          action: "Boka ett kort uppföljningsmöte för att identifiera eventuella blockeringar.",
        });
      }

      for (const entry of leaderboard) {
        if (entry.emails > 10 && entry.calls === 0) {
          insights.push({
            title: "Många mail, inga samtal",
            reason: `${entry.full_name} har skickat ${entry.emails} mail men inte loggat några samtal.`,
            users: [entry.full_name],
            action: "Uppmuntra telefonkontakt som komplement till e-post.",
          });
        }
      }

      if (leaderboard.length >= 3) {
        const totalScore = leaderboard.reduce((a, b) => a + b.score, 0);
        if (totalScore > 0) {
          const topCount = Math.max(1, Math.ceil(leaderboard.length * 0.2));
          const topScore = leaderboard.slice(0, topCount).reduce((a, b) => a + b.score, 0);
          const topPct = Math.round((topScore / totalScore) * 100);
          if (topPct >= 70) {
            insights.push({
              title: `Topp ${topCount} står för ${topPct}% av aktiviteten`,
              reason: "Aktiviteten är ojämnt fördelad i teamet.",
              users: leaderboard.slice(0, topCount).map(u => u.full_name),
              action: "Fördela arbetsbelastning jämnare eller belöna toppresterare.",
            });
          }
        }
      }
    }

    // ======== NEW: Sales Funnel, Revenue, Time-to-Convert ========

    // Sales Funnel - query leads, sent_emails, meetings, documents, quotes
    let funnelData: any = null;
    let revenueData: any = null;
    let timeToConvertData: any = null;

    // Funnel is visible to all roles (filtered by user for USER role)
    {
      // Leads created in period
      let leadsQuery = supabase
        .from("leads")
        .select("id, created_by, created_at, email")
        .eq("organization_id", orgId)
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      if (userRole === "user") {
        leadsQuery = leadsQuery.eq("created_by", user.id);
      }

      const { data: periodLeads } = await leadsQuery;
      const leads = periodLeads || [];
      const leadIds = leads.map(l => l.id);

      // Contacted: leads with at least one sent_email or call_log in period
      let contactedLeadIds = new Set<string>();

      if (leadIds.length > 0) {
        let emailsQ = supabase
          .from("sent_emails")
          .select("lead_id")
          .eq("organization_id", orgId)
          .in("lead_id", leadIds.slice(0, 500));
        if (userRole === "user") emailsQ = emailsQ.eq("sent_by", user.id);
        const { data: emailLeads } = await emailsQ;
        (emailLeads || []).forEach(e => { if (e.lead_id) contactedLeadIds.add(e.lead_id); });

        let callsQ = supabase
          .from("call_logs")
          .select("lead_id")
          .eq("organization_id", orgId)
          .in("lead_id", leadIds.slice(0, 500));
        if (userRole === "user") callsQ = callsQ.eq("created_by", user.id);
        const { data: callLeads } = await callsQ;
        (callLeads || []).forEach(c => { if (c.lead_id) contactedLeadIds.add(c.lead_id); });
      }

      // Meetings booked with leads in period
      let meetingsQ = supabase
        .from("meetings")
        .select("lead_id")
        .eq("organization_id", orgId)
        .not("lead_id", "is", null)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (userRole === "user") meetingsQ = meetingsQ.eq("host_user_id", user.id);
      const { data: meetingLeads } = await meetingsQ;
      const meetingLeadIds = new Set((meetingLeads || []).map(m => m.lead_id).filter(Boolean));

      // Offers sent in period
      let docsQ = supabase
        .from("documents")
        .select("lead_id")
        .eq("organization_id", orgId)
        .not("lead_id", "is", null)
        .not("sent_at", "is", null)
        .gte("sent_at", startISO)
        .lte("sent_at", endISO);
      if (userRole === "user") docsQ = docsQ.eq("created_by", user.id);
      const { data: docLeads } = await docsQ;
      const offerLeadIds = new Set((docLeads || []).map(d => d.lead_id).filter(Boolean));

      // Deals won (quotes accepted) in period
      let quotesQ = supabase
        .from("quotes")
        .select("id, lead_id, total, created_by, accepted_at, created_at")
        .eq("organization_id", orgId)
        .not("accepted_at", "is", null)
        .gte("accepted_at", startISO)
        .lte("accepted_at", endISO);
      if (userRole === "user") quotesQ = quotesQ.eq("created_by", user.id);
      const { data: wonQuotes } = await quotesQ;
      const wonLeadIds = new Set((wonQuotes || []).map(q => q.lead_id).filter(Boolean));

      // Also check accepted documents
      let acceptedDocsQ = supabase
        .from("documents")
        .select("id, lead_id, total, created_by, accepted_at, created_at")
        .eq("organization_id", orgId)
        .not("accepted_at", "is", null)
        .gte("accepted_at", startISO)
        .lte("accepted_at", endISO);
      if (userRole === "user") acceptedDocsQ = acceptedDocsQ.eq("created_by", user.id);
      const { data: wonDocs } = await acceptedDocsQ;
      (wonDocs || []).forEach(d => { if (d.lead_id) wonLeadIds.add(d.lead_id); });

      const leadsCreated = leads.length;
      const contacted = contactedLeadIds.size;
      const meetingsBooked = meetingLeadIds.size;
      const offersSent = offerLeadIds.size;
      const dealsWon = wonLeadIds.size;

      funnelData = {
        stages: [
          { key: "leads_created", label: "Leads skapade", count: leadsCreated, pct: 100 },
          {
            key: "contacted",
            label: "Kontaktade",
            count: contacted,
            pct: leadsCreated > 0 ? Math.round((contacted / leadsCreated) * 100) : 0,
          },
          {
            key: "meetings_booked",
            label: "Möte bokat",
            count: meetingsBooked,
            pct: contacted > 0 ? Math.round((meetingsBooked / contacted) * 100) : 0,
          },
          {
            key: "offers_sent",
            label: "Offert skickad",
            count: offersSent,
            pct: meetingsBooked > 0 ? Math.round((offersSent / meetingsBooked) * 100) : 0,
          },
          {
            key: "deals_won",
            label: "Affär vunnen",
            count: dealsWon,
            pct: offersSent > 0 ? Math.round((dealsWon / offersSent) * 100) : 0,
          },
        ],
      };

      // ---- Revenue & Deal Performance (teamleader/admin only) ----
      if (userRole !== "user") {
        const allWonDeals = [...(wonQuotes || []), ...(wonDocs || [])];

        // Group by user
        const revenueByUser: Record<string, { deals: number; revenue: number; days: number[] }> = {};

        for (const deal of allWonDeals) {
          const uid = deal.created_by;
          if (!uid) continue;
          if (!revenueByUser[uid]) revenueByUser[uid] = { deals: 0, revenue: 0, days: [] };
          revenueByUser[uid].deals++;
          revenueByUser[uid].revenue += Number(deal.total || 0);

          // Days to close
          if (deal.created_at && deal.accepted_at) {
            const created = new Date(deal.created_at).getTime();
            const accepted = new Date(deal.accepted_at).getTime();
            const daysDiff = Math.round((accepted - created) / (1000 * 60 * 60 * 24));
            revenueByUser[uid].days.push(daysDiff);
          }
        }

        // Total offers sent per user for close rate
        let allSentQuotesQ = supabase
          .from("quotes")
          .select("id, created_by")
          .eq("organization_id", orgId)
          .not("sent_at", "is", null)
          .gte("sent_at", startISO)
          .lte("sent_at", endISO);
        const { data: allSentQuotes } = await allSentQuotesQ;

        let allSentDocsQ = supabase
          .from("documents")
          .select("id, created_by")
          .eq("organization_id", orgId)
          .not("sent_at", "is", null)
          .gte("sent_at", startISO)
          .lte("sent_at", endISO);
        const { data: allSentDocs } = await allSentDocsQ;

        const sentCountByUser: Record<string, number> = {};
        for (const q of [...(allSentQuotes || []), ...(allSentDocs || [])]) {
          if (q.created_by) sentCountByUser[q.created_by] = (sentCountByUser[q.created_by] || 0) + 1;
        }

        const revenuePerUser = Object.entries(revenueByUser)
          .map(([uid, data]) => {
            const p = profileMap.get(uid);
            const sentCount = sentCountByUser[uid] || 0;
            const avgDays = data.days.length > 0 ? Math.round(data.days.reduce((a, b) => a + b, 0) / data.days.length) : 0;
            return {
              user_id: uid,
              full_name: p?.full_name || p?.email || "Okänd",
              avatar_url: p?.avatar_url || null,
              deals_won: data.deals,
              revenue: Math.round(data.revenue),
              avg_deal_size: data.deals > 0 ? Math.round(data.revenue / data.deals) : 0,
              close_rate: sentCount > 0 ? Math.round((data.deals / sentCount) * 100) : 0,
              avg_days_to_close: avgDays,
            };
          })
          .sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = revenuePerUser.reduce((a, b) => a + b.revenue, 0);
        const totalDeals = revenuePerUser.reduce((a, b) => a + b.deals_won, 0);

        revenueData = {
          total_revenue: totalRevenue,
          total_deals: totalDeals,
          avg_deal_size: totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0,
          per_user: revenuePerUser,
        };
      }

      // ---- Time-to-Convert Insights (teamleader/admin only) ----
      if (userRole !== "user") {
        // Get all leads with meetings for the org (broader window for avg calc)
        const { data: allLeads } = await supabase
          .from("leads")
          .select("id, created_at")
          .eq("organization_id", orgId)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .limit(1000);

        const allLeadIds = (allLeads || []).map(l => l.id);
        const leadCreatedMap = new Map((allLeads || []).map(l => [l.id, new Date(l.created_at).getTime()]));

        // Get first meeting per lead
        let firstMeetings: Record<string, number> = {};
        if (allLeadIds.length > 0) {
          const { data: meetingsAll } = await supabase
            .from("meetings")
            .select("lead_id, created_at")
            .eq("organization_id", orgId)
            .in("lead_id", allLeadIds.slice(0, 500))
            .order("created_at", { ascending: true });

          for (const m of meetingsAll || []) {
            if (m.lead_id && !firstMeetings[m.lead_id]) {
              firstMeetings[m.lead_id] = new Date(m.created_at!).getTime();
            }
          }
        }

        // Get first offer sent per lead
        let firstOffers: Record<string, number> = {};
        if (allLeadIds.length > 0) {
          const { data: offersAll } = await supabase
            .from("documents")
            .select("lead_id, sent_at")
            .eq("organization_id", orgId)
            .not("sent_at", "is", null)
            .in("lead_id", allLeadIds.slice(0, 500))
            .order("sent_at", { ascending: true });

          for (const o of offersAll || []) {
            if (o.lead_id && !firstOffers[o.lead_id]) {
              firstOffers[o.lead_id] = new Date(o.sent_at!).getTime();
            }
          }
        }

        // Get accepted date per lead
        let dealClosedMap: Record<string, number> = {};
        if (allLeadIds.length > 0) {
          const { data: acceptedQ } = await supabase
            .from("quotes")
            .select("lead_id, accepted_at")
            .eq("organization_id", orgId)
            .not("accepted_at", "is", null)
            .in("lead_id", allLeadIds.slice(0, 500));

          for (const q of acceptedQ || []) {
            if (q.lead_id && !dealClosedMap[q.lead_id]) {
              dealClosedMap[q.lead_id] = new Date(q.accepted_at!).getTime();
            }
          }

          const { data: acceptedD } = await supabase
            .from("documents")
            .select("lead_id, accepted_at")
            .eq("organization_id", orgId)
            .not("accepted_at", "is", null)
            .in("lead_id", allLeadIds.slice(0, 500));

          for (const d of acceptedD || []) {
            if (d.lead_id && !dealClosedMap[d.lead_id]) {
              dealClosedMap[d.lead_id] = new Date(d.accepted_at!).getTime();
            }
          }
        }

        const msToDay = 1000 * 60 * 60 * 24;
        const leadToMeetingDays: number[] = [];
        const meetingToOfferDays: number[] = [];
        const offerToDealDays: number[] = [];

        for (const leadId of allLeadIds) {
          const created = leadCreatedMap.get(leadId);
          const meeting = firstMeetings[leadId];
          const offer = firstOffers[leadId];
          const deal = dealClosedMap[leadId];

          if (created && meeting) {
            leadToMeetingDays.push(Math.round((meeting - created) / msToDay));
          }
          if (meeting && offer) {
            meetingToOfferDays.push(Math.round((offer - meeting) / msToDay));
          }
          if (offer && deal) {
            offerToDealDays.push(Math.round((deal - offer) / msToDay));
          }
        }

        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

        const steps = [
          { key: "lead_to_meeting", label: "Lead → Möte", avg_days: avg(leadToMeetingDays) },
          { key: "meeting_to_offer", label: "Möte → Offert", avg_days: avg(meetingToOfferDays) },
          { key: "offer_to_deal", label: "Offert → Affär", avg_days: avg(offerToDealDays) },
        ];

        const slowest = steps.filter(s => s.avg_days !== null).sort((a, b) => (b.avg_days || 0) - (a.avg_days || 0))[0] || null;

        // Fastest closer
        let fastestCloser: any = null;
        if (revenueData && revenueData.per_user.length > 0) {
          const closers = revenueData.per_user.filter((u: any) => u.avg_days_to_close > 0);
          if (closers.length > 0) {
            const fastest = closers.sort((a: any, b: any) => a.avg_days_to_close - b.avg_days_to_close)[0];
            fastestCloser = { full_name: fastest.full_name, avg_days: fastest.avg_days_to_close };
          }
        }

        timeToConvertData = {
          steps,
          slowest_step: slowest ? slowest.label : null,
          fastest_closer: fastestCloser,
        };
      }
    }

    // ---- Callback backlog (open call_tasks) ----
    let callbackBacklog = { total_open: 0, due_today: 0 };
    {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      let backlogQuery = supabase
        .from("call_tasks")
        .select("id, due_at, assigned_to_user_id, status")
        .eq("organization_id", orgId)
        .eq("status", "open");

      if (userRole === "user") {
        backlogQuery = backlogQuery.eq("assigned_to_user_id", user.id);
      }

      const { data: openTasks } = await backlogQuery;
      const tasks = openTasks || [];
      callbackBacklog = {
        total_open: tasks.length,
        due_today: tasks.filter(t => {
          const due = new Date(t.due_at);
          return due >= todayStart && due <= todayEnd;
        }).length,
      };
    }

    // ---- Monthly Top-3 (for prestige rings) ----
    const top3UserIds: string[] = [];
    if (revenueData && revenueData.per_user.length > 0) {
      const sorted = [...revenueData.per_user].sort((a: any, b: any) => b.revenue - a.revenue);
      top3UserIds.push(...sorted.slice(0, 3).map((u: any) => u.user_id));
    } else {
      const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
      top3UserIds.push(...sorted.slice(0, 3).map(u => u.user_id));
    }

    return new Response(
      JSON.stringify({
        totals,
        deltas,
        leaderboard,
        timeSeries,
        byType,
        insights,
        weights,
        callOutcomeStats,
        funnelData,
        revenueData,
        timeToConvertData,
        callbackBacklog,
        top3UserIds,
        userRole,
        currentUserId: user.id,
        period: { start: startISO, end: endISO, granularity },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Statistics overview error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    "email.sent": "Mail skickade",
    "call.logged": "Samtal",
    "document.sent": "Dokument skickade",
    "meeting.booked": "Möten bokade",
    "task.completed": "Uppgifter klara",
    "deal.stage_changed": "Stegbyten",
    "note.created": "Anteckningar",
  };
  return labels[type] || type;
}
