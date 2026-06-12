import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { TicketDetailPanel } from "./TicketDetailPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useTranslation } from "@/i18n/LanguageProvider";
import type { TicketRow } from "./TicketCard";

const statusKeys = ["new", "open", "in_progress", "waiting", "resolved", "closed"];
const typeKeys = ["sales", "support", "onboarding", "other"];
const priorityKeys = ["low", "medium", "high", "urgent"];
const priorityColors: Record<string, string> = { low: "text-muted-foreground", medium: "text-warning", high: "text-orange-500", urgent: "text-destructive" };

interface TicketListProps {
  myOnly?: boolean;
}

export function TicketList({ myOnly }: TicketListProps) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const fetchTickets = async () => {
    if (!user) return;
    setLoading(true);
    let query = fromTable("tickets").select("*").order("created_at", { ascending: false });
    if (myOnly) query = query.eq("assigned_to", user.id);
    const { data, error } = await query;
    if (error) toast({ title: "Fel", description: error.message, variant: "destructive" });
    else setTickets(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [user]);

  const filtered = tickets.filter(t => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Sök ärende..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla typer</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla status</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Prioritet" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ärende</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioritet</TableHead>
              <TableHead>Tilldelad</TableHead>
              <TableHead>Ålder</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Inga ärenden hittades</TableCell></TableRow>
            ) : filtered.map(t => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(t)}>
                  <TableCell className="font-medium max-w-[300px] truncate">{t.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{typeLabels[t.type] ?? t.type}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{statusLabels[t.status] ?? t.status}</Badge></TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1 text-xs ${priorityColors[t.priority]}`}>
                      <AlertTriangle className="h-3 w-3" /> {priorityLabels[t.priority]}
                    </span>
                  </TableCell>
                  <TableCell>{t.assigned_to ? <UserAvatar userId={t.assigned_to} size="xs" /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { locale: sv, addSuffix: true })}</TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <TicketDetailPanel ticket={selected} open={!!selected} onClose={() => setSelected(null)} onUpdated={() => { fetchTickets(); setSelected(null); }} />
      )}
    </>
  );
}
