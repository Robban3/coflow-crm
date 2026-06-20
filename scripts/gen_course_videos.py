#!/usr/bin/env python3
"""Generera berättade "slide-videor" ur kursmaterialet — helt gratis och lokalt.

Källa: kursernas TipTap-JSON ligger redan i migrations-SQL-filerna. Vi parsar ut
dem per kurs och språk, gör om varje modul till slides (Pillow), läser upp texten
med espeak-ng (offline TTS) och fogar ihop till en MP4 per kurs/språk med ffmpeg
(medföljer imageio-ffmpeg). Inga konton, ingen kostnad, inget skickas externt.

Exempel:
  python3 scripts/gen_course_videos.py --course "Grundkurs: Sälj från A till Ö" \
      --lang sv --modules 1 --out output/videos/grundkurs__sv__m1.mp4
  python3 scripts/gen_course_videos.py --all        # alla kurser, alla språk
"""
import argparse, glob, json, os, re, subprocess, sys, tempfile, wave

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS = os.path.join(ROOT, "supabase", "migrations")
SQL_FILES = [
    "20260620150000_courses_v2_batch1.sql",
    "20260620160000_courses_v2_batch2.sql",
    "20260620180000_courses_v2_b1_translations.sql",
    "20260620200000_courses_v2_b2_translations.sql",
]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# ── Stil ─────────────────────────────────────────────────────────────────────
W, H = 1920, 1080
BG = (11, 18, 32)          # djup marinblå
PANEL = (17, 27, 46)
ACCENT = (79, 140, 255)    # Applabbet-blå
TEXT = (240, 244, 250)
MUTED = (150, 166, 190)
QUOTE_BG = (22, 34, 56)
MARGIN = 130
FONT_DIR = "/usr/share/fonts/truetype/dejavu"
def _font(name, size): return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
F_CRUMB   = _font("DejaVuSans-Bold.ttf", 34)
F_TITLE   = _font("DejaVuSans-Bold.ttf", 78)
F_MODULE  = _font("DejaVuSans-Bold.ttf", 92)
F_BULLET  = _font("DejaVuSans.ttf", 46)
F_BULLETB = _font("DejaVuSans-Bold.ttf", 46)
F_QUOTE   = _font("DejaVuSans.ttf", 44)
F_BRAND   = _font("DejaVuSans-Bold.ttf", 30)

# Piper neurala röster (gratis, körs lokalt). Hämtade från rhasspy/piper v0.0.2.
PIPER_MODELS = {
    "sv": "models/piper/sv-se-nst-medium.onnx",
    "en": "models/piper/en-us-lessac-medium.onnx",
    "es": "models/piper/es-mls_10246-low.onnx",
}
# Release-assets för auto-nedladdning om modellerna saknas (models/ är gitignorerad)
PIPER_RELEASE = "https://github.com/rhasspy/piper/releases/download/v0.0.2/"
PIPER_ASSETS = {
    "sv": "voice-sv-se-nst-medium.tar.gz",
    "en": "voice-en-us-lessac-medium.tar.gz",
    "es": "voice-es-mls_10246-low.tar.gz",
}


def ensure_voice(lang):
    """Ladda ner + packa upp Piper-rösten om den inte redan finns lokalt."""
    model = os.path.join(ROOT, PIPER_MODELS[lang])
    if os.path.exists(model):
        return True
    import io
    import tarfile
    import urllib.request
    dest = os.path.join(ROOT, "models", "piper")
    os.makedirs(dest, exist_ok=True)
    url = PIPER_RELEASE + PIPER_ASSETS[lang]
    try:
        print(f"  hämtar röst ({lang}) från {PIPER_ASSETS[lang]} ...")
        req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
        data = urllib.request.urlopen(req, timeout=180).read()
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as t:
            t.extractall(dest)
        return os.path.exists(model)
    except Exception as e:
        print(f"  kunde inte hämta Piper-röst ({lang}): {type(e).__name__}: {e}")
        return False
# espeak-ng röster (nödfallback om Piper-modell saknas)
ESPEAK_VOICES = {"sv": ("sv", 150), "en": ("en-us", 155), "es": ("es", 155)}
LANG_COL = {"sv": "body", "en": "body_en", "es": "body_es"}

