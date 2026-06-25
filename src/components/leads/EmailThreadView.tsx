import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";
import { 
  Mail, 
  ArrowRight, 
  ArrowLeft, 
  Clock, 
  Eye, 
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SentEmail {
  id: string;
  subject: string;
  body: string;
  recipient_email: string;
  created_at: string;
  opened_at: string | null;
  opened_count: number | null;
  source: string;
  reply_token: string | null;
}

interface EmailReply {
  id: string;
  original_email_id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
}

interface ThreadMessage {
  id: string;
  type: "sent" | "reply";
  subject: string;
  body: string;
  timestamp: string;
  from: string;
  isRead?: boolean;
  openCount?: number;
}

interface EmailThreadViewProps {
  leadId: string;
  leadName?: string;
  className?: string;
}

export function EmailThreadView({ leadId, leadName, className }: EmailThreadViewProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [replies, setReplies] = useState<EmailReply[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadEmailThread();
  }, [leadId]);

  const loadEmailThread = async () => {
    setIsLoading(true);
    try {
      // Fetch sent emails for this lead
      const { data: emails, error: emailsError } = await supabase
        .from("sent_emails")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });

      if (emailsError) throw emailsError;
      setSentEmails(emails || []);

      // Fetch replies for this lead
      const { data: replyData, error: repliesError } = await supabase
        .from("email_replies")
        .select("*")
        .eq("lead_id", leadId)
        .order("received_at", { ascending: true });

      if (repliesError) throw repliesError;
      setReplies(replyData || []);

      // Auto-expand latest reply if it exists
      if (replyData && replyData.length > 0) {
        const latestReply = replyData[replyData.length - 1];
        setExpandedMessages(new Set([latestReply.id]));
      }

    } catch (error) {
      console.error("Error loading email thread:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Merge and sort all messages chronologically
  const threadMessages: ThreadMessage[] = [
    ...sentEmails.map((email): ThreadMessage => ({
      id: email.id,
      type: "sent",
      subject: email.subject,
      body: email.body,
      timestamp: email.created_at,
      from: t("leadDetail.et_you"),
      isRead: email.opened_at !== null,
      openCount: email.opened_count || 0,
    })),
    ...replies.map((reply): ThreadMessage => ({
      id: reply.id,
      type: "reply",
      subject: reply.subject || t("leadDetail.et_noSubject"),
      body: reply.body_text || reply.body_html || "",
      timestamp: reply.received_at,
      from: reply.from_name || reply.from_email,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const toggleMessage = (id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const replyCount = replies.length;
  const hasNewReplies = replies.some(r => {
    const receivedAt = new Date(r.received_at);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return receivedAt > hourAgo;
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (threadMessages.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Mail className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground text-center">
            {t("leadDetail.et_emptyThread")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-full overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MessageSquare className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span className="truncate">Mailkonversation</span>
                {replyCount > 0 && (
                  <Badge variant={hasNewReplies ? "default" : "secondary"} className="text-xs shrink-0">
                    {replyCount} svar
                    {hasNewReplies && <Sparkles className="h-3 w-3 ml-1" />}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs truncate">
                {threadMessages.length} meddelanden med {leadName || "lead"}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 p-0 shrink-0"
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0 overflow-hidden px-3 sm:px-6">
          <ScrollArea className="max-h-[400px] w-full">
            <div className="space-y-3 pr-2 w-full max-w-full">
              {threadMessages.map((message, index) => {
                const isExpanded = expandedMessages.has(message.id);
                const isSent = message.type === "sent";
                const isLast = index === threadMessages.length - 1;
                
                return (
                  <div
                    key={message.id}
                    className="relative w-full max-w-full"
                  >
                    {/* Timeline connector */}
                    {index < threadMessages.length - 1 && (
                      <div className="absolute left-[15px] top-[40px] bottom-[-12px] w-px bg-border" />
                    )}
                    
                    <div
                      className={cn(
                        "flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border cursor-pointer transition-colors w-full max-w-full overflow-hidden",
                        isSent 
                          ? "bg-primary/5 border-primary/20 hover:bg-primary/10" 
                          : "bg-accent/50 border-accent hover:bg-accent",
                        isLast && message.type === "reply" && "ring-2 ring-primary ring-offset-2"
                      )}
                      onClick={() => toggleMessage(message.id)}
                    >
                      {/* Direction icon */}
                      <div className={cn(
                        "shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center",
                        isSent 
                          ? "bg-primary/10 text-primary" 
                          : "bg-accent text-accent-foreground"
                      )}>
                        {isSent ? (
                          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                        ) : (
                          <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-start sm:items-center justify-between gap-1 sm:gap-2 mb-1 flex-wrap">
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                            <span className="font-medium text-xs sm:text-sm truncate">
                              {message.from}
                            </span>
                            {isSent && message.isRead && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 shrink-0">
                                <Eye className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5" />
                                {message.openCount}
                              </Badge>
                            )}
                            {!isSent && isLast && (
                              <Badge className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 shrink-0">
                                NYTT
                              </Badge>
                            )}
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5 sm:gap-1">
                            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            {format(new Date(message.timestamp), "d MMM HH:mm", { locale: sv })}
                          </span>
                        </div>
                        
                        <p className="text-xs sm:text-sm font-medium text-foreground/90 truncate">
                          {message.subject}
                        </p>
                        
                        {isExpanded ? (
                          <div className="mt-2 pt-2 border-t border-border/50 overflow-hidden">
                            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                              {message.body}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-1">
                            {message.body.substring(0, 60)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Summary footer */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {sentEmails.length} skickade
              </span>
              <span className="flex items-center gap-1">
                <ArrowLeft className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {replies.length} mottagna
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadEmailThread}
              className="h-6 text-[10px] sm:text-xs px-2 shrink-0"
            >
              Uppdatera
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
