import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Send,
  XCircle,
  Loader2,
  Building2,
  Mail,
  Clock,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { FollowUpEmailDialog } from "./FollowUpEmailDialog";
import { useTranslation } from "@/i18n/LanguageProvider";

interface FollowUpLead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  last_contact_at: string;
}

async function fetchFollowUpData() {
  // Fetch active leads with email
  const { data: activeLeads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, company_name, contact_name, email, created_at")
    .eq("lead_status", "active")
    .not("email", "is", null);

  if (leadsErr) throw leadsErr;
  if (!activeLeads?.length) return { activeLeads: [], sentEmails: [], activeSequenceLeadIds: new Set<string>() };

  const leadIds = activeLeads.map((l) => l.id);

  // Batch the two sub-queries in parallel
  const [sentResult, seqResult] = await Promise.all([
    supabase
      .from("sent_emails")
      .select("lead_id, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_sequences")
      .select("lead_id")
      .in("lead_id", leadIds)
      .eq("status", "active"),
  ]);

  const activeSequenceLeadIds = new Set(
    seqResult.data?.map((s) => s.lead_id) || []
  );

  return {
    activeLeads,
    sentEmails: sentResult.data || [],
    activeSequenceLeadIds,
  };
}

export function MailFollowUp() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNotInterestedDialog, setShowNotInterestedDialog] = useState(false);
  const [notInterestedLeadIds, setNotInterestedLeadIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [markingLoading, setMarkingLoading] = useState(false);
  const [followUpLeadIds, setFollowUpLeadIds] = useState<string[]>([]);
  const [minDays, setMinDays] = useState<number>(7);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: ["follow-up-leads"],
    queryFn: fetchFollowUpData,
    staleTime: 2 * 60 * 1000,
  });

  // Derive filtered/sorted leads from cached data + local filter state
  const leads: FollowUpLead[] = (() => {
    if (!rawData?.activeLeads?.length) return [];

    const lastContactMap = new Map<string, string>();
    for (const e of rawData.sentEmails) {
      if (e.lead_id && !lastContactMap.has(e.lead_id)) {
        lastContactMap.set(e.lead_id, e.created_at);
      }
    }

    const cutoffDate = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000);

    return rawData.activeLeads
      .filter((lead) => {
        const lastContact = lastContactMap.get(lead.id);
        if (!lastContact) return false;
        if (rawData.activeSequenceLeadIds.has(lead.id)) return false;
        if (new Date(lastContact) > cutoffDate) return false;
        return true;
      })
      .map((lead) => ({
        id: lead.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        email: lead.email,
        last_contact_at: lastContactMap.get(lead.id)!,
      }))
      .sort((a, b) => {
        const diff =
          new Date(a.last_contact_at).getTime() -
          new Date(b.last_contact_at).getTime();
        return sortDir === "asc" ? diff : -diff;
      });
  })();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["follow-up-leads"] });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  };

  const openNotInterested = (leadIds: string[]) => {
    setNotInterestedLeadIds(leadIds);
    setReason("");
    setShowNotInterestedDialog(true);
  };

  const handleMarkNotInterested = async () => {
    setMarkingLoading(true);
    try {
      for (const id of notInterestedLeadIds) {
        const { error } = await supabase
          .from("leads")
          .update({
            lead_status: "not_interested",
            is_not_interested: true,
            not_interested_at: new Date().toISOString(),
            not_interested_reason: reason || null,
          })
          .eq("id", id);
        if (error) throw error;
      }
      toast({
        title: t("mail.followUp.markedNotInterested", {
          count: notInterestedLeadIds.length,
        }),
      });
      setShowNotInterestedDialog(false);
      setSelected(new Set());
      invalidate();
    } catch (e: any) {
      toast({ title: t("mail.followUp.error"), description: e.message, variant: "destructive" });
    } finally {
      setMarkingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leads.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {t("mail.followUp.emptyTitle")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("mail.followUp.emptyDesc")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">{t("mail.followUp.lastContactLabel")}</span>
          <Select value={String(minDays)} onValueChange={(v) => setMinDays(Number(v))}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("mail.followUp.over7days")}</SelectItem>
              <SelectItem value="14">{t("mail.followUp.over2weeks")}</SelectItem>
              <SelectItem value="30">{t("mail.followUp.over30days")}</SelectItem>
              <SelectItem value="60">{t("mail.followUp.over60days")}</SelectItem>
              <SelectItem value="90">{t("mail.followUp.over90days")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">{t("mail.followUp.sortLabel")}</span>
          <Select value={sortDir} onValueChange={(v) => setSortDir(v as "asc" | "desc")}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t("mail.followUp.oldestFirst")}</SelectItem>
              <SelectItem value="desc">{t("mail.followUp.newestFirst")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {t("mail.followUp.leadsCount", { count: leads.length })}
        </Badge>
      </div>
      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">
            {selected.size} lead(s) valda
          </span>
          <Button
            size="sm"
            onClick={() => setFollowUpLeadIds(Array.from(selected))}
          >
            <Send className="h-4 w-4 mr-1" />
            Skicka uppföljning
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openNotInterested(Array.from(selected))}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Ej intresserad
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === leads.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Företag</TableHead>
                <TableHead className="hidden md:table-cell">Kontakt</TableHead>
                <TableHead className="hidden sm:table-cell">E-post</TableHead>
                <TableHead className="hidden lg:table-cell">{t("mail.followUp.lastContactLabel")}</TableHead>
                <TableHead className="text-right">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="font-medium hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {lead.company_name || t("mail.unknownCompany")}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {lead.contact_name || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {lead.email}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(lead.last_contact_at), {
                        addSuffix: true,
                        locale: sv,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFollowUpLeadIds([lead.id])}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        <span className="hidden sm:inline">{t("mail.tabFollowUp")}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openNotInterested([lead.id])}
                      >
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Not Interested Dialog */}
      <Dialog
        open={showNotInterestedDialog}
        onOpenChange={setShowNotInterestedDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Markera som Ej intresserad</DialogTitle>
            <DialogDescription>
              {notInterestedLeadIds.length === 1
                ? "Denna lead filtreras bort från uppföljning."
                : `${notInterestedLeadIds.length} leads filtreras bort från uppföljning.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="ni-reason">Anledning (valfritt)</Label>
            <Textarea
              id="ni-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="T.ex. har redan leverantör, inte aktuellt..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNotInterestedDialog(false)}
            >{t("mail.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={handleMarkNotInterested}
              disabled={markingLoading}
            >
              {markingLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Bekräfta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up email dialog */}
      {followUpLeadIds.length > 0 && (
        <FollowUpEmailDialog
          leadIds={followUpLeadIds}
          onClose={() => setFollowUpLeadIds([])}
          onSent={() => {
            setFollowUpLeadIds([]);
            setSelected(new Set());
            invalidate();
          }}
        />
      )}
    </div>
  );
}
