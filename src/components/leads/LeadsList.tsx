import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ExternalLink, 
  BarChart3,
  User,
  Mail,
  Phone,
  Users,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Send,
  Clock,
  CircleDashed,
  CheckCircle2,
  UserPlus,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Minus,
  Zap,
  Inbox,
  MoreHorizontal,
  Undo2,
  Calendar,
  FileText,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { LeadOwnerSelect } from "@/components/leads/LeadOwnerSelect";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers";
import type { LeadWithOutreachStatus } from "@/pages/LeadsPage";
import { useTranslation } from "@/i18n/LanguageProvider";

type OwnerFilter = "all" | "mine" | "unassigned" | string;
type SortField = "company_name" | "created_at" | "contact_name" | "source";
type SortDirection = "asc" | "desc";
type EnrichmentFilter = "all" | "ready_for_approval" | "processing" | "failed";

interface LeadsListProps {
  leads: LeadWithOutreachStatus[];
  onRefresh: () => void;
}

// Lightweight inline avatar display using pre-fetched data
function InlineLeadOwners({
  memberIds,
  membersMap,
  getInitials,
  leadId,
  currentOwnerId,
  onOwnerChange,
}: {
  memberIds: string[];
  membersMap: Map<string, TeamMember>;
  getInitials: (member: TeamMember) => string;
  leadId: string;
  currentOwnerId: string | null;
  onOwnerChange: () => void;
}) {
  const { t } = useTranslation();
  const [showPopover, setShowPopover] = useState(false);

  const assignedMembers = memberIds
    .map(id => membersMap.get(id))
    .filter((m): m is TeamMember => !!m);

  if (showPopover) {
    return (
      <LeadOwnerSelect
        leadId={leadId}
        currentOwnerId={currentOwnerId}
        onOwnerChange={() => {
          onOwnerChange();
          setShowPopover(false);
        }}
        compact
      />
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 p-0 rounded-full"
      onClick={() => setShowPopover(true)}
      title={
        assignedMembers.length > 0
          ? assignedMembers.map(m => m.full_name || m.email).join(", ")
          : t("leadsList.assignMembers")
      }
    >
      {assignedMembers.length === 0 ? (
        <div className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <UserPlus className="h-3 w-3 text-muted-foreground" />
        </div>
      ) : assignedMembers.length === 1 ? (
        <Avatar className="h-7 w-7">
          <AvatarImage src={assignedMembers[0].avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {getInitials(assignedMembers[0])}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex -space-x-2">
          {assignedMembers.slice(0, 3).map(m => (
            <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
              <AvatarImage src={m.avatar_url || undefined} />
              <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                {getInitials(m)}
              </AvatarFallback>
            </Avatar>
          ))}
          {assignedMembers.length > 3 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-medium">
              +{assignedMembers.length - 3}
            </div>
          )}
        </div>
      )}
    </Button>
  );
}

// Per-row "remove" action: releases the lead back to the shared pool. A reason
// is mandatory so the next seller understands why it was let go. The 30-day
// releaser cooldown is enforced server-side by claim_pool_lead.
function LeadRemoveAction({
  leadId,
  onReleased,
}: {
  leadId: string;
  onReleased: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleRelease = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("release_lead_to_pool", {
        _lead_id: leadId,
        _reason: reason.trim(),
      });
      if (error) throw error;
      toast({
        title: t("leadDetail.ll_backInPoolTitle"),
        description: t("leadDetail.ll_backInPoolDesc"),
      });
      setOpen(false);
      setReason("");
      onReleased();
    } catch (e: any) {
      toast({ title: t("leadDetail.ll_couldNotRemove"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Undo2 className="h-4 w-4 mr-2 text-muted-foreground" />
            {t("leadDetail.ll_removeFromMyLeads")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leadDetail.ll_removeDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("leadDetail.ll_removeDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="remove-reason">{t("leadDetail.ll_reasonLabel")}</Label>
            <Textarea
              id="remove-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("leadDetail.ll_reasonPlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("leadDetail.ll_cancel")}
            </Button>
            <Button onClick={handleRelease} disabled={loading || !reason.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("leadDetail.ll_returnBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LeadsList({ leads, onRefresh }: LeadsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hideNotInterested, setHideNotInterested] = useState(true);
  const [hideWorked, setHideWorked] = useState(true);
  const [showTest, setShowTest] = useState(false); // admin-only: reveal test/demo leads
  const [enrichmentFilter, setEnrichmentFilter] = useState<EnrichmentFilter>("all");
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState<{ processed: number; remaining: number } | null>(null);
  
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { members, membersMap, getInitials } = useTeamMembers();
  const { t } = useTranslation();
  const { toast } = useToast();

  const pendingCount = useMemo(() => leads.filter(l => l.enrichment_status === "pending").length, [leads]);

  // A lead sits in the shared pool when it has been released and is unassigned.
  const isPoolLead = useCallback(
    (lead: LeadWithOutreachStatus) => lead.assigned_to === null && !!(lead as any).released_at,
    [],
  );
  const poolLeads = useMemo(() => leads.filter(isPoolLead), [leads, isPoolLead]);

  const handleClaim = async (lead: LeadWithOutreachStatus) => {
    setClaimingId(lead.id);
    try {
      const { error } = await (supabase as any).rpc("claim_pool_lead", { _lead_id: lead.id });
      if (error) throw error;
      toast({
        title: t("leadDetail.ll_pickedUpTitle"),
        description: t("leadDetail.ll_pickedUpDesc"),
      });
      onRefresh();
    } catch (e: any) {
      toast({ title: t("leadDetail.ll_couldNotPickUp"), description: e.message, variant: "destructive" });
    } finally {
      setClaimingId(null);
    }
  };

  const handleProcessQueue = async () => {
    if (!leads[0]) return;
    // Derive org id from first lead
    const orgId = (leads[0] as any).organization_id;
    if (!orgId) return;

    setIsProcessingQueue(true);
    setQueueProgress(null);

    try {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.functions.invoke("process-enrichment-queue", {
        body: { organization_id: orgId },
      });
      if (data) {
        setQueueProgress({ processed: data.processed ?? 0, remaining: data.remaining ?? 0 });
      }
      onRefresh();
    } catch (e) {
      console.error("Queue processing error:", e);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  // Filter by lead status (hide not interested / invalid phone). Pool leads are
  // shown only under the dedicated "pool" filter, never mixed into normal views.
  // Non-pool leads after the hide/test filters — the base both the list AND the
  // owner-dropdown counts are derived from, so the counts match what's shown.
  const statusFilteredLeads = useMemo(() => {
    // Test/demo leads are hidden from everyone; an admin can reveal them with
    // the "Visa test"-toggle.
    const notTest = (l: LeadWithOutreachStatus) => (isAdmin && showTest) || !l.is_test;
    // While searching, show every matching saved lead regardless of the
    // hide-worked / hide-not-interested toggles — otherwise a lead you've
    // already called or marked "ej intresserad" can't be found at all.
    const searching = searchQuery.trim().length > 0;
    let base = leads.filter((l) => !isPoolLead(l)).filter(notTest);
    // Worked leads (logged call/email/meeting) live in the pipeline; hide them
    // from the leads list by default.
    if (hideWorked && !searching) base = base.filter((l) => !l.has_activity);
    if (!hideNotInterested || searching) return base;
    return base.filter((lead) => {
      const status = (lead as any).lead_status || "active";
      return status === "active" || status === "customer";
    });
  }, [leads, isPoolLead, hideNotInterested, hideWorked, searchQuery, isAdmin, showTest]);

  const poolVisible = useMemo(
    () => poolLeads.filter((l) => (isAdmin && showTest) || !l.is_test),
    [poolLeads, isAdmin, showTest],
  );

  // Filter by owner (using member_ids from lead_members table)
  const ownerFilteredLeads = useMemo(() => {
    if (ownerFilter === "pool") return poolVisible;
    return statusFilteredLeads.filter((lead) => {
      if (ownerFilter === "all") return true;
      if (ownerFilter === "mine") return lead.member_ids?.includes(user?.id || "") || lead.assigned_to === user?.id;
      if (ownerFilter === "unassigned") return (!lead.member_ids || lead.member_ids.length === 0) && lead.assigned_to === null;
      // Filter by specific team member
      return lead.member_ids?.includes(ownerFilter) || lead.assigned_to === ownerFilter;
    });
  }, [statusFilteredLeads, poolVisible, ownerFilter, user?.id]);

  // Filter by enrichment status
  const enrichmentFilteredLeads = useMemo(() => {
    if (enrichmentFilter === "all") return ownerFilteredLeads;
    return ownerFilteredLeads.filter((lead) => {
      switch (enrichmentFilter) {
        case "ready_for_approval":
          return lead.enrichment_status === "ready" && lead.auto_draft_generated === true;
        case "processing":
          return lead.enrichment_status === "processing" || lead.enrichment_status === "pending";
        case "failed":
          return lead.enrichment_status === "failed";
        default:
          return true;
      }
    });
  }, [ownerFilteredLeads, enrichmentFilter]);

  // Progressive search filter
  const searchFilteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return enrichmentFilteredLeads;
    
    const query = searchQuery.toLowerCase().trim();
    return enrichmentFilteredLeads.filter((lead) => {
      const searchableFields = [
        lead.company_name,
        lead.contact_name,
        lead.email,
        lead.phone,
        lead.website,
      ];
      return searchableFields.some(field => 
        field?.toLowerCase().includes(query)
      );
    });
  }, [enrichmentFilteredLeads, searchQuery]);

  // Sort leads
  const sortedLeads = useMemo(() => {
    return [...searchFilteredLeads].sort((a, b) => {
      let aVal: string | null = null;
      let bVal: string | null = null;

      switch (sortField) {
        case "company_name":
          aVal = a.company_name?.toLowerCase() || "";
          bVal = b.company_name?.toLowerCase() || "";
          break;
        case "contact_name":
          aVal = a.contact_name?.toLowerCase() || "";
          bVal = b.contact_name?.toLowerCase() || "";
          break;
        case "source":
          aVal = a.source;
          bVal = b.source;
          break;
        case "created_at":
        default:
          aVal = a.created_at;
          bVal = b.created_at;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [searchFilteredLeads, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleLeadOwnerChange = () => {
    onRefresh();
  };

  const handleAnalyzeLead = (lead: LeadWithOutreachStatus) => {
    if (lead.website) {
      navigate(`/web-analysis?url=${encodeURIComponent(lead.website)}`);
    }
  };

  // Pool leads have no owner, but we can show WHO released them to the pool
  // (leads.released_by, set on release). Resolve the name via the team member map.
  const renderPooledBy = (lead: LeadWithOutreachStatus) => {
    const rb = (lead as any).released_by as string | undefined;
    if (!isPoolLead(lead) || !rb) return null;
    const m = membersMap.get(rb);
    const name = m?.full_name || m?.email || "?";
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Avatar className="h-4 w-4">
                <AvatarImage src={m?.avatar_url || undefined} alt={name} />
                <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{m ? getInitials(m) : "?"}</AvatarFallback>
              </Avatar>
              {name}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("leadsList.pooledBy", { name })}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getOutreachStatusBadge = (lead: LeadWithOutreachStatus) => {
    switch (lead.outreach_status) {
      case "sequence_active":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="gap-1 bg-blue-500 hover:bg-blue-600 text-white">
                  <Clock className="h-3 w-3" />
                  {t("leadsList.badgeSequence")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("leadsList.tipSequenceActive")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "email_sent":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <Send className="h-3 w-3" />
                  {t("leadsList.mailBadge", { count: lead.email_count })}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("leadsList.tipMailsSent", { count: lead.email_count })}</p>
                {lead.sequence_status && lead.sequence_status !== 'active' && (
                  <p className="text-xs text-muted-foreground">{t("leadsList.sequenceLabel", { status: lead.sequence_status })}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "none":
      default:
        // No email outreach, but the lead may have been worked by phone — show
        // the latest call outcome ("Ej intresserad", "Ringa igen", …) instead of
        // a misleading "Ej kontaktad".
        if (lead.has_call) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.last_call_label || t("leadsList.contacted")}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("leadsList.tipCalled")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        // A booked meeting (data was loaded but previously ignored) or a pipeline
        // status that implies the lead has been worked — don't misreport as "Ej kontaktad".
        {
          const ls = (lead as any).lead_status as string | undefined;
          if (lead.has_meeting || ls === "meeting_booked") {
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-transparent">
                      <Calendar className="h-3 w-3" />
                      {t("leadsList.contactMeetingBooked")}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("leadsList.tipMeetingBooked")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          const STAGE: Record<string, { label: string; icon: JSX.Element; className: string }> = {
            offer_sent: { label: t("leadsList.contactOfferSent"), icon: <FileText className="h-3 w-3" />, className: "bg-amber-100 text-amber-700 hover:bg-amber-200 border-transparent" },
            won: { label: t("leadsList.contactWon"), icon: <Trophy className="h-3 w-3" />, className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-transparent" },
            contacted: { label: t("leadsList.contacted"), icon: <CheckCircle2 className="h-3 w-3" />, className: "" },
            callback: { label: t("leadsList.contactCallback"), icon: <Phone className="h-3 w-3" />, className: "" },
          };
          if (ls && STAGE[ls]) {
            const s = STAGE[ls];
            return (
              <Badge variant="secondary" className={`gap-1 ${s.className}`}>
                {s.icon}
                {s.label}
              </Badge>
            );
          }
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <CircleDashed className="h-3 w-3" />
                  {t("leadsList.notContacted")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("leadsList.tipNoContact")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
    }
  };

  const getAnalysisStatusBadge = (lead: LeadWithOutreachStatus) => {
    if (lead.has_analysis) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className="gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Web analyses deep-link to the analysis page; GEO/SEO/report-only
                  // analyses have no web_analysis id, so open the lead's analysis view.
                  if (lead.analysis_id) navigate(`/web-analysis?id=${lead.analysis_id}`);
                  else navigate(`/leads/${lead.id}`);
                }}
              >
                <CheckCircle2 className="h-3 w-3" />
                {t("leadsList.analyzed")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("leadsList.tipClickAnalysis")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    if (lead.website) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="gap-1 text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyzeLead(lead);
                }}
              >
                <BarChart3 className="h-3 w-3" />
                {t("leadsList.notAnalyzed")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("leadsList.tipClickAnalyze")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <span className="text-xs text-muted-foreground">-</span>
    );
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'web_analysis':
        return <Badge variant="secondary">{t("leadsList.sourceWebAnalysis")}</Badge>;
      case 'firecrawl':
        return <Badge variant="secondary">Firecrawl</Badge>;
      case 'manual':
        return <Badge variant="outline">{t("leadsList.sourceManual")}</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  const getEnrichmentBadge = (lead: LeadWithOutreachStatus) => {
    const status = lead.enrichment_status;
    const hasDraft = lead.enrichment_status === "ready" && lead.auto_draft_generated === true;

    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground text-[10px]">
            <Minus className="h-3 w-3" />
            {t("leadsList.enrPending")}
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("leadsList.enrProcessing")}
          </Badge>
        );
      case "ready":
        return (
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="gap-1 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
              <CheckCircle className="h-3 w-3" />
              {t("leadsList.enrReady")}
            </Badge>
            {hasDraft && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-primary">
                      <Mail className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("leadsList.tipDraftPending")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <AlertTriangle className="h-3 w-3" />
            {t("leadsList.enrFailed")}
          </Badge>
        );
      case "needs_enrichment":
        return (
          <Badge variant="secondary" className="gap-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            <Zap className="h-3 w-3" />
            {t("leadsList.enrNeedsEnrichment")}
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground text-[10px]">
            <Minus className="h-3 w-3" />
            –
          </Badge>
        );
      default:
        return null;
    }
  };

  // Counts shown in the owner dropdown — derived from the SAME filtered base as
  // the visible list, so e.g. "Mina (N)" matches the number of leads shown.
  const mineCount = statusFilteredLeads.filter(l => l.member_ids?.includes(user?.id || "") || l.assigned_to === user?.id).length;
  const unassignedCount = statusFilteredLeads.filter(l => (!l.member_ids || l.member_ids.length === 0) && l.assigned_to === null).length;
  const poolCount = poolVisible.length;

  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">
            {t("leadsList.pendingAnalysis", { count: pendingCount })}
            {queueProgress && (
              <span className="ml-2 text-muted-foreground">
                {t("leadsList.queueProgress", { processed: queueProgress.processed, remaining: queueProgress.remaining })}
              </span>
            )}
          </span>
          <Button size="sm" onClick={handleProcessQueue} disabled={isProcessingQueue}>
            {isProcessingQueue ? (
              <><Loader2 className="mr-2 h-3 w-3 animate-spin" />{t("leadsList.enrProcessing")}</>
            ) : (
              <><Zap className="mr-2 h-3 w-3" />{t("leadsList.startAnalysis")}</>
            )}
          </Button>
        </div>
      )}
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle className="text-lg">{t("leadsList.savedLeads")}</CardTitle>
            <CardDescription>
              {t("leadsList.showingCount", { shown: sortedLeads.length, total: leads.length })}
            </CardDescription>
          </div>
          
          {/* Search and Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("leadsList.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Owner Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select value={ownerFilter} onValueChange={(value) => setOwnerFilter(value)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t("leadsList.ownerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t("leadsList.ownerAll", { count: leads.length })}
                    </div>
                  </SelectItem>
                  <SelectItem value="mine">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t("leadsList.ownerMine", { count: mineCount })}
                    </div>
                  </SelectItem>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-dashed border-muted-foreground/40" />
                      {t("leadsList.ownerUnassigned", { count: unassignedCount })}
                    </div>
                  </SelectItem>
                  <SelectItem value="pool">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4" />
                      {t("leadDetail.ll_availableInPool", { count: poolCount })}
                    </div>
                  </SelectItem>
                  {isAdmin && members.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                        {t("leadsList.teamMembers")}
                      </div>
                      {members
                        .filter(m => m.id !== user?.id)
                        .map((member) => {
                          const memberLeads = statusFilteredLeads.filter(l => l.member_ids?.includes(member.id) || l.assigned_to === member.id).length;
                          return (
                            <SelectItem key={member.id} value={member.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={member.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                    {getInitials(member)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate">
                                  {member.full_name || member.email.split("@")[0]}
                                </span>
                                <span className="text-muted-foreground">({memberLeads})</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Enrichment Filter */}
            <Select value={enrichmentFilter} onValueChange={(v) => setEnrichmentFilter(v as EnrichmentFilter)}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue placeholder={t("leadsList.enrichmentPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leadsList.enrAll")}</SelectItem>
                <SelectItem value="ready_for_approval">{t("leadsList.enrReadyApproval")}</SelectItem>
                <SelectItem value="processing">{t("leadsList.enrUnderProcessing")}</SelectItem>
                <SelectItem value="failed">{t("leadsList.enrFailedPlural")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t("leadsList.sortPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">{t("leadsList.sortDate")}</SelectItem>
                <SelectItem value="company_name">{t("leadsList.sortCompany")}</SelectItem>
                <SelectItem value="contact_name">{t("leadsList.sortContact")}</SelectItem>
                <SelectItem value="source">{t("leadsList.sortSource")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visibility toggles */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="hide-not-interested"
                checked={hideNotInterested}
                onCheckedChange={setHideNotInterested}
              />
              <Label htmlFor="hide-not-interested" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                {t("leadsList.hideNotInterested")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="hide-worked"
                checked={hideWorked}
                onCheckedChange={setHideWorked}
              />
              <Label htmlFor="hide-worked" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                {t("leadDetail.ll_hideWorked")}
              </Label>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Switch id="show-test" checked={showTest} onCheckedChange={setShowTest} />
                <Label htmlFor="show-test" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  {t("leadsList.showTest")}
                </Label>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
            <Search className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
              {leads.length === 0 ? t("leadsList.emptyNoLeads") : t("leadsList.emptyNoMatch")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {leads.length === 0
                ? t("leadsList.emptyNoLeadsDesc")
                : t("leadsList.emptyNoMatchDesc")
              }
            </p>
            {(ownerFilter !== "all" || searchQuery) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setOwnerFilter("all");
                  setSearchQuery("");
                }}
              >
                {t("leadsList.clearFilters")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="flex flex-col gap-2 p-4 md:hidden">
              {sortedLeads.map((lead) => (
                <div 
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {lead.company_name || t("leadsList.noCompany")}
                          {lead.is_test && <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold text-amber-600 align-middle">TEST</span>}
                        </p>
                        {lead.website && (
                          <a 
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {lead.contact_name && (
                        <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>
                      )}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {isPoolLead(lead) ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5 whitespace-nowrap"
                          disabled={claimingId === lead.id}
                          onClick={() => handleClaim(lead)}
                        >
                          {claimingId === lead.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Inbox className="h-3.5 w-3.5" />
                          )}
                          {t("leadDetail.ll_pickUp")}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <InlineLeadOwners
                            memberIds={lead.member_ids}
                            membersMap={membersMap}
                            getInitials={getInitials}
                            leadId={lead.id}
                            currentOwnerId={lead.assigned_to}
                            onOwnerChange={handleLeadOwnerChange}
                          />
                          <LeadRemoveAction leadId={lead.id} onReleased={onRefresh} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {isPoolLead(lead) && (
                      <Badge variant="outline" className="gap-1">
                        <Inbox className="h-3 w-3" />
                        {(lead as any).released_reason || t("leadDetail.ll_freeInPool")}
                      </Badge>
                    )}
                    {renderPooledBy(lead)}
                    {getEnrichmentBadge(lead)}
                    {getOutreachStatusBadge(lead)}
                    <LeadStatusBadge
                      leadStatus={(lead as any).lead_status}
                      notInterestedReason={(lead as any).not_interested_reason}
                    />
                    {lead.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{lead.email}</span>
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </span>
                    )}
                    {getSourceBadge(lead.source)}
                    {getAnalysisStatusBadge(lead)}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">{t("leadsList.colOwner")}</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("company_name")}
                    >
                      <div className="flex items-center">
                        {t("leadsList.colCompany")}
                        <SortIcon field="company_name" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("contact_name")}
                    >
                      <div className="flex items-center">
                        {t("leadsList.colContact")}
                        <SortIcon field="contact_name" />
                      </div>
                    </TableHead>
                    <TableHead>{t("leadsList.colEmail")}</TableHead>
                    <TableHead>{t("leadsList.colPhone")}</TableHead>
                    <TableHead>{t("leadsList.colEnrichment")}</TableHead>
                    <TableHead>{t("leadsList.colContactStatus")}</TableHead>
                    <TableHead>{t("leadsList.colAnalysis")}</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("source")}
                    >
                      <div className="flex items-center">
                        {t("leadsList.colSource")}
                        <SortIcon field="source" />
                      </div>
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLeads.map((lead) => (
                    <TableRow 
                      key={lead.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isPoolLead(lead) ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1.5 whitespace-nowrap"
                              disabled={claimingId === lead.id}
                              onClick={() => handleClaim(lead)}
                            >
                              {claimingId === lead.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Inbox className="h-3.5 w-3.5" />
                              )}
                              {t("leadDetail.ll_pickUp")}
                            </Button>
                            {(lead as any).released_reason && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                                      <Inbox className="h-3 w-3" />
                                      {t("leadDetail.ll_free")}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-[240px]">{(lead as any).released_reason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {renderPooledBy(lead)}
                          </div>
                        ) : (
                          <InlineLeadOwners
                            memberIds={lead.member_ids}
                            membersMap={membersMap}
                            getInitials={getInitials}
                            leadId={lead.id}
                            currentOwnerId={lead.assigned_to}
                            onOwnerChange={handleLeadOwnerChange}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {lead.company_name || "-"}
                          {lead.is_test && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold text-amber-600">TEST</span>}
                          {lead.website && (
                            <a 
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{lead.contact_name || "-"}</TableCell>
                      <TableCell>{lead.email || "-"}</TableCell>
                      <TableCell>{lead.phone || "-"}</TableCell>
                      <TableCell>{getEnrichmentBadge(lead)}</TableCell>
                      <TableCell>{getOutreachStatusBadge(lead)}</TableCell>
                      <TableCell>{getAnalysisStatusBadge(lead)}</TableCell>
                      <TableCell>{getSourceBadge(lead.source)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                        {!isPoolLead(lead) && (
                          <LeadRemoveAction leadId={lead.id} onReleased={onRefresh} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
