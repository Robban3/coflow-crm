import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type DocumentBlock } from "../blocks/types";
import { BlockRenderer } from "../blocks/BlockRenderer";
import { DragHandle } from "./DragHandle";
import { Button } from "@/components/ui/button";
import { Copy, Trash2 } from "lucide-react";

interface SortableBlockListProps {
  blocks: DocumentBlock[];
  onReorder: (activeId: string, overId: string) => void;
  onUpdateBlock: (id: string, config: DocumentBlock["config"]) => void;
  onDuplicateBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  readOnly?: boolean;
  /** Hides drag/duplicate/delete but allows content editing */
  structureLocked?: boolean;
}

function SortableBlock({
  block,
  onUpdateBlock,
  onDuplicate,
  onDelete,
  readOnly,
  structureLocked,
}: {
  block: DocumentBlock;
  onUpdateBlock: (config: DocumentBlock["config"]) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  readOnly?: boolean;
  structureLocked?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, disabled: structureLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 py-2 px-1 rounded-lg hover:bg-muted/30 transition-colors"
    >
      {!readOnly && !structureLocked && (
        <div className="flex flex-col items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <DragHandle listeners={listeners} attributes={attributes} />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <BlockRenderer block={block} readOnly={readOnly} structureLocked={structureLocked} onChange={onUpdateBlock} />
      </div>
    </div>
  );
}

export function SortableBlockList({
  blocks,
  onReorder,
  onUpdateBlock,
  onDuplicateBlock,
  onDeleteBlock,
  readOnly,
  structureLocked,
}: SortableBlockListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              readOnly={readOnly}
              structureLocked={structureLocked}
              onUpdateBlock={(config) => onUpdateBlock(block.id, config)}
              onDuplicate={() => onDuplicateBlock(block.id)}
              onDelete={() => onDeleteBlock(block.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
