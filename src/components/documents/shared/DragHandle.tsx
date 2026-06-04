import { GripVertical } from "lucide-react";
import { forwardRef } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";

interface DragHandleProps {
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
}

export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  ({ listeners, attributes }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    );
  }
);

DragHandle.displayName = "DragHandle";
