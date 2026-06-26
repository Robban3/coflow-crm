import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, 
  UserPlus, 
  Copy, 
  Check, 
  Loader2, 
  Key, 
  Trash2,
  RefreshCw,
  Shield,
  Building2,
  Globe,
  Save,
  Puzzle,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { useOrganization } from "@/hooks/useOrganization";
import { ProfileImageUpload } from "./ProfileImageUpload";
import { MODULE_REGISTRY } from "@/modules/registry";
import type { Database } from "@/integrations/supabase/types";

type AppModule = Database["public"]["Enums"]["app_module"];

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string;
}

interface UserModuleState {
  [userId: string]: {
    [module: string]: boolean;
  };
}

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  is_active: boolean;
}

export function OrganizationDashboard() {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [userModules, setUserModules] = useState<UserModuleState>({});
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showInviteCodeDialog, setShowInviteCodeDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [savingModule, setSavingModule] = useState<string | null>(null);
  
  const [orgSettings, setOrgSettings] = useState({
    company_name: "",
    company_website: "",
    company_logo_url: "",
  });
  const [autoEnrichEnabled, setAutoEnrichEnabled] = useState(true);
  const [isSavingAutoEnrich, setIsSavingAutoEnrich] = useState(false);
  const [maxOpenLeads, setMaxOpenLeads] = useState(50);
  const [isSavingCap, setIsSavingCap] = useState(false);

  const [newUserForm, setNewUserForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "user" as "admin" | "user",
  });
  
  const [inviteCodeForm, setInviteCodeForm] = useState({
    maxUses: 1,
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const { refreshModules } = useModules();
  const { refreshSettings } = useOrganization();

  // Get modules that can be toggled (have dbModuleKey)
  const toggleableModules = MODULE_REGISTRY.filter(m => m.dbModuleKey);

  useEffect(() => {
    fetchAllData();
  }, [user?.id]);

  const fetchAllData = async () => {
    setIsLoading(true);
    await Promise.all([fetchTeamData(), fetchOrgSettings(), fetchUserModules(), fetchAutoEnrichSetting(), fetchLeadCap()]);
    setIsLoading(false);
  };

  const fetchAutoEnrichSetting = async () => {
    if (!user?.id) return;
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile?.organization_id) return;
    const { data: org } = await supabase.from("organizations").select("auto_enrich_enabled").eq("id", profile.organization_id).single();
    if (org) setAutoEnrichEnabled(org.auto_enrich_enabled ?? true);
  };

  const handleToggleAutoEnrich = async (enabled: boolean) => {
    if (!user?.id) return;
    setIsSavingAutoEnrich(true);
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
    if (profile?.organization_id) {
      await supabase.from("organizations").update({ auto_enrich_enabled: enabled } as any).eq("id", profile.organization_id);
      setAutoEnrichEnabled(enabled);
      toast({ title: enabled ? t("settings.autoAnalyzeEnabled") : t("settings.autoAnalyzeDisabled") });
    }
    setIsSavingAutoEnrich(false);
  };

  // Separate, error-tolerant fetch: the column may not exist until the lead
  // ownership migration is deployed, so a failure here must not break the
  // other org settings.
  const fetchLeadCap = async () => {
    if (!user?.id) return;
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile?.organization_id) return;
    const { data: org, error } = await supabase
      .from("organizations")
      .select("max_open_leads_per_user")
      .eq("id", profile.organization_id)
      .single();
    if (!error && org) setMaxOpenLeads((org as any).max_open_leads_per_user ?? 50);
  };

  const handleSaveCap = async () => {
    if (!user?.id) return;
    setIsSavingCap(true);
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
    if (profile?.organization_id) {
      const { error } = await supabase
        .from("organizations")
        .update({ max_open_leads_per_user: maxOpenLeads } as any)
        .eq("id", profile.organization_id);
      toast(
        error
          ? { title: t("settings.leadCapSaveError"), variant: "destructive" }
          : { title: t("settings.leadCapSaved") }
      );
    }
    setIsSavingCap(false);
  };

  const fetchUserModules = async () => {
    const { data, error } = await supabase
      .from("user_modules")
      .select("user_id, module, enabled");

    if (error) {
      console.error("Error fetching user modules:", error);
      return;
    }

    const moduleState: UserModuleState = {};
    data?.forEach(um => {
      if (!moduleState[um.user_id]) {
        moduleState[um.user_id] = {};
      }
      moduleState[um.user_id][um.module] = um.enabled;
    });

    setUserModules(moduleState);
  };

  const fetchOrgSettings = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from("profiles")
      .select("company_name, company_website, company_logo_url")
      .eq("id", user.id)
      .single();

    if (data) {
      setOrgSettings({
        company_name: data.company_name || "",
        company_website: data.company_website || "",
        company_logo_url: data.company_logo_url || "",
      });
    }
  };

  const fetchTeamData = async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, created_at");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }

    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

    const teamMembers: TeamMember[] = (profiles || []).map(p => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      role: (rolesMap.get(p.id) as "admin" | "user") || "user",
      created_at: p.created_at,
    }));

    setMembers(teamMembers);

    const { data: codes, error: codesError } = await supabase
      .from("organization_invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (!codesError && codes) {
      setInviteCodes(codes);
    }
  };

  const handleToggleModule = async (userId: string, moduleKey: string, enabled: boolean) => {
    setSavingModule(`${userId}-${moduleKey}`);
    
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from("user_modules")
        .select("id")
        .eq("user_id", userId)
        .eq("module", moduleKey as AppModule)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_modules")
          .update({ enabled })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("user_modules")
          .insert({
            user_id: userId,
            module: moduleKey as AppModule,
            enabled,
          });
      }

      // Update local state
      setUserModules(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [moduleKey]: enabled,
        },
      }));

      // Refresh modules for current user if they were the one being modified
      if (userId === user?.id) {
        await refreshModules();
      }

      toast({
        title: enabled ? t("settings.moduleEnabled") : t("settings.moduleDisabled"),
        description: t("settings.moduleForUser", { module: MODULE_REGISTRY.find(m => m.dbModuleKey === moduleKey)?.name ?? "" }),
      });
    } catch (error) {
      console.error("Error toggling module:", error);
      toast({
        title: t("settings.profileSaveErrorTitle"),
        description: t("settings.moduleStatusErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setSavingModule(null);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: "admin" | "user") => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    
    try {
      if (newRole === "admin") {
        // Add admin role
        await supabase.from("user_roles").upsert({
          user_id: userId,
          role: "admin",
        });
      } else {
        // Remove admin role, keep user role
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
      }

      setMembers(prev => prev.map(m => 
        m.id === userId ? { ...m, role: newRole } : m
      ));

      toast({
        title: t("settings.roleUpdatedTitle"),
        description: t("settings.roleUpdatedDesc", { role: newRole === "admin" ? t("settings.roleAdminFull") : t("settings.roleUserFull") }),
      });
    } catch (error) {
      console.error("Error toggling role:", error);
      toast({
        title: t("settings.profileSaveErrorTitle"),
        description: t("settings.roleChangeErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const handleSaveOrgSettings = async () => {
    if (!user?.id) return;
    setIsSavingOrg(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        company_name: orgSettings.company_name || null,
        company_website: orgSettings.company_website || null,
        company_logo_url: orgSettings.company_logo_url || null,
      })
      .eq("id", user.id);

    if (error) {
      toast({
        title: t("settings.profileSaveErrorTitle"),
        description: t("settings.orgInfoSaveErrorDesc"),
        variant: "destructive",
      });
    } else {
      // Refresh organization settings in the sidebar
      await refreshSettings();
      toast({
        title: t("settings.orgInfoSavedTitle"),
        description: t("settings.orgInfoSavedDesc"),
      });
    }
    setIsSavingOrg(false);
  };

  const generateInviteCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleDeleteUser = async () => {
    if (!deletingMember) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: deletingMember.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: t("settings.userRemovedTitle"),
        description: t("settings.userRemovedDesc", { name: deletingMember.full_name || deletingMember.email }),
      });
      setDeletingMember(null);
      fetchTeamData();
    } catch (e: any) {
      toast({ title: t("settings.userRemoveErrorTitle"), description: e.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateInviteCode = async () => {
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("settings.notLoggedIn"));

      const code = generateInviteCode();

      const { error } = await supabase.from("organization_invites").insert({
        code,
        created_by: user.id,
        max_uses: inviteCodeForm.maxUses,
        expires_at: null,
      });

      if (error) throw error;

      toast({
        title: t("settings.inviteCreatedTitle"),
        description: t("settings.inviteCreatedDesc", { code }),
      });

      setShowInviteCodeDialog(false);
      setInviteCodeForm({ maxUses: 1 });
      fetchTeamData();
    } catch (error) {
      console.error("Error creating invite code:", error);
      toast({
        title: t("settings.profileSaveErrorTitle"),
        description: t("settings.inviteCreateErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.email || !newUserForm.password) {
      toast({
        title: t("settings.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Use edge function to create user without logging in as them
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUserForm.email,
          password: newUserForm.password,
          fullName: newUserForm.fullName,
          role: newUserForm.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: t("settings.userCreatedTitle"),
        description: t("settings.userAddedToTeam", { email: newUserForm.email }),
      });

      setShowAddDialog(false);
      setNewUserForm({ email: "", password: "", fullName: "", role: "user" });
      
      setTimeout(fetchTeamData, 1000);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: t("settings.profileSaveErrorTitle"),
        description: error.message || t("settings.userCreateErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteInviteCode = async (id: string) => {
    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: t("settings.profileSaveErrorTitle"),
        description: t("settings.inviteDeleteErrorDesc"),
        variant: "destructive",
      });
    } else {
      toast({ title: t("settings.inviteDeletedTitle") });
      fetchTeamData();
    }
  };

  const getInitials = (email: string, name?: string | null) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const isModuleEnabled = (userId: string, moduleKey: string): boolean => {
    return userModules[userId]?.[moduleKey] ?? true; // Default to enabled
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeInvites = inviteCodes.filter(c => c.is_active).length;

  return (
    <div className="space-y-6">
      {/* Minimal stats bar */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground border-b pb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span><strong className="text-foreground">{members.length}</strong>{t("settings.statUsers")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span><strong className="text-foreground">{members.filter(m => m.role === "admin").length}</strong>{t("settings.statAdmins")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          <span><strong className="text-foreground">{activeInvites}</strong>{t("settings.statActiveInvites")}</span>
        </div>
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <Puzzle className="h-4 w-4" />{t("settings.tabModules")}</TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />{t("settings.roleUser")}</TabsTrigger>
          <TabsTrigger value="invites" className="flex items-center gap-2">
            <Key className="h-4 w-4" />{t("settings.tabInvites")}</TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />{t("settings.tabCompanyInfo")}</TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />{t("settings.tabAutomation")}</TabsTrigger>
        </TabsList>

        {/* Modules Tab - Fortnox style */}
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.modulePermissionsTitle")}</CardTitle>
              <CardDescription>{t("settings.modulePermissionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">{t("settings.roleUser")}</TableHead>
                      {toggleableModules.map((module) => (
                        <TableHead key={module.id} className="text-center min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <module.icon className="h-4 w-4" />
                            <span className="text-xs">{module.name}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.email, member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member.full_name || member.email.split("@")[0]}
                              </p>
                              {member.role === "admin" && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">{t("settings.roleAdmin")}</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {toggleableModules.map((module) => (
                          <TableCell key={module.id} className="text-center">
                            {savingModule === `${member.id}-${module.dbModuleKey}` ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                              <Switch
                                checked={isModuleEnabled(member.id, module.dbModuleKey!)}
                                onCheckedChange={(checked) => 
                                  handleToggleModule(member.id, module.dbModuleKey!, checked)
                                }
                              />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{t("settings.roleUser")}</CardTitle>
                <CardDescription>{t("settings.membersDesc")}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />{t("settings.add")}</Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("settings.roleUser")}</TableHead>
                      <TableHead>{t("settings.email")}</TableHead>
                      <TableHead>{t("settings.role")}</TableHead>
                      <TableHead className="text-right">{t("settings.roleAdmin")}</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.email, member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {member.full_name || member.email.split("@")[0]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                            {member.role === "admin" ? t("settings.roleAdmin") : t("settings.roleUser")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={member.role === "admin"}
                            onCheckedChange={() => handleToggleRole(member.id, member.role)}
                            disabled={member.id === user?.id}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingMember(member)}
                            disabled={member.id === user?.id}
                            title={member.id === user?.id ? t("settings.cannotDeleteSelf") : t("settings.deleteUserTitle")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{t("settings.inviteCodesTitle")}</CardTitle>
                <CardDescription>{t("settings.inviteCodesDesc")}</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowInviteCodeDialog(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />{t("settings.createCode")}</Button>
            </CardHeader>
            <CardContent>
              {inviteCodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Key className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">{t("settings.noInvitesYet")}</p>
                  <Button size="sm" variant="outline" onClick={() => setShowInviteCodeDialog(true)}>{t("settings.createCode")}</Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("settings.colCode")}</TableHead>
                        <TableHead>{t("settings.colUses")}</TableHead>
                        <TableHead>{t("settings.colStatus")}</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteCodes.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="px-2 py-1 rounded bg-muted font-mono text-sm">
                                {invite.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleCopyCode(invite.code)}
                              >
                                {copiedCode === invite.code ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {invite.uses} / {invite.max_uses}
                          </TableCell>
                          <TableCell>
                            {invite.is_active ? (
                              <Badge variant="secondary">{t("settings.active")}</Badge>
                            ) : (
                              <Badge variant="outline">{t("settings.inactive")}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteInviteCode(invite.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.companyInfoTitle")}</CardTitle>
              <CardDescription>{t("settings.companyInfoDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">{t("settings.companyLogoAlt")}</Label>
                <ProfileImageUpload
                  currentUrl={orgSettings.company_logo_url}
                  userId={user?.id || ""}
                  type="logo"
                  onUpload={(url) => setOrgSettings(prev => ({ ...prev, company_logo_url: url }))}
                  fallback={orgSettings.company_name?.substring(0, 2).toUpperCase() || "ORG"}
                  size="lg"
                />
              </div>

              <div className="grid gap-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />{t("settings.companyName")}</Label>
                  <Input
                    id="org-name"
                    value={orgSettings.company_name}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder={t("settings.orgCompanyNamePlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />{t("settings.companyWebsite")}</Label>
                  <Input
                    id="org-website"
                    type="url"
                    value={orgSettings.company_website}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, company_website: e.target.value }))}
                    placeholder={t("settings.orgCompanyWebsitePlaceholder")}
                  />
                </div>
              </div>

              <Button onClick={handleSaveOrgSettings} disabled={isSavingOrg}>
                {isSavingOrg ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t("settings.saveDetails")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.tabAutomation")}</CardTitle>
              <CardDescription>{t("settings.automationDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("settings.autoAnalyzeLabel")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.autoAnalyzeDesc")}</p>
                </div>
                <Switch
                  checked={autoEnrichEnabled}
                  onCheckedChange={handleToggleAutoEnrich}
                  disabled={isSavingAutoEnrich}
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-t pt-6">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("settings.leadCapLabel")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.leadCapDesc")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    min={1}
                    value={maxOpenLeads}
                    onChange={(e) => setMaxOpenLeads(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24"
                  />
                  <Button size="sm" onClick={handleSaveCap} disabled={isSavingCap}>
                    {t("settings.leadCapSave")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      {/* Delete user confirmation */}
      <Dialog open={!!deletingMember} onOpenChange={(o) => !o && setDeletingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.deleteUserTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.deleteUserConfirm")}{" "}
              <strong>{deletingMember?.full_name || deletingMember?.email}</strong>{t("settings.deleteUserConfirmRest")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingMember(null)} disabled={isDeleting}>
              {t("settings.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("settings.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.addUser")}</DialogTitle>
            <DialogDescription>{t("settings.addUserDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("settings.emailRequired")}</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t("settings.emailPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.passwordRequired")}</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder={t("settings.passwordPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.name")}</Label>
              <Input
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder={t("settings.fullNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.role")}</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(v) => setNewUserForm(prev => ({ ...prev, role: v as "admin" | "user" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("settings.roleUser")}</SelectItem>
                  <SelectItem value="admin">{t("settings.roleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{t("settings.cancel")}</Button>
            <Button onClick={handleAddUser} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("settings.createUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Code Dialog */}
      <Dialog open={showInviteCodeDialog} onOpenChange={setShowInviteCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.createInviteTitle")}</DialogTitle>
            <DialogDescription>{t("settings.createInviteDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("settings.numberOfUses")}</Label>
              <Select
                value={String(inviteCodeForm.maxUses)}
                onValueChange={(v) => setInviteCodeForm({ maxUses: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("settings.uses1")}</SelectItem>
                  <SelectItem value="5">{t("settings.uses5")}</SelectItem>
                  <SelectItem value="10">{t("settings.uses10")}</SelectItem>
                  <SelectItem value="100">{t("settings.usesUnlimited")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteCodeDialog(false)}>{t("settings.cancel")}</Button>
            <Button onClick={handleCreateInviteCode} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("settings.generateCode")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
