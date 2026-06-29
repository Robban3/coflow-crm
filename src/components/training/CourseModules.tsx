import { cn } from "@/lib/utils";
import { TrainingRichText } from "./TrainingRichText";
import { splitDocByModule, splitNodesByImageMarker, stripModulePrefix } from "@/lib/trainingModules";

/**
 * Renders a course's rich-text body as separate, numbered module blocks — split
 * at each "Modul/Module/Módulo N" marker. Purely visual: reuses the existing
 * TrainingRichText (read-only) for each module's text.
 *
 * Illustrations are currently disabled — any `[bild: key]` marker lines are
 * still stripped out (so they don't show as raw text), but no image is drawn.
 */
export function CourseModules({ body, language }: { body: unknown; language: string }) {
  const modules = splitDocByModule(body);
  if (modules.length === 0) return null;

  let n = 0;
  return (
    <div className="space-y-5">
      {modules.map((m, i) => {
        const numbered = m.title != null;
        if (numbered) n++;
        // Keep splitting so `[bild: …]` marker lines are removed from the text,
        // but only render the text segments — illustrations are hidden.
        const segments = splitNodesByImageMarker(m.doc).filter((s) => s.kind === "text");
        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border border-border bg-card overflow-hidden",
              numbered && "border-l-4 border-l-primary",
            )}
          >
            {numbered && (
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
                  {String(n).padStart(2, "0")}
                </span>
                <h3 className="font-semibold leading-tight">{stripModulePrefix(m.title!)}</h3>
              </div>
            )}
            <div className="space-y-3 px-4 py-3">
              {segments.map((seg, j) => (
                <TrainingRichText key={`${language}-${j}`} content={(seg as { doc: unknown }).doc} readOnly />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
