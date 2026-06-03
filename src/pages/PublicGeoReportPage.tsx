import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, AlertCircle, Zap, Target, Clock,
  ExternalLink, CheckCircle, XCircle, RefreshCw, Mail, ArrowRight
} from "lucide-react";

const STEPS = [
  { step: 1, label: "Tar emot uppgifter" },
  { step: 2, label: "Hämtar innehåll från webbplatsen" },
  { step: 3, label: "Skapar mini-rapport" },
];

const scoreLabel = (s: number) =>
  s >= 80 ? "Stark AI-synlighet" : s >= 50 ? "Bra potential" : "Låg AI-synlighet";

const scoreColor = (s: number) =>
  s >= 80 ? "#34d399" : s >= 50 ? "#fbbf24" : "#f87171";

const severityBadge = (s: string) => {
  const map: Record<string, { cls: string; label: string }> = {
    high: { cls: "kg-badge-high", label: "Hög" },
    medium: { cls: "kg-badge-medium", label: "Medium" },
    low: { cls: "kg-badge-low", label: "Låg" },
  };
  return map[s] || map.low;
};

const priorityIcon = (p: string) => {
  switch (p) {
    case "quick_win": return <Zap className="h-4 w-4 text-emerald-400" />;
    case "medium": return <Target className="h-4 w-4 text-amber-400" />;
    case "long_term": return <Clock className="h-4 w-4 text-sky-400" />;
    default: return <Target className="h-4 w-4 text-slate-500" />;
  }
};

