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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

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

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('meetings.notLoggedIn'));

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
        guestName: "",
        guestEmail: "",
        meetingLink: "",
      });
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

          <div className="space-y-2">
            <Label htmlFor="guestName">{t("meetings.fieldGuestName")}</Label>
            <Input
              id="guestName"
              placeholder={t("meetings.fieldGuestNamePlaceholder")}
              value={form.guestName}
              onChange={(e) => setForm(prev => ({ ...prev, guestName: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestEmail">{t("meetings.fieldGuestEmail")}</Label>
            <Input
              id="guestEmail"
              type="email"
              placeholder={t("meetings.fieldGuestEmailPlaceholder")}
              value={form.guestEmail}
              onChange={(e) => setForm(prev => ({ ...prev, guestEmail: e.target.value }))}
            />
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
