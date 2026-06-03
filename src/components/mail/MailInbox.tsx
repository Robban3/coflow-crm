import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Inbox, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { MailThreadView } from "./MailThreadView";

interface EmailReply {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  original_email_id: string | null;
  lead_id: string | null;
  sent_by: string;
}

export function MailInbox() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);

  const { data: replies = [], isLoading: loading } = useQuery({
    queryKey: ["mail-inbox", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("email_replies")
        .select("*")
        .eq("sent_by", user.id)
        .order("received_at", { ascending: false })
        .limit(200);
      return (data || []) as EmailReply[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const filtered = replies.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.from_email?.toLowerCase().includes(q) ||
      r.from_name?.toLowerCase().includes(q) ||
      r.subject?.toLowerCase().includes(q) ||
      r.body_text?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedReplyId) {
    const reply = replies.find((r) => r.id === selectedReplyId);
    if (reply) {
      return (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedReplyId(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka till inkorg
          </Button>
          <MailThreadView
            originalEmailId={reply.original_email_id || reply.id}
            highlightReplyId={reply.id}
          />
        </div>
      );
    }
  }

  if (!replies.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Inga inkomna svar ännu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök i inkorg..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((reply) => (
          <Card
            key={reply.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setSelectedReplyId(reply.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {reply.from_name || reply.from_email}
                    </span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      Svar
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {reply.subject || "(Inget ämne)"}
                  </p>
                  {reply.body_text && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {reply.body_text.slice(0, 120)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDistanceToNow(new Date(reply.received_at), {
                    addSuffix: true,
                    locale: sv,
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