# Snygga kurstitlar för intro-sliden (modulrubrikerna är redan översatta i texten)
COURSE_TITLES = {
    "sv": {"Grundkurs: Sälj från A till Ö": "Grundkurs: Sälj från A till Ö"},
    "en": {
        "Grundkurs: Sälj från A till Ö": "Foundation course: Selling A to Z",
        "Behovsanalys & frågeteknik": "Needs analysis & questioning",
        "Invändningshantering & förhandling": "Objection handling & negotiation",
        "Mötesbokning & kalla samtal": "Meeting booking & cold calls",
        "Digital spetskunskap: SEO & GEO": "Digital edge: SEO & GEO",
        "Produktmästaren": "The product master",
        "Storytelling & pitch": "Storytelling & pitch",
        "CRM-mästaren": "The CRM master",
    },
    "es": {
        "Grundkurs: Sälj från A till Ö": "Curso base: Vender de la A a la Z",
        "Behovsanalys & frågeteknik": "Análisis de necesidades y preguntas",
        "Invändningshantering & förhandling": "Manejo de objeciones y negociación",
        "Mötesbokning & kalla samtal": "Agendar reuniones y llamadas en frío",
        "Digital spetskunskap: SEO & GEO": "Ventaja digital: SEO y GEO",
        "Produktmästaren": "El maestro del producto",
        "Storytelling & pitch": "Narrativa y pitch",
        "CRM-mästaren": "El maestro del CRM",
    },
}
INTRO_SUB = {"sv": "Applabbet · Säljutbildning", "en": "Applabbet · Sales training",
             "es": "Applabbet · Formación de ventas"}


# ── Parsa kursinnehåll ur migrations-SQL ─────────────────────────────────────
def load_courses():
    """-> {title: {lang: doc_dict}}"""
    out = {}
    stmt_re = re.compile(r"SET\s+(.*?)\s+FROM\s+.*?ti\.title\s*=\s*'((?:[^']|'')+)'\s*;",
                         re.S)
    doc_re = re.compile(r"body(_en|_es)?\s*=\s*\$j\$(.*?)\$j\$", re.S)
    col2lang = {"": "sv", "_en": "en", "_es": "es"}
    for fn in SQL_FILES:
        path = os.path.join(MIGRATIONS, fn)
        if not os.path.exists(path):
            continue
        sql = open(path, encoding="utf-8").read()
        for setpart, title in stmt_re.findall(sql):
            title = title.replace("''", "'")
            for suffix, body in doc_re.findall(setpart):
                lang = col2lang[suffix]
                out.setdefault(title, {})[lang] = json.loads(body)
    return out


def node_text(node):
    if "text" in node:
        return node["text"]
    return "".join(node_text(c) for c in node.get("content", []))


def is_bold_para(node):
    cs = [c for c in node.get("content", []) if c.get("text")]
    return bool(cs) and all(
        any(m.get("type") == "bold" for m in (c.get("marks") or [])) for c in cs)


def doc_to_slides(doc, course_title, lang, modules_limit=None):
    """TipTap-doc -> lista av slides (+ narration)."""
    slides = [{
        "kind": "intro",
        "crumb": INTRO_SUB[lang],
        "title": COURSE_TITLES[lang].get(course_title, course_title),
        "bullets": [],
        "speak": COURSE_TITLES[lang].get(course_title, course_title),
    }]
    cur = None
    module_title = ""
    module_count = 0
    for node in doc.get("content", []):
        t = node["type"]
        if t == "heading":
            module_count += 1
            if modules_limit and module_count > modules_limit:
                break
            module_title = node_text(node)
            cur = None
            slides.append({"kind": "module", "crumb": "", "title": module_title,
                           "bullets": [], "speak": module_title})
        elif t == "paragraph":
            txt = node_text(node).strip()
            if not txt:
                continue
            if is_bold_para(node):
                cur = {"kind": "content", "crumb": module_title, "title": txt,
                       "bullets": [], "speak_parts": [txt]}
                slides.append(cur)
            else:
                cur = _ensure(cur, slides, module_title)
                cur["bullets"].append(("p", txt))
                cur["speak_parts"].append(txt)
        elif t in ("bulletList", "orderedList"):
            cur = _ensure(cur, slides, module_title)
            for i, li in enumerate(node.get("content", [])):
                txt = node_text(li).strip()
                prefix = f"{i+1}. " if t == "orderedList" else None
                cur["bullets"].append(("li", txt, prefix))
                cur["speak_parts"].append(txt.replace(" – ", ". ").replace(": ", ". "))
        elif t == "blockquote":
            cur = _ensure(cur, slides, module_title)
            for p in node.get("content", []):
                txt = node_text(p).strip()
                if txt:
                    cur["bullets"].append(("quote", txt))
                    cur["speak_parts"].append(txt)
    for s in slides:
        if "speak" not in s:
            s["speak"] = ". ".join([s["title"]] + [b for b in s.get("speak_parts", [])
                                                   if b not in (s["title"],)])
    return slides


