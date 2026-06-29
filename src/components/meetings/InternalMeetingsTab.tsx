import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, CalendarClock, CheckCircle2, XCircle, Zap } from "lucide-react";

const RECIPIENTS = [
  { email: "robert@applabbet.com", name: "Robert" },
  { email: "oliver@applabbet.com", name: "Oliver" },
];
const CATEGORIES = [
  { value: "teknisk", label: "Teknisk fråga" },
  { value: "salj", label: "Säljstöd / coachning" },
  { value: "offert", label: "Offert & prissättning" },
  { value: "kund", label: "Kund & leverans" },
  { value: "ovrigt", label: "Övrigt" },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label || v;
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" }) : null);

interface MeetingRequest {
  id: string;
  requested_by: string;
  recipient_emails: string[];
  category: string;
  description: string;
  preferred_time: string | null;
  urgency: string;
  status: string;
  scheduled_time: string | null;
  meeting_link: string | null;
  response_note: string | null;
  created_at: string;
}

export function InternalMeetingsTab() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const canRespond = isAdmin || RECIPIENTS.some((r) => r.email === user?.email);

  const { data: requests = [], refetch, isLoading } = useQuery({
    queryKey: ["meeting-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("meeting_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as MeetingRequest[];
    },
  });

  // Resolve requester names.
  const { data: names = {} } = useQuery({
    queryKey: ["meeting-request-names", requests.map((r) => r.requested_by).join(",")],
    enabled: requests.length > 0,
    queryFn: async () => {
      const ids = [...new Set(requests.map((r) => r.requested_by))];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email; });
      return map;
    },
  });

  // ── Create dialog ──
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([RECIPIENTS[0].email, RECIPIENTS[1].email]);
  const [category, setCategory] = useState("teknisk");
  const [description, setDescription] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);

  const toggleRecipient = (email: string) =>
    setRecipients((r) => (r.includes(email) ? r.filter((e) => e !== email) : [...r, email]));

  const submit = async () => {
    if (!recipients.length) { toast({ title: "Välj minst en mottagare", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ title: "Skriv en kort beskrivning", variant: "destructive" }); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-meeting", {
        body: {
          recipientEmails: recipients,
          category,
          description: description.trim(),
          preferredTime: preferredTime ? new Date(preferredTime).toISOString() : null,
          urgency: urgent ? "bradskande" : "normal",
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Möteförfrågan skickad", description: "De får ett mejl och en notis." });
      setOpen(false);
      setDescription(""); setPreferredTime(""); setUrgent(false);
      refetch();
    } catch (e: any) {
      toast({ title: "Kunde inte skicka", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // ── Respond dialog ──
  const [respondTo, setRespondTo] = useState<{ req: MeetingRequest; action: "confirm" | "decline" } | null>(null);
  const [schedTime, setSchedTime] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [responding, setResponding] = useState(false);

  const sendResponse = async () => {
    if (!respondTo) return;
    setResponding(true);
    try {
      const { data, error } = await supabase.functions.invoke("respond-meeting-request", {
        body: {
          id: respondTo.req.id,
          action: respondTo.action,
          scheduledTime: respondTo.action === "confirm" && schedTime ? new Date(schedTime).toISOString() : null,
          meetingLink: link || null,
          note: note || null,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: respondTo.action === "confirm" ? "Möte bekräftat" : "Förfrågan avböjd" });
      setRespondTo(null); setSchedTime(""); setLink(""); setNote("");
      refetch();
    } catch (e: any) {
      toast({ title: "Kunde inte svara", description: e.message, variant: "destructive" });
    } finally {
      setResponding(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "confirmed") return <Badge className="bg-green-600 hover:bg-green-600">Bekräftat</Badge>;
    if (s === "declined") return <Badge variant="destructive">Avböjt</Badge>;
    if (s === "done") return <Badge variant="secondary">Klart</Badge>;
    return <Badge variant="outline">Väntar</Badge>;
  };

  const sorted = useMemo(
    () => [...requests].sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1)),
    [requests],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">Boka ett internt möte med Robert och/eller Oliver.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Boka möte med oss
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
          Inga mötesförfrågningar än.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{catLabel(r.category)}</span>
                    {r.urgency === "bradskande" && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Zap className="h-3 w-3" /> Brådskande</span>
                    )}
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Från {r.requested_by === user?.id ? "dig" : (names[r.requested_by] || "säljare")}
                    {" · till "}{r.recipient_emails.map((e) => RECIPIENTS.find((x) => x.email === e)?.name || e).join(" & ")}
                  </p>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{r.description}</p>
                  <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                    {r.preferred_time && <div><CalendarClock className="inline h-3 w-3 mr-1" />Önskad tid: {fmt(r.preferred_time)}</div>}
                    {r.status === "confirmed" && r.scheduled_time && <div className="text-green-600">Bokat: {fmt(r.scheduled_time)}</div>}
                    {r.meeting_link && <div><a href={r.meeting_link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{r.meeting_link}</a></div>}
                    {r.response_note && <div>Svar: {r.response_note}</div>}
                  </div>
                </div>
                {canRespond && r.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setRespondTo({ req: r, action: "confirm" })}>
                      <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" /> Bekräfta
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRespondTo({ req: r, action: "decline" })}>
                      <XCircle className="h-4 w-4 mr-1 text-destructive" /> Avböj
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Boka möte med oss</DialogTitle>
            <DialogDescription>De får ett mejl och en notis i CRM:et.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Vem vill du träffa?</Label>
              <div className="flex flex-col gap-2">
                {RECIPIENTS.map((r) => (
                  <label key={r.email} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={recipients.includes(r.email)} onCheckedChange={() => toggleRecipient(r.email)} />
                    {r.name} <span className="text-muted-foreground">({r.email})</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Vad gäller det?</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="mr-desc" className="mb-1.5 block">Kort beskrivning</Label>
              <Textarea id="mr-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Vad vill du ta upp på mötet?" />
            </div>
            <div>
              <Label htmlFor="mr-time" className="mb-1.5 block">Önskad tid (valfritt)</Label>
              <Input id="mr-time" type="datetime-local" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={urgent} onCheckedChange={setUrgent} /> Brådskande
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Avbryt</Button>
            <Button onClick={submit} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Skicka förfrågan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond dialog */}
      <Dialog open={!!respondTo} onOpenChange={(o) => !o && setRespondTo(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{respondTo?.action === "confirm" ? "Bekräfta möte" : "Avböj förfrågan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {respondTo?.action === "confirm" && (
              <>
                <div>
                  <Label htmlFor="resp-time" className="mb-1.5 block">Tid</Label>
                  <Input id="resp-time" type="datetime-local" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="resp-link" className="mb-1.5 block">Möteslänk (valfritt)</Label>
                  <Input id="resp-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="resp-note" className="mb-1.5 block">Meddelande (valfritt)</Label>
              <Textarea id="resp-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondTo(null)}>Avbryt</Button>
            <Button onClick={sendResponse} disabled={responding} variant={respondTo?.action === "decline" ? "destructive" : "default"}>
              {responding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {respondTo?.action === "confirm" ? "Bekräfta" : "Avböj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
