import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Comment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  content: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketCommentsProps {
  ticketId: string;
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    const { data } = await fromTable("ticket_comments")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
  };

  useEffect(() => { fetchComments(); }, [ticketId]);

  const handleSend = async () => {
    if (!content.trim() || !user) return;
    setSending(true);
    const { error } = await fromTable("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: user.id,
      content: content.trim(),
      is_internal: isInternal,
    });
    if (error) toast({ title: t("tickets.toast.error"), description: error.message, variant: "destructive" });
    else { setContent(""); fetchComments(); }
    setSending(false);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{t("tickets.comments.title")}</h4>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">{t("tickets.comments.empty")}</p>
        )}
        {comments.map(c => (
            <div key={c.id} className="flex gap-2">
              {c.user_id ? <UserAvatar userId={c.user_id} size="xs" /> : <div className="w-5 h-5 rounded-full bg-muted" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { locale: dateLocale, addSuffix: true })}
                  </span>
                  {c.is_internal && <Eye className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
        ))}
      </div>
      <div className="space-y-2 pt-2 border-t">
        <Textarea
          placeholder={t("tickets.comments.placeholder")}
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={2}
          className="text-sm"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} />
            <Label htmlFor="internal" className="text-xs">{t("tickets.comments.internalNote")}</Label>
          </div>
          <Button size="sm" onClick={handleSend} disabled={sending || !content.trim()}>
            <Send className="h-3.5 w-3.5 mr-1" /> {t("tickets.comments.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
