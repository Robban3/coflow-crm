#!/usr/bin/env node
/**
 * Import the Bolagsverket company-register bulk file (näringslivsregistret) into
 * `company_registry`. The file is semicolon-delimited, quoted, UTF-8, with a
 * header row and "$"-coded fields. Streams the file (handles multi-GB) and
 * batch-upserts.
 *
 *   npm i papaparse @supabase/supabase-js
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node scripts/import-company-register.mjs "C:\\path\\bolagsverket_bulkfil.txt"
 *
 * SNI/industry comes from a separate SCB file (join on org number) — added later.
 * Re-runnable (upsert on org_number). ENCODING=latin1 to override UTF-8.
 */
import fs from "node:fs";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

const FILE = process.argv[2];
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCODING = process.env.ENCODING || "utf8";
if (!FILE || !URL || !KEY) {
  console.error('Usage: SUPABASE_URL=.. SUPABASE_SERVICE_ROLE_KEY=.. node scripts/import-company-register.mjs "<file.txt>"');
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
const BATCH = 500;

// Bolagsverket organisationsform codes -> readable form (best effort).
const FORM = {
  AB: "Aktiebolag", BAB: "Bankaktiebolag", FAB: "Försäkringsaktiebolag",
  E: "Enskild näringsidkare", HB: "Handelsbolag", KB: "Kommanditbolag",
  EK: "Ekonomisk förening", BRF: "Bostadsrättsförening", BF: "Bostadsförening",
  KHF: "Kooperativ hyresrättsförening", SF: "Sambruksförening",
  I: "Ideell förening", S: "Stiftelse", SB: "Sparbank", MB: "Medlemsbank",
  TSF: "Trossamfund", SE: "Europabolag", SCE: "Europakooperativ",
  FL: "Filial", OFB: "Ömsesidigt försäkringsbolag", UF: "Understödsförening",
};
const before$ = (v) => String(v || "").split("$")[0].trim();
function mapForm(raw) {
  const code = String(raw || "").split("$")[0].replace(/-ORGFO$/i, "").trim();
  return FORM[code] || code || null;
}

function mapRow(r) {
  const org_number = before$(r["organisationsidentitet"]).replace(/\D/g, "");
  if (!org_number || org_number.length < 10) return null;
  const company_name = before$(r["organisationsnamn"]);
  if (!company_name) return null;
  const addr = String(r["postadress"] || "").split("$"); // gata$co$ort$postnr$land
  const avreg = String(r["avregistreringsdatum"] || "").trim();
  return {
    org_number,
    company_name,
    company_form: mapForm(r["organisationsform"]),
    registration_date: String(r["registreringsdatum"] || "").trim() || null,
    status: avreg ? "Avregistrerad" : "Aktiv",
    business_description: String(r["verksamhetsbeskrivning"] || "").trim() || null,
    address: (addr[0] || "").trim() || null,
    co_address: (addr[1] || "").trim() || null,
    city: (addr[2] || "").trim() || null,
    postal_code: (addr[3] || "").replace(/\s/g, "").trim() || null,
    country: (addr[4] || "SE").trim(),
  };
}

let total = 0, mapped = 0, upserted = 0, errors = 0;
let buffer = [];

async function flush() {
  if (!buffer.length) return;
  // The bulk file can list the same org_number more than once (multiple address
  // rows, name variants, etc.). Postgres rejects an upsert that touches the same
  // conflict key twice in one statement ("cannot affect row a second time"), so
  // collapse duplicates within the batch — last row wins.
  const byOrg = new Map();
  for (const row of buffer) byOrg.set(row.org_number, row);
  const batch = [...byOrg.values()];
  buffer = [];
  const { error } = await supabase.from("company_registry").upsert(batch, { onConflict: "org_number" });
  if (error) { errors++; console.error("  upsert error:", error.message); }
  else upserted += batch.length;
}

console.log(`Importing ${FILE} (encoding=${ENCODING})…`);
const stream = fs.createReadStream(FILE, { encoding: ENCODING });

await new Promise((resolve, reject) => {
  Papa.parse(stream, {
    header: true,
    delimiter: ";",
    quoteChar: '"',
    skipEmptyLines: true,
    step: (res, parser) => {
      total++;
      const row = mapRow(res.data);
      if (row) { buffer.push(row); mapped++; }
      if (buffer.length >= BATCH) {
        parser.pause();
        flush().then(() => parser.resume()).catch((e) => { console.error(e.message); parser.resume(); });
      }
      if (total % 50000 === 0) console.log(`  rows=${total} mapped=${mapped} upserted=${upserted} errors=${errors}`);
    },
    complete: async () => {
      await flush();
      console.log(`DONE. rows=${total} mapped=${mapped} upserted=${upserted} errors=${errors}`);
      resolve();
    },
    error: (e) => reject(e),
  });
});
