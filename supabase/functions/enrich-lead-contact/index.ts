import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Market = "SE" | "US" | "DE";

// Domains to exclude - belong to scraping/utility sites, not the company
const EXCLUDED_EMAIL_DOMAINS = [
  "merinfo.se", "hitta.se", "allabolag.se", "eniro.se",
  "error-report.com", "cookiebot.com", "google.com", "googlemail.com",
  "facebook.com", "example.com", "sentry.io", "hotjar.com", "trustpilot.com",
  "wixpress.com", "squarespace.com", "wordpress.com", "shopify.com",
];

function isValidCompanyEmail(email: string): boolean {
  const lower = email.toLowerCase();
  for (const d of EXCLUDED_EMAIL_DOMAINS) {
    if (lower.endsWith(`@${d}`)) return false;
  }
  if (/^(noreply|no-reply|mailer-daemon|postmaster|abuse|webmaster)@/i.test(lower)) return false;
  if (!/\.[a-z]{2,}$/.test(lower)) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(lower)) return false;
  return true;
}

function pickBestEmail(emails: string[]): string | null {
  const valid = [...new Set(emails)].filter(isValidCompanyEmail);
  if (valid.length === 0) return null;
  const preferredPrefixes = ["info@", "kontakt@", "hej@", "hello@", "contact@", "office@"];
  for (const p of preferredPrefixes) {
    const m = valid.find((e) => e.toLowerCase().startsWith(p));
    if (m) return m.toLowerCase();
  }
  return valid[0].toLowerCase();
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const mailto = (text.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [])
    .map((m) => m.replace(/^mailto:/i, ""));
  return [...matches, ...mailto];
}

function extractPhone(text: string, market: Market): string | null {
  const patterns: RegExp[] = market === "US"
    ? [
        /(?:Phone|Tel|Telephone|Call)[:\s]*([+]?1?[\s().-]?\d{3}[\s().-]?\d{3}[\s().-]?\d{4})/i,
        /\b(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
      ]
    : market === "DE"
    ? [
        /(?:Telefon|Tel|Fon|Phone)[:\s]*([+]?[0-9\-\s()/]{7,25})/i,
        /\b(\+49[\s\-]?[0-9][\s\-]?[0-9]{2,4}[\s\-]?[0-9]{2,4}[\s\-]?[0-9]{2,4})\b/,
        /\b(0[1-9][0-9]{1,4}[\s\-/]?[0-9]{3,8})\b/,
      ]
    : [
        /(?:Telefon|Tel|Tfn|Phone)[:\s]*([+]?[0-9\-\s()]{7,20})/i,
        /\b(\+46[\s\-]?[0-9][\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2})\b/,
        /\b(0[1-9][0-9][\s\-]?[0-9]{2,3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2})\b/,
      ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) {
      const phone = (m[1] || m[0]).trim();
      if (phone.replace(/\D/g, "").length >= 7) return phone;
    }
  }
  return null;
}

const CONTACT_PATHS_BY_MARKET: Record<Market, string[]> = {
  SE: ["/kontakt", "/kontakta-oss", "/om-oss", "/contact"],
  US: ["/contact", "/contact-us", "/about", "/about-us", "/team"],
  DE: ["/kontakt", "/kontakt-aufnehmen", "/uber-uns", "/ueber-uns", "/impressum"],
};

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, "");
}

function buildCandidatePages(websiteUrl: string, market: Market): string[] {
  const base = normalizeUrl(websiteUrl);
  const paths = CONTACT_PATHS_BY_MARKET[market];
  return [base, ...paths.map((p) => `${base}${p}`)];
}

interface ExtractedContacts {
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
}

const EXTRACTION_PROMPTS: Record<Market, string> = {
  SE:
    "Extract all contact information from this Swedish company page including email addresses, phone numbers, person names with titles or roles. Return as structured JSON.",
  US:
    "Extract all contact information from this company page including email addresses, phone numbers, person names with titles or roles. Return as structured JSON.",
  DE:
    "Extract all contact information from this German company page including email addresses, phone numbers, person names with titles or roles. Return as structured JSON.",
};

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    email: { type: "string", description: "Primary contact email (prefer info@, contact@, kontakt@). Empty string if none found." },
    phone: { type: "string", description: "Primary phone number with country code if possible. Empty string if none found." },
    contact_name: { type: "string", description: "Full name of a contact person. Empty string if none found." },
    contact_title: { type: "string", description: "Job title or role of the contact person. Empty string if none." },
  },
  required: ["email", "phone", "contact_name", "contact_title"],
  additionalProperties: false,
};