export default function PublicGeoReportPage() {
  const { token } = useParams<{ token: string }>();
  const [scan, setScan] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectCount, setRedirectCount] = useState<number | null>(null);
  const pollCount = useRef(0);
  const startTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchScan = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-quick-scan-view`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 404 || res.status === 410) {
          setError(err.error || "Rapport ej tillgänglig");
          setScan(null);
          return "stop";
        }
        return "continue";
      }
      const data = await res.json();
      setScan(data);
      setError(null);
      setIsLoading(false);

      if (data.status === "completed" || data.status === "failed") {
        return "stop";
      }
      return "continue";
    } catch {
      return "continue";
    }
  }, [token]);

  // Dynamic browser tab title + OG meta tags
  useEffect(() => {
    if (!scan) return;
    const name = scan.company_name || scan.domain || "";
    const title = name ? `${name} – GEO Rapport` : "GEO Rapport";
    const description = name
      ? `GEO & AI-synlighetsrapport för ${name}`
      : "GEO & AI-synlighetsrapport";
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("name", "description", description);

    return () => {
      document.title = "CoFlow - CRM";
      setMeta("property", "og:title", "CoFlow - CRM");
      setMeta("property", "og:description", "CoFlow CRM");
      setMeta("name", "description", "CoFlow CRM");
    };
  }, [scan?.company_name, scan?.domain]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const result = await fetchScan();
      setIsLoading(false);
      pollCount.current++;
      if (result === "stop" || cancelled) return;
      const elapsed = Date.now() - startTime.current;
      if (elapsed > 90_000) {
        setError("timeout");
        return;
      }
      const interval = elapsed < 30_000 ? 1500 : Math.min(1500 * Math.pow(1.5, Math.floor((elapsed - 30_000) / 5000)), 12000);
      timerRef.current = setTimeout(poll, interval);
    };
    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [token, fetchScan]);

  useEffect(() => {
    if (scan?.status !== "completed" || redirectCount === null) return;
    if (redirectCount <= 0) return;
    const t = setTimeout(() => setRedirectCount((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [redirectCount, scan?.status]);

  useEffect(() => {
    if (scan?.status === "completed" && redirectCount === null) {
      // Don't auto-redirect on the public report page
    }
  }, [scan?.status]);

  // Loading state
  if (isLoading && !scan && !error) {
    return <Shell><ProgressView currentStep={1} domain="" /></Shell>;
  }

  // Timeout state
  if (error === "timeout") {
    return (
      <Shell>
        <div className="max-w-md mx-auto text-center py-20 animate-in">
          <div className="kg-icon-box kg-icon-warning mx-auto mb-6">
            <Clock className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2 tracking-tight">
            Analysen tar lite längre tid
          </h1>
          <p className="text-slate-400 text-sm mb-1.5 leading-relaxed max-w-xs mx-auto">
            Vi arbetar fortfarande med din rapport. Du får resultatet via email när det är klart.
          </p>
          <p className="text-slate-600 text-xs mb-8">
            Du kan stänga den här sidan — rapporten finns kvar på samma länk.
          </p>
          <button
            onClick={() => { startTime.current = Date.now(); pollCount.current = 0; setError(null); fetchScan(); }}
            className="kg-btn-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Kontrollera igen
          </button>
        </div>
      </Shell>
    );
  }

  // Real error (404/410)
  if (error && error !== "timeout") {
    return (
      <Shell>
        <div className="max-w-md mx-auto text-center py-20 animate-in">
          <div className="kg-icon-box kg-icon-error mx-auto mb-6">
            <XCircle className="h-7 w-7 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2 tracking-tight">Rapport ej tillgänglig</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </Shell>
    );
  }

  // Queued / running
  if (!scan || scan.status === "queued" || scan.status === "running") {
    return (
      <Shell>
        <ProgressView currentStep={scan?.progress_step ?? 1} domain={scan?.domain || ""} />
      </Shell>
    );
  }

  // Failed
  if (scan.status === "failed") {
    const bookingUrl = `https://kodcogeo.se/boka?email=${encodeURIComponent(scan.email || "")}&domain=${encodeURIComponent(scan.domain || "")}&utm_source=mini_report&utm_medium=cta&utm_campaign=geo_failed`;
    return (
      <Shell>
        <div className="max-w-md mx-auto text-center py-20 animate-in">
          <div className="kg-icon-box kg-icon-warning mx-auto mb-6">
            <AlertCircle className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2 tracking-tight">
            Vi kunde inte skapa mini-rapporten just nu
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            Du får fortfarande hjälp — vi har tagit emot din förfrågan och återkommer.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="kg-btn-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Försök igen
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="kg-btn-secondary"
            >
              <Mail className="h-4 w-4" />
              Kontakta oss
            </a>
          </div>
        </div>
      </Shell>
    );
  }

  // ──── Completed ────
  const geoScore = scan.geo_score ?? 0;
  const findings = (scan.top_findings || []) as any[];
  const actions = (scan.top_actions || []) as any[];
  const ctaBookingUrl = `https://kodcogeo.se/boka?email=${encodeURIComponent(scan.email || "")}&domain=${encodeURIComponent(scan.domain || "")}&score=${geoScore}&token=${token}&utm_source=mini_report&utm_medium=cta&utm_campaign=geo`;
  const ctaGuideUrl = `https://kodcogeo.se/geo-guide?utm_source=mini_report&utm_medium=cta&utm_campaign=geo`;

  return (
    <Shell>
      <div className="max-w-2xl mx-auto">
        {/* Hero score */}
        <div className="text-center pt-8 pb-10 animate-in">
          <div className="kg-score-ring mx-auto mb-5" style={{
            '--score-color': scoreColor(geoScore),
          } as React.CSSProperties}>
            <div className="kg-score-inner">
              <span className="text-5xl font-bold tabular-nums tracking-tight" style={{ color: scoreColor(geoScore) }}>
                {geoScore}
              </span>
            </div>
          </div>
          <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: scoreColor(geoScore) }}>
            {scoreLabel(geoScore)}
          </p>
          <p className="text-slate-500 text-xs mt-1.5 font-mono">{scan.domain}</p>
          {scan.company_name && (
            <p className="text-slate-300 text-sm font-medium mt-2">{scan.company_name}</p>
          )}
        </div>

        {/* Summary */}
        {scan.summary_short && (
          <section className="mb-10 animate-in stagger-1">
            <div className="kg-card p-5">
              <p className="text-slate-300 text-sm leading-relaxed">
                {scan.summary_short}
              </p>
            </div>
          </section>
        )}

        {/* Findings */}
        {findings.length > 0 && (
          <section className="mb-10 animate-in stagger-2">
            <h2 className="kg-section-title">
              <AlertCircle className="h-4 w-4 text-red-400" />
              Det här hindrar AI från att rekommendera er
            </h2>
            <div className="space-y-2.5">
              {findings.map((f: any, i: number) => {
                const badge = severityBadge(f.severity);
                return (
                  <div key={i} className="kg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-white/90">{f.title}</p>
                      <span className={`kg-badge ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    {f.why && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{f.why}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <section className="mb-10 animate-in stagger-3">
            <h2 className="kg-section-title">
              <Zap className="h-4 w-4 text-emerald-400" />
              Snabba förbättringar
            </h2>
            <div className="space-y-2.5">
              {actions.map((a: any, i: number) => (
                <div key={i} className="kg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{priorityIcon(a.priority)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90">{a.title}</p>
                      {a.steps && <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{a.steps}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Full analysis upsell */}
        <section className="mb-10 animate-in stagger-4">
          <div className="kg-card-accent p-6">
            <h2 className="text-sm font-semibold text-white mb-4 tracking-tight">
              En fullständig analys inkluderar
            </h2>
            <ul className="space-y-2.5 text-sm text-slate-300">
              {[
                "Djupanalys av upp till 25 sidor",
                "Komplett schema.org-granskning",
                "AI-citatanalys och entitetsoptimering",
                "Prioriterad åtgärdsplan med tidsuppskattningar",
                "Konkurrentjämförelse",
                "Anpassad kundrapport i PDF-format",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-8 space-y-4 animate-in stagger-5">
          <a
            href={ctaBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="kg-btn-cta"
          >
            Boka 15 min genomgång
            <ArrowRight className="h-4 w-4" />
          </a>
          <div>
            <a
              href={ctaGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="kg-link-secondary"
            >
              Läs GEO-guiden <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="text-[10px] text-slate-600">Öppnas i ny flik</p>
        </section>

        {/* Disclaimer */}
        <p className="text-[10px] text-slate-600 text-center mt-2 mb-2">
          Mini-rapporten är en snabbscan (5–8 sidor). Full analys ger mer precision.
        </p>
      </div>

      <footer className="border-t border-white/[0.06] mt-10 py-5 text-center">
        <p className="text-[11px] text-slate-600">
          Rapport genererad av{" "}
          <a href="https://kodcogeo.se" className="text-slate-500 hover:text-slate-300 transition-colors">
            Kod & Co
          </a>
        </p>
      </footer>
    </Shell>
  );
}

// ──── Sub-components ────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="kodcogeo-public">
      <div className="kg-glow kg-glow-tl" />
      <div className="kg-glow kg-glow-br" />
      <div className="relative z-10 min-h-screen px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
}

function ProgressView({ currentStep, domain }: { currentStep: number; domain: string }) {
  return (
    <div className="max-w-md mx-auto py-20">
      <div className="text-center mb-12 animate-in">
        <div className="kg-icon-box kg-icon-accent mx-auto mb-6">
          <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2 tracking-tight">
          Din rapport förbereds
        </h1>
        <p className="text-slate-500 text-xs">
          Det tar normalt 30–90 sekunder. Du får även resultatet via email.
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map(({ step, label }) => {
          const isActive = step === currentStep;
          const isDone = step < currentStep;
          return (
            <div
              key={step}
              className={`kg-step ${
                isActive ? "kg-step-active" : isDone ? "kg-step-done" : "kg-step-pending"
              }`}
            >
              <div className={`kg-step-dot ${
                isActive ? "kg-step-dot-active" : isDone ? "kg-step-dot-done" : "kg-step-dot-pending"
              }`}>
                {isDone ? <CheckCircle className="h-4 w-4" /> : step}
              </div>
              <span className={`text-sm ${
                isActive ? "text-white font-medium" : isDone ? "text-slate-400" : "text-slate-600"
              }`}>
                {label}
              </span>
              {isActive && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400 ml-auto" />
              )}
            </div>
          );
        })}
      </div>

      {domain && (
        <p className="text-center text-slate-600 text-[11px] mt-8 font-mono">
          Analyserar {domain}
        </p>
      )}
    </div>
  );
}
