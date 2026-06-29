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

// Pick a fitting illustration for a module from its title/text. Order matters —
// more specific topics first so e.g. "överlämning" wins over the generic
// "process". Covers sv/en/es keywords. Returns an illustration key or null.
const TOPIC_KEYWORDS: Array<[string, RegExp]> = [
  ["overlamning", /överlämn|overlamn|handoff|implementer|traspas/i],
  ["avslut", /avslut|\bclose\b|avtal|signer|cierre|cerrar/i],
  ["invandningar", /invändning|invandning|objection|bemöt|objeci/i],
  ["behovsanalys", /behov|\bneeds\b|lyssna|fråg|necesidad/i],
  ["prospektering", /prospekter|hitta rätt|kvalificer|köpsignal|prospect|encontrar/i],
  ["pitch", /pitch|presenter|förslag|presentaci|propuesta/i],
  ["misstag", /misstag|undvik|mistake|\berror|errores/i],
  ["ova", /\böva\b|övning|practice|facit|practica|ejercicio/i],
  ["tillvaxt", /tillväxt|växa|growth|skala|crecim/i],
  ["kontakt", /\bkontakt|outreach|contacto|första kontakt/i],
  ["analys", /analys|\bmät|statistik|rapport|análisis|datos/i],
  ["process", /process|stegen|överblick|flöde|proceso|pasos/i],
];

export function illustrationForModule(text: string): string | null {
  for (const [key, re] of TOPIC_KEYWORDS) {
    if (re.test(text)) return key;
  }
  return null;
}

/** Strip the leading "Modul N – " marker from a title, leaving just the label. */
export function stripModulePrefix(title: string): string {
  const cleaned = title.replace(/^\s*m[oó]dul[oe]?\s*\d+\s*[–\-:·.]*\s*/i, "").trim();
  return cleaned || title;
}

// ── Inline illustration shortcode: a paragraph that is exactly "[bild: key]" ──
export type CourseSegment =
  | { kind: "text"; doc: TipTapDoc }
  | { kind: "image"; key: string };

const IMAGE_MARKER = /^\s*\[\s*bild\s*:\s*([\w-]+)\s*\]\s*$/i;

/**
 * Split a module's body into a sequence of text segments and inline image
 * markers, so [bild: key] lines can be replaced by an illustration while the
 * surrounding text keeps rendering through TrainingRichText. Empty text
 * segments are dropped.
 */
export function splitNodesByImageMarker(doc: TipTapDoc): CourseSegment[] {
  const nodes = Array.isArray(doc.content) ? doc.content : [];
  const segments: CourseSegment[] = [];
  let buffer: TipTapNode[] = [];
  const flush = () => {
    if (buffer.length) {
      segments.push({ kind: "text", doc: { type: "doc", content: buffer } });
      buffer = [];
    }
  };
  for (const node of nodes) {
    const m = nodeText(node).trim().match(IMAGE_MARKER);
    if (m) {
      flush();
      segments.push({ kind: "image", key: m[1].toLowerCase() });
    } else {
      buffer.push(node);
    }
  }
  flush();
  return segments;
}
