import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useAuth } from "@/hooks/useAuth";
import type { TicketRow } from "./TicketCard";

export function TicketStats() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  useEffect(() => {
    if (!user) return;
    fromTable("tickets").select("id, status, priority, created_at, resolved_at").then(({ data }: any) => {
      setTickets(data ?? []);
    });
  }, [user]);

  const open = tickets.filter(t => !["resolved", "closed"].includes(t.status)).length;
  const urgent = tickets.filter(t => t.priority === "urgent" && !["resolved", "closed"].includes(t.status)).length;
  const thisWeek = tickets.filter(t => {
    const d = new Date(t.created_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;
  const resolved = tickets.filter(t => t.resolved_at);
  const avgResolveHrs = resolved.length > 0
    ? Math.round(resolved.reduce((acc, t) => acc + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000, 0) / resolved.length)
    : 0;

  const stats = [
    { label: "Öppna ärenden", value: open, icon: CheckSquare, color: "text-primary" },
    { label: "Brådskande", value: urgent, icon: AlertTriangle, color: "text-destructive" },
    { label: "Denna vecka", value: thisWeek, icon: TrendingUp, color: "text-success" },
    { label: "Snitt lösningstid", value: avgResolveHrs > 0 ? `${avgResolveHrs}h` : "—", icon: Clock, color: "text-warning" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(s => (
        <Card key={s.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <s.icon className={`h-5 w-5 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