async function firecrawlExtract(
  apiKey: string,
  url: string,
  market: Market,
): Promise<{ extracted: ExtractedContacts; markdown: string }> {
  // v2 with json format + schema for structured extraction; falls back to markdown regex if json missing
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [
          "markdown",
          { type: "json", prompt: EXTRACTION_PROMPTS[market], schema: EXTRACTION_SCHEMA },
        ],
        onlyMainContent: false,
        waitFor: 2500,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn(`[enrich] Firecrawl ${url} -> ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
      return { extracted: {}, markdown: "" };
    }
    const root = data?.data ?? data ?? {};
    const markdown: string = root.markdown || "";
    const json = root.json || root.extract || {};
    const extracted: ExtractedContacts = {
      email: typeof json.email === "string" && json.email.trim() ? json.email.trim() : null,
      phone: typeof json.phone === "string" && json.phone.trim() ? json.phone.trim() : null,
      contact_name: typeof json.contact_name === "string" && json.contact_name.trim() ? json.contact_name.trim() : null,
      contact_title: typeof json.contact_title === "string" && json.contact_title.trim() ? json.contact_title.trim() : null,
    };
    return { extracted, markdown };
  } catch (err) {
    console.warn(`[enrich] Firecrawl error for ${url}:`, (err as Error).message);
    return { extracted: {}, markdown: "" };
  }
}

function mergeContacts(
  current: ExtractedContacts,
  next: ExtractedContacts,
  fallbackMarkdown: string,
  market: Market,
): ExtractedContacts {
  const merged: ExtractedContacts = { ...current };

  // Prefer extracted email; fallback to regex on markdown
  if (!merged.email) {
    if (next.email && isValidCompanyEmail(next.email)) {
      merged.email = next.email.toLowerCase();
    } else if (fallbackMarkdown) {
      merged.email = pickBestEmail(extractEmails(fallbackMarkdown));
    }
  }

  if (!merged.phone) {
    merged.phone = next.phone || (fallbackMarkdown ? extractPhone(fallbackMarkdown, market) : null);
  }

  if (!merged.contact_name && next.contact_name) merged.contact_name = next.contact_name;
  if (!merged.contact_title && next.contact_title) merged.contact_title = next.contact_title;

  return merged;
}

function isContactComplete(c: ExtractedContacts): boolean {
  return Boolean(c.email && c.phone && c.contact_name);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: "Firecrawl är inte konfigurerat" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      leadId,
      website_url: websiteUrlInput,
      market: marketInput,
    }: { leadId?: string; website_url?: string; market?: string } = body;

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "leadId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const market: Market = marketInput === "US" || marketInput === "DE" ? marketInput : "SE";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: leadData } = await serviceClient
      .from("leads")
      .select("website, email, phone, contact_name, organization_id")
      .eq("id", leadId)
      .maybeSingle();

    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!leadData?.organization_id || !callerProfile?.organization_id || callerProfile.organization_id !== leadData.organization_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const website = websiteUrlInput || leadData?.website;
    if (!website) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Ingen webbadress angiven för leadet",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const candidates = buildCandidatePages(website, market);
    let contacts: ExtractedContacts = {};
    let sourceUrl: string | null = null;

    for (const url of candidates) {
      if (isContactComplete(contacts)) break;
      console.log(`[enrich] Scraping ${url} (market=${market})`);
      const { extracted, markdown } = await firecrawlExtract(firecrawlKey, url, market);
      const before = { ...contacts };
      contacts = mergeContacts(contacts, extracted, markdown, market);
      // Track first source that gave us anything new
      if (!sourceUrl) {
        const gainedSomething =
          (!before.email && contacts.email) ||
          (!before.phone && contacts.phone) ||
          (!before.contact_name && contacts.contact_name);
        if (gainedSomething) sourceUrl = url;
      }
    }

    // Update lead with new fields only (don't overwrite existing values)
    const updates: Record<string, string> = {};
    if (contacts.email && !leadData?.email) updates.email = contacts.email;
    if (contacts.phone && !leadData?.phone) updates.phone = contacts.phone;
    if (contacts.contact_name && !leadData?.contact_name) updates.contact_name = contacts.contact_name;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await serviceClient
        .from("leads")
        .update(updates)
        .eq("id", leadId);
      if (updateError) {
        console.error("[enrich] Lead update error:", updateError);
      }
    }

    const found = {
      email: contacts.email || null,
      phone: contacts.phone || null,
      contact_name: contacts.contact_name || null,
      contact_title: contacts.contact_title || null,
      source_url: sourceUrl,
    };

    return new Response(
      JSON.stringify({
        success: true,
        market,
        found,
        // Backward compatible: callers expect `sources` array + `updated` boolean
        sources: sourceUrl ? [sourceUrl] : [],
        updated: Object.keys(updates).length > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[enrich] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
