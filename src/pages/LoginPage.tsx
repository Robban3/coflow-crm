import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: t("login.failedTitle"),
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    } else {
      toast({
        title: t("login.successTitle"),
        description: t("login.successDesc"),
      });
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 relative">
      {/* Language + theme toggle in corner */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher showLabel />
        <ThemeToggle />
      </div>

      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial from-muted/30 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-in opacity-0" style={{ animationFillMode: 'forwards' }}>
        <Card className="border-border/40 shadow-lg dark:shadow-2xl dark:shadow-black/20">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-md">
              <span className="text-primary-foreground font-bold text-xl tracking-tight">WA</span>
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">{t("login.welcome")}</CardTitle>
            <CardDescription className="text-muted-foreground/80">
              {t("login.subtitle")}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  {t("login.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    {t("login.password")}
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("login.forgotPassword")}
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-base font-medium" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("login.submit")}
              </Button>
            </CardContent>
          </form>

          <div className="px-6 pb-8 pt-2">
            <p className="text-sm text-muted-foreground text-center">
              {t("login.noAccount")}{" "}
              <Link
                to="/register"
                className="text-primary font-medium hover:underline underline-offset-4 transition-colors"
              >
                {t("login.createAccount")}
              </Link>
            </p>
          </div>
        </Card>

        {/* Footer text */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          {t("login.secureFooter")}
        </p>
      </div>
    </div>
  );
}
