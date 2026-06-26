#!/usr/bin/env node
/**
 * Extract Nettoomsättning (net revenue) from Bolagsverket digital annual reports
 * (iXBRL .xhtml) packed in zip files, and load it into `company_financials`.
 *
 * Streams each zip entry (never extracts millions of files to disk) and uses
 * fast regex extraction (no heavy XBRL parsing).
 *
 *   npm i yauzl @supabase/supabase-js
 *
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node scripts/extract-register-financials.mjs "C:\\path\\to\\zip-folder"
 *
 * The folder is searched recursively for *.zip. Re-runnable (upsert on
 * org_number + fiscal_year), so you can stop/resume safely.
 */
import fs from "node:fs";
import path from "node:path";
import yauzl from "yauzl";
import { createClient } from "@supabase/supabase-js";

const DIR = process.argv[2];
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DIR || !URL || !KEY) {
  console.error("Usage: SUPABASE_URL=.. SUPABASE_SERVICE_ROLE_KEY=.. node scripts/extract-register-financials.mjs <zip-folder>");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const BATCH = 500;
let buffer = [];
let files = 0, withRevenue = 0, upserted = 0, errors = 0;

// ── Extraction ────────────────────────────────────────────────────────────
function parseReport(xml) {
  const orgM =
    xml.match(/se-cd-base:Organisationsnummer"[^>]*>\s*([\d-]{8,12})/) ||
    xml.match(/identifier[^>]*www\.bolagsverket\.se[^>]*>\s*([\d-]{8,12})/);
  const org = orgM ? orgM[1].replace(/\D/g, "") : null;
  if (!org || org.length !== 10) return [];

  const nameM = xml.match(/se-cd-base:ForetagetsNamn[^>]*>([^<]+)</);
  const company_name = nameM ? nameM[1].trim() : null;

  // context id -> period end year/date
  const endByCtx = {};
  const ctxRe = /id="(period\d+)"[\s\S]{0,500}?endDate>(\d{4})-(\d{2})-(\d{2})</g;
  let m;
  while ((m = ctxRe.exec(xml)) !== null) {
    if (!endByCtx[m[1]]) endByCtx[m[1]] = { year: +m[2], date: `${m[2]}-${m[3]}-${m[4]}` };
  }

  // Nettoomsättning facts: keep the most precise (smallest |scale|) per context.
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
    rows.push({
      org_number: org,
      fiscal_year: end.year,
      period_end: end.date,
      net_revenue: best[ctx].value,
      company_name,
    });
  }
  return rows;
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  const { error } = await supabase
    .from("company_financials")
    .upsert(batch, { onConflict: "org_number,fiscal_year" });
  if (error) { errors++; console.error("  upsert error:", error.message); }
  else upserted += batch.length;
}

function processZip(zipPath) {
  return new Promise((resolve) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) { console.error("zip open failed:", zipPath, err.message); return resolve(); }
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName) || !/\.(xhtml|html|xml)$/i.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
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
              if (files % 5000 === 0) console.log(`  files=${files} withRevenue=${withRevenue} upserted=${upserted} errors=${errors}`);
            } catch (_e) { /* skip bad file */ }
            zip.readEntry();
          });
        });
      });
      zip.on("end", async () => { await flush(); resolve(); });
      zip.on("error", (er) => { console.error("zip error:", er.message); resolve(); });
    });
  });
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
const zips = walkZips(DIR);
console.log(`Found ${zips.length} zip file(s) under ${DIR}`);
let zi = 0;
for (const z of zips) {
  zi++;
  console.log(`[${zi}/${zips.length}] ${z}`);
  await processZip(z);
}
await flush();
console.log(`DONE. files=${files} withRevenue=${withRevenue} upserted=${upserted} errors=${errors}`);
