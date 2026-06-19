import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useModules } from "@/hooks/useModules";
import { useOrganization } from "@/hooks/useOrganization";
import { Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { TrainingNavGroup } from "./TrainingNavGroup";

export function AppSidebar() {
  const location = useLocation();
  const { enabledModules } = useModules();
  const { settings } = useOrganization();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasAnimated = useRef(false);
  const shouldAnimate = !hasAnimated.current;
  // Mark as animated after first render
  if (!hasAnimated.current) hasAnimated.current = true;

  const navigationModules = enabledModules.filter(m => m.id !== 'settings' && !m.isLeadSection);

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

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col h-screen",
        "bg-sidebar border-r border-sidebar-border/60",
        "transition-all duration-300 ease-out",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 border-b border-sidebar-border/60",
        isCollapsed ? "px-3 justify-center" : "px-5"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 min-w-0">
            {settings.company_logo_url ? (
              <img 
                src={settings.company_logo_url} 
                alt={settings.company_name || "Logo"} 
                className="h-9 w-9 rounded-lg object-contain"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-primary-foreground font-bold text-sm tracking-tight">
                  {getInitials()}
                </span>
              </div>
            )}
            <span className="font-semibold text-sidebar-foreground truncate tracking-tight">
              {settings.company_name || "WebAgency CRM"}
            </span>
          </div>
        )}
        {isCollapsed && (
          <>
            {settings.company_logo_url ? (
              <img 
                src={settings.company_logo_url} 
                alt={settings.company_name || "Logo"} 
                className="h-9 w-9 rounded-lg object-contain"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground font-bold text-sm">
                  {getInitials().charAt(0)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-3 py-5 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1">
          {navigationModules.map((module, index) => {
            if (module.id === 'training') {
              return <TrainingNavGroup key={module.id} variant="desktop" collapsed={isCollapsed} />;
            }
            const Icon = module.icon;
            const moduleName = t(`nav.${module.id}`);
            const isActive = location.pathname === module.path ||
              (module.path !== '/dashboard' && location.pathname.startsWith(module.path));

            return (
              <li 
                key={module.id}
                className={shouldAnimate ? "animate-in opacity-0" : ""}
                style={shouldAnimate ? { animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' } : undefined}
              >
                <Link
                  to={module.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                    "transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                  title={isCollapsed ? moduleName : undefined}
                >
                  <Icon className={cn(
                    "h-5 w-5 shrink-0 transition-colors duration-200",
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                  )} />
                  {!isCollapsed && <span>{moduleName}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Settings & Collapse */}
      <div className="px-3 py-4 border-t border-sidebar-border/60 space-y-2">
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
            "transition-all duration-200",
            location.pathname.startsWith('/settings')
              ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
          title={isCollapsed ? t("sidebar.settings") : undefined}
        >
          <Settings className={cn(
            "h-5 w-5 shrink-0 transition-colors duration-200",
            location.pathname.startsWith('/settings')
              ? "text-sidebar-primary"
              : "text-sidebar-foreground/60"
          )} />
          {!isCollapsed && <span>{t("sidebar.settings")}</span>}
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "w-full justify-center text-muted-foreground/70 hover:text-muted-foreground",
            "h-9"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-1">{t("sidebar.collapse")}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
