import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, isPast, differenceInHours } from "date-fns";
import { sv } from "date-fns/locale";

export interface TicketRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  created_by: string | null;
  assigned_to: string | null;
  customer_id: string | null;
  lead_id: string | null;
  document_id: string | null;
  due_date: string | null;
  resolved_at: string | null;
  tags: string[];
  metadata: any;
  created_at: string;
  updated_at: string;
  organization_id: string | null;
}

const typeLabels: Record<string, string> = {
  sales: "Sälj",
  support: "Support",
  onboarding: "Onboarding",
  other: "Övrigt",
};

const typeColors: Record<string, string> = {
  sales: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  support: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  onboarding: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  other: "bg-muted text-muted-foreground",
};

const priorityIcons: Record<string, { color: string; label: string }> = {
  low: { color: "text-muted-foreground", label: "Låg" },
  medium: { color: "text-warning", label: "Medium" },
  high: { color: "text-orange-500", label: "Hög" },
  urgent: { color: "text-destructive", label: "Brådskande" },
};

interface TicketCardProps {
  ticket: TicketRow;
  onClick: (ticket: TicketRow) => void;
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const age = formatDistanceToNow(new Date(ticket.created_at), { locale: sv, addSuffix: true });
  const priority = priorityIcons[ticket.priority] ?? priorityIcons.medium;
  const dueSoon = ticket.due_date && differenceInHours(new Date(ticket.due_date), new Date()) < 24 && !isPast(new Date(ticket.due_date));
  const overdue = ticket.due_date && isPast(new Date(ticket.due_date)) && ticket.status !== "resolved" && ticket.status !== "closed";

  return (
    <div
      onClick={() => onClick(ticket)}
      className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight line-clamp-2">{ticket.title}</h4>
        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${priority.color}`} />
      </div>

      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${typeColors[ticket.type] ?? ""}`}>
          {typeLabels[ticket.type] ?? ticket.type}
        </Badge>
        {overdue && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Försenat</Badge>
        )}
        {dueSoon && !overdue && (
          <Badge className="text-[10px] px-1.5 py-0 bg-warning/20 text-warning border-warning/30">Snart deadline</Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {age}
        </span>
        {ticket.assigned_to && (
          <UserAvatar userId={ticket.assigned_to} size="xs" />
        )}
      </div>
    </div>
  );
}
