import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneCall, List, ArrowRight, Zap, Target, Clock } from "lucide-react";
import { LeaderboardWidget } from "@/components/power-call/LeaderboardWidget";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function OutreachProPage() {
  const { t } = useTranslation();
  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <PhoneCall className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("outreach.pro.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("outreach.pro.subtitle")}</p>
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="group hover:border-primary/50 transition-all duration-200 cursor-pointer" onClick={() => window.location.href = '/outreach-pro/power-call'}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold text-base mb-1">{t("outreach.pro.startCardTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("outreach.pro.startCardDesc")}
              </p>
              <Button className="mt-4 w-full" asChild>
                <Link to="/outreach-pro/power-call">{t("outreach.pro.startSession")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group hover:border-border/80 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <List className="h-5 w-5 text-muted-foreground" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <h3 className="font-semibold text-base mb-1">{t("outreach.pro.listsCardTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("outreach.pro.listsCardDesc")}
              </p>
              <Button variant="outline" className="mt-4 w-full" asChild>
                <Link to="/outreach-pro/lists">{t("outreach.pro.showLists")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard + Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Target,
                title: t("outreach.pro.featSmartQueueTitle"),
                desc: t("outreach.pro.featSmartQueueDesc"),
              },
              {
                icon: PhoneCall,
                title: t("outreach.pro.featClickToCallTitle"),
                desc: t("outreach.pro.featClickToCallDesc"),
              },
              {
                icon: Clock,
                title: t("outreach.pro.featLockingTitle"),
                desc: t("outreach.pro.featLockingDesc"),
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-4 rounded-xl border bg-card/50 h-fit">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium mb-0.5">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div>
            <LeaderboardWidget />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
