import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { SellerProfileGate } from "@/components/seller/SellerProfileGate";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-gradient-subtle overflow-hidden">
      <SellerProfileGate />
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AppHeader title={title} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
