import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";
import { 
  Mail, 
  Phone, 
  Calendar, 
  FileText, 
  CheckCircle, 
  BarChart3,
  User,
  MessageSquare,
  Send,
  MailOpen,
  Clock,
  ListTodo,
  Globe,
  Search,
  Inbox,
  Trophy,
  Loader2
} from "lucide-react";
import { UserAvatar, usePrefetchProfiles } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: 'email_sent' | 'email_opened' | 'email_reply' | 'call' | 'meeting' | 'note' | 'task_completed' | 'task_created' | 'offer_sent' | 'deal_won' | 'web_analysis' | 'seo_analysis' | 'report_opened' | 'lead_created';
  title: string;
  description?: string;
  timestamp: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

interface ActivityTimelineProps {
  leadId: string;
  leadCreatedAt: string;
  leadSource: string;
}

export function ActivityTimeline({ leadId, leadCreatedAt, leadSource }: ActivityTimelineProps) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllEvents();
  }, [leadId]);

  const fetchAllEvents = async () => {
    setIsLoading(true);
    
    try {
      // Fetch all data sources in parallel - only select needed columns (avoid raw_data blobs)
      const [
        activitiesRes,
        callLogsRes,
        sentEmailsRes,
        emailRepliesRes,
        webAnalysesRes,
        seoAnalysesRes,
        tasksRes,
        meetingsRes,
        documentsRes,
        quotesRes,
        dealHandoffsRes,
      ] = await Promise.all([
        supabase.from('activities').select('id, type, title, description, scheduled_at, completed_at, created_at, user_id').eq('lead_id', leadId).limit(200),
        supabase.from('call_logs').select('id, outcome_label, note, created_at, created_by').eq('lead_id', leadId).limit(200),
        supabase.from('sent_emails').select('id, subject, recipient_email, created_at, sent_by, opened_at, opened_count, source').eq('lead_id', leadId).limit(200),
        supabase.from('email_replies').select('id, subject, from_email, from_name, received_at').eq('lead_id', leadId).limit(100),
        supabase.from('web_analyses').select('id, url, performance_score, seo_score, accessibility_score, best_practices_score, created_at, analyzed_by').eq('lead_id', leadId).limit(50),
        supabase.from('seo_analyses').select('id, visibility_score, created_at, analyzed_by').eq('lead_id', leadId).limit(50),
        supabase.from('tasks').select('id, title, description, created_at, created_by, completed_at, assigned_to, status').eq('lead_id', leadId).limit(200),
        supabase.from('meetings').select('id, title, start_time, created_at, host_user_id').eq('lead_id', leadId).limit(100),
        supabase.from('documents').select('id, title, document_number, sent_at, created_by').eq('lead_id', leadId).not('sent_at', 'is', null).limit(100),
        supabase.from('quotes').select('id, title, quote_number, sent_at, created_by').eq('lead_id', leadId).not('sent_at', 'is', null).limit(100),
        (supabase.from('deal_handoffs' as any).select('id, company_name, created_at, created_by').eq('lead_id', leadId).limit(50) as any),
      ]);

      const allEvents: TimelineEvent[] = [];

      // Lead created event
      allEvents.push({
        id: `lead-created-${leadId}`,
        type: 'lead_created',
        title: t("leadDetail.at_leadCreated"),
        description: t("leadDetail.at_sourcePrefix", { source: getSourceLabel(leadSource) }),
        timestamp: leadCreatedAt,
        userId: null,
      });

      // Activities (calls, meetings, notes)
      if (activitiesRes.data) {
        for (const activity of activitiesRes.data) {
          const isReportOpened = activity.title === 'Rapport öppnad av mottagare';
          allEvents.push({
            id: `activity-${activity.id}`,
            type: isReportOpened ? 'report_opened' : activity.type as TimelineEvent['type'],
            title: activity.title,
            description: activity.description,
            timestamp: activity.completed_at || activity.created_at,
            userId: activity.user_id,
          });
        }
      }

      // Logged calls (outcome + note) — from LogCallDialog / Power Call
      if (callLogsRes.data) {
        for (const call of callLogsRes.data) {
          allEvents.push({
            id: `call-${call.id}`,
            type: 'call',
            title: call.outcome_label,
            description: call.note ?? undefined,
            timestamp: call.created_at,
            userId: call.created_by,
          });
        }
      }

      // Sent emails
      if (sentEmailsRes.data) {
        for (const email of sentEmailsRes.data) {
          // Email sent event
          allEvents.push({
            id: `email-sent-${email.id}`,
            type: 'email_sent',
            title: email.subject,
            description: t("leadDetail.at_toPrefix", { email: email.recipient_email }),
            timestamp: email.created_at,
            userId: email.sent_by,
            metadata: {
              recipientEmail: email.recipient_email,
              source: email.source,
            },
          });

          // Email opened event (if opened)
          if (email.opened_at) {
            allEvents.push({
              id: `email-opened-${email.id}`,
              type: 'email_opened',
              title: t("leadDetail.at_emailOpenedTitle"),
              description: email.opened_count && email.opened_count > 1
                ? t("leadDetail.at_emailOpenedDescCount", { subject: email.subject, count: String(email.opened_count) })
                : t("leadDetail.at_emailOpenedDesc", { subject: email.subject }),
              timestamp: email.opened_at,
              userId: null,
              metadata: {
                openCount: email.opened_count,
              },
            });
          }
        }
      }

      // Email replies
      if (emailRepliesRes.data) {
        for (const reply of emailRepliesRes.data) {
          allEvents.push({
            id: `email-reply-${reply.id}`,
            type: 'email_reply',
            title: reply.subject || t("leadDetail.at_replyReceived"),
            description: t("leadDetail.at_fromPrefix", { name: reply.from_name || reply.from_email }),
            timestamp: reply.received_at,
            userId: null,
            metadata: {
              fromEmail: reply.from_email,
              fromName: reply.from_name,
            },
          });
        }
      }

      // Web analyses
      if (webAnalysesRes.data) {
        for (const analysis of webAnalysesRes.data) {
          const scores = [
            analysis.performance_score,
            analysis.seo_score,
            analysis.accessibility_score,
            analysis.best_practices_score,
          ].filter(s => s !== null);
          const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length) : null;
          
          allEvents.push({
            id: `web-analysis-${analysis.id}`,
            type: 'web_analysis',
            title: t("leadDetail.at_webAnalysisDone"),
            description: avgScore !== null ? t("leadDetail.at_avgScore", { score: String(avgScore) }) : undefined,
            timestamp: analysis.created_at,
            userId: analysis.analyzed_by,
            metadata: {
              performanceScore: analysis.performance_score,
              seoScore: analysis.seo_score,
              accessibilityScore: analysis.accessibility_score,
              bestPracticesScore: analysis.best_practices_score,
            },
          });
        }
      }

      // SEO analyses
      if (seoAnalysesRes.data) {
        for (const seo of seoAnalysesRes.data) {
          allEvents.push({
            id: `seo-analysis-${seo.id}`,
            type: 'seo_analysis',
            title: t("leadDetail.at_seoAnalysisDone"),
            description: seo.visibility_score ? t("leadDetail.at_visibilityScore", { score: String(seo.visibility_score) }) : undefined,
            timestamp: seo.created_at,
            userId: seo.analyzed_by,
            metadata: {
              visibilityScore: seo.visibility_score,
            },
          });
        }
      }

      // Tasks — created (by whoever created it) and, if done, completed
      if (tasksRes.data) {
        for (const task of tasksRes.data) {
          allEvents.push({
            id: `task-created-${task.id}`,
            type: 'task_created',
            title: task.title,
            description: task.description,
            timestamp: task.created_at,
            userId: task.created_by,
          });
          if (task.completed_at) {
            allEvents.push({
              id: `task-completed-${task.id}`,
              type: 'task_completed',
              title: task.title,
              description: task.description,
              timestamp: task.completed_at,
              userId: task.assigned_to,
            });
          }
        }
      }

      // Meetings booked
      if (meetingsRes.data) {
        for (const meeting of meetingsRes.data as any[]) {
          allEvents.push({
            id: `meeting-${meeting.id}`,
            type: 'meeting',
            title: meeting.title || t("leadDetail.at_labelMeeting"),
            description: meeting.start_time
              ? format(new Date(meeting.start_time), "d MMM yyyy HH:mm", { locale: dateLocale })
              : undefined,
            timestamp: meeting.created_at,
            userId: meeting.host_user_id,
          });
        }
      }

      // Offers / quotes sent
      for (const doc of [...((documentsRes.data as any[]) || []), ...((quotesRes.data as any[]) || [])]) {
        const number = doc.document_number || doc.quote_number;
        allEvents.push({
          id: `offer-sent-${doc.id}`,
          type: 'offer_sent',
          title: [number ? `#${number}` : null, doc.title].filter(Boolean).join(" "),
          description: undefined,
          timestamp: doc.sent_at,
          userId: doc.created_by,
        });
      }

      // Deal won (handoff)
      if (dealHandoffsRes.data) {
        for (const handoff of dealHandoffsRes.data as any[]) {
          allEvents.push({
            id: `deal-won-${handoff.id}`,
            type: 'deal_won',
            title: handoff.company_name || t("leadDetail.at_labelDealWon"),
            description: undefined,
            timestamp: handoff.created_at,
            userId: handoff.created_by,
          });
        }
      }

      // Sort by timestamp descending (newest first)
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setEvents(allEvents);
    } catch (error) {
      console.error('Error fetching timeline events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceLabel = (source: string) => {
    const sourceMap: Record<string, string> = {
      manual: t("leadDetail.at_sourceManual"),
      google_places: 'Google Places',
      web_analysis: t("leadDetail.at_sourceWebAnalysis"),
      import: t("leadDetail.at_sourceImport"),
    };
    return sourceMap[source] || source;
  };

  // Prefetch profiles for all events with userId
  const userIds = useMemo(() => events.map(e => e.userId).filter(Boolean), [events]);
  usePrefetchProfiles(userIds as string[]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: TimelineEvent[] }[] = [];
    let currentLabel = '';
    
    for (const event of events) {
      const date = new Date(event.timestamp);
      let label: string;
      
      if (isToday(date)) {
        label = t("leadDetail.at_today");
      } else if (isYesterday(date)) {
        label = t("leadDetail.at_yesterday");
      } else {
        label = format(date, "d MMMM yyyy", { locale: dateLocale });
      }
      
      if (label !== currentLabel) {
        groups.push({ label, events: [] });
        currentLabel = label;
      }
      
      groups[groups.length - 1].events.push(event);
    }
    
    return groups;
  }, [events]);

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'email_sent': return Send;
      case 'email_opened': return MailOpen;
      case 'email_reply': return Inbox;
      case 'call': return Phone;
      case 'meeting': return Calendar;
      case 'note': return FileText;
      case 'task_completed': return CheckCircle;
      case 'task_created': return ListTodo;
      case 'offer_sent': return FileText;
      case 'deal_won': return Trophy;
      case 'web_analysis': return BarChart3;
      case 'seo_analysis': return Search;
      case 'report_opened': return Globe;
      case 'lead_created': return User;
      default: return MessageSquare;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'email_sent': return 'bg-blue-500';
      case 'email_opened': return 'bg-green-500';
      case 'email_reply': return 'bg-emerald-500';
      case 'call': return 'bg-orange-500';
      case 'meeting': return 'bg-purple-500';
      case 'note': return 'bg-gray-500';
      case 'task_completed': return 'bg-green-600';
      case 'task_created': return 'bg-yellow-500';
      case 'offer_sent': return 'bg-amber-500';
      case 'deal_won': return 'bg-emerald-600';
      case 'web_analysis': return 'bg-indigo-500';
      case 'seo_analysis': return 'bg-pink-500';
      case 'report_opened': return 'bg-teal-500';
      case 'lead_created': return 'bg-primary';
      default: return 'bg-muted';
    }
  };

  const getEventLabel = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'email_sent': return t("leadDetail.at_labelEmailSent");
      case 'email_opened': return t("leadDetail.at_labelEmailOpened");
      case 'email_reply': return t("leadDetail.at_labelEmailReply");
      case 'call': return t("leadDetail.at_labelCall");
      case 'meeting': return t("leadDetail.at_labelMeeting");
      case 'note': return t("leadDetail.at_labelNote");
      case 'task_completed': return t("leadDetail.at_labelTaskCompleted");
      case 'task_created': return t("leadDetail.at_labelTaskCreated");
      case 'offer_sent': return t("leadDetail.at_labelOfferSent");
      case 'deal_won': return t("leadDetail.at_labelDealWon");
      case 'web_analysis': return t("leadDetail.at_labelWebAnalysis");
      case 'seo_analysis': return t("leadDetail.at_labelSeoAnalysis");
      case 'report_opened': return t("leadDetail.at_labelReportOpened");
      case 'lead_created': return t("leadDetail.at_labelLeadCreated");
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t("leadDetail.at_emptyTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("leadDetail.at_emptyDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map((group, groupIndex) => (
        <div key={group.label}>
          {/* Date header */}
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-2 mb-3">
            <Badge variant="secondary" className="text-xs font-medium">
              {group.label}
            </Badge>
          </div>
          
          {/* Events in this group */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {group.events.map((event, eventIndex) => {
                const Icon = getEventIcon(event.type);
                const isLast = groupIndex === groupedEvents.length - 1 && eventIndex === group.events.length - 1;
                
                return (
                  <div key={event.id} className="relative flex gap-4 pl-0">
                    {/* Icon bubble */}
                    <div className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white",
                      getEventColor(event.type)
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    {/* Content */}
                    <div className={cn(
                      "flex-1 pb-4 min-w-0",
                      isLast && "pb-0"
                    )}>
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground">
                            {getEventLabel(event.type)}
                          </span>
                          {event.userId && (
                            <UserAvatar userId={event.userId} size="xs" showTooltip />
                          )}
                        </div>
                        <time className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(event.timestamp), "HH:mm", { locale: sv })}
                        </time>
                      </div>
                      
                      <p className="text-sm font-medium text-foreground truncate">
                        {event.title}
                      </p>
                      
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      
                      {/* Score badges for analyses */}
                      {event.type === 'web_analysis' && event.metadata && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {event.metadata.performanceScore !== null && (
                            <Badge variant="outline" className="text-[10px]">
                              {t("leadDetail.at_badgePerformance", { score: event.metadata.performanceScore as number })}
                            </Badge>
                          )}
                          {event.metadata.seoScore !== null && (
                            <Badge variant="outline" className="text-[10px]">
                              {t("leadDetail.at_badgeSeo", { score: event.metadata.seoScore as number })}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
