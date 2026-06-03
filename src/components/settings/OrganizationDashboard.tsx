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
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [userModules, setUserModules] = useState<UserModuleState>({});
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showInviteCodeDialog, setShowInviteCodeDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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
    await Promise.all([fetchTeamData(), fetchOrgSettings(), fetchUserModules(), fetchAutoEnrichSetting()]);
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
      toast({ title: enabled ? "Automatisk analys aktiverad" : "Automatisk analys inaktiverad" });
    }
    setIsSavingAutoEnrich(false);
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
        title: enabled ? "Modul aktiverad" : "Modul inaktiverad",
        description: `${MODULE_REGISTRY.find(m => m.dbModuleKey === moduleKey)?.name} för användaren`,
      });
    } catch (error) {
      console.error("Error toggling module:", error);
      toast({
        title: "Fel",
        description: "Kunde inte ändra modulstatus",
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
        title: "Roll uppdaterad",
        description: `Användaren är nu ${newRole === "admin" ? "administratör" : "vanlig användare"}`,
      });
    } catch (error) {
      console.error("Error toggling role:", error);
      toast({
        title: "Fel",
        description: "Kunde inte ändra roll",
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
        title: "Fel",
        description: "Kunde inte spara organisationsuppgifter",
        variant: "destructive",
      });
    } else {
      // Refresh organization settings in the sidebar
      await refreshSettings();
      toast({
        title: "Sparat!",
        description: "Organisationsuppgifterna har uppdaterats",
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

  const handleCreateInviteCode = async () => {
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

      const code = generateInviteCode();

      const { error } = await supabase.from("organization_invites").insert({
        code,
        created_by: user.id,
        max_uses: inviteCodeForm.maxUses,
        expires_at: null,
      });

      if (error) throw error;

      toast({
        title: "Inbjudningskod skapad!",
        description: `Koden ${code} kan nu användas vid registrering`,
      });

      setShowInviteCodeDialog(false);
      setInviteCodeForm({ maxUses: 1 });
      fetchTeamData();
    } catch (error) {
      console.error("Error creating invite code:", error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa inbjudningskod",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.email || !newUserForm.password) {
      toast({
        title: "Fyll i alla fält",
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
        title: "Användare skapad!",
        description: `${newUserForm.email} har lagts till i teamet`,
      });

      setShowAddDialog(false);
      setNewUserForm({ email: "", password: "", fullName: "", role: "user" });
      
      setTimeout(fetchTeamData, 1000);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte skapa användare",
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
        title: "Fel",
        description: "Kunde inte ta bort inbjudningskoden",
        variant: "destructive",
      });
    } else {
      toast({ title: "Inbjudningskod borttagen" });
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
          <span><strong className="text-foreground">{members.length}</strong> användare</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span><strong className="text-foreground">{members.filter(m => m.role === "admin").length}</strong> admins</span>
        </div>
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          <span><strong className="text-foreground">{activeInvites}</strong> aktiva inbjudningar</span>
        </div>
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <Puzzle className="h-4 w-4" />
            Moduler
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Användare
          </TabsTrigger>
          <TabsTrigger value="invites" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Inbjudningar
          </TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Företagsinfo
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automatisering
          </TabsTrigger>
        </TabsList>

        {/* Modules Tab - Fortnox style */}
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Modulbehörigheter</CardTitle>
              <CardDescription>
                Aktivera eller inaktivera moduler för varje användare
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Användare</TableHead>
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
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  Admin
                                </Badge>
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
                <CardTitle>Användare</CardTitle>
                <CardDescription>Hantera teammedlemmar och roller</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Lägg till
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Användare</TableHead>
                      <TableHead>E-post</TableHead>
                      <TableHead>Roll</TableHead>
                      <TableHead className="text-right">Admin</TableHead>
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
                            {member.role === "admin" ? "Admin" : "Användare"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={member.role === "admin"}
                            onCheckedChange={() => handleToggleRole(member.id, member.role)}
                            disabled={member.id === user?.id}
                          />
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
                <CardTitle>Inbjudningskoder</CardTitle>
                <CardDescription>
                  Dela koder för att låta nya användare registrera sig
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowInviteCodeDialog(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Skapa kod
              </Button>
            </CardHeader>
            <CardContent>
              {inviteCodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Key className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Inga inbjudningskoder ännu
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setShowInviteCodeDialog(true)}>
                    Skapa kod
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kod</TableHead>
                        <TableHead>Användningar</TableHead>
                        <TableHead>Status</TableHead>
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
                              <Badge variant="secondary">Aktiv</Badge>
                            ) : (
                              <Badge variant="outline">Inaktiv</Badge>
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
              <CardTitle>Företagsinformation</CardTitle>
              <CardDescription>
                Uppgifter som visas i e-postsignaturer etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Företagslogga</Label>
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
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Företagsnamn
                  </Label>
                  <Input
                    id="org-name"
                    value={orgSettings.company_name}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Mitt Företag AB"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Hemsida
                  </Label>
                  <Input
                    id="org-website"
                    type="url"
                    value={orgSettings.company_website}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, company_website: e.target.value }))}
                    placeholder="https://mittforetag.se"
                  />
                </div>
              </div>

              <Button onClick={handleSaveOrgSettings} disabled={isSavingOrg}>
                {isSavingOrg ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Spara uppgifter
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation">
          <Card>
            <CardHeader>
              <CardTitle>Automatisering</CardTitle>
              <CardDescription>
                Styr hur leads analyseras och berikas automatiskt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Analysera nya leads automatiskt</Label>
                  <p className="text-sm text-muted-foreground">
                    Kör webbanalys och skapa utskicksutkast för nya leads automatiskt.
                    Stäng av för att spara API-anrop.
                  </p>
                </div>
                <Switch
                  checked={autoEnrichEnabled}
                  onCheckedChange={handleToggleAutoEnrich}
                  disabled={isSavingAutoEnrich}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till användare</DialogTitle>
            <DialogDescription>
              Skapa ett nytt konto för en teammedlem
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>E-post *</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@företag.se"
              />
            </div>
            <div className="space-y-2">
              <Label>Lösenord *</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Minst 6 tecken"
              />
            </div>
            <div className="space-y-2">
              <Label>Namn</Label>
              <Input
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Förnamn Efternamn"
              />
            </div>
            <div className="space-y-2">
              <Label>Roll</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(v) => setNewUserForm(prev => ({ ...prev, role: v as "admin" | "user" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Användare</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleAddUser} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Skapa användare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Code Dialog */}
      <Dialog open={showInviteCodeDialog} onOpenChange={setShowInviteCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa inbjudningskod</DialogTitle>
            <DialogDescription>
              Generera en kod som nya användare kan använda vid registrering
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Antal användningar</Label>
              <Select
                value={String(inviteCodeForm.maxUses)}
                onValueChange={(v) => setInviteCodeForm({ maxUses: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 användning</SelectItem>
                  <SelectItem value="5">5 användningar</SelectItem>
                  <SelectItem value="10">10 användningar</SelectItem>
                  <SelectItem value="100">Obegränsat (100)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteCodeDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleCreateInviteCode} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generera kod
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
