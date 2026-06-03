import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { AIAgentChat } from "./AIAgentChat";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

export function AIAgentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Don't show on login/register pages, public routes, or when not authenticated
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isPublicRoute = location.pathname.startsWith("/r/") || location.pathname.startsWith("/book/") || location.pathname.startsWith("/quote/") || location.pathname.startsWith("/offer/");
  
  if (isLoading || !user || isAuthPage || isPublicRoute) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-40 rounded-full w-14 h-14 shadow-lg transition-all duration-300",
          "bg-primary hover:bg-primary/90 hover:scale-105",
          isOpen && "opacity-0 pointer-events-none"
        )}
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>

      {/* Chat overlay */}
      <AIAgentChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