def _ensure(cur, slides, module_title):
    if cur is None or cur["kind"] not in ("content",):
        cur = {"kind": "content", "crumb": module_title, "title": "",
               "bullets": [], "speak_parts": []}
        slides.append(cur)
    return cur


# ── Rita slides ──────────────────────────────────────────────────────────────
def wrap(draw, text, font, max_w):
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = (line + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w:
            line = trial
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def draw_slide(slide, path):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # vänster accentlist
    d.rectangle([0, 0, 14, H], fill=ACCENT)
    # brand
    d.text((W - MARGIN - d.textlength("APPLABBET", font=F_BRAND), H - 70),
           "APPLABBET", font=F_BRAND, fill=MUTED)

    if slide["kind"] in ("intro", "module"):
        crumb = slide.get("crumb", "")
        if crumb:
            d.text((MARGIN, 360), crumb, font=F_CRUMB, fill=ACCENT)
        f = F_MODULE if slide["kind"] == "module" else F_TITLE
        lines = wrap(d, slide["title"], f, W - 2 * MARGIN)
        total = len(lines) * (f.size + 16)
        y = (H - total) // 2
        for ln in lines:
            d.text((MARGIN, y), ln, font=f, fill=TEXT)
            y += f.size + 16
        if slide["kind"] == "intro":
            d.text((MARGIN, y + 24), INTRO_SUB.get("", ""), font=F_CRUMB, fill=MUTED)
        img.save(path)
        return

    # content
    y = 120
    if slide.get("crumb"):
        d.text((MARGIN, y), slide["crumb"].upper(), font=F_CRUMB, fill=ACCENT)
        y += 60
    if slide.get("title"):
        for ln in wrap(d, slide["title"], F_TITLE, W - 2 * MARGIN):
            d.text((MARGIN, y), ln, font=F_TITLE, fill=TEXT)
            y += F_TITLE.size + 10
        y += 24

    for item in slide["bullets"]:
        kind = item[0]
        if kind == "quote":
            txt = item[1]
            lines = wrap(d, txt, F_QUOTE, W - 2 * MARGIN - 60)
            block_h = len(lines) * (F_QUOTE.size + 12) + 40
            d.rectangle([MARGIN, y, W - MARGIN, y + block_h], fill=QUOTE_BG)
            d.rectangle([MARGIN, y, MARGIN + 10, y + block_h], fill=ACCENT)
            yy = y + 20
            for ln in lines:
                d.text((MARGIN + 40, yy), ln, font=F_QUOTE, fill=(208, 220, 238))
                yy += F_QUOTE.size + 12
            y += block_h + 28
        else:
            txt = item[1]
            prefix = item[2] if (kind == "li" and len(item) > 2 and item[2]) else None
            bullet = prefix if prefix else "•"
            d.text((MARGIN, y + 6), bullet, font=F_BULLETB, fill=ACCENT)
            indent = MARGIN + 70
            lines = wrap(d, txt, F_BULLET, W - indent - MARGIN)
            # fetstil på "Etikett:" / "Etikett –" om sådan finns
            for j, ln in enumerate(lines):
                d.text((indent, y), ln, font=F_BULLET, fill=TEXT)
                y += F_BULLET.size + 10
            y += 16
        if y > H - 130:   # skydd mot overflow
            break
    img.save(path)


# ── TTS (Piper neural, espeak-ng som fallback) ───────────────────────────────
_piper_cache = {}


def _piper(lang):
    if lang not in _piper_cache:
        from piper import PiperVoice
        m = os.path.join(ROOT, PIPER_MODELS[lang])
        _piper_cache[lang] = PiperVoice.load(m, config_path=m + ".json")
    return _piper_cache[lang]


def _espeak(text, lang, path):
    voice, speed = ESPEAK_VOICES[lang]
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                     encoding="utf-8") as tf:
        tf.write(text)
        tfp = tf.name
    subprocess.run(["espeak-ng", "-v", voice, "-s", str(speed), "-z",
                    "-w", path, "-f", tfp], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.unlink(tfp)


def synth(text, lang, path):
    """Skriv uppläsning till WAV och returnera längden i sekunder."""
    if lang in PIPER_MODELS and ensure_voice(lang):
        with wave.open(path, "wb") as wf:
            _piper(lang).synthesize_wav(text, wf)
    else:
        _espeak(text, lang, path)
    with wave.open(path) as wf:
        return wf.getnframes() / float(wf.getframerate())


# ── Bygg video ───────────────────────────────────────────────────────────────
def build(slides, out_path, workdir):
    os.makedirs(workdir, exist_ok=True)
    clips = []
    for i, s in enumerate(slides):
        png = os.path.join(workdir, f"s{i:03d}.png")
        wav = os.path.join(workdir, f"s{i:03d}.wav")
        mp4 = os.path.join(workdir, f"s{i:03d}.mp4")
        draw_slide(s, png)
        dur = synth(s["speak"], s["_lang"], wav) + 0.6   # liten paus efter
        subprocess.run([FFMPEG, "-y", "-loop", "1", "-i", png, "-i", wav,
                        "-c:v", "libx264", "-t", f"{dur:.2f}", "-r", "25",
                        "-pix_fmt", "yuv420p", "-vf", f"scale={W}:{H}",
                        "-c:a", "aac", "-b:a", "128k", "-shortest", mp4],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        clips.append(mp4)
        print(f"  slide {i+1}/{len(slides)}  {dur:4.1f}s  {s['kind']}")
    listf = os.path.join(workdir, "list.txt")
    with open(listf, "w") as f:
        for c in clips:
            f.write(f"file '{os.path.abspath(c)}'\n")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listf,
                    "-c", "copy", out_path], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out_path


def slugify(s):
    s = s.lower()
    for a, b in [("å", "a"), ("ä", "a"), ("ö", "o"), ("é", "e")]:
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--course")
    ap.add_argument("--lang", default="sv", choices=["sv", "en", "es"])
    ap.add_argument("--modules", type=int, default=None,
                    help="begränsa till N första moduler (för testklipp)")
    ap.add_argument("--out")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()

    courses = load_courses()
    if not courses:
        sys.exit("Hittade inget kursinnehåll i migrations-SQL.")

    jobs = []
    if args.all:
        for title in courses:
            for lang in ("sv", "en", "es"):
                if lang in courses[title]:
                    jobs.append((title, lang, None,
                                 f"output/videos/{slugify(title)}__{lang}.mp4"))
    else:
        if not args.course:
            print("Kurser:", *["\n  - " + t for t in courses], sep="")
            sys.exit("Ange --course \"<titel>\" (eller --all).")
        title = args.course
        if title not in courses:
            sys.exit(f"Okänd kurs: {title}")
        out = args.out or f"output/videos/{slugify(title)}__{args.lang}.mp4"
        jobs.append((title, args.lang, args.modules, out))

    for title, lang, mlim, out in jobs:
        print(f"\n== {title} [{lang}] -> {out} ==")
        slides = doc_to_slides(courses[title][lang], title, lang, mlim)
        for s in slides:
            s["_lang"] = lang
        with tempfile.TemporaryDirectory() as wd:
            build(slides, os.path.join(ROOT, out), wd)
        print(f"  klar: {out}")


if __name__ == "__main__":
    main()
