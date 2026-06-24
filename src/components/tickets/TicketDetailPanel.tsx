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
import { sv, enUS, es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useTranslation } from "@/i18n/LanguageProvider";
import type { TicketRow } from "./TicketCard";

const statusKeys = ["new", "open", "in_progress", "waiting", "resolved", "closed"];
const priorityKeys = ["low", "medium", "high", "urgent"];

interface Props {
  ticket: TicketRow;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function TicketDetailPanel({ ticket, open, onClose, onUpdated }: Props) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const { members, getMember } = useTeamMembers();
  const assignee = getMember(ticket.assigned_to);

  const updateField = async (field: string, value: any) => {
    const payload: any = { [field]: value };
    if (field === "status" && value === "resolved") payload.resolved_at = new Date().toISOString();
    const { error } = await fromTable("tickets").update(payload).eq("id", ticket.id);
    if (error) toast({ title: t("tickets.toast.error"), description: error.message, variant: "destructive" });
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
            <Badge variant="secondary">{t(`tickets.type.${ticket.type}`)}</Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {t(`tickets.priority.${ticket.priority}`)}
            </Badge>
          </div>

          {/* Description / won-deal onboarding details */}
          {(() => {
            const handoff = (ticket.metadata as any)?.deal_handoff;
            if (handoff) {
              const rows: Array<[string, string | null | undefined]> = [
                ["Företag", handoff.company_name],
                ["Kontaktperson", handoff.contact_name],
                ["E-post", handoff.email],
                ["Telefon", handoff.phone],
                ["Produkt/tjänst", handoff.product_service],
                ["Onboarding", [handoff.onboarding_date, handoff.onboarding_time].filter(Boolean).join(" ")],
                ["Säljarens anteckningar", handoff.seller_notes],
                ["Kundens mål", handoff.customer_goal],
                ["Löften / överenskommelser", handoff.promises],
              ];
              return (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Vunnen affär – onboarding</p>
                  {rows.map(([label, value]) =>
                    value && String(value).trim() ? (
                      <div key={label} className="space-y-0.5">
                        <p className="text-xs font-semibold text-foreground">{label}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{value}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              );
            }
            return ticket.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
            ) : null;
          })()}

          <Separator />

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs">{t("tickets.detail.status")}</Label>
            <Select defaultValue={ticket.status} onValueChange={v => updateField("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusKeys.map(k => <SelectItem key={k} value={k}>{t(`tickets.status.${k}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label className="text-xs">{t("tickets.detail.priority")}</Label>
            <Select defaultValue={ticket.priority} onValueChange={v => updateField("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {priorityKeys.map(k => <SelectItem key={k} value={k}>{t(`tickets.priority.${k}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned to */}
          <div className="space-y-1">
            <Label className="text-xs">{t("tickets.detail.assigned")}</Label>
            <Select defaultValue={ticket.assigned_to ?? ""} onValueChange={v => updateField("assigned_to", v || null)}>
              <SelectTrigger>
                <SelectValue placeholder={t("tickets.detail.noAssignee")}>
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
                {t("tickets.detail.dueDate", { date: format(new Date(ticket.due_date), "d MMM yyyy", { locale: dateLocale }) })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              {t("tickets.detail.created", { date: format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: dateLocale }) })}
            </div>
            {ticket.resolved_at && (
              <div className="flex items-center gap-2">
                {t("tickets.detail.resolved", { date: format(new Date(ticket.resolved_at), "d MMM yyyy HH:mm", { locale: dateLocale }) })}
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
