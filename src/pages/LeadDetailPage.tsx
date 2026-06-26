import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  ArrowRight,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  BarChart3,
  Clock,
  Plus,
  PhoneCall,
  MessageSquare,
  Calendar,
  FileText,
  CheckCircle,
  Loader2,
  Edit,
  
  Send,
  UserCircle,
  ListTodo,
  AlertCircle,
  Trash2,
  MoreHorizontal,
  Search,
  Hash,
  Users,
  Sparkles
} from "lucide-react";
import { OutreachSequenceManager } from "@/components/outreach/OutreachSequenceManager";
import { CreateGrowthReportDialog } from "@/components/reports/growth/CreateGrowthReportDialog";

import { SingleEmailGenerator } from "@/components/leads/SingleEmailGenerator";
import { EmailThreadView } from "@/components/leads/EmailThreadView";
import { LeadOwnerSelect } from "@/components/leads/LeadOwnerSelect";
import { EmailFinder } from "@/components/leads/EmailFinder";
import { WebsiteContactScraper } from "@/components/leads/WebsiteContactScraper";
import { FleetDataSection } from "@/components/leads/FleetDataSection";
import { ActivityTimeline } from "@/components/leads/ActivityTimeline";
import { CompetitorAnalysis } from "@/components/leads/CompetitorAnalysis";
import { AnalysisCenter } from "@/components/leads/AnalysisCenter";
import { EnrichLeadButton } from "@/components/leads/EnrichLeadButton";
import { LogCallDialog } from "@/components/leads/LogCallDialog";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { LeadStatusActions } from "@/components/leads/LeadStatusActions";
import { UserAvatar, usePrefetchProfiles } from "@/components/ui/user-avatar";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { webAnalysisApi } from "@/lib/api/webAnalysis";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { useModules } from "@/hooks/useModules";
import { useLeadQueue } from "@/hooks/useLeadQueue";


interface Lead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  source: string;
  source_data: Record<string, unknown> | null;
  created_at: string;
  assigned_to: string | null;
  org_number: string | null;
  lead_status: string;
  not_interested_at: string | null;
  not_interested_reason: string | null;
  enrichment_status: string | null;
  auto_draft_generated: boolean | null;
}

interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task_completed';
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  user_id: string | null;
}

