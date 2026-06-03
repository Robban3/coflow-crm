import { getAllBlockEntries } from "../blocks/registry";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Type, Images, Minus, Table, List, Space } from "lucide-react";
import { type BlockType } from "../blocks/types";

const iconMap: Record<string, React.ReactNode> = {
  Type: <Type className="h-4 w-4" />,
  Image: <Images className="h-4 w-4" />,
  Minus: <Minus className="h-4 w-4" />,
  Table: <Table className="h-4 w-4" />,
  List: <List className="h-4 w-4" />,
  Space: <Space className="h-4 w-4" />,
};

interface BlockEditorToolbarProps {
  onAddBlock: (type: BlockType) => void;
}

export function BlockEditorToolbar({ onAddBlock }: BlockEditorToolbarProps) {
  const entries = getAllBlockEntries();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Lägg till block
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {entries.map((entry) => (
          <DropdownMenuItem key={entry.type} onClick={() => onAddBlock(entry.type)}>
            {iconMap[entry.icon] || null}
            <span className="ml-2">{entry.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
