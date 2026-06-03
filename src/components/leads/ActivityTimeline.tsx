import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { sv } from "date-fns/locale";
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
  Loader2
} from "lucide-react";
import { UserAvatar, usePrefetchProfiles } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: 'email_sent' | 'email_opened' | 'email_reply' | 'call' | 'meeting' | 'note' | 'task_completed' | 'task_created' | 'web_analysis' | 'seo_analysis' | 'report_opened' | 'lead_created';
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
        sentEmailsRes,
        emailRepliesRes,
        webAnalysesRes,
        seoAnalysesRes,
        tasksRes,
      ] = await Promise.all([
        supabase.from('activities').select('id, type, title, description, scheduled_at, completed_at, created_at, user_id').eq('lead_id', leadId).limit(200),
        supabase.from('sent_emails').select('id, subject, recipient_email, created_at, sent_by, opened_at, opened_count, source').eq('lead_id', leadId).limit(200),
        supabase.from('email_replies').select('id, subject, from_email, from_name, received_at').eq('lead_id', leadId).limit(100),
        supabase.from('web_analyses').select('id, url, performance_score, seo_score, accessibility_score, best_practices_score, created_at, analyzed_by').eq('lead_id', leadId).limit(50),
        supabase.from('seo_analyses').select('id, visibility_score, created_at, analyzed_by').eq('lead_id', leadId).limit(50),
        supabase.from('tasks').select('id, title, description, completed_at, assigned_to').eq('lead_id', leadId).eq('status', 'completed').limit(100),
      ]);

      const allEvents: TimelineEvent[] = [];

      // Lead created event
      allEvents.push({
        id: `lead-created-${leadId}`,
        type: 'lead_created',
        title: 'Lead skapad',
        description: `Källa: ${getSourceLabel(leadSource)}`,
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

      // Sent emails
      if (sentEmailsRes.data) {
        for (const email of sentEmailsRes.data) {
          // Email sent event
          allEvents.push({
            id: `email-sent-${email.id}`,
            type: 'email_sent',
            title: email.subject,
            description: `Till: ${email.recipient_email}`,
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
              title: `E-post öppnad`,
              description: `"${email.subject}" öppnades${email.opened_count && email.opened_count > 1 ? ` (${email.opened_count} gånger)` : ''}`,
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
            title: reply.subject || 'Svar mottaget',
            description: `Från: ${reply.from_name || reply.from_email}`,
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
            title: 'Webbanalys slutförd',
            description: avgScore !== null ? `Genomsnittspoäng: ${avgScore}/100` : undefined,
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
            title: 'SEO-analys slutförd',
            description: seo.visibility_score ? `Synlighetspoäng: ${seo.visibility_score}/100` : undefined,
            timestamp: seo.created_at,
            userId: seo.analyzed_by,
            metadata: {
              visibilityScore: seo.visibility_score,
            },
          });
        }
      }

      // Completed tasks
      if (tasksRes.data) {
        for (const task of tasksRes.data) {
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
      manual: 'Manuell',
      google_places: 'Google Places',
      web_analysis: 'Webbanalys',
      import: 'Import',
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
        label = 'Idag';
      } else if (isYesterday(date)) {
        label = 'Igår';
      } else {
        label = format(date, "d MMMM yyyy", { locale: sv });
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
      case 'web_analysis': return 'bg-indigo-500';
      case 'seo_analysis': return 'bg-pink-500';
      case 'report_opened': return 'bg-teal-500';
      case 'lead_created': return 'bg-primary';
      default: return 'bg-muted';
    }
  };

  const getEventLabel = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'email_sent': return 'E-post skickad';
      case 'email_opened': return 'E-post öppnad';
      case 'email_reply': return 'Svar mottaget';
      case 'call': return 'Samtal';
      case 'meeting': return 'Möte';
      case 'note': return 'Anteckning';
      case 'task_completed': return 'Uppgift slutförd';
      case 'task_created': return 'Uppgift skapad';
      case 'web_analysis': return 'Webbanalys';
      case 'seo_analysis': return 'SEO-analys';
      case 'report_opened': return 'Rapport öppnad';
      case 'lead_created': return 'Lead skapad';
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
          Ingen aktivitet ännu
        </h3>
        <p className="text-sm text-muted-foreground">
          Aktiviteter, e-post och analyser visas här
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
                              Prestanda: {event.metadata.performanceScore as number}
                            </Badge>
                          )}
                          {event.metadata.seoScore !== null && (
                            <Badge variant="outline" className="text-[10px]">
                              SEO: {event.metadata.seoScore as number}
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
