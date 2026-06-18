import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Telescope,
  Search,
  GitBranch,
  CheckSquare,
  Ticket,
  Inbox,
  PhoneCall,
  BarChart3,
  FileText,
  FileBarChart,
  Calendar,
  LineChart,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/LanguageProvider";
import { SandboxDashboard } from "./tabs/SandboxDashboard";
import { SandboxLeads } from "./tabs/SandboxLeads";
import { SandboxPipeline } from "./tabs/SandboxPipeline";
import { SandboxMail } from "./tabs/SandboxMail";
import { SandboxPowerCall } from "./tabs/SandboxPowerCall";
import { SandboxWebAnalysis } from "./tabs/SandboxWebAnalysis";
import { SandboxQuotes } from "./tabs/SandboxQuotes";
import { SandboxStatistics } from "./tabs/SandboxStatistics";
import { SandboxCustomers } from "./tabs/SandboxCustomers";
import { SandboxProspecting } from "./tabs/SandboxProspecting";
import { SandboxTasks } from "./tabs/SandboxTasks";
import { SandboxTickets } from "./tabs/SandboxTickets";
import { SandboxReports } from "./tabs/SandboxReports";
import { SandboxMeetings } from "./tabs/SandboxMeetings";

interface Tab {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  Component: () => JSX.Element;
}

const TABS: Tab[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, Component: SandboxDashboard },
  { id: "customers", labelKey: "nav.customers", icon: Users, Component: SandboxCustomers },
  { id: "pipeline", labelKey: "nav.pipeline", icon: GitBranch, Component: SandboxPipeline },
  { id: "leads", labelKey: "nav.leads", icon: Search, Component: SandboxLeads },
  { id: "prospecting", labelKey: "nav.prospecting", icon: Telescope, Component: SandboxProspecting },
  { id: "tasks", labelKey: "nav.tasks", icon: CheckSquare, Component: SandboxTasks },
  { id: "tickets", labelKey: "nav.tickets", icon: Ticket, Component: SandboxTickets },
  { id: "webanalysis", labelKey: "nav.web_analysis", icon: BarChart3, Component: SandboxWebAnalysis },
  { id: "mail", labelKey: "nav.mail", icon: Inbox, Component: SandboxMail },
  { id: "powercall", labelKey: "nav.outreach_pro", icon: PhoneCall, Component: SandboxPowerCall },
  { id: "quotes", labelKey: "nav.quotes", icon: FileText, Component: SandboxQuotes },
  { id: "reports", labelKey: "nav.reports", icon: FileBarChart, Component: SandboxReports },
  { id: "meetings", labelKey: "nav.meetings", icon: Calendar, Component: SandboxMeetings },
  { id: "statistics", labelKey: "nav.statistics", icon: LineChart, Component: SandboxStatistics },
];

/**
 * Interactive training sandbox: a safe, read-only copy of the CRM with sample
 * data, per-tab explanations and highlighted key buttons. Nothing is ever saved.
 */
export function SandboxApp() {
  const { t } = useTranslation();
  const [active, setActive] = useState(TABS[0].id);
  const ActiveTab = TABS.find((x) => x.id === active)!.Component;

  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden">
      {/* Practice-mode banner */}
      <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-sm">
        <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-medium text-amber-700 dark:text-amber-300">
          {t("training.sandbox.banner")}
        </span>
      </div>

      {/* Tab navigation (mimics the CRM modules) */}
      <div className="flex gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-background text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="p-4 md:p-6">
        <ActiveTab />
      </div>
    </div>
  );
}
