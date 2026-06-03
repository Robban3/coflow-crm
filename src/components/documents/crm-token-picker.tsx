import { useState } from "react";
import { CRM_TOKEN_GROUPS } from "./crm-tokens";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Braces, Search } from "lucide-react";

interface CrmTokenPickerProps {
  onSelect: (placeholder: string) => void;
}

export function CrmTokenPicker({ onSelect }: CrmTokenPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const lowerSearch = search.toLowerCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted/80 flex items-center gap-1"
          title="Infoga fält"
        >
          <Braces className="h-3 w-3" />
          Fält
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Sök fält..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs pl-7"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {CRM_TOKEN_GROUPS.map((group) => {
            const filteredTokens = group.tokens.filter(
              (t) =>
                !search ||
                t.label.toLowerCase().includes(lowerSearch) ||
                t.token.toLowerCase().includes(lowerSearch)
            );
            if (filteredTokens.length === 0) return null;
            return (
              <div key={group.group}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">
                  {group.label}
                </p>
                {filteredTokens.map((token) => (
                  <button
                    key={token.token}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center justify-between gap-2"
                    onClick={() => {
                      onSelect(token.placeholder);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span>{token.label}</span>
                    <code className="text-[10px] text-muted-foreground font-mono">
                      {token.placeholder}
                    </code>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
