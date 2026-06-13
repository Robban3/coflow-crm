import { useTranslation } from "@/i18n/LanguageProvider";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";
import { type DocumentBlock, type TextBlockConfig } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrmTokenPicker } from "../crm-token-picker";

interface Props {
  block: DocumentBlock;
  readOnly?: boolean;
  structureLocked?: boolean;
  onChange?: (config: DocumentBlock["config"]) => void;
}

export function TextBlockRenderer({ block, readOnly, structureLocked, onChange }: Props) {
  const { t } = useTranslation();
  const config = block.config as TextBlockConfig;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false }),
    ],
    content: config.content || "<p></p>",
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange?.({
        ...config,
        content: e.getJSON(),
      } as TextBlockConfig);
    },
  });

  useEffect(() => {
    if (editor && readOnly !== undefined) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  const handleLevelChange = (level: string) => {
    onChange?.({
      ...config,
      level: level as TextBlockConfig["level"],
    } as TextBlockConfig);
  };

  const handleInsertToken = (placeholder: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(placeholder).run();
  };

  return (
    <div className="w-full">
      {!readOnly && !structureLocked && (
        <div className="flex items-center gap-2 mb-2">
          <Select value={config.level} onValueChange={handleLevelChange}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="h1">Rubrik 1</SelectItem>
              <SelectItem value="h2">Rubrik 2</SelectItem>
              <SelectItem value="p">{t("templates.textBlockBody")}</SelectItem>
            </SelectContent>
          </Select>
          {editor && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`px-2 py-1 rounded text-xs ${editor.isActive("bold") ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`px-2 py-1 rounded text-xs ${editor.isActive("italic") ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                I
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`px-2 py-1 rounded text-xs ${editor.isActive("bulletList") ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                •
              </button>
              <CrmTokenPicker onSelect={handleInsertToken} />
            </div>
          )}
        </div>
      )}
      <div
        className={`prose prose-sm max-w-none ${
          config.level === "h1"
            ? "[&_.ProseMirror>*:first-child]:text-2xl [&_.ProseMirror>*:first-child]:font-bold"
            : config.level === "h2"
            ? "[&_.ProseMirror>*:first-child]:text-xl [&_.ProseMirror>*:first-child]:font-semibold"
            : ""
        }`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
