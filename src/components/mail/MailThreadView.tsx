import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/LanguageProvider";

interface ThreadMessage {
  id: string;
  direction: "sent" | "reply";
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
}

interface MailThreadViewProps {
  originalEmailId: string;
  highlightReplyId?: string;
}

export function MailThreadView({ originalEmailId, highlightReplyId }: MailThreadViewProps) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThread();
  }, [originalEmailId]);

  async function fetchThread() {
    setLoading(true);
    const thread: ThreadMessage[] = [];

    // Fetch original sent email
    const { data: sent } = await supabase
      .from("sent_emails")
      .select("id, recipient_email, recipient_name, subject, body, created_at")
      .eq("id", originalEmailId)
      .single();

    if (sent) {
      thread.push({
        id: sent.id,
        direction: "sent",
        from: t("mail.you"),
        to: sent.recipient_name || sent.recipient_email,
        subject: sent.subject,
        body: sent.body,
        timestamp: sent.created_at,
      });
    }

    // Fetch all replies to this email
    const { data: replies } = await supabase
      .from("email_replies")
      .select("id, from_email, from_name, subject, body_text, body_html, received_at")
      .eq("original_email_id", originalEmailId)
      .order("received_at", { ascending: true });

    if (replies) {
      for (const r of replies) {
        thread.push({
          id: r.id,
          direction: "reply",
          from: r.from_name || r.from_email,
          to: t("mail.you"),
          subject: r.subject || "",
          body: r.body_text || "",
          timestamp: r.received_at,
        });
      }
    }

    setMessages(thread);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("mail.threadNotFound")}</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{messages[0]?.subject}</h3>
      {messages.map((msg) => (
        <Card
          key={msg.id}
          className={cn(
            "transition-all",
            msg.id === highlightReplyId && "ring-2 ring-primary"
          )}
        >
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              {msg.direction === "sent" ? (
                <Send className="h-4 w-4 text-primary" />
              ) : (
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{msg.from}</span>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="text-sm text-muted-foreground">{msg.to}</span>
              <Badge variant={msg.direction === "sent" ? "default" : "secondary"} className="ml-auto text-xs">
                {msg.direction === "sent" ? t("mail.directionSent") : t("mail.directionReply")}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(msg.timestamp), "d MMM yyyy HH:mm", { locale: dateLocale })}
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-sm whitespace-pre-wrap text-foreground">
              {msg.body}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
