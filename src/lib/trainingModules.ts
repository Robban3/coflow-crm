// Split a training course's TipTap body into module segments at each module
// marker ("Modul 1" / "Module 1" / "Módulo 1" …). Purely presentational — the
// content stays one rich-text field; we just group top-level nodes by their
// preceding module marker so each module renders as its own block.
//
// We match on the marker TEXT (not on heading level): the editor only offers H2,
// so module titles and sub-headings share the same level — and the marker word
// differs per language. Matching the text works regardless of heading level,
// bold-paragraph markers, or language.

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
  /** Marker text (e.g. "Modul 1 – …"), or null for an intro segment. */
  title: string | null;
  /** A standalone TipTap doc with this module's body nodes (marker excluded). */
  doc: TipTapDoc;
}

// "Modul 1", "Module 1", "Modulo 1", "Módulo 1" — case-insensitive, at start.
const MODULE_MARKER = /^\s*m[oó]dul[oe]?\s*\d+/i;

/** Recursively collect all text in a node into a single plain string. */
function nodeText(node: TipTapNode): string {
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) return node.content.map(nodeText).join("");
  return "";
}

/**
 * Group a TipTap document into modules by its module markers.
 * - Nodes before the first marker become an untitled intro module.
 * - Each marker node starts a new module (its text is the title, excluded from
 *   the body); following nodes (incl. sub-headings) are that module's body.
 * - No marker at all → a single untitled module with the whole body (fallback).
 * Returns [] for empty/missing content.
 */
export function splitDocByModule(body: unknown): CourseModule[] {
  const doc = (body ?? null) as TipTapDoc | null;
  const nodes = Array.isArray(doc?.content) ? doc!.content! : [];
  if (nodes.length === 0) return [];

  const modules: CourseModule[] = [];
  let current: CourseModule | null = null;

  for (const node of nodes) {
    const text = nodeText(node).trim();
    if (MODULE_MARKER.test(text)) {
      current = { title: text || null, doc: { type: "doc", content: [] } };
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

/** Strip the leading "Modul N – " marker from a title, leaving just the label. */
export function stripModulePrefix(title: string): string {
  const cleaned = title.replace(/^\s*m[oó]dul[oe]?\s*\d+\s*[–\-:·.]*\s*/i, "").trim();
  return cleaned || title;
}
