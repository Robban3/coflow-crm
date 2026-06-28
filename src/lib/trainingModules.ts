// Split a training course's TipTap body into module segments at each H2 heading.
// Purely presentational — the content stays a single rich-text field; we just
// group top-level nodes by their preceding H2 so each "Modul X" heading can be
// rendered as its own block. The editor only offers H2 (TrainingRichText), so
// H2 is the module delimiter.

export interface TipTapDoc {
  type: "doc";
  content?: TipTapNode[];
}
interface TipTapNode {
  type?: string;
  attrs?: { level?: number; [k: string]: unknown };
  content?: TipTapNode[];
  text?: string;
  [k: string]: unknown;
}

export interface CourseModule {
  /** Heading text, or null for an intro segment before the first H2. */
  title: string | null;
  /** A standalone TipTap doc with this module's body nodes (heading excluded). */
  doc: TipTapDoc;
}

function headingText(node: TipTapNode): string {
  if (!Array.isArray(node.content)) return "";
  return node.content
    .map((n) => (typeof n.text === "string" ? n.text : ""))
    .join("")
    .trim();
}

/**
 * Group a TipTap document into modules by its level-2 headings.
 * - Nodes before the first H2 become an untitled intro module.
 * - Each H2 starts a new module; following nodes (until the next H2) are its body.
 * - No H2 at all → a single untitled module containing the whole body (fallback).
 * Returns [] for empty/missing content.
 */
export function splitDocByHeading(body: unknown): CourseModule[] {
  const doc = (body ?? null) as TipTapDoc | null;
  const nodes = Array.isArray(doc?.content) ? doc!.content! : [];
  if (nodes.length === 0) return [];

  const modules: CourseModule[] = [];
  let current: CourseModule | null = null;

  for (const node of nodes) {
    const isModuleHeading = node.type === "heading" && node.attrs?.level === 2;
    if (isModuleHeading) {
      current = { title: headingText(node) || null, doc: { type: "doc", content: [] } };
      modules.push(current);
    } else {
      if (!current) {
        current = { title: null, doc: { type: "doc", content: [] } };
        modules.push(current);
      }
      current.doc.content!.push(node);
    }
  }

  return modules;
}
