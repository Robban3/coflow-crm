import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UserMenu } from "./UserMenu";
import { MobileSidebar } from "./MobileSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="h-14 md:h-16 border-b border-border/60 bg-card/80 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between min-w-0 sticky top-0 z-40">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Mobile menu trigger */}
        <MobileSidebar />
        
        {title && (
          <h1 className="text-base md:text-lg font-semibold text-foreground truncate min-w-0 tracking-tight">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Search - hidden on mobile */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            type="search"
            placeholder="Sök..."
            className="w-64 pl-10 bg-background/60 border-border/60 h-9 text-sm placeholder:text-muted-foreground/50 focus:bg-background transition-colors"
          />
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
