import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GraduationCap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useTrainingAccess } from "@/hooks/useTrainingAccess";
import { useTrainingCategories } from "@/hooks/useTrainingCategories";

interface Props {
  variant: "desktop" | "mobile";
  /** Desktop only: sidebar is collapsed to icons. */
  collapsed?: boolean;
  /** Mobile only: close the sheet on navigate. */
  onNavigate?: () => void;
}

/**
 * Renders the org-gated "Utbildning" menu with dynamic category submenus.
 * Returns null unless the current organization has the training feature enabled.
 */
export function TrainingNavGroup({ variant, collapsed, onNavigate }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const { canView } = useTrainingAccess();
  const { categories } = useTrainingCategories();
  const sectionActive = location.pathname.startsWith("/utbildning");
  const [open, setOpen] = useState(sectionActive);

  if (!canView) return null;

  const desktop = variant === "desktop";

  const rowClass = (active: boolean) =>
    desktop
      ? cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          active
            ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        )
      : cn(
          "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
          active
            ? "bg-accent text-primary"
            : "text-foreground hover:bg-accent hover:text-accent-foreground"
        );

  const iconClass = (active: boolean) =>
    desktop
      ? cn("h-5 w-5 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")
      : "h-5 w-5 shrink-0";

  // Collapsed desktop sidebar: just the icon linking to the landing page.
  if (desktop && collapsed) {
    return (
      <li>
        <Link to="/utbildning" className={rowClass(sectionActive)} title={t("nav.training")}>
          <GraduationCap className={iconClass(sectionActive)} />
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className={cn(rowClass(sectionActive), "w-full")}>
          <GraduationCap className={iconClass(sectionActive)} />
          <span className="flex-1 text-left">{t("nav.training")}</span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-1 ml-4 space-y-1 border-l border-sidebar-border/60 pl-2">
            {categories.map((c) => {
              const active = location.pathname === `/utbildning/${c.slug}`;
              return (
                <li key={c.id}>
                  <Link
                    to={`/utbildning/${c.slug}`}
                    onClick={onNavigate}
                    className={cn(rowClass(active), "py-2 text-sm")}
                  >
                    <span className="truncate">{c.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
