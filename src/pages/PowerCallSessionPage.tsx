import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DEFAULT_CALL_OUTCOMES } from "@/lib/defaultCallOutcomes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  ArrowLeft,
  Phone,
  Globe,
  Building2,
  MapPin,
  PhoneMissed,
  CalendarClock,
  XCircle,
  MessageSquare,
  CalendarCheck,
  ArrowRight,
  Loader2,
  CheckCircle,
  Zap,
  BarChart3,
  AlertCircle,
  ExternalLink,
  X,
  Sparkles,
  Clock,
  Mail,
  MailOpen,
  PhoneCall,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  lead_status: string;
  last_call_at?: string | null;
  last_call_outcome_key?: string | null;
  source_data: Record<string, unknown> | null;
  webAnalysis?: { performance_score: number | null; seo_score: number | null; accessibility_score: number | null } | null;
  geoAnalysis?: { geo_score: number | null; summary: string | null } | null;
}

interface CallOutcome {
  id: string;
  key: string;
  label: string;
  color: string | null;
  icon: string | null;
  requires_note: boolean;
  requires_task: boolean;
  lead_status_effect: string | null;
  sort_order: number;
}

// ── Outcome colors ────────────────────────────────────────────────────────────

const COLOR_BASE: Record<string, string> = {
  slate: "border-border bg-muted/40 hover:bg-muted text-foreground",
  neutral: "border-border bg-muted/40 hover:bg-muted text-foreground",
  amber: "border-amber-400/50 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  green: "border-green-400/50 bg-green-50 hover:bg-green-100 text-green-900 dark:bg-green-950/30 dark:text-green-200",
  red: "border-red-400/50 bg-red-50 hover:bg-red-100 text-red-900 dark:bg-red-950/30 dark:text-red-200",
  blue: "border-blue-400/50 bg-blue-50 hover:bg-blue-100 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
};

const ICON_COMPONENT: Record<string, React.ComponentType<{ className?: string }>> = {
  "phone-missed": PhoneMissed,
  "calendar-clock": CalendarClock,
  "x-circle": XCircle,
  "message-square": MessageSquare,
  "calendar-check": CalendarCheck,
};

// ── Score badge ───────────────────────────────────────────────────────────────

function ScorePill({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const color =
    value >= 80
      ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
      : value >= 50
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", color)}>
      {label} {value}
    </span>
  );
}

// ── Pitch builder ─────────────────────────────────────────────────────────────

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function buildPitch(lead: Lead, t: TranslateFn): string[] {
  const name = lead.company_name || t("powerCall.session.pitchCompanyFallback");
  const web = lead.webAnalysis;
  const geo = lead.geoAnalysis;

  if (!web && !geo) {
    return [
      t("powerCall.session.pitchNoAnalysisOpening", { name }),
      t("powerCall.session.pitchNoAnalysisObservation"),
      t("powerCall.session.pitchNoAnalysisQuestion"),
      t("powerCall.session.pitchNoAnalysisCta"),
    ];
  }

  const perfNote = web?.performance_score !== null && web?.performance_score !== undefined && web.performance_score < 70
    ? t("powerCall.session.pitchPerfNote", { score: web.performance_score })
    : null;

  const geoNote = geo?.geo_score !== null && geo?.geo_score !== undefined && geo.geo_score < 80
    ? t("powerCall.session.pitchGeoNote", { score: geo.geo_score })
    : null;

  const obs = perfNote || geoNote || t("powerCall.session.pitchAnalysisFallbackObs");

  return [
    t("powerCall.session.pitchAnalysisOpening"),
    t("powerCall.session.pitchAnalysisObservation", { obs }),
    t("powerCall.session.pitchAnalysisQuestion"),
    t("powerCall.session.pitchAnalysisCta"),
  ];
}

// ── Edge function caller ──────────────────────────────────────────────────────