interface WebAnalysis {
  id: string;
  url: string;
  performance_score: number | null;
  accessibility_score: number | null;
  seo_score: number | null;
  best_practices_score: number | null;
  analyzed_by: string | null;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

const activityTypes = [
  { value: 'call', label: 'Samtal', icon: PhoneCall },
  { value: 'email', label: 'E-post', icon: Mail },
  { value: 'meeting', label: 'Möte', icon: Calendar },
  { value: 'note', label: 'Anteckning', icon: FileText },
] as const;

function AutoEnrichButton({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-enrich-lead", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      toast({ title: t("leadDetail.ldp_analysisStarted"), description: data?.status === "skipped" ? t("leadDetail.ldp_leadSkipped") : t("leadDetail.ldp_autoEnrichRunning") });
      onDone();
    } catch (e: any) {
      toast({ title: t("leadDetail.ldp_error"), description: e.message || t("leadDetail.ldp_couldNotStartAnalysis"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline" size="sm">
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
      {t("leadDetail.ldp_analyzeAutomatically")}
    </Button>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getNextId } = useLeadQueue();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { hasModuleAccess } = useModules();
  
  const queryClient = useQueryClient();

  // Core lead data query
  const { data: leadQueryData, isLoading } = useQuery({
    queryKey: ['lead-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('No id');
      
      const leadRes = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
      if (leadRes.error || !leadRes.data) throw new Error('Lead not found');
      const leadData = leadRes.data as Lead;

      const orgDigits = leadData.org_number ? leadData.org_number.replace(/\D/g, '') : null;

      const [analysesRes, urlAnalyses, tasksRes, fleetDataRes, seoAnalysesRes, companyRegistryRes] = await Promise.all([
        supabase.from('web_analyses').select('id, url, performance_score, accessibility_score, seo_score, best_practices_score, analyzed_by, created_at').eq('lead_id', id).order('created_at', { ascending: false }).limit(20),
        leadData.website ? webAnalysisApi.findAnalysesByUrl(leadData.website) : Promise.resolve([]),
        supabase.from('tasks').select('id, title, description, status, priority, due_date, assigned_to, created_at').eq('lead_id', id).in('status', ['todo', 'in_progress']).order('due_date', { ascending: true }).limit(100),
        supabase.from('lead_fleet_data').select('vehicle_count, phone_subscription_count, phone_operator, leasing_company, vehicles, phone_numbers').eq('lead_id', id).maybeSingle(),
        supabase.from('seo_analyses').select('visibility_score, ai_summary, ai_opportunities, primary_keywords, estimated_keywords, raw_data').eq('lead_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        orgDigits
          ? supabase.from('company_registry').select('company_name, legal_form, company_form, city, postal_code, address, sni_codes, sni_descriptions, registration_date, status, business_description, revenue, revenue_year').eq('org_number', orgDigits).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // Merge analyses
      const leadIdAnalyses = (analysesRes.data || []) as WebAnalysis[];
      const allAnalyses = [...leadIdAnalyses];
      for (const urlAnalysis of urlAnalyses) {
        if (!allAnalyses.find(a => a.id === urlAnalysis.id)) {
          allAnalyses.push({
            id: urlAnalysis.id, url: urlAnalysis.url,
            performance_score: urlAnalysis.performance_score, accessibility_score: urlAnalysis.accessibility_score,
            seo_score: urlAnalysis.seo_score, best_practices_score: urlAnalysis.best_practices_score,
            analyzed_by: urlAnalysis.analyzed_by || null, created_at: urlAnalysis.created_at,
          });
        }
      }
      allAnalyses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const fleetData = !fleetDataRes.error && fleetDataRes.data ? {
        vehicle_count: fleetDataRes.data.vehicle_count,
        phone_subscription_count: fleetDataRes.data.phone_subscription_count,
        phone_operator: fleetDataRes.data.phone_operator,
        leasing_company: fleetDataRes.data.leasing_company,
        vehicles: Array.isArray(fleetDataRes.data.vehicles) ? fleetDataRes.data.vehicles : null,
        phone_numbers: Array.isArray(fleetDataRes.data.phone_numbers) ? fleetDataRes.data.phone_numbers : null,
      } : null;

      // Use estimated_keywords (real DataForSEO ranked keywords) over primary_keywords (on-page word frequency)
      const rawData = seoAnalysesRes.data?.raw_data as any;
      const estimatedKw = seoAnalysesRes.data?.estimated_keywords as any[];
      const rankedKw = rawData?.ranked_keywords as any[];
      // Prefer ranked_keywords from raw_data, then estimated_keywords, then primary_keywords as last resort
      const bestKeywords = (rankedKw && rankedKw.length > 0)
        ? rankedKw.slice(0, 20).map((k: any) => ({ keyword: k.keyword, position: k.position, search_volume: k.search_volume, traffic: k.traffic }))
        : (estimatedKw && estimatedKw.length > 0)
          ? estimatedKw
          : Array.isArray(seoAnalysesRes.data?.primary_keywords) ? seoAnalysesRes.data.primary_keywords as any[] : null;

      const seoData = !seoAnalysesRes.error && seoAnalysesRes.data ? {
        visibility_score: seoAnalysesRes.data.visibility_score,
        ai_summary: seoAnalysesRes.data.ai_summary,
        ai_opportunities: Array.isArray(seoAnalysesRes.data.ai_opportunities)
          ? (seoAnalysesRes.data.ai_opportunities as Array<{ title: string; priority: string }>)
          : null,
        primary_keywords: bestKeywords,
        raw_data: rawData || null,
      } : null;

      return { lead: leadData, analyses: allAnalyses, tasks: (tasksRes.data || []) as Task[], fleetData, seoData, companyRegistry: companyRegistryRes.data ?? null };
    },
    enabled: !!id,
  });

  const lead = leadQueryData?.lead ?? null;
  const analyses = leadQueryData?.analyses ?? [];
  const tasks = leadQueryData?.tasks ?? [];
  const fleetData = leadQueryData?.fleetData ?? null;
  const seoData = leadQueryData?.seoData ?? null;
  const companyRegistry = leadQueryData?.companyRegistry ?? null;

  // Check for existing growth report for this lead
  const { data: existingGrowthReport } = useQuery({
    queryKey: ['existing-growth-report', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reports')
        .select('id')
        .eq('lead_id', id!)
        .eq('report_type', 'complete_growth_report')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const invalidateLead = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['lead-detail', id] });
  }, [queryClient, id]);

  const [activeTab, setActiveTab] = useState<"timeline" | "emails" | "outreach" | "analyses" | "competitors">("timeline");
  const [showGrowthReportDialog, setShowGrowthReportDialog] = useState(false);
  const [showLogCallDialog, setShowLogCallDialog] = useState(false);
  const mailTabRef = useRef<HTMLDivElement | null>(null);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [activityForm, setActivityForm] = useState({
    type: 'note' as Activity['type'],
    title: '',
    description: '',
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    due_date: '',
  });

  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    org_number: '',
  });

  // Sync edit form when lead data loads
  useEffect(() => {
    if (lead) {
      setEditForm({
        company_name: lead.company_name || '',
        contact_name: lead.contact_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        website: lead.website || '',
        org_number: lead.org_number || '',
      });
    }
  }, [lead?.id]);

  // TEMP debug: find the element that causes horizontal overflow in Mail tab on mobile.
  // Enable by setting localStorage.setItem('debugOverflow', '1') in devtools.
  useEffect(() => {
    const enabled = typeof window !== "undefined" && window.localStorage?.getItem("debugOverflow") === "1";
    if (!enabled) return;
    if (activeTab !== "emails") return;

    const root = mailTabRef.current;
    if (!root) return;

    const run = () => {
      const rootWidth = root.clientWidth;
      const offenders: Array<{ tag: string; className: string; sw: number; cw: number; text: string }> = [];

      const nodes = Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => el.offsetParent !== null);
      for (const el of nodes) {
        const sw = el.scrollWidth;
        const cw = el.clientWidth;
        if (sw > cw + 1 && sw > rootWidth + 1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            className: (el.getAttribute("class") || "").slice(0, 200),
            sw,
            cw,
            text: (el.textContent || "").trim().slice(0, 80),
          });
          // Visual mark
          el.style.outline = "2px solid red";
          el.style.outlineOffset = "-2px";
        }
      }

      if (offenders.length) {
         
        console.log("[overflow-debug] offenders:", offenders);
      } else {
         
        console.log("[overflow-debug] no offenders found");
      }
    };

    const t = window.setTimeout(run, 250);
    return () => window.clearTimeout(t);
  }, [activeTab]);

  // fetchLeadData replaced by useQuery above

  const handleAddActivity = async () => {
    if (!id) return;
    const isNote = activityForm.type === 'note';
    const trimmedTitle = activityForm.title.trim();
    const trimmedDescription = activityForm.description.trim();
    // Notes can be saved with just text — a missing title falls back to
    // "Anteckning". Other activity types still require a title.
    if (isNote) {
      if (!trimmedTitle && !trimmedDescription) return;
    } else if (!trimmedTitle) {
      return;
    }
    const finalTitle = trimmedTitle || t("leadDetail.ldp_note");

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('activities').insert({
        lead_id: id,
        type: activityForm.type,
        title: finalTitle,
        description: trimmedDescription || null,
        user_id: user?.id,
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Logging outreach (email/meeting) claims an unassigned lead for the
      // caller — only if currently unassigned, so it never takes someone else's.
      if ((activityForm.type === "email" || activityForm.type === "meeting") && user?.id) {
        await supabase.from("leads").update({ assigned_to: user.id }).eq("id", id).is("assigned_to", null);
      }

      toast({
        title: t("leadDetail.ldp_activityAdded"),
        description: t("leadDetail.ldp_activityAddedDesc", { title: finalTitle }),
      });

      setShowActivityDialog(false);
      setActivityForm({ type: 'note', title: '', description: '' });
      invalidateLead();

    } catch (error) {
      toast({
        title: t("leadDetail.ldp_error"),
        description: t("leadDetail.ldp_couldNotAddActivity"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || !editForm.company_name) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('leads').update({
        company_name: editForm.company_name,
        contact_name: editForm.contact_name || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        website: editForm.website || null,
        org_number: editForm.org_number || null,
      }).eq('id', id);

      if (error) throw error;

      toast({
        title: t("leadDetail.ldp_saved"),
        description: t("leadDetail.ldp_leadInfoUpdated"),
      });

      setIsEditMode(false);
      invalidateLead();

    } catch (error) {
      toast({
        title: t("leadDetail.ldp_error"),
        description: t("leadDetail.ldp_couldNotSaveChanges"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTask = async () => {
    if (!taskForm.title || !id) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingTask) {
        // Update existing task
        const { error } = await supabase.from('tasks').update({
          title: taskForm.title,
          description: taskForm.description || null,
          priority: taskForm.priority,
          due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
        }).eq('id', editingTask.id);

        if (error) throw error;

        toast({
          title: t("leadDetail.ldp_taskUpdated"),
          description: t("leadDetail.ldp_taskUpdatedDesc", { title: taskForm.title }),
        });
      } else {
        // Create new task
        const { error } = await supabase.from('tasks').insert({
          lead_id: id,
          title: taskForm.title,
          description: taskForm.description || null,
          priority: taskForm.priority,
          due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
          status: 'todo',
          assigned_to: user?.id,
          created_by: user?.id,
        });

        if (error) throw error;

        toast({
          title: t("leadDetail.ldp_taskCreated"),
          description: t("leadDetail.ldp_taskAddedDesc", { title: taskForm.title }),
        });
      }

      setShowTaskDialog(false);
      setEditingTask(null);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
      invalidateLead();

    } catch (error) {
      toast({
        title: t("leadDetail.ldp_error"),
        description: editingTask ? t("leadDetail.ldp_couldNotUpdateTask") : t("leadDetail.ldp_couldNotCreateTask"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
    });
    setShowTaskDialog(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsDeletingTask(taskId);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      
      if (error) throw error;

      toast({
        title: t("leadDetail.ldp_taskDeleted"),
        description: t("leadDetail.ldp_taskRemoved"),
      });
      
      invalidateLead();
    } catch (error) {
      toast({
        title: t("leadDetail.ldp_error"),
        description: t("leadDetail.ldp_couldNotDeleteTask"),
        variant: "destructive",
      });
    } finally {
      setIsDeletingTask(null);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);
      
      if (error) throw error;

      toast({
        title: t("leadDetail.ldp_taskDone"),
        description: t("leadDetail.ldp_taskMarkedDone"),
      });
      
      invalidateLead();
    } catch (error) {
      toast({
        title: t("leadDetail.ldp_error"),
        description: t("leadDetail.ldp_couldNotUpdateTask"),
        variant: "destructive",
      });
    }
  };

  const openNewTaskDialog = () => {
    setEditingTask(null);
    setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
    setShowTaskDialog(true);
  };

  const handleAnalyze = () => {
    if (lead?.website) {
      navigate(`/web-analysis?url=${encodeURIComponent(lead.website)}&leadId=${id}`);
    }
  };



  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPriorityBadge = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return <Badge variant="destructive" className="text-[10px]">{t("leadDetail.ldp_priorityUrgent")}</Badge>;
      case 'high': return <Badge variant="destructive" className="text-[10px] bg-orange-500">{t("leadDetail.ldp_priorityHigh")}</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-[10px]">{t("leadDetail.ldp_priorityMedium")}</Badge>;
      case 'low': return <Badge variant="outline" className="text-[10px]">{t("leadDetail.ldp_priorityLow")}</Badge>;
    }
  };

  // Prefetch all user profiles for activities, analyses, and tasks
  usePrefetchProfiles([
    ...analyses.map(a => a.analyzed_by),
    ...tasks.map(t => t.assigned_to),
  ]);

  if (isLoading) {
    return (
      <AppLayout title={t("leadDetail.ldp_loading")}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <AppLayout title={lead.company_name || t("leadDetail.lc_leadFallback")}>
      <div className="space-y-4 md:space-y-6">
        {/* Header - Mobile optimized */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/leads')} className="shrink-0 -ml-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl md:text-2xl font-bold text-foreground truncate">{lead.company_name || t("leadDetail.ldp_unknownCompany")}</h2>
                {lead.company_name && (
                  <button
                    onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(lead.company_name || '')}`, '_blank')}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={t("leadDetail.ldp_searchGoogle")}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                )}
                <LeadStatusBadge
                  leadStatus={lead.lead_status}
                  notInterestedReason={lead.not_interested_reason}
                />
                <LeadStatusActions
                  leadId={lead.id}
                  leadStatus={lead.lead_status}
                  onStatusChange={() => invalidateLead()}
                />
                <LeadOwnerSelect
                  leadId={lead.id}
                  currentOwnerId={lead.assigned_to}
                  onOwnerChange={() => invalidateLead()}
                  compact
                />
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                {t("leadDetail.ldp_createdAt", { date: format(new Date(lead.created_at), "d MMMM yyyy", { locale: sv }) })}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 ml-auto"
              onClick={() => {
                const next = getNextId(lead.id);
                if (next) navigate(`/leads/${next}`);
              }}
              disabled={!getNextId(lead.id)}
              title={t("leadDetail.ldp_nextLead")}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Action buttons - stack on mobile */}
          <div className="flex flex-wrap gap-2">
            {!isEditMode && (
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} className="flex-1 sm:flex-none">
                <Edit className="mr-2 h-4 w-4" />
                {t("leadDetail.ldp_edit")}
              </Button>
            )}
           {lead.website && (
              <Button size="sm" onClick={handleAnalyze} className="flex-1 sm:flex-none">
                <BarChart3 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{t("leadDetail.ldp_analyzeWebsite")}</span>
                <span className="sm:hidden">{t("leadDetail.ldp_analyzeShort")}</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`/quotes?newFromLead=${id}`)} className="flex-1 sm:flex-none">
              <FileText className="mr-2 h-4 w-4" />
              {t("leadDetail.ldp_createQuote")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => existingGrowthReport ? navigate(`/reports/${existingGrowthReport.id}`) : setShowGrowthReportDialog(true)}
              className="flex-1 sm:flex-none"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{existingGrowthReport ? t("leadDetail.ldp_viewReport") : t("leadDetail.ldp_completeReport")}</span>
              <span className="sm:hidden">{t("leadDetail.ldp_reportShort")}</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Contact Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <Building2 className="h-4 w-4 md:h-5 md:w-5" />
                  {t("leadDetail.ldp_contactInformation")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditMode ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("leadDetail.ldp_companyName")}</Label>
                        <Input
                          value={editForm.company_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, company_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("leadDetail.ldp_contactPerson")}</Label>
                        <Input
                          value={editForm.contact_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, contact_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("leadDetail.ldp_email")}</Label>
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("leadDetail.ldp_phone")}</Label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("leadDetail.ldp_website")}</Label>
                        <Input
                          value={editForm.website}
                          onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("leadDetail.ldp_orgNumber")}</Label>
                        <Input
                          value={editForm.org_number}
                          onChange={(e) => setEditForm(prev => ({ ...prev, org_number: e.target.value }))}
                          placeholder="XXXXXX-XXXX"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveEdit} disabled={isSaving || !editForm.company_name}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t("leadDetail.ldp_save")}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditMode(false)}>
                        {t("leadDetail.ldp_cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t("leadDetail.ldp_contactPerson")}</p>
                        <p className="font-medium">{lead.contact_name || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{t("leadDetail.ldp_email")}</p>
                        {lead.email ? (
                          <div className="flex items-center gap-2">
                            <a href={`mailto:${lead.email}`} className="font-medium text-primary hover:underline">
                              {lead.email}
                            </a>
                            {/* Firecrawl scraper - first option if we need more data */}
                            <WebsiteContactScraper
                              leadId={lead.id}
                              website={lead.website}
                              companyName={lead.company_name}
                              onDataExtracted={() => invalidateLead()}
                            />
                            {/* Firecrawl-based enrichment as secondary trigger */}
                            <EmailFinder
                              leadId={lead.id}
                              website={lead.website}
                              companyName={lead.company_name}
                              contactName={lead.contact_name}
                              currentEmail={lead.email}
                              onEmailFound={() => invalidateLead()}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">-</span>
                            {/* Firecrawl scraper - primary option for finding email */}
                            <WebsiteContactScraper
                              leadId={lead.id}
                              website={lead.website}
                              companyName={lead.company_name}
                              onDataExtracted={() => invalidateLead()}
                            />
                            {/* Firecrawl-based enrichment as secondary trigger */}
                            <EmailFinder
                              leadId={lead.id}
                              website={lead.website}
                              companyName={lead.company_name}
                              contactName={lead.contact_name}
                              currentEmail={null}
                              onEmailFound={() => invalidateLead()}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t("leadDetail.ldp_phone")}</p>
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} className="font-medium text-primary hover:underline">
                            {lead.phone}
                          </a>
                        ) : (
                          <p className="font-medium">-</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t("leadDetail.ldp_website")}</p>
                        {lead.website ? (
                          <a 
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {lead.website}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="font-medium">-</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Hash className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t("leadDetail.ldp_orgNumber")}</p>
                        <p className="font-medium">{lead.org_number || "-"}</p>
                      </div>
                    </div>
                    {/* Official company data from Bolagsverket (via company_registry) */}
                    {companyRegistry && (
                      <div className="sm:col-span-2">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-semibold">Officiell företagsinformation</p>
                            <span className="text-xs text-muted-foreground">· Bolagsverket</span>
                            {companyRegistry.status && (
                              <span
                                className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                                  companyRegistry.status === "Avregistrerad"
                                    ? "bg-destructive/15 text-destructive"
                                    : companyRegistry.status === "Aktiv"
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {companyRegistry.status}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {companyRegistry.legal_form && (
                              <div>
                                <p className="text-xs text-muted-foreground">Juridisk form</p>
                                <p className="font-medium">{companyRegistry.legal_form}</p>
                              </div>
                            )}
                            {companyRegistry.address && (
                              <div>
                                <p className="text-xs text-muted-foreground">Adress</p>
                                <p className="font-medium">{companyRegistry.address}</p>
                              </div>
                            )}
                            {(companyRegistry.postal_code || companyRegistry.city) && (
                              <div>
                                <p className="text-xs text-muted-foreground">Ort</p>
                                <p className="font-medium">{[companyRegistry.postal_code, companyRegistry.city].filter(Boolean).join(' ')}</p>
                              </div>
                            )}
                            {companyRegistry.registration_date && (
                              <div>
                                <p className="text-xs text-muted-foreground">Registrerad</p>
                                <p className="font-medium">{companyRegistry.registration_date}</p>
                              </div>
                            )}
                            {companyRegistry.revenue && (
                              <div>
                                <p className="text-xs text-muted-foreground">Omsättning</p>
                                {companyRegistry.revenue_year && (
                                  <p className="text-xs text-muted-foreground">{companyRegistry.revenue_year}</p>
                                )}
                                <p className="font-medium">{companyRegistry.revenue}</p>
                              </div>
                            )}
                            {(companyRegistry.sni_descriptions || companyRegistry.sni_codes) && (
                              <div className="sm:col-span-2">
                                <p className="text-xs text-muted-foreground">Bransch (SNI)</p>
                                <p className="font-medium">{companyRegistry.sni_descriptions || companyRegistry.sni_codes}</p>
                              </div>
                            )}
                            {companyRegistry.business_description && (
                              <div className="sm:col-span-2">
                                <p className="text-xs text-muted-foreground">Verksamhet</p>
                                <p className="font-medium">{companyRegistry.business_description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Enrich button when missing website or email */}
                    {(!lead.website || !lead.email) && (
                      <div className="sm:col-span-2">
                        <EnrichLeadButton
                          leadId={lead.id}
                          companyName={lead.company_name}
                          orgNumber={lead.org_number}
                          website={lead.website}
                          onEnriched={invalidateLead}
                        />
                      </div>
                    )}
                    {/* Auto-enrichment re-run button */}
                    {(lead.enrichment_status === 'failed' || lead.auto_draft_generated === false) && (
                      <div className="sm:col-span-2">
                        <AutoEnrichButton leadId={lead.id} onDone={invalidateLead} />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs for Activities & Analyses */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="min-w-0">
              <TabsList className="w-full h-auto grid grid-cols-3 sm:grid-cols-5 sm:flex gap-1">
                <TabsTrigger value="timeline" className="flex-1 min-w-0 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("leadDetail.ldp_tabTimeline")}</span>
                  <span className="sm:hidden text-[10px] truncate">{t("leadDetail.ldp_tabTimelineShort")}</span>
                </TabsTrigger>
                <TabsTrigger value="emails" className="flex-1 min-w-0 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
                  <Mail className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("leadDetail.ldp_tabMail")}</span>
                  <span className="sm:hidden text-[10px] truncate">{t("leadDetail.ldp_tabMail")}</span>
                </TabsTrigger>
                <TabsTrigger value="outreach" className="flex-1 min-w-0 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
                  <Send className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("leadDetail.ldp_tabSequences")}</span>
                  <span className="sm:hidden text-[10px] truncate">{t("leadDetail.ldp_tabSequencesShort")}</span>
                </TabsTrigger>
                <TabsTrigger value="analyses" className="flex-1 min-w-0 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
                  <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("leadDetail.ldp_tabAnalyses")}</span>
                  <span className="sm:hidden text-[10px] truncate">{t("leadDetail.ldp_tabAnalysesShort")}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">({analyses.length})</span>
                </TabsTrigger>
                <TabsTrigger value="competitors" className="flex-1 min-w-0 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 py-2 px-2 sm:px-3 text-xs sm:text-sm">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{t("leadDetail.ldp_tabCompetitors")}</span>
                  <span className="sm:hidden text-[10px] truncate">{t("leadDetail.ldp_tabCompetitorsShort")}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-3 sm:mt-4">
                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="text-base md:text-lg flex items-center gap-2">
                      <Clock className="h-4 w-4 md:h-5 md:w-5" />
                      {t("leadDetail.ldp_completeTimeline")}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {t("leadDetail.ldp_timelineDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <ActivityTimeline 
                      leadId={lead.id}
                      leadCreatedAt={lead.created_at}
                      leadSource={lead.source}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="emails" className="mt-3 sm:mt-4 overflow-hidden">
                <div ref={mailTabRef} className="w-full max-w-full overflow-hidden space-y-4">
                  {/* Email Thread View - shows all conversations (sent + replies) */}
                  <EmailThreadView 
                    leadId={id!} 
                    leadName={lead.company_name || undefined}
                    className="w-full max-w-full"
                  />
                  
                  {/* Single Email Generator */}
                  <SingleEmailGenerator
                    leadId={id!}
                    leadEmail={lead.email}
                    leadName={lead.company_name}
                    contactName={lead.contact_name}
                    website={lead.website}
                    analyses={analyses}
                    fleetData={fleetData}
                    seoData={seoData}
                    onEmailSent={() => invalidateLead()}
                  />
                </div>
              </TabsContent>

              <TabsContent value="outreach" className="mt-3 sm:mt-4">
                <OutreachSequenceManager 
                  leadId={id!}
                  leadEmail={lead.email}
                  leadName={lead.company_name}
                />
              </TabsContent>

              <TabsContent value="analyses" className="mt-3 sm:mt-4">
                <AnalysisCenter
                  leadId={id!}
                  website={lead.website}
                  analyses={analyses}
                  seoData={seoData}
                  onNavigateAnalyze={handleAnalyze}
                />
              </TabsContent>

              <TabsContent value="competitors" className="mt-3 sm:mt-4">
                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="text-base md:text-lg flex items-center gap-2">
                      <Users className="h-4 w-4 md:h-5 md:w-5" />
                      {t("leadDetail.ldp_competitorAnalysis")}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {t("leadDetail.ldp_competitorDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <CompetitorAnalysis 
                      leadId={lead.id}
                      leadWebsite={lead.website}
                      leadCompanyName={lead.company_name}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - becomes horizontal quick actions on mobile */}
          <div className="space-y-4 md:space-y-6">
            {/* Quick Actions - grid on mobile, list on desktop */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">{t("leadDetail.ldp_quickActions")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="justify-start lg:w-full" 
                  onClick={() => setShowLogCallDialog(true)}
                >
                  <PhoneCall className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline lg:inline">{t("leadDetail.ldp_log")}</span> {t("leadDetail.ldp_call")}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="justify-start lg:w-full"
                  onClick={() => {
                    setActivityForm({ type: 'email', title: '', description: '' });
                    setShowActivityDialog(true);
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline lg:inline">{t("leadDetail.ldp_log")}</span> {t("leadDetail.ldp_emailLower")}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="justify-start lg:w-full"
                  onClick={() => {
                    setActivityForm({ type: 'meeting', title: '', description: '' });
                    setShowActivityDialog(true);
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline lg:inline">{t("leadDetail.ldp_log")}</span> {t("leadDetail.ldp_meeting")}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="justify-start lg:w-full"
                  onClick={() => {
                    setActivityForm({ type: 'note', title: '', description: '' });
                    setShowActivityDialog(true);
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t("leadDetail.ldp_note")}
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  className="justify-start lg:w-full col-span-2 sm:col-span-4 lg:col-span-1"
                  onClick={openNewTaskDialog}
                >
                  <ListTodo className="mr-2 h-4 w-4" />
                  {t("leadDetail.ldp_createTask")}
                </Button>
              </CardContent>
            </Card>

            {/* Upcoming Tasks */}
            {tasks.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    {t("leadDetail.ldp_upcomingTasks")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="p-2 rounded-lg bg-muted/50 space-y-1.5 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="shrink-0 w-4 h-4 rounded border border-muted-foreground/30 hover:border-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                            title={t("leadDetail.ldp_markAsDone")}
                          >
                            <CheckCircle className="h-3 w-3 text-transparent hover:text-primary" />
                          </button>
                          <p className="text-sm font-medium line-clamp-1">{task.title}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {getPriorityBadge(task.priority)}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditTask(task)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={isDeletingTask === task.id}
                            >
                              {isDeletingTask === task.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-6">
                        <div className="flex items-center gap-2">
                          {task.due_date && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.due_date), "d MMM", { locale: sv })}
                            </div>
                          )}
                        </div>
                        {task.assigned_to && (
                          <UserAvatar userId={task.assigned_to} size="xs" showTooltip />
                        )}
                      </div>
                    </div>
                  ))}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => navigate('/tasks')}
                  >
                    {t("leadDetail.ldp_viewAllTasks")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Fleet Data Section - only if module is enabled */}
            {hasModuleAccess('fleet_data') && (
              <FleetDataSection
                leadId={lead.id}
                orgNumber={lead.org_number}
                companyName={lead.company_name}
                onOrgNumberFound={() => invalidateLead()}
                onOrgNumberChange={() => invalidateLead()}
              />
            )}

            {/* Source Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">{t("leadDetail.ldp_source")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="mb-2 text-xs">
                  {lead.source === 'web_analysis' ? t("leadDetail.ldp_sourceWebAnalysis") : 
                   lead.source === 'firecrawl' ? 'Firecrawl' : 
                   lead.source === 'manual' ? t("leadDetail.ldp_sourceManual") : lead.source}
                </Badge>
                {lead.source_data && Object.keys(lead.source_data).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {lead.source_data.orgNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground">{t("leadDetail.ldp_orgNr")}</p>
                        <p className="text-sm font-medium">{String(lead.source_data.orgNumber)}</p>
                      </div>
                    )}
                    {lead.source_data.socialLinks && Array.isArray(lead.source_data.socialLinks) && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t("leadDetail.ldp_socialMedia")}</p>
                        <div className="flex flex-wrap gap-1">
                          {(lead.source_data.socialLinks as string[]).slice(0, 3).map((link, i) => (
                            <a 
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              {new URL(link).hostname.replace('www.', '')}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Activity Dialog */}
        <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("leadDetail.ldp_addActivity")}</DialogTitle>
              <DialogDescription>
                {t("leadDetail.ldp_logActivityDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("leadDetail.ldp_activityType")}</Label>
                <Select 
                  value={activityForm.type} 
                  onValueChange={(v) => setActivityForm(prev => ({ ...prev, type: v as Activity['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {t(`leadDetail.ldp_activity_${type.value}`)}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{activityForm.type === 'note' ? t("leadDetail.ldp_titleOptional") : t("leadDetail.ldp_titleReq")}</Label>
                <Input
                  value={activityForm.title}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={
                    activityForm.type === 'call' ? t("leadDetail.ldp_placeholderCall") :
                    activityForm.type === 'email' ? t("leadDetail.ldp_activityExample") :
                    activityForm.type === 'meeting' ? t("leadDetail.ldp_placeholderMeeting") :
                    t("leadDetail.ldp_placeholderNote")
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("leadDetail.ldp_description")}</Label>
                <Textarea
                  value={activityForm.description}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t("leadDetail.ldp_addDetails")}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActivityDialog(false)}>
                {t("leadDetail.ldp_cancel")}
              </Button>
              <Button
                onClick={handleAddActivity}
                disabled={
                  isSaving ||
                  (activityForm.type === 'note'
                    ? !activityForm.title.trim() && !activityForm.description.trim()
                    : !activityForm.title.trim())
                }
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("leadDetail.ldp_saving")}
                  </>
                ) : (
                  t("leadDetail.ldp_add")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Task Dialog */}
        <Dialog open={showTaskDialog} onOpenChange={(open) => {
          setShowTaskDialog(open);
          if (!open) {
            setEditingTask(null);
            setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingTask ? t("leadDetail.ldp_editTask") : t("leadDetail.ldp_createTask")}</DialogTitle>
              <DialogDescription>
                {editingTask ? t("leadDetail.ldp_editTaskDesc") : t("leadDetail.ldp_addTaskDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("leadDetail.ldp_titleReq")}</Label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t("leadDetail.ldp_taskTitlePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("leadDetail.ldp_description")}</Label>
                <Textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t("leadDetail.ldp_addDetails")}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("leadDetail.ldp_priority")}</Label>
                  <Select 
                    value={taskForm.priority} 
                    onValueChange={(v) => setTaskForm(prev => ({ ...prev, priority: v as Task['priority'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("leadDetail.ldp_priorityLow")}</SelectItem>
                      <SelectItem value="medium">{t("leadDetail.ldp_priorityMedium")}</SelectItem>
                      <SelectItem value="high">{t("leadDetail.ldp_priorityHigh")}</SelectItem>
                      <SelectItem value="urgent">{t("leadDetail.ldp_priorityUrgent")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("leadDetail.ldp_dueDate")}</Label>
                  <Input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
                Avbryt
              </Button>
              <Button onClick={handleSaveTask} disabled={isSaving || !taskForm.title}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("leadDetail.ldp_saving")}
                  </>
                ) : editingTask ? (
                  t("leadDetail.ldp_saveChanges")
                ) : (
                  t("leadDetail.ldp_createTask")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Growth Report Dialog */}
        {lead && (
          <CreateGrowthReportDialog
            open={showGrowthReportDialog}
            onOpenChange={setShowGrowthReportDialog}
            lead={{ id: lead.id, company_name: lead.company_name, website: lead.website }}
          />
        )}

        {/* Log Call Dialog */}
        {lead && (
          <LogCallDialog
            open={showLogCallDialog}
            onOpenChange={setShowLogCallDialog}
            leadId={lead.id}
            leadName={lead.company_name}
            leadPhone={lead.phone}
            onSaved={invalidateLead}
          />
        )}
      </div>
    </AppLayout>
  );
}
