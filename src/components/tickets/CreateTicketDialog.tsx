import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "@/hooks/use-toast";
import { fromTable } from "@/components/documents/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateTicketDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const organizationId = useOrganizationId();
  const { members } = useTeamMembers();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("support");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkedEntity, setLinkedEntity] = useState(""); // "lead:uuid" or "customer:uuid"
  const [linkSearch, setLinkSearch] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);

  const [leads, setLeads] = useState<{ id: string; company_name: string | null }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; company_name: string }[]>([]);

  useEffect(() => {
    if (!open || !organizationId) return;
    supabase.from("leads").select("id, company_name").eq("organization_id", organizationId).order("company_name").limit(200).then(({ data }) => {
      if (data) setLeads(data);
    });
    supabase.from("customers").select("id, company_name").eq("organization_id", organizationId).order("company_name").limit(200).then(({ data }) => {
      if (data) setCustomers(data);
    });
  }, [open, organizationId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setLinkOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const reset = () => {
    setTitle(""); setDescription(""); setType("support"); setPriority("medium"); setAssignedTo(""); setDueDate(""); setLinkedEntity(""); setLinkSearch("");
  };

  const linkedLabel = useMemo(() => {
    if (!linkedEntity) return "";
    if (linkedEntity.startsWith("lead:")) {
      const l = leads.find(x => x.id === linkedEntity.slice(5));
      return l ? `Lead: ${l.company_name || "(Namnlös)"}` : "";
    }
    if (linkedEntity.startsWith("customer:")) {
      const c = customers.find(x => x.id === linkedEntity.slice(9));
      return c ? `Kund: ${c.company_name}` : "";
    }
    return "";
  }, [linkedEntity, leads, customers]);

  const filteredLinkItems = useMemo(() => {
    const q = linkSearch.toLowerCase();
    const items: { value: string; label: string; group: string }[] = [];
    leads.forEach(l => {
      const name = l.company_name || "(Namnlös)";
      if (!q || name.toLowerCase().includes(q)) items.push({ value: `lead:${l.id}`, label: name, group: "Lead" });
    });
    customers.forEach(c => {
      if (!q || c.company_name.toLowerCase().includes(q)) items.push({ value: `customer:${c.id}`, label: c.company_name, group: "Kund" });
    });
    return items;
  }, [linkSearch, leads, customers]);

  const handleCreate = async () => {
    if (!title.trim() || !user || !organizationId) return;
    setSaving(true);

    const parsedLeadId = linkedEntity.startsWith("lead:") ? linkedEntity.slice(5) : null;
    const parsedCustomerId = linkedEntity.startsWith("customer:") ? linkedEntity.slice(9) : null;

    const { error } = await fromTable("tickets").insert({
      title: title.trim(),
      description: description.trim() || null,
      type,
      priority,
      created_by: user.id,
      assigned_to: assignedTo || null,
      organization_id: organizationId,
      due_date: dueDate || null,
      lead_id: parsedLeadId,
      customer_id: parsedCustomerId,
    });

    if (error) {
      toast({ title: "Kunde inte skapa ärende", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ärende skapat" });
      reset();
      onOpenChange(false);
      onCreated();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa nytt ärende</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Titel *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Beskriv ärendet kort..." />
          </div>
          <div className="space-y-1">
            <Label>Beskrivning</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Detaljer..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sälj</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="other">Övrigt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Låg</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">Hög</SelectItem>
                  <SelectItem value="urgent">Brådskande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1 relative" ref={linkRef}>
            <Label>Koppla till lead/kund</Label>
            {linkedEntity ? (
              <div className="flex items-center gap-2">
                <span className="text-sm bg-muted px-2 py-1.5 rounded-md flex-1">{linkedLabel}</span>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => { setLinkedEntity(""); setLinkSearch(""); }}>✕</Button>
              </div>
            ) : (
              <Input
                value={linkSearch}
                onChange={e => { setLinkSearch(e.target.value); setLinkOpen(true); }}
                onFocus={() => setLinkOpen(true)}
                placeholder="Sök lead eller kund..."
              />
            )}
            {linkOpen && !linkedEntity && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                {filteredLinkItems.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Inga resultat</div>
                )}
                {filteredLinkItems.map(item => (
                  <button
                    key={item.value}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                    onMouseDown={e => { e.preventDefault(); setLinkedEntity(item.value); setLinkSearch(""); setLinkOpen(false); }}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.group}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Tilldela till</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Välj teammedlem" /></SelectTrigger>
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
          <div className="space-y-1">
            <Label>Deadline</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Skapa ärende
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}