// Hand-drawn flat "spot" illustrations for course content, themed to the app
// palette via CSS theme variables (hsl(var(--primary)) etc.) so they adapt to
// light/dark. Referenced from course text via a [bild: <key>] shortcode and
// rendered inline by CourseModules. Add new motifs here — the key is what the
// author types in the text.

import type { FC } from "react";

type IllustrationProps = { className?: string };

const VB = "0 0 240 150";
const wrap = (className?: string) =>
  `mx-auto w-full max-w-md ${className ?? ""}`.trim();

// Shared rounded backdrop panel.
const Backdrop = () => <rect x="0" y="0" width="240" height="150" rx="16" fill="hsl(var(--muted))" />;

const Process: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Process">
    <Backdrop />
    <line x1="40" y1="75" x2="200" y2="75" stroke="hsl(var(--primary) / 0.3)" strokeWidth="5" strokeLinecap="round" />
    <circle cx="40" cy="75" r="13" fill="hsl(var(--primary))" />
    <circle cx="93" cy="75" r="13" fill="hsl(var(--primary) / 0.6)" />
    <circle cx="147" cy="75" r="13" fill="hsl(var(--primary) / 0.6)" />
    <circle cx="200" cy="75" r="13" fill="hsl(var(--primary))" />
  </svg>
);

const Prospektering: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Prospektering">
    <Backdrop />
    <rect x="36" y="38" width="118" height="74" rx="8" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="2" />
    <line x1="50" y1="58" x2="120" y2="58" stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth="5" strokeLinecap="round" />
    <line x1="50" y1="75" x2="138" y2="75" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="5" strokeLinecap="round" />
    <line x1="50" y1="92" x2="108" y2="92" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="5" strokeLinecap="round" />
    <circle cx="162" cy="90" r="22" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="6" />
    <line x1="178" y1="106" x2="198" y2="126" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" />
  </svg>
);

const Behovsanalys: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Behovsanalys">
    <Backdrop />
    <rect x="40" y="42" width="92" height="46" rx="12" fill="hsl(var(--primary))" />
    <path d="M62 88 l0 16 l18 -16 z" fill="hsl(var(--primary))" />
    <rect x="122" y="70" width="80" height="42" rx="12" fill="hsl(var(--primary) / 0.25)" />
    <path d="M182 112 l0 14 l-16 -14 z" fill="hsl(var(--primary) / 0.25)" />
  </svg>
);

const Pitch: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Pitch">
    <Backdrop />
    <rect x="50" y="32" width="140" height="82" rx="8" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="2" />
    <rect x="68" y="84" width="14" height="20" rx="2" fill="hsl(var(--primary) / 0.5)" />
    <rect x="90" y="70" width="14" height="34" rx="2" fill="hsl(var(--primary) / 0.7)" />
    <rect x="112" y="56" width="14" height="48" rx="2" fill="hsl(var(--primary))" />
    <path d="M68 60 L104 52 L156 44" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="120" y1="114" x2="120" y2="126" stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="4" />
    <line x1="98" y1="126" x2="142" y2="126" stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const Invandningar: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Invändningar">
    <Backdrop />
    <path d="M120 34 c20 10 36 12 44 12 c2 30 -8 50 -44 64 c-36 -14 -46 -34 -44 -64 c8 0 24 -2 44 -12 z"
      fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinejoin="round" />
    <path d="M104 78 l11 11 l22 -24" stroke="hsl(var(--primary))" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Avslut: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Avslut">
    <Backdrop />
    <rect x="66" y="30" width="84" height="92" rx="8" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="2" />
    <line x1="80" y1="50" x2="136" y2="50" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="4" strokeLinecap="round" />
    <line x1="80" y1="64" x2="136" y2="64" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="4" strokeLinecap="round" />
    <line x1="80" y1="78" x2="118" y2="78" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="4" strokeLinecap="round" />
    <circle cx="152" cy="104" r="24" fill="hsl(var(--primary))" />
    <path d="M141 104 l8 8 l15 -16" stroke="hsl(var(--primary-foreground))" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Overlamning: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Överlämning">
    <Backdrop />
    <path d="M44 75 h44" stroke="hsl(var(--primary) / 0.5)" strokeWidth="7" strokeLinecap="round" />
    <rect x="96" y="55" width="48" height="40" rx="6" fill="hsl(var(--primary))" />
    <path d="M120 55 v40 M96 70 h48" stroke="hsl(var(--primary-foreground) / 0.5)" strokeWidth="3" />
    <path d="M152 75 h40 m-13 -11 l13 11 l-13 11" stroke="hsl(var(--primary))" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Misstag: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Vanliga misstag">
    <Backdrop />
    <path d="M120 38 L170 114 H70 Z" fill="hsl(var(--primary) / 0.12)" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinejoin="round" />
    <line x1="120" y1="66" x2="120" y2="92" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round" />
    <circle cx="120" cy="104" r="4" fill="hsl(var(--primary))" />
  </svg>
);

const Ova: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Öva">
    <Backdrop />
    <circle cx="112" cy="78" r="36" fill="none" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="6" />
    <circle cx="112" cy="78" r="21" fill="none" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="6" />
    <circle cx="112" cy="78" r="7" fill="hsl(var(--primary))" />
    <path d="M150 40 l20 6 l-10 8 l8 10 l-20 -6 z" fill="hsl(var(--primary))" />
    <line x1="158" y1="56" x2="120" y2="78" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const Tillvaxt: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Tillväxt">
    <Backdrop />
    <rect x="54" y="92" width="18" height="26" rx="3" fill="hsl(var(--primary) / 0.4)" />
    <rect x="82" y="76" width="18" height="42" rx="3" fill="hsl(var(--primary) / 0.6)" />
    <rect x="110" y="58" width="18" height="60" rx="3" fill="hsl(var(--primary) / 0.8)" />
    <rect x="138" y="42" width="18" height="76" rx="3" fill="hsl(var(--primary))" />
    <path d="M58 84 L150 40 m-15 -1 l15 1 l-1 15" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Kontakt: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Kontakt">
    <Backdrop />
    <rect x="60" y="46" width="120" height="80" rx="10" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="4" />
    <path d="M64 54 L120 94 L176 54" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Analys: FC<IllustrationProps> = ({ className }) => (
  <svg viewBox={VB} className={wrap(className)} role="img" aria-label="Analys">
    <Backdrop />
    <path d="M68 112 A52 52 0 0 1 172 112" fill="none" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="12" strokeLinecap="round" />
    <path d="M68 112 A52 52 0 0 1 150 72" fill="none" stroke="hsl(var(--primary))" strokeWidth="12" strokeLinecap="round" />
    <line x1="120" y1="112" x2="150" y2="82" stroke="hsl(var(--foreground))" strokeWidth="4" strokeLinecap="round" />
    <circle cx="120" cy="112" r="7" fill="hsl(var(--foreground))" />
  </svg>
);

export const ILLUSTRATIONS: Record<string, FC<IllustrationProps>> = {
  process: Process,
  prospektering: Prospektering,
  prospecting: Prospektering,
  behovsanalys: Behovsanalys,
  pitch: Pitch,
  invandningar: Invandningar,
  avslut: Avslut,
  overlamning: Overlamning,
  misstag: Misstag,
  ova: Ova,
  tillvaxt: Tillvaxt,
  kontakt: Kontakt,
  analys: Analys,
};

/** Look up an illustration component by (lowercased) key; null if unknown. */
export function getIllustration(key: string): FC<IllustrationProps> | null {
  return ILLUSTRATIONS[key.toLowerCase()] ?? null;
}

/** Keys an author can use in a [bild: <key>] shortcode. */
export const ILLUSTRATION_KEYS = Object.keys(ILLUSTRATIONS);
