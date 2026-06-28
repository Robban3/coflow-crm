import { cn } from "@/lib/utils";
import { TrainingRichText } from "./TrainingRichText";
import { splitDocByHeading } from "@/lib/trainingModules";

/**
 * Renders a course's rich-text body as separate, numbered module blocks — split
 * at each H2 heading (design direction A). Purely visual: reuses the existing
 * TrainingRichText (read-only) for each module's content. Content before the
 * first H2 renders as an untitled intro block; no H2 → a single block.
 */
export function CourseModules({ body, language }: { body: unknown; language: string }) {
  const modules = splitDocByHeading(body);
  if (modules.length === 0) return null;

  let n = 0;
  return (
    <div className="space-y-4">
      {modules.map((m, i) => {
        const numbered = m.title != null;
        if (numbered) n++;
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
                <h3 className="font-semibold leading-tight">{m.title}</h3>
              </div>
            )}
            <div className="px-4 py-3">
              <TrainingRichText content={m.doc} readOnly key={language} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
