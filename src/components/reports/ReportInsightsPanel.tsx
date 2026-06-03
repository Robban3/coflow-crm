import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye,
  EyeOff,
  Clock,
  Target,
  ArrowDown,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface Props {
  reportId: string;
  shareToken?: string | null;
}

interface SessionSummary {
  session_count: number;
  first_opened: string | null;
  last_opened: string | null;
  total_active_ms: number;
  max_scroll_depth: number;
  sections_reached: string[];
  cta_clicks: Record<string, number>;
  reached_pricing: boolean;
  pricing_dropoff: boolean;
  recent_events: Array<{
    event_type: string;
    event_name: string | null;
    value_int: number | null;
    created_at: string;
  }>;
}

function computeInsights(
  sessions: any[],
  events: any[]
): SessionSummary {
  const session_count = sessions.length;
  const first_opened = sessions.length
    ? sessions.reduce((min, s) =>
        s.started_at < min ? s.started_at : min, sessions[0].started_at)
    : null;
  const last_opened = sessions.length
    ? sessions.reduce((max, s) =>
        s.last_seen_at > max ? s.last_seen_at : max, sessions[0].last_seen_at)
    : null;
  const total_active_ms = sessions.reduce(
    (sum, s) => sum + (s.total_active_ms || 0),
    0
  );

  // Scroll depth
  const scrollEvents = events.filter((e) => e.event_type === "scroll_depth");
  const max_scroll_depth = scrollEvents.reduce(
    (max, e) => Math.max(max, e.value_int || 0),
    0
  );

  // Sections reached
  const sectionEvents = events.filter((e) => e.event_type === "section_view");
  const sections_reached = [...new Set(sectionEvents.map((e) => e.event_name).filter(Boolean))] as string[];

  // CTA clicks
  const ctaEvents = events.filter(
    (e) => e.event_type === "cta_click" || e.event_type === "pdf_click" || e.event_type === "share_click"
  );
  const cta_clicks: Record<string, number> = {};
  for (const e of ctaEvents) {
    const key = e.event_name || e.event_type;
    cta_clicks[key] = (cta_clicks[key] || 0) + 1;
  }

  // Pricing analysis
  const reached_pricing = sections_reached.includes("pricing");
  const hasCtaAfterPricing = ctaEvents.length > 0;

  // Pricing drop-off: reached pricing, no CTA clicks, and last session ended > 10 min ago
  let pricing_dropoff = false;
  if (reached_pricing && !hasCtaAfterPricing && sessions.length > 0) {
    const lastSeen = new Date(last_opened || 0).getTime();
    const now = Date.now();
    if (now - lastSeen > 10 * 60 * 1000) {
      pricing_dropoff = true;
    }
  }

  // Recent events (last 10)
  const recent_events = events
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((e) => ({
      event_type: e.event_type,
      event_name: e.event_name,
      value_int: e.value_int,
      created_at: e.created_at,
    }));

  return {
    session_count,
    first_opened,
    last_opened,
    total_active_ms,
    max_scroll_depth,
    sections_reached,
    cta_clicks,
    reached_pricing,
    pricing_dropoff,
    recent_events,
  };
}

const SECTION_LABELS: Record<string, string> = {
  executive: "Executive",
  nuläge: "Nuläge",
  barrier: "Tillväxthinder",
  roadmap: "Roadmap",
  pricing: "Investering & Paket",
  next_steps: "Nästa steg",
  summary: "Sammanfattning",
  findings: "Fynd",
  actions: "Åtgärder",
  cta: "CTA",
};

const EVENT_LABELS: Record<string, string> = {
  view: "Sidvisning",
  heartbeat: "Aktiv",
  section_view: "Sektion visad",
  scroll_depth: "Scroll",
  cta_click: "CTA-klick",
  pdf_click: "PDF-export",
  share_click: "Dela",
};

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function ReportInsightsPanel({ reportId, shareToken }: Props) {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["report-insights", reportId, shareToken],
    queryFn: async () => {
      if (!shareToken) return null;

      const [sessionsRes, eventsRes] = await Promise.all([
        supabase
          .from("report_view_sessions")
          .select("*")
          .eq("report_token", shareToken)
          .order("started_at", { ascending: false })
          .limit(100),
        supabase
          .from("report_view_events")
          .select("*")
          .eq("report_token", shareToken)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const sessions = (sessionsRes.data as any[]) || [];
      const events = (eventsRes.data as any[]) || [];

      return computeInsights(sessions, events);
    },
    enabled: !!shareToken,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  if (!shareToken) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-3" />
        <div className="h-3 bg-muted rounded w-48" />
      </div>
    );
  }

  if (!insights || insights.session_count === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Report Insights</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" />
          <span>Inte öppnad ännu</span>
        </div>
      </div>
    );
  }

  const d = insights;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Report Insights</h3>
        {d.pricing_dropoff && (
          <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5 ml-auto">
            <AlertTriangle className="h-2.5 w-2.5 mr-1" />
            Drop-off vid pris
          </Badge>
        )}
        {d.reached_pricing && !d.pricing_dropoff && Object.keys(d.cta_clicks).length === 0 && (
          <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5 ml-auto">
            Nådde pris, ej bokad
          </Badge>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Öppnad"
          value="Ja"
          sub={d.first_opened ? format(new Date(d.first_opened), "d MMM HH:mm", { locale: sv }) : undefined}
        />
        <MetricCard
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Sessioner"
          value={String(d.session_count)}
          sub={d.total_active_ms > 0 ? `~${formatDuration(d.total_active_ms)}` : undefined}
        />
        <MetricCard
          icon={<ArrowDown className="h-3.5 w-3.5" />}
          label="Scroll"
          value={`${d.max_scroll_depth}%`}
        />
        <MetricCard
          icon={<Target className="h-3.5 w-3.5" />}
          label="CTA-klick"
          value={String(Object.values(d.cta_clicks).reduce((a, b) => a + b, 0))}
        />
      </div>

      {/* Sections reached */}
      {d.sections_reached.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Sektioner nådda</p>
          <div className="flex flex-wrap gap-1.5">
            {d.sections_reached.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className={`text-[10px] font-normal ${
                  s === "pricing"
                    ? "border-primary/30 text-primary bg-primary/5"
                    : ""
                }`}
              >
                {SECTION_LABELS[s] || s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* CTA breakdown */}
      {Object.keys(d.cta_clicks).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">CTA-klick</p>
          <div className="space-y-1">
            {Object.entries(d.cta_clicks).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last seen */}
      {d.last_opened && (
        <p className="text-[10px] text-muted-foreground">
          Senast aktiv: {format(new Date(d.last_opened), "d MMM yyyy HH:mm", { locale: sv })}
        </p>
      )}

      {/* Recent events timeline */}
      {d.recent_events.length > 0 && (
        <details className="group">
          <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Senaste händelser ({d.recent_events.length})
          </summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {d.recent_events.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground py-0.5">
                <span className="text-[10px] font-mono shrink-0">
                  {format(new Date(e.created_at), "HH:mm:ss")}
                </span>
                <span className="text-foreground/70">
                  {EVENT_LABELS[e.event_type] || e.event_type}
                  {e.event_name ? `: ${SECTION_LABELS[e.event_name] || e.event_name}` : ""}
                  {e.value_int ? ` (${e.value_int}%)` : ""}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
