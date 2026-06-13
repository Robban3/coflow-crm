import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Users, 
  UserPlus, 
  Copy, 
  Check, 
  Loader2, 
  Key, 
  Trash2,
  RefreshCw,
  Shield,
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string;
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

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showInviteCodeDialog, setShowInviteCodeDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
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
  const { t } = useTranslation();

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    setIsLoading(true);

    // Fetch all profiles with their roles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, created_at");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setIsLoading(false);
      return;
    }

    // Fetch all user roles
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

    // Fetch invite codes
    const { data: codes, error: codesError } = await supabase
      .from("organization_invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (!codesError && codes) {
      setInviteCodes(codes);
    }

    setIsLoading(false);
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
      if (!user) throw new Error(t("settings.notLoggedIn"));

      const code = generateInviteCode();

      const { error } = await supabase.from("organization_invites").insert({
        code,
        created_by: user.id,
        max_uses: inviteCodeForm.maxUses,
        expires_at: null, // No expiry for now
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
        title: t("settings.error"),
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
      // Create user via admin API would require service role key
      // For now, we'll use the regular signup and auto-confirm
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: {
          data: {
            full_name: newUserForm.fullName,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Set role if admin
        if (newUserForm.role === "admin") {
          await supabase.from("user_roles").insert({
            user_id: data.user.id,
            role: "admin",
          });
        }
      }

      toast({
        title: t("settings.userCreatedTitle"),
        description: t("settings.userCreatedDesc", { email: newUserForm.email }),
      });

      setShowAddDialog(false);
      setNewUserForm({ email: "", password: "", fullName: "", role: "user" });
      
      // Wait a bit for the profile trigger to create the profile
      setTimeout(fetchTeamData, 1000);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: t("settings.error"),
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
        title: t("settings.error"),
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t("settings.teamMembersTitle")}</CardTitle>
            <CardDescription>{t("settings.teamMembersDesc")}</CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t("settings.addUser")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(member.email, member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {member.full_name || member.email}
                    </p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === "admin" ? (
                    <Badge className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {t("settings.roleUser")}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Codes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t("settings.inviteCodesTitle")}
            </CardTitle>
            <CardDescription>
              {t("settings.inviteCodesDesc")}
            </CardDescription>
          </div>
          <Button onClick={() => setShowInviteCodeDialog(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("settings.createCode")}
          </Button>
        </CardHeader>
        <CardContent>
          {inviteCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{t("settings.noActiveInvites")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inviteCodes.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <code className="px-3 py-1 rounded bg-background border font-mono text-sm">
                      {invite.code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopyCode(invite.code)}
                    >
                      {copiedCode === invite.code ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {t("settings.usesLabel", { uses: invite.uses, max: invite.max_uses })}
                    </span>
                    {!invite.is_active && (
                      <Badge variant="secondary">{t("settings.inactive")}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteInviteCode(invite.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.addUserTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.addUserDesc")}
            </DialogDescription>
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
