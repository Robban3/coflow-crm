import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useModules } from "@/hooks/useModules";
import { useOrganization } from "@/hooks/useOrganization";
import { Settings, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { TrainingNavGroup } from "./TrainingNavGroup";

export function MobileSidebar() {
  const location = useLocation();
  const { enabledModules } = useModules();
  const { settings } = useOrganization();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const navigationModules = enabledModules.filter(m => m.id !== 'settings' && !m.isLeadSection);

  // Get initials from company name or fallback
  const getInitials = () => {
    if (settings.company_name) {
      return settings.company_name
        .split(" ")
        .map(w => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }
    return "WA";
  };

  const handleNavClick = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("sidebar.openMenu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            {settings.company_logo_url ? (
              <img 
                src={settings.company_logo_url} 
                alt={settings.company_name || "Logo"} 
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-sm">{getInitials()}</span>
              </div>
            )}
            <span className="font-semibold text-foreground truncate">
              {settings.company_name || "WebAgency CRM"}
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navigationModules.map((module) => {
              if (module.id === 'training') {
                return <TrainingNavGroup key={module.id} variant="mobile" onNavigate={handleNavClick} />;
              }
              const Icon = module.icon;
              const isActive = location.pathname === module.path ||
                (module.path !== '/dashboard' && location.pathname.startsWith(module.path));

              return (
                <li key={module.id}>
                  <Link
                    to={module.path}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-primary"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{t(`nav.${module.id}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Settings */}
        <div className="px-3 py-4 border-t border-border mt-auto">
          <Link
            to="/settings"
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
              location.pathname.startsWith('/settings')
                ? "bg-accent text-primary"
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span>{t("sidebar.settings")}</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
