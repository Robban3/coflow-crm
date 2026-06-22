import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Key, CheckCircle2, XCircle, Building2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidation, setCodeValidation] = useState<"valid" | "invalid" | null>(null);
  const [registrationType, setRegistrationType] = useState<"new" | "join">("new");
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Pre-fill invite code from URL and switch to join tab
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setInviteCode(code);
      setRegistrationType("join");
      validateInviteCode(code);
    }
  }, [searchParams]);

  const validateInviteCode = async (code: string) => {
    if (!code || code.length < 4) {
      setCodeValidation(null);
      return;
    }

    setIsValidatingCode(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_public_invite_by_code", {
        invite_code: code.toUpperCase(),
      });

      const invite = Array.isArray(data) ? data[0] : null;
      if (error || !invite) {
        setCodeValidation("invalid");
      } else {
        setCodeValidation("valid");
      }
    } catch {
      setCodeValidation("invalid");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleCodeChange = (code: string) => {
    setInviteCode(code.toUpperCase());
    setCodeValidation(null);
  };

  const handleCodeBlur = () => {
    if (inviteCode) {
      validateInviteCode(inviteCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate invite code if joining existing org
    if (registrationType === "join") {
      if (!inviteCode) {
        toast({
          title: t("register.inviteRequiredTitle"),
          description: t("register.inviteRequiredDesc"),
          variant: "destructive",
        });
        return;
      }

      if (codeValidation !== "valid") {
        toast({
          title: t("register.inviteInvalidTitle"),
          description: t("register.inviteInvalidDesc"),
          variant: "destructive",
        });
        return;
      }
    }

    if (password !== confirmPassword) {
      toast({
        title: t("register.passwordMismatchTitle"),
        description: t("register.passwordMismatchDesc"),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t("register.passwordShortTitle"),
        description: t("register.passwordShortDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let organizationId: string | null = null;

      // If joining existing org, atomically consume invite and get org ID
      if (registrationType === "join") {
        const { data: consumedOrgId, error: inviteError } = await (supabase as any).rpc("consume_invite_code", {
          invite_code: inviteCode,
        });

        if (inviteError || !consumedOrgId) {
          throw new Error(t("register.inviteInvalidError"));
        }

        organizationId = consumedOrgId;
      }

      // Create the user
      const { error, session } = await signUp(email, password, fullName);

      if (error) {
        throw error;
      }

      // Email confirmation enabled: no session until the user verifies their
      // address. Tell them to check their inbox instead of proceeding (the app
      // can't load without a session anyway).
      if (!session) {
        toast({
          title: t("register.verifyEmailTitle"),
          description: t("register.verifyEmailDesc", { email }),
        });
        navigate("/login");
        return;
      }

      // Wait a moment for auth trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 500));

      // If joining existing org, update profile with organization_id
      if (registrationType === "join" && organizationId) {
        const { data: { user: newUser } } = await supabase.auth.getUser();
        
        if (newUser) {
          await supabase
            .from("profiles")
            .update({ 
              organization_id: organizationId,
              onboarding_completed: true 
            })
            .eq("id", newUser.id);
        }

        toast({
          title: t("register.createdTitle"),
          description: t("register.joinedDesc"),
        });
        navigate("/dashboard");
      } else {
        // New organization - redirect to onboarding
        toast({
          title: t("register.createdTitle"),
          description: t("register.configureDesc"),
        });
        navigate("/onboarding");
      }
    } catch (error: any) {
      toast({
        title: t("register.failedTitle"),
        description: error.message || t("register.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher showLabel />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-lg">CRM</span>
          </div>
          <CardTitle className="text-2xl">{t("register.title")}</CardTitle>
          <CardDescription>
            {t("register.subtitle")}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Registration type tabs */}
            <Tabs 
              value={registrationType} 
              onValueChange={(v) => setRegistrationType(v as "new" | "join")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {t("register.newOrg")}
                </TabsTrigger>
                <TabsTrigger value="join" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("register.join")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="mt-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t("register.newOrgDesc")}
                </p>
              </TabsContent>

              <TabsContent value="join" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5" />
                    {t("register.inviteCode")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="inviteCode"
                      type="text"
                      placeholder="XXXXXXXX"
                      value={inviteCode}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      onBlur={handleCodeBlur}
                      disabled={isLoading}
                      className="font-mono uppercase pr-10"
                    />
                    {isValidatingCode && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {!isValidatingCode && codeValidation === "valid" && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
                    )}
                    {!isValidatingCode && codeValidation === "invalid" && (
                      <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {codeValidation === "invalid" && (
                    <p className="text-xs text-destructive">
                      {t("register.inviteInvalid")}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="fullName">{t("register.name")}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t("register.namePlaceholder")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("register.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("register.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("register.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || (registrationType === "join" && codeValidation !== "valid")}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {registrationType === "new" ? t("register.createOrg") : t("register.joinOrg")}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              {t("register.hasAccount")}{" "}
              <Link to="/login" className="text-primary hover:underline">
                {t("register.login")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
