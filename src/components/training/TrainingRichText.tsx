import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface Props {
  /** TipTap document JSON (as stored in training_items.body). */
  content?: unknown | null;
  readOnly?: boolean;
  onChange?: (json: unknown) => void;
}

/**
 * Thin TipTap wrapper used by the Training CMS. Mirrors the document TextBlock
 * editor: rich text stored as JSON, rendered read-only via the same engine
 * (so no raw HTML is injected).
 */
export function TrainingRichText({ content, readOnly, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: true }),
    ],
    content: (content as object) || "<p></p>",
    editable: !readOnly,
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON()),
  });

  useEffect(() => {
    if (editor && readOnly !== undefined) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  if (!editor) return null;

  return (
    <div>
      {!readOnly && (
        <div className="flex flex-wrap gap-1 mb-2">
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            •
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            1.
          </ToolbarButton>
        </div>
      )}
      <div className="prose prose-sm max-w-none dark:prose-invert [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs min-w-7 ${active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
    >
      {children}
    </button>
  );
}
