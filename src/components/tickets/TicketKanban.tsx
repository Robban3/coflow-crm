import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { TicketCard, type TicketRow } from "./TicketCard";
import { TicketDetailPanel } from "./TicketDetailPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { fromTable } from "@/components/documents/supabaseHelper";

const COLUMNS: { key: string; label: string }[] = [
  { key: "new", label: "Nytt" },
  { key: "open", label: "Öppet" },
  { key: "in_progress", label: "Pågår" },
  { key: "waiting", label: "Väntar" },
  { key: "resolved", label: "Löst" },
  { key: "closed", label: "Stängt" },
];

export function TicketKanban() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const fetchTickets = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await fromTable("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Kunde inte hämta ärenden", description: error.message, variant: "destructive" });
    } else {
      setTickets(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [user]);

  const handleDrop = async (ticketId: string, newStatus: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    // Optimistic update
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus, resolved_at: newStatus === "resolved" ? new Date().toISOString() : t.resolved_at } : t));

    const updatePayload: any = { status: newStatus };
    if (newStatus === "resolved") updatePayload.resolved_at = new Date().toISOString();

    const { error } = await fromTable("tickets").update(updatePayload).eq("id", ticketId);
    if (error) {
      toast({ title: "Kunde inte uppdatera", description: error.message, variant: "destructive" });
      fetchTickets();
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-6 gap-3">
        {COLUMNS.map(c => (
          <div key={c.key} className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[400px]">
        {COLUMNS.map(col => {
          const colTickets = tickets.filter(t => t.status === col.key);
          return (
            <div
              key={col.key}
              className="bg-muted/50 rounded-lg p-2 space-y-2"
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary/30"); }}
              onDragLeave={e => { e.currentTarget.classList.remove("ring-2", "ring-primary/30"); }}
              onDrop={e => {
                e.currentTarget.classList.remove("ring-2", "ring-primary/30");
                if (draggedId) handleDrop(draggedId, col.key);
                setDraggedId(null);
              }}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                <span className="text-xs text-muted-foreground">{colTickets.length}</span>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {colTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={() => setDraggedId(ticket.id)}
                    onDragEnd={() => setDraggedId(null)}
                  >
                    <TicketCard ticket={ticket} onClick={setSelected} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {selected && (
        <TicketDetailPanel
          ticket={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { fetchTickets(); setSelected(null); }}
        />
      )}
    </>
  );
}
