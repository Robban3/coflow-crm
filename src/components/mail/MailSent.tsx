import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Send, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

interface SentEmail {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  source: string;
  status: string | null;
  opened_at: string | null;
  opened_count: number | null;
  created_at: string;
}

export function MailSent() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: emails = [], isLoading: loading } = useQuery({
    queryKey: ["mail-sent", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sent_emails")
        .select("id, recipient_email, recipient_name, subject, body, source, status, opened_at, opened_count, created_at")
        .eq("sent_by", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []) as SentEmail[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const filtered = emails.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.recipient_email?.toLowerCase().includes(q) ||
      e.recipient_name?.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!emails.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Send className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Inga skickade mail ännu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök i skickade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((email) => (
          <Card key={email.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {email.recipient_name || email.recipient_email}
                    </span>
                    <Badge
                      variant={email.status === "sent" ? "default" : "destructive"}
                      className="text-xs shrink-0"
                    >
                      {email.status === "sent" ? "Skickat" : email.status || "Okänd"}
                    </Badge>
                    {email.opened_at && (
                      <Badge variant="outline" className="text-xs shrink-0 gap-1">
                        <Eye className="h-3 w-3" />
                        Öppnat{email.opened_count && email.opened_count > 1 ? ` (${email.opened_count}x)` : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {email.subject}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDistanceToNow(new Date(email.created_at), {
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
