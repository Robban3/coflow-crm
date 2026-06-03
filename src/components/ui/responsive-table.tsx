import * as React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

// Wrapper that adds horizontal scroll on mobile
export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0", className)}>
      <div className="min-w-[600px] md:min-w-0">
        {children}
      </div>
    </div>
  );
}

// Card-based display for mobile, hides on desktop
interface MobileCardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function MobileCardList<T>({ items, renderCard, className }: MobileCardListProps<T>) {
  return (
    <div className={cn("flex flex-col gap-3 md:hidden", className)}>
      {items.map((item, index) => renderCard(item, index))}
    </div>
  );
}

// Desktop table wrapper - hidden on mobile
interface DesktopTableProps {
  children: React.ReactNode;
  className?: string;
}

export function DesktopTable({ children, className }: DesktopTableProps) {
  return (
    <div className={cn("hidden md:block overflow-x-auto", className)}>
      {children}
    </div>
  );
}
