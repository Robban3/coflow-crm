import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TicketComments } from "./TicketComments";
import { Calendar, User, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { fromTable } from "@/components/documents/supabaseHelper";
import type { TicketRow } from "./TicketCard";

const statusLabels: Record<string, string> = { new: "Nytt", open: "Öppet", in_progress: "Pågår", waiting: "Väntar", resolved: "Löst", closed: "Stängt" };
const typeLabels: Record<string, string> = { sales: "Sälj", support: "Support", onboarding: "Onboarding", other: "Övrigt" };
const priorityLabels: Record<string, string> = { low: "Låg", medium: "Medium", high: "Hög", urgent: "Brådskande" };

interface Props {
  ticket: TicketRow;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function TicketDetailPanel({ ticket, open, onClose, onUpdated }: Props) {
  const { members, getMember } = useTeamMembers();
  const assignee = getMember(ticket.assigned_to);

  const updateField = async (field: string, value: any) => {
    const payload: any = { [field]: value };
    if (field === "status" && value === "resolved") payload.resolved_at = new Date().toISOString();
    const { error } = await fromTable("tickets").update(payload).eq("id", ticket.id);
    if (error) toast({ title: "Fel", description: error.message, variant: "destructive" });
    else onUpdated();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left pr-6">{ticket.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Type & Priority badges */}
          <div className="flex gap-2">
            <Badge variant="secondary">{typeLabels[ticket.type]}</Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {priorityLabels[ticket.priority]}
            </Badge>
          </div>

          {/* Description */}
          {ticket.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
          )}

          <Separator />

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select defaultValue={ticket.status} onValueChange={v => updateField("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label className="text-xs">Prioritet</Label>
            <Select defaultValue={ticket.priority} onValueChange={v => updateField("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned to */}
          <div className="space-y-1">
            <Label className="text-xs">Tilldelad</Label>
            <Select defaultValue={ticket.assigned_to ?? ""} onValueChange={v => updateField("assigned_to", v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Ingen tilldelad">
                  {assignee && (
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={assignee.id} size="xs" />
                      {assignee.full_name ?? assignee.email}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={m.id} size="xs" />
                      {m.full_name ?? m.email}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meta info */}
          <div className="space-y-2 text-xs text-muted-foreground">
            {ticket.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Deadline: {format(new Date(ticket.due_date), "d MMM yyyy", { locale: sv })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Skapad: {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: sv })}
            </div>
            {ticket.resolved_at && (
              <div className="flex items-center gap-2">
                Löst: {format(new Date(ticket.resolved_at), "d MMM yyyy HH:mm", { locale: sv })}
              </div>
            )}
          </div>

          <Separator />

          {/* Comments */}
          <TicketComments ticketId={ticket.id} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
