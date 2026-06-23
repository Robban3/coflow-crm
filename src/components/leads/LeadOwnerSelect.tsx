import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, X, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { notifyLeadAssigned } from "@/hooks/useNotifications";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface LeadMember {
  id: string;
  user_id: string;
  role: string;
}

interface LeadOwnerSelectProps {
  leadId: string;
  currentOwnerId: string | null;
  onOwnerChange?: (ownerId: string | null) => void;
  compact?: boolean;
  leadCompanyName?: string;
}

export function LeadOwnerSelect({
  leadId,
  currentOwnerId,
  onOwnerChange,
  compact = false,
  leadCompanyName,
}: LeadOwnerSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [leadMembers, setLeadMembers] = useState<LeadMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    const [membersRes, leadMembersRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, avatar_url"),
      supabase.from("lead_members").select("id, user_id, role").eq("lead_id", leadId),
    ]);

    if (!membersRes.error && membersRes.data) setAllMembers(membersRes.data);
    if (!leadMembersRes.error && leadMembersRes.data) setLeadMembers(leadMembersRes.data);
  };

  const isUserOnLead = leadMembers.some((lm) => lm.user_id === user?.id);
  // Only admins may assign/reassign leads to users (product decision). Regular
  // users claim leads implicitly by logging a call/email, not via this control.
  const canManage = isAdmin;

  const addMember = async (memberId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("lead_members").insert({
        lead_id: leadId,
        user_id: memberId,
        added_by: user?.id,
      });
      if (error) throw error;

      // Also update assigned_to on leads table for backward compatibility
      if (leadMembers.length === 0) {
        await supabase.from("leads").update({ assigned_to: memberId }).eq("id", leadId);
      }

      const member = allMembers.find((m) => m.id === memberId);
      toast({
        title: t("leadDetail.owner_memberAdded"),
        description: t("leadDetail.owner_addedDesc", { name: member?.full_name || member?.email }),
      });

      if (memberId !== user?.id) {
        await notifyLeadAssigned(memberId, leadCompanyName || "Ny lead", leadId);
      }

      await fetchData();
      onOwnerChange?.(memberId);
    } catch (error) {
      console.error("Error adding member:", error);
      toast({ title: t("leadDetail.owner_errorTitle"), description: t("leadDetail.owner_addError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("lead_members")
        .delete()
        .eq("lead_id", leadId)
        .eq("user_id", memberId);
      if (error) throw error;

      // Update assigned_to for backward compatibility
      if (currentOwnerId === memberId) {
        const remaining = leadMembers.filter((lm) => lm.user_id !== memberId);
        await supabase
          .from("leads")
          .update({ assigned_to: remaining.length > 0 ? remaining[0].user_id : null })
          .eq("id", leadId);
      }

      toast({ title: t("leadDetail.owner_memberRemoved") });
      await fetchData();
      onOwnerChange?.(null);
    } catch (error) {
      toast({ title: t("leadDetail.owner_errorTitle"), description: t("leadDetail.owner_removeError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (email: string, name?: string | null) => {
    if (name) return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
    return email.substring(0, 2).toUpperCase();
  };

  const assignedMembers = allMembers.filter((m) => leadMembers.some((lm) => lm.user_id === m.id));
  const availableMembers = (isAdmin ? allMembers : allMembers.filter((m) => m.id === user?.id)).filter(
    (m) => !leadMembers.some((lm) => lm.user_id === m.id)
  );

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={!canManage}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 p-0 rounded-full"
            title={
              assignedMembers.length > 0
                ? assignedMembers.map((m) => m.full_name || m.email).join(", ")
                : "Tilldela medlemmar"
            }
          >
            {assignedMembers.length === 0 ? (
              <div className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <UserPlus className="h-3 w-3 text-muted-foreground" />
              </div>
            ) : assignedMembers.length === 1 ? (
              <Avatar className="h-7 w-7">
                <AvatarImage src={assignedMembers[0].avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials(assignedMembers[0].email, assignedMembers[0].full_name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex -space-x-2">
                {assignedMembers.slice(0, 3).map((m) => (
                  <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={m.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                      {getInitials(m.email, m.full_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {assignedMembers.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-medium">
                    +{assignedMembers.length - 3}
                  </div>
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2" align="start">
          <div className="space-y-1">
            {assignedMembers.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Tilldelade</p>
                {assignedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {getInitials(member.email, member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{member.full_name || member.email}</span>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeMember(member.id)}
                        disabled={isLoading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </>
            )}
            {availableMembers.length > 0 && canManage && (
              <>
                <p className="text-xs font-medium text-muted-foreground px-2 py-1 border-t mt-1 pt-2">
                  Lägg till
                </p>
                {availableMembers.map((member) => (
                  <Button
                    key={member.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => addMember(member.id)}
                    disabled={isLoading}
                  >
                    <Avatar className="h-6 w-6 mr-2">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {getInitials(member.email, member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{member.full_name || member.email}</span>
                  </Button>
                ))}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Full-size variant (used in lead detail sidebar)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={!canManage}>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <div className="flex items-center gap-2">
            {assignedMembers.length === 0 ? (
              <>
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Ingen tilldelad</span>
              </>
            ) : (
              <>
                <div className="flex -space-x-1">
                  {assignedMembers.slice(0, 3).map((m) => (
                    <Avatar key={m.id} className="h-5 w-5 border border-background">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                        {getInitials(m.email, m.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="truncate text-sm">
                  {assignedMembers.length === 1
                    ? assignedMembers[0].full_name || assignedMembers[0].email
                    : `${assignedMembers.length} medlemmar`}
                </span>
              </>
            )}
          </div>
          <UserPlus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          {assignedMembers.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">Tilldelade</p>
              {assignedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {getInitials(member.email, member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{member.full_name || member.email}</span>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeMember(member.id)}
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
          {availableMembers.length > 0 && canManage && (
            <>
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 border-t mt-1 pt-2">
                Lägg till
              </p>
              {availableMembers.map((member) => (
                <Button
                  key={member.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => addMember(member.id)}
                  disabled={isLoading}
                >
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(member.email, member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{member.full_name || member.email}</span>
                </Button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
