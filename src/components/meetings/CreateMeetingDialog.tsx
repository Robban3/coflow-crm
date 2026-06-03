import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeetingCreated?: () => void;
  leadId?: string;
  leadName?: string;
  leadEmail?: string;
}

export function CreateMeetingDialog({ 
  open, 
  onOpenChange, 
  onMeetingCreated,
  leadId,
  leadName,
  leadEmail 
}: CreateMeetingDialogProps) {
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreating, setIsCreating] = useState(false);
  const [leads, setLeads] = useState<{ id: string; company_name: string | null; contact_name: string | null; email: string | null }[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leadId || "");
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    guestName: leadName || "",
    guestEmail: leadEmail || "",
    meetingLink: "",
  });

  // Fetch leads for the picker
  useEffect(() => {
    if (!open || !organizationId) return;
    const fetchLeads = async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, company_name, contact_name, email")
        .eq("organization_id", organizationId)
        .order("company_name");
      setLeads(data || []);
    };
    fetchLeads();
  }, [open, organizationId]);

  // When lead is selected, prefill guest info
  useEffect(() => {
    if (selectedLeadId && leads.length > 0) {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (lead) {
        setForm(prev => ({
          ...prev,
          guestName: prev.guestName || lead.contact_name || lead.company_name || "",
          guestEmail: prev.guestEmail || lead.email || "",
          title: prev.title || `Möte med ${lead.company_name || lead.contact_name || ""}`,
        }));
      }
    }
  }, [selectedLeadId, leads]);

  const filteredLeads = leads.filter(l => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return l.company_name?.toLowerCase().includes(q) || l.contact_name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q);
  }).slice(0, 20);

  const handleCreate = async () => {
    if (!form.title || !form.date || !form.startTime || !form.endTime) {
      toast({
        title: "Fyll i obligatoriska fält",
        description: "Titel, datum och tider är obligatoriska",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Inte inloggad');

      const startTime = new Date(`${form.date}T${form.startTime}`);
      const endTime = new Date(`${form.date}T${form.endTime}`);

      const { error } = await supabase.from('meetings').insert({
        title: form.title,
        description: form.description || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        guest_name: form.guestName || null,
        guest_email: form.guestEmail || null,
        meeting_link: form.meetingLink || null,
        host_user_id: user.id,
        organization_id: organizationId,
        lead_id: selectedLeadId || null,
        status: 'scheduled',
      });

      if (error) throw error;

      toast({
        title: "Möte skapat",
        description: `${form.title} har bokats in`,
      });

      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onMeetingCreated?.();
      
      // Reset form
      setForm({
        title: "",
        description: "",
        date: "",
        startTime: "09:00",
        endTime: "10:00",
        guestName: "",
        guestEmail: "",
        meetingLink: "",
      });
      setSelectedLeadId("");
      setLeadSearch("");
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa mötet",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa nytt möte</DialogTitle>
          <DialogDescription>
            Boka in ett möte i din kalender
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead picker */}
          {!leadId && (
            <div className="space-y-2">
              <Label>Koppla till lead (valfritt)</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj lead..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Sök lead..."
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <SelectItem value="none">Ingen lead</SelectItem>
                  {filteredLeads.map(lead => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.company_name || lead.contact_name || lead.email || "Okänd lead"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              placeholder="t.ex. Introduktionsmöte"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Datum *</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Starttid *</Label>
              <Input
                id="startTime"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm(prev => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Sluttid *</Label>
              <Input
                id="endTime"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm(prev => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestName">Gästens namn</Label>
            <Input
              id="guestName"
              placeholder="t.ex. Anna Andersson"
              value={form.guestName}
              onChange={(e) => setForm(prev => ({ ...prev, guestName: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestEmail">Gästens e-post</Label>
            <Input
              id="guestEmail"
              type="email"
              placeholder="t.ex. anna@foretag.se"
              value={form.guestEmail}
              onChange={(e) => setForm(prev => ({ ...prev, guestEmail: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meetingLink">Möteslänk (valfritt)</Label>
            <Input
              id="meetingLink"
              placeholder="t.ex. https://meet.google.com/..."
              value={form.meetingLink}
              onChange={(e) => setForm(prev => ({ ...prev, meetingLink: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning</Label>
            <Textarea
              id="description"
              placeholder="Kort beskrivning av mötet..."
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Skapa möte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