async function callEdgeFunction(name: string, body: Record<string, unknown>, token: string) {
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectRef}.supabase.co/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `${name} failed`);
  }
  return res.json();
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PowerCallSessionPage() {
  const [searchParams] = useSearchParams();
  const listId = searchParams.get("list");
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [isLoadingLead, setIsLoadingLead] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [callsThisSession, setCallsThisSession] = useState(0);
  const [nextReady, setNextReady] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [lastUsedEndpoints, setLastUsedEndpoints] = useState<{ web?: { name: string; payloadType: string }; geo?: { name: string; payloadType: string } } | null>(null);
  const prepareInFlight = useRef(false);

  // Outcome dialog
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("09:00");
  const [isSaving, setIsSaving] = useState(false);

  // List selector
  const [selectedListId, setSelectedListId] = useState<string>(listId || "all");

  // ── Outreach emails for current lead ────────────────────────────────────────
  const { data: outreachEmails = [] } = useQuery({
    queryKey: ["power-call-outreach", currentLead?.id],
    queryFn: async () => {
      if (!currentLead?.id) return [];
      const { data } = await supabase
        .from("sent_emails")
        .select("id, subject, created_at, opened_at, opened_count, source")
        .eq("lead_id", currentLead.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!currentLead?.id,
  });

  // ── Call history for current lead ──────────────────────────────────────────
  const { data: callHistory = [] } = useQuery({
    queryKey: ["power-call-history", currentLead?.id],
    queryFn: async () => {
      if (!currentLead?.id) return [];
      const { data } = await supabase
        .from("call_logs")
        .select("id, outcome_key, outcome_label, note, created_at, created_by")
        .eq("lead_id", currentLead.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!currentLead?.id,
  });

  // Lists query
  const { data: lists = [] } = useQuery({
    queryKey: ["power-call-lists", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from("power_call_lists")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Call outcomes
  const { data: outcomes = [] } = useQuery<CallOutcome[]>({
    queryKey: ["call-outcomes", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from("call_outcomes")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as CallOutcome[];
    },
    enabled: !!organizationId,
  });

  // ── Get auth token ───────────────────────────────────────────────────────────

  const getToken = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  // ── Poll session state every 3s when active ──────────────────────────────────

  useEffect(() => {
    if (!sessionStarted || !sessionId || sessionDone) return;
    const interval = setInterval(async () => {
      try {
        const token = await getToken();
        const result = await callEdgeFunction("power-call-session-state", { sessionId }, token);
        const s = result?.session;
        if (s) {
          setNextReady(s.next_ready || false);
          setIsPreloading(s.next_preparing || false);
        }
      } catch {
        // Best-effort poll
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionStarted, sessionId, sessionDone, getToken]);

  // ── Trigger prepare-next in background ───────────────────────────────────────

  const triggerPrepareNext = useCallback(async (sid: string) => {
    if (prepareInFlight.current) return;
    prepareInFlight.current = true;
    setIsPreloading(true);
    setNextReady(false);
    try {
      const token = await getToken();
      await callEdgeFunction("power-call-prepare-next", { sessionId: sid }, token);
    } catch {
      // Silently fail — preload is best-effort
    } finally {
      prepareInFlight.current = false;
    }
  }, [getToken]);

  // ── Start session ────────────────────────────────────────────────────────────

  const handleStartSession = useCallback(async () => {
    if (!user) return;
    setIsLoadingLead(true);
    setSessionDone(false);
    setCallsThisSession(0);
    try {
      const token = await getToken();
      const result = await callEdgeFunction(
        "power-call-start",
        { listId: selectedListId === "all" ? null : selectedListId },
        token
      );

      if (result.done || !result.currentLead) {
        setSessionDone(true);
        setSessionStarted(true);
        return;
      }

      setSessionId(result.sessionId);
      setCurrentLead(result.currentLead);
      setSessionStarted(true);

      // Start preloading next in background
      setTimeout(() => triggerPrepareNext(result.sessionId), 500);
    } catch (err) {
      toast({ title: t("powerCall.session.toastError"), description: t("powerCall.session.toastStartFailed"), variant: "destructive" });
    } finally {
      setIsLoadingLead(false);
    }
  }, [user, selectedListId, getToken, triggerPrepareNext, toast, t]);

  // ── Save outcome & advance ───────────────────────────────────────────────────

  const handleSaveAndNext = useCallback(async (andNext: boolean) => {
    if (!selectedOutcome || !sessionId || !currentLead) return;
    if (selectedOutcome.requires_note && !note.trim()) return;
    if (selectedOutcome.requires_task && !callbackDate) return;

    setIsSaving(true);
    try {
      const token = await getToken();
      let callbackAt: string | undefined;
      if (callbackDate) {
        callbackAt = new Date(`${callbackDate}T${callbackTime}:00`).toISOString();
      }

      if (andNext) {
        // Use power-call-next edge function
        const result = await callEdgeFunction("power-call-next", {
          sessionId,
          outcome: selectedOutcome.key,
          notes: note || undefined,
          callbackAt,
        }, token);

        toast({
          title: t("powerCall.session.toastSaved"),
          description: `${selectedOutcome.label}`,
        });

        setOutcomeOpen(false);
        setSelectedOutcome(null);
        setNote("");
        setCallbackDate("");
        setCallbackTime("09:00");
        setCallsThisSession((n) => n + 1);

        if (result.done || !result.currentLead) {
          setSessionDone(true);
          setCurrentLead(null);
        } else {
          setCurrentLead(result.currentLead);
          setNextReady(false);
          // Trigger preload for the next-next lead
          setTimeout(() => triggerPrepareNext(sessionId), 300);
        }
      } else {
        // Save only — use direct supabase insert (no navigation)
        let callbackTaskId: string | null = null;
        if (selectedOutcome.requires_task && callbackDate) {
          const dueDate = new Date(`${callbackDate}T${callbackTime}:00`);
          const { data: task } = await supabase
            .from("tasks")
            .insert({
              lead_id: currentLead.id,
              title: t("powerCall.session.callbackTaskTitle", { company: currentLead.company_name || t("powerCall.session.taskLeadFallback") }),
              description: note || null,
              priority: "medium",
              due_date: dueDate.toISOString(),
              status: "todo",
              assigned_to: user?.id,
              created_by: user?.id,
              organization_id: organizationId,
            })
            .select("id")
            .single();
          callbackTaskId = task?.id ?? null;
        }

        await supabase.from("call_logs").insert({
          organization_id: organizationId,
          lead_id: currentLead.id,
          outcome_key: selectedOutcome.key,
          outcome_label: selectedOutcome.label,
          note: note || null,
          callback_task_id: callbackTaskId,
          created_by: user?.id,
        });

        const leadUpdate: Record<string, unknown> = {
          last_call_outcome_key: selectedOutcome.key,
          last_call_at: new Date().toISOString(),
        };
        if (selectedOutcome.key === "booked") {
          leadUpdate.lead_status = "meeting_booked";
        }
        if (selectedOutcome.key === "not_interested") {
          leadUpdate.is_not_interested = true;
          leadUpdate.not_interested_at = new Date().toISOString();
          leadUpdate.not_interested_reason = note || null;
        }
        await supabase.from("leads").update(leadUpdate).eq("id", currentLead.id);

        toast({ title: t("powerCall.session.toastSaved"), description: selectedOutcome.label });
        setOutcomeOpen(false);
        setSelectedOutcome(null);
        setNote("");
        setCallbackDate("");
        setCallbackTime("09:00");
        setCallsThisSession((n) => n + 1);
      }
    } catch {
      toast({ title: t("powerCall.session.toastError"), description: t("powerCall.session.toastSaveFailed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [selectedOutcome, sessionId, currentLead, note, callbackDate, callbackTime, getToken, triggerPrepareNext, organizationId, user, toast, t]);

  // ── Skip lead ────────────────────────────────────────────────────────────────

  const handleSkip = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingLead(true);
    try {
      const token = await getToken();
      // Pass empty outcome (just advance)
      const result = await callEdgeFunction("power-call-next", { sessionId, outcome: null }, token);
      setCallsThisSession((n) => n + 1);
      if (result.done || !result.currentLead) {
        setSessionDone(true);
        setCurrentLead(null);
      } else {
        setCurrentLead(result.currentLead);
        setNextReady(false);
        setTimeout(() => triggerPrepareNext(sessionId), 300);
      }
    } catch {
      toast({ title: t("powerCall.session.toastError"), description: t("powerCall.session.toastSkipFailed"), variant: "destructive" });
    } finally {
      setIsLoadingLead(false);
    }
  }, [sessionId, getToken, triggerPrepareNext, toast, t]);

  // ── Generate analysis for current lead ──────────────────────────────────────

  const handleGenerateAnalysis = useCallback(async () => {
    if (!currentLead?.id) return;
    setIsGeneratingAnalysis(true);
    try {
      const token = await getToken();
      // ensure-lead-analyses loads candidates from analysis_endpoints DB table (name-agnostic)
      const result = await callEdgeFunction("ensure-lead-analyses", {
        leadId: currentLead.id,
        modules: { web: true, geo: true },
      }, token);

      // Capture which endpoints were actually used (for debug display)
      if (result?.used) {
        setLastUsedEndpoints(result.used);
      }

      const statusMsg = result?.hasWebsite === false
        ? t("powerCall.session.analysisNoWebsite")
        : t("powerCall.session.analysisStarted");
      toast({ title: t("powerCall.session.toastAnalysis"), description: statusMsg });

      // Poll for up to 30s until analysis appears
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const [webRes, geoRes] = await Promise.all([
          supabase.from("web_analyses").select("performance_score, seo_score, accessibility_score")
            .eq("lead_id", currentLead.id).order("created_at", { ascending: false }).limit(1),
          supabase.from("geo_analyses").select("geo_score, summary")
            .eq("lead_id", currentLead.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1),
        ]);
        if (webRes.data?.[0] || geoRes.data?.[0]) {
          setCurrentLead((prev) => prev ? {
            ...prev,
            webAnalysis: webRes.data?.[0] || prev.webAnalysis,
            geoAnalysis: geoRes.data?.[0] || prev.geoAnalysis,
          } : prev);
          toast({ title: t("powerCall.session.toastAnalysisDone"), description: t("powerCall.session.analysisPitchUpdated") });
          break;
        }
      }
    } catch {
      toast({ title: t("powerCall.session.toastAnalysisFailed"), variant: "destructive" });
    } finally {
      setIsGeneratingAnalysis(false);
    }
  }, [currentLead, getToken, toast, t]);

  // ── End session ─────────────────────────────────────────────────────────────

  const handleEndSession = useCallback(async () => {
    if (sessionId) {
      await supabase.from("power_call_sessions").update({
        status: "ended",
        ended_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    setSessionStarted(false);
    setCurrentLead(null);
    setSessionDone(false);
    setCallsThisSession(0);
    setSessionId(null);
    setNextReady(false);
  }, [sessionId]);

  // ── Pitch lines ─────────────────────────────────────────────────────────────

  const pitchLines = currentLead ? buildPitch(currentLead, t) : [];
  const hasAnalysis = !!(currentLead?.webAnalysis || currentLead?.geoAnalysis);

  // ── Start screen ─────────────────────────────────────────────────────────────

  if (!sessionStarted) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[70vh] p-4">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">{t("powerCall.session.title")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("powerCall.session.startSubtitle")}
              </p>
            </div>

            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("powerCall.session.selectListLabel")}</Label>
                  <Select value={selectedListId} onValueChange={setSelectedListId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("powerCall.session.allActiveLeads")}</SelectItem>
                      {lists.map((l: { id: string; name: string }) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStartSession}
                  disabled={isLoadingLead}
                >
                  {isLoadingLead ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Phone className="h-4 w-4 mr-2" />}
                  {t("powerCall.session.startSession")}
                </Button>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/outreach-pro"><ArrowLeft className="h-3.5 w-3.5 mr-1" />{t("powerCall.session.back")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Session done ─────────────────────────────────────────────────────────────

  if (sessionDone) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[70vh] p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">{t("powerCall.session.doneTitle")}</h2>
            <p className="text-muted-foreground">
              {t("powerCall.session.doneCount", { count: callsThisSession })}
            </p>
            <p className="text-sm text-muted-foreground">{t("powerCall.session.doneNoMore")}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={handleEndSession}>{t("powerCall.session.end")}</Button>
              <Button onClick={handleStartSession}>{t("powerCall.session.restart")}</Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Session header bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEndSession}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">{t("powerCall.session.active")}</span>
              <Badge variant="secondary" className="text-xs">{t("powerCall.session.callsBadge", { count: callsThisSession })}</Badge>
            </div>
          </div>

          {/* Preload status indicator */}
          <div className="flex items-center gap-3">
            {isPreloading ? (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("powerCall.session.preparingNext")}
              </span>
            ) : nextReady ? (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {t("powerCall.session.nextReady")}
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {t("powerCall.session.nextPreparing")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleEndSession}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              {t("powerCall.session.end")}
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingLead ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">{t("powerCall.session.loadingNext")}</p>
              </div>
            </div>
          ) : !currentLead ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">{t("powerCall.session.noLeads")}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-6 max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

                {/* ── A) Lead Snapshot ── */}
                <div className="lg:col-span-1 space-y-3">
                  <Card>
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <h2 className="text-lg font-bold leading-tight mb-0.5">
                          {currentLead.company_name || t("powerCall.session.unknownCompany")}
                        </h2>
                        {currentLead.source_data && typeof currentLead.source_data === 'object' && 'city' in currentLead.source_data && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {currentLead.source_data.city as string}
                          </p>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-2.5">
                        {currentLead.phone ? (
                          <a
                            href={`tel:${currentLead.phone}`}
                            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors group"
                          >
                            <Phone className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-semibold text-primary">{currentLead.phone}</span>
                            <span className="text-xs text-muted-foreground ml-auto group-hover:text-primary">{t("powerCall.session.callAction")}</span>
                          </a>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                            <Phone className="h-4 w-4" />
                            <span className="italic">{t("powerCall.session.phoneMissing")}</span>
                          </div>
                        )}

                        {currentLead.website ? (
                          <a
                            href={currentLead.website.startsWith("http") ? currentLead.website : `https://${currentLead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
                          >
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{currentLead.website}</span>
                            <ExternalLink className="h-3 w-3 ml-auto shrink-0" />
                          </a>
                        ) : null}

                        {currentLead.contact_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-1.5">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span>{currentLead.contact_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Score badges */}
                      {hasAnalysis && (
                        <>
                          <Separator />
                          <div className="flex flex-wrap gap-1.5">
                            <ScorePill label={t("powerCall.session.scorePerformance")} value={currentLead.webAnalysis?.performance_score ?? null} />
                            <ScorePill label={t("powerCall.session.scoreSeo")} value={currentLead.webAnalysis?.seo_score ?? null} />
                            <ScorePill label={t("powerCall.session.scoreGeo")} value={currentLead.geoAnalysis?.geo_score ?? null} />
                          </div>
                        </>
                      )}

                      {/* Generate analysis CTA */}
                      {currentLead.website && !hasAnalysis && (
                        <>
                          <Separator />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={handleGenerateAnalysis}
                            disabled={isGeneratingAnalysis}
                          >
                            {isGeneratingAnalysis ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {isGeneratingAnalysis ? t("powerCall.session.generatingAnalysis") : t("powerCall.session.generateAnalysis")}
                          </Button>
                          {/* Debug: show which endpoint was used */}
                          {lastUsedEndpoints && (
                            <p className="text-xs text-muted-foreground/60 font-mono">
                              {lastUsedEndpoints.web && `web: ${lastUsedEndpoints.web.name} (${lastUsedEndpoints.web.payloadType})`}
                              {lastUsedEndpoints.web && lastUsedEndpoints.geo && " · "}
                              {lastUsedEndpoints.geo && `geo: ${lastUsedEndpoints.geo.name} (${lastUsedEndpoints.geo.payloadType})`}
                            </p>
                          )}
                        </>
                      )}

                      <Separator />

                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground"
                        asChild
                      >
                        <Link to={`/leads/${currentLead.id}`} target="_blank">
                          {t("powerCall.session.openLeadCard")} <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  {/* ── Outreach status ── */}
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <h4 className="text-xs font-semibold">{t("powerCall.session.outreach")}</h4>
                      </div>
                      {outreachEmails.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t("powerCall.session.noMailSent")}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {outreachEmails.map((email: any) => (
                            <div key={email.id} className="flex items-start gap-2 text-xs">
                              {email.opened_at ? (
                                <MailOpen className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                              ) : (
                                <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{email.subject}</p>
                                <p className="text-muted-foreground">
                                  {format(new Date(email.created_at), "d MMM HH:mm", { locale: sv })}
                                  {email.opened_at && (
                                    <span className="text-green-600 dark:text-green-400 ml-1">
                                      · {email.opened_count > 1 ? t("powerCall.session.openedTimes", { count: email.opened_count }) : t("powerCall.session.opened")}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ── Call history ── */}
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
                        <h4 className="text-xs font-semibold">{t("powerCall.session.callHistory")}</h4>
                      </div>
                      {callHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t("powerCall.session.noPreviousCalls")}</p>
                      ) : (
                        <div className="space-y-2">
                          {callHistory.map((call: any) => (
                            <div key={call.id} className="text-xs border-l-2 border-muted pl-2.5 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{call.outcome_label}</Badge>
                                <span className="text-muted-foreground">
                                  {format(new Date(call.created_at), "d MMM HH:mm", { locale: sv })}
                                </span>
                              </div>
                              {call.note && (
                                <p className="text-muted-foreground line-clamp-2">{call.note}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ── B) Pitch / Manus ── */}
                <div className="lg:col-span-1 space-y-3">
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">{t("powerCall.session.pitchTitle")}</h3>
                        {!hasAnalysis && (
                          <Badge variant="outline" className="text-xs ml-auto">{t("powerCall.session.pitchGeneric")}</Badge>
                        )}
                      </div>
                      <ol className="space-y-3">
                        {pitchLines.map((line, i) => {
                          const [label, ...rest] = line.split(": ");
                          return (
                            <li key={i} className="flex gap-3">
                              <span className="text-xs font-bold text-primary shrink-0 mt-0.5 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                {i + 1}
                              </span>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-0.5">{label}</p>
                                <p className="text-sm leading-relaxed">{rest.join(": ")}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>

                      {currentLead.geoAnalysis?.summary && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium">{t("powerCall.session.geoSummary")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {currentLead.geoAnalysis.summary}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ── C) Outcome buttons ── */}
                <div className="lg:col-span-1 space-y-3">
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold mb-4">{t("powerCall.session.registerOutcome")}</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {(outcomes.length > 0 ? outcomes : (DEFAULT_CALL_OUTCOMES as CallOutcome[])).map((outcome) => {
                          const Icon = ICON_COMPONENT[outcome.icon || ""] || Phone;
                          const base = COLOR_BASE[outcome.color || "slate"] || COLOR_BASE.slate;
                          return (
                            <button
                              key={outcome.id}
                              onClick={() => {
                                setSelectedOutcome(outcome);
                                setNote("");
                                setCallbackDate("");
                                setCallbackTime("09:00");
                                setOutcomeOpen(true);
                              }}
                              className={cn(
                                "flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all text-left",
                                base,
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              {outcome.label}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSkip}
                    disabled={isLoadingLead}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    {t("powerCall.session.skip")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Outcome dialog ── */}
      <Dialog open={outcomeOpen} onOpenChange={setOutcomeOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {t("powerCall.session.logOutcome", { company: currentLead?.company_name || "" })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Outcome confirmation */}
            {selectedOutcome && (
              <div className={cn(
                "flex items-center gap-2.5 p-3 rounded-lg border font-medium text-sm",
                COLOR_BASE[selectedOutcome.color || "slate"]
              )}>
                {(() => {
                  const Icon = ICON_COMPONENT[selectedOutcome.icon || ""] || Phone;
                  return <Icon className="h-4 w-4 shrink-0" />;
                })()}
                {selectedOutcome.label}
              </div>
            )}

            {/* Note */}
            {selectedOutcome && (selectedOutcome.requires_note || ["callback", "answered", "not_interested"].includes(selectedOutcome.key)) && (
              <div className="space-y-1.5">
                <Label>
                  {t("powerCall.session.note")}{selectedOutcome.requires_note && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    selectedOutcome.key === "not_interested"
                      ? t("powerCall.session.notInterestedPlaceholder")
                      : selectedOutcome.key === "answered"
                      ? t("powerCall.session.summaryPlaceholder")
                      : t("powerCall.session.notePlaceholder")
                  }
                  rows={3}
                  autoFocus
                />
              </div>
            )}

            {/* Callback */}
            {selectedOutcome?.requires_task && (
              <div className="space-y-3 p-3 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20">
                <Label className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm">
                  <CalendarClock className="h-4 w-4" />
                  {t("powerCall.session.scheduleFollowUp")}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("powerCall.session.dateLabel")}</Label>
                    <Input
                      type="date"
                      value={callbackDate}
                      onChange={(e) => setCallbackDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("powerCall.session.timeLabel")}</Label>
                    <Input
                      type="time"
                      value={callbackTime}
                      onChange={(e) => setCallbackTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOutcomeOpen(false)} disabled={isSaving}>
              {t("powerCall.session.cancel")}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSaveAndNext(false)}
              disabled={isSaving || (selectedOutcome?.requires_note && !note.trim()) || (selectedOutcome?.requires_task && !callbackDate)}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {t("powerCall.session.save")}
            </Button>
            <Button
              onClick={() => handleSaveAndNext(true)}
              disabled={isSaving || (selectedOutcome?.requires_note && !note.trim()) || (selectedOutcome?.requires_task && !callbackDate)}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {t("powerCall.session.saveAndNext")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
