import { cn } from "@/lib/utils";
import { TrainingRichText } from "./TrainingRichText";
import { splitDocByModule, splitNodesByImageMarker, stripModulePrefix, illustrationForModule } from "@/lib/trainingModules";
import { getIllustration } from "./illustrations";

/**
 * Renders a course's rich-text body as separate, numbered module blocks — split
 * at each "Modul/Module/Módulo N" marker. Purely visual: reuses the existing
 * TrainingRichText (read-only) for each module's text. Within a module, a line
 * that is exactly `[bild: key]` is replaced by the matching inline illustration.
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
        const segments = splitNodesByImageMarker(m.doc);
        // Auto-place a fitting illustration at the top of a module — unless the
        // author already put an explicit [bild: …] marker in it.
        const hasExplicitImage = segments.some((s) => s.kind === "image");
        const autoKey =
          numbered && !hasExplicitImage
            ? illustrationForModule(stripModulePrefix(m.title!)) ?? illustrationForModule(JSON.stringify(m.doc))
            : null;
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
              {autoKey && <CourseIllustration keyName={autoKey} />}
              {segments.map((seg, j) =>
                seg.kind === "image" ? (
                  <CourseIllustration key={`img-${j}`} keyName={seg.key} />
                ) : (
                  <TrainingRichText key={`${language}-${j}`} content={seg.doc} readOnly />
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CourseIllustration({ keyName }: { keyName: string }) {
  const Illo = getIllustration(keyName);
  if (!Illo) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-xs text-muted-foreground">
        Illustration "{keyName}" saknas
      </div>
    );
  }
  return (
    <div className="my-2 flex justify-center">
      <Illo className="max-w-sm" />
    </div>
  );
}
