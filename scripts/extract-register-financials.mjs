#!/usr/bin/env node
/**
 * Extract Nettoomsättning (net revenue) from Bolagsverket digital annual reports
 * (iXBRL .xhtml) and load it into `company_financials`.
 *
 * TWO MODES:
 *
 *  1) Download + process (unattended) — fetches the bulk zips straight from
 *     Bolagsverket, extracts, then deletes each zip. Auto-discovers chunks.
 *
 *       npm i yauzl @supabase/supabase-js
 *       SUPABASE_URL="https://xxxx.supabase.co" \
 *       SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *       node scripts/extract-register-financials.mjs --download 2026 2025
 *
 *  2) Local folder — process zips you already downloaded:
 *
 *       node scripts/extract-register-financials.mjs "C:\\path\\to\\zip-folder"
 *
 * Re-runnable (upsert on org_number + fiscal_year). Tune parallelism with
 * CONCURRENCY (default 4). Needs Node 18+ (global fetch).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import yauzl from "yauzl";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const BASE = "https://vardefulla-datamangder.bolagsverket.se/arsredovisningar-bulkfiler/arsredovisningar";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "4", 10);
const BATCH = 500;

let buffer = [];
let files = 0, withRevenue = 0, upserted = 0, errors = 0, zips = 0;

// ── Extraction ────────────────────────────────────────────────────────────
function parseReport(xml) {
  const orgM =
    xml.match(/se-cd-base:Organisationsnummer"[^>]*>\s*([\d-]{8,12})/) ||
    xml.match(/identifier[^>]*www\.bolagsverket\.se[^>]*>\s*([\d-]{8,12})/);
  const org = orgM ? orgM[1].replace(/\D/g, "") : null;
  if (!org || org.length !== 10) return [];

  const nameM = xml.match(/se-cd-base:ForetagetsNamn[^>]*>([^<]+)</);
  const company_name = nameM ? nameM[1].trim() : null;

  const endByCtx = {};
  const ctxRe = /id="(period\d+)"[\s\S]{0,500}?endDate>(\d{4})-(\d{2})-(\d{2})</g;
  let m;
  while ((m = ctxRe.exec(xml)) !== null) {
    if (!endByCtx[m[1]]) endByCtx[m[1]] = { year: +m[2], date: `${m[2]}-${m[3]}-${m[4]}` };
  }

  const best = {};
  const factRe = /<ix:nonFraction\b([^>]*name="se-gen-base:Nettoomsattning"[^>]*)>([^<]*)<\/ix:nonFraction>/g;
  while ((m = factRe.exec(xml)) !== null) {
    const attrs = m[1];
    const ctx = (attrs.match(/contextRef="(period\d+)"/) || [])[1];
    if (!ctx) continue;
    const scale = parseInt((attrs.match(/scale="(-?\d+)"/) || [])[1] ?? "0", 10);
    const sign = /sign="-"/.test(attrs) ? -1 : 1;
    const digits = (m[2] || "").replace(/[^\d]/g, "");
    if (!digits) continue;
    const value = sign * Math.round(parseInt(digits, 10) * Math.pow(10, scale));
    if (!best[ctx] || Math.abs(scale) < Math.abs(best[ctx].scale)) best[ctx] = { value, scale };
  }

  const rows = [];
  for (const ctx of Object.keys(best)) {
    const end = endByCtx[ctx];
    if (!end) continue;
    rows.push({ org_number: org, fiscal_year: end.year, period_end: end.date, net_revenue: best[ctx].value, company_name });
  }
  return rows;
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  const { error } = await supabase.from("company_financials").upsert(batch, { onConflict: "org_number,fiscal_year" });
  if (error) { errors++; console.error("  upsert error:", error.message); }
  else upserted += batch.length;
}

function processZip(zipPath) {
  return new Promise((resolve) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) { console.error("zip open failed:", zipPath, err.message); return resolve(); }
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName) || !/\.(xhtml|html|xml)$/i.test(entry.fileName)) { zip.readEntry(); return; }
        zip.openReadStream(entry, (e, stream) => {
          if (e) { zip.readEntry(); return; }
          const chunks = [];
          stream.on("data", (c) => chunks.push(c));
          stream.on("end", async () => {
            try {
              const rows = parseReport(Buffer.concat(chunks).toString("utf8"));
              files++;
              if (rows.length) { withRevenue++; buffer.push(...rows); }
              if (buffer.length >= BATCH) await flush();
              if (files % 5000 === 0) console.log(`  files=${files} withRevenue=${withRevenue} upserted=${upserted} zips=${zips} errors=${errors}`);
            } catch { /* skip bad file */ }
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve());
      zip.on("error", (er) => { console.error("zip error:", er.message); resolve(); });
    });
  });
}

// ── Download mode ───────────────────────────────────────────────────────────
async function downloadToTemp(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok || !res.body) { console.error("  download failed", url, res.status); return null; }
  const tmp = path.join(os.tmpdir(), `ar_${Date.now()}_${Math.round(Math.random() * 1e9)}.zip`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  return tmp;
}

async function processNNGroup(year, NN) {
  for (let m = 1; ; m++) {
    const url = `${BASE}/${year}/${NN}_${m}.zip`;
    let tmp;
    try { tmp = await downloadToTemp(url); }
    catch (e) { console.error("  download error", url, e.message); break; }
    if (!tmp) break; // 404 => no more chunks for this NN
    zips++;
    console.log(`[${year}/${NN}_${m}] downloaded, processing… (zips=${zips})`);
    await processZip(tmp);
    fs.unlinkSync(tmp);
  }
}

async function pool(items, n, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

function walkZips(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkZips(p));
    else if (/\.zip$/i.test(e.name)) out.push(p);
  }
  return out;
}

// ── Run ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === "--download") {
  const years = args.slice(1).length ? args.slice(1) : ["2026", "2025"];
  const nns = Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, "0"));
  for (const year of years) {
    console.log(`=== Year ${year} (concurrency ${CONCURRENCY}) ===`);
    await pool(nns, CONCURRENCY, (NN) => processNNGroup(year, NN));
    await flush();
  }
} else {
  const dir = args[0];
  if (!dir) { console.error("Usage: ... --download [years...]   OR   ... <zip-folder>"); process.exit(1); }
  const list = walkZips(dir);
  console.log(`Found ${list.length} zip file(s) under ${dir}`);
  await pool(list, CONCURRENCY, async (z) => { zips++; console.log(`[${zips}/${list.length}] ${z}`); await processZip(z); });
}
await flush();
console.log(`DONE. zips=${zips} files=${files} withRevenue=${withRevenue} upserted=${upserted} errors=${errors}`);
