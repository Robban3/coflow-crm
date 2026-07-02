import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Plus, Search, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/LanguageProvider";

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
  const { user } = useAuth();
  const { members } = useTeamMembers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [isCreating, setIsCreating] = useState(false);
  const [leads, setLeads] = useState<{ id: string; company_name: string | null; contact_name: string | null; email: string | null }[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leadId || "");

  // External guests (multiple). The first entry is the primary guest stored in
  // guest_name/guest_email for backward-compat + single-guest display.
  const [guests, setGuests] = useState<{ name: string; email: string }[]>([
    { name: leadName || "", email: leadEmail || "" },
  ]);
  // Internal participants (team members) who should also see the meeting.
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    meetingLink: "",
  });

  // Today (local) as YYYY-MM-DD, used to block past dates in the picker.
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const toggleParticipant = (id: string) =>
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const updateGuest = (i: number, field: "name" | "email", value: string) =>
    setGuests((prev) => prev.map((g, idx) => (idx === i ? { ...g, [field]: value } : g)));
  const addGuest = () => setGuests((prev) => [...prev, { name: "", email: "" }]);
  const removeGuest = (i: number) =>
    setGuests((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

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

  // When lead is selected, prefill the primary guest + title (only if empty)
  useEffect(() => {
    if (selectedLeadId && selectedLeadId !== "none" && leads.length > 0) {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (lead) {
        setGuests(prev => {
          const next = [...prev];
          next[0] = {
            name: next[0]?.name || lead.contact_name || lead.company_name || "",
            email: next[0]?.email || lead.email || "",
          };
          return next;
        });
        setForm(prev => ({
          ...prev,
          title: prev.title || t("meetings.meetingWith", { name: lead.company_name || lead.contact_name || "" }),
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
        title: t("meetings.requiredFieldsTitle"),
        description: t("meetings.requiredFieldsDesc"),
        variant: "destructive",
      });
      return;
    }

    const startTime = new Date(`${form.date}T${form.startTime}`);
    const endTime = new Date(`${form.date}T${form.endTime}`);

    // Don't allow booking a meeting that starts in the past.
    if (startTime.getTime() < Date.now()) {
      toast({ title: t("meetings.error"), description: t("meetings.pastDateError"), variant: "destructive" });
      return;
    }
    if (endTime.getTime() <= startTime.getTime()) {
      toast({ title: t("meetings.error"), description: t("meetings.endBeforeStartError"), variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error(t('meetings.notLoggedIn'));

      // External guests: drop empty rows; first is the primary guest.
      const cleanGuests = guests
        .map((g) => ({ name: g.name.trim(), email: g.email.trim() }))
        .filter((g) => g.name || g.email);
      const primaryGuest = cleanGuests[0];

      // Internal participants always include the creator, deduped.
      const allParticipantIds = [...new Set([authUser.id, ...participantIds])];

      const cleanLeadId = selectedLeadId && selectedLeadId !== "none" ? selectedLeadId : null;

      const { error } = await supabase.from('meetings').insert({
        title: form.title,
        description: form.description || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        guest_name: primaryGuest?.name || null,
        guest_email: primaryGuest?.email || null,
        guests: cleanGuests,
        participant_ids: allParticipantIds,
        meeting_link: form.meetingLink || null,
        host_user_id: authUser.id,
        organization_id: organizationId,
        lead_id: cleanLeadId,
        status: 'scheduled',
        // guests + participant_ids are newer columns not yet in generated types.
      } as any);

      if (error) throw error;

      toast({
        title: t("meetings.meetingCreatedTitle"),
        description: t("meetings.meetingCreatedDesc", { title: form.title }),
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
        meetingLink: "",
      });
      setGuests([{ name: "", email: "" }]);
      setParticipantIds([]);
      setSelectedLeadId("");
      setLeadSearch("");
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: t("meetings.error"),
        description: t("meetings.meetingCreateError"),
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
          <DialogTitle>{t("meetings.createDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("meetings.createDialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead picker */}
          {!leadId && (
            <div className="space-y-2">
              <Label>{t("meetings.linkToLead")}</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("meetings.selectLead")} />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder={t("meetings.searchLead")}
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <SelectItem value="none">{t("meetings.noLead")}</SelectItem>
                  {filteredLeads.map(lead => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.company_name || lead.contact_name || lead.email || t("meetings.unknownLead")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">{t("meetings.fieldTitle")}</Label>
            <Input
              id="title"
              placeholder={t("meetings.fieldTitlePlaceholder")}
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">{t("meetings.fieldDate")}</Label>
            <Input
              id="date"
              type="date"
              min={todayStr}
              value={form.date}
              onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">{t("meetings.fieldStartTime")}</Label>
              <Input
                id="startTime"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm(prev => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">{t("meetings.fieldEndTime")}</Label>
              <Input
                id="endTime"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm(prev => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>

          {/* Internal participants (team members) */}
          {members.filter((m) => m.id !== user?.id).length > 0 && (
            <div className="space-y-2">
              <Label>{t("meetings.fieldParticipants")}</Label>
              <p className="text-xs text-muted-foreground -mt-1">{t("meetings.participantsHint")}</p>
              <div className="max-h-36 overflow-y-auto rounded-md border border-border divide-y">
                {members
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <label key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={participantIds.includes(m.id)}
                        onCheckedChange={() => toggleParticipant(m.id)}
                      />
                      <span className="truncate">{m.full_name || m.email}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {/* External guests (multiple) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("meetings.fieldGuests")}</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addGuest}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("meetings.addGuest")}
              </Button>
            </div>
            <div className="space-y-2">
              {guests.map((g, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Input
                      placeholder={t("meetings.fieldGuestNamePlaceholder")}
                      value={g.name}
                      onChange={(e) => updateGuest(i, "name", e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder={t("meetings.fieldGuestEmailPlaceholder")}
                      value={g.email}
                      onChange={(e) => updateGuest(i, "email", e.target.value)}
                    />
                  </div>
                  {guests.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => removeGuest(i)} aria-label={t("meetings.removeGuest")}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meetingLink">{t("meetings.fieldMeetingLink")}</Label>
            <Input
              id="meetingLink"
              placeholder={t("meetings.fieldMeetingLinkPlaceholder")}
              value={form.meetingLink}
              onChange={(e) => setForm(prev => ({ ...prev, meetingLink: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("meetings.fieldDescription")}</Label>
            <Textarea
              id="description"
              placeholder={t("meetings.fieldDescriptionPlaceholder")}
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("meetings.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {t("meetings.createMeeting")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
