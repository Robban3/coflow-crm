# Coflow CRM — Projektöversikt

> Komplett CRM- och säljplattform för B2B-säljteam. Specialiserad på webbanalys, GEO/AI-synlighet, prospektering och automatiserad outreach.

**Live-URL:** https://www.coflow.se
**Plattform:** Lovable (https://lovable.dev) med Lovable Cloud (Supabase)
**Språk:** Svenska (UI), TypeScript/SQL (kod)

---

## 1. Vad är Coflow?

Coflow är ett full-stack CRM byggt för säljteam som arbetar med digital marknadsföring (SEO/GEO/webbutveckling). Plattformen kombinerar klassiska CRM-funktioner (leads, pipeline, kunder, möten) med kraftfulla analysverktyg (webbplatsanalys, AI-synlighet, fordonsdata) och automatiserad outreach (sekvenser, power-call, AI-genererade mail).

### Kärnvärden
- **Multi-tenant**: Varje organisation har sina egna data, användare och inställningar (RLS-isolerat).
- **Modulärt**: Funktioner aktiveras per organisation/användare via `user_modules`.
- **AI-drivet**: Lovable AI Gateway (Gemini, GPT-5) används för analys, sammanfattningar och mailgenerering — utan API-nycklar.
- **Realtids-CRM**: React Query + Supabase Realtime för cachning och uppdateringar.

---

## 2. Teknisk stack

| Lager | Teknologi |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix) + semantiska tokens |
| Routing | react-router-dom v6 (lazy-loaded sidor) |
| State/Data | @tanstack/react-query v5 (staleTime 2 min, gcTime 10 min) |
| Backend | Lovable Cloud = Supabase (Postgres + Auth + Storage + Edge Functions) |
| Edge Functions | Deno + TypeScript (`supabase/functions/`) |
| Drag & Drop | @dnd-kit |
| Rich text | TipTap v3 |
| Diagram | Recharts |
| AI | Lovable AI Gateway (Gemini 2.5 Pro/Flash, GPT-5) |
| Email | Resend (via connector gateway) |
| Externa API:er | Google Places, PageSpeed, Hunter.io, Firecrawl, DataForSEO, Merinfo (fordonsdata) |

### Kritiska arkitekturregler
- **`src/integrations/supabase/client.ts` och `types.ts` är auto-genererade** — får aldrig editeras manuellt.
- **`.env` hanteras automatiskt** av Lovable Cloud (innehåller `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`).
- **Roller lagras i `user_roles`** (separat tabell) — aldrig på `profiles`. Använd `has_role()` security-definer-funktionen.
- **All färg är HSL** och definieras som semantiska tokens i `src/index.css` + `tailwind.config.ts`. Inga hårdkodade `text-white`/`bg-black` i komponenter.

---

## 3. Designsystem

Designfilosofin är en **premium, varm och refinerad** estetik avsedd för 8+ timmars dagligt bruk.

### Light mode
- Background: warm cream (`45 25% 97%`)
- Primary: sophisticated slate (`220 14% 28%`)
- Accent: warm stone, sage success, terracotta destructive

### Dark mode
- Background: deep charcoal med värme (`20 12% 9%`)
- Primary: cream accent (`40 15% 85%`)

Alla tokens definieras i `src/index.css` (`:root` och `.dark`) och mappas i `tailwind.config.ts`. Använd ALLTID semantiska klasser (`bg-background`, `text-foreground`, `bg-primary`, `border-border` etc.).

### Komponentbibliotek
shadcn/ui-komponenter ligger i `src/components/ui/`. Custom-varianter skapas via `class-variance-authority` (cva).

---

## 4. Mappstruktur

```
src/
├── App.tsx                       # Router + providers (QueryClient, Auth, Theme, Modules, Org)
├── main.tsx                      # Entry point
├── index.css                     # Design tokens (HSL)
├── pages/                        # En fil per route
│   ├── DashboardPage.tsx
│   ├── LeadsPage.tsx / LeadDetailPage.tsx
│   ├── MailPage.tsx              # Inkorg, Skickat, Outreach, Uppföljning
│   ├── StatisticsPage.tsx
│   ├── PowerCallSessionPage.tsx  # Fokuserat ringläge
│   ├── PublicReportPage.tsx      # Publika delningssidor
│   └── ...
├── components/
│   ├── layout/                   # AppLayout, AppSidebar, AppHeader, MobileSidebar
│   ├── leads/                    # LeadsList, ActivityTimeline, AnalysisCenter, etc.
│   ├── mail/                     # MailInbox, MailSent, MailFollowUp, FollowUpEmailDialog
│   ├── outreach/                 # SequencesList, EmailApprovalCard
│   ├── power-call/               # LeaderboardWidget
│   ├── statistics/               # KPICards, Charts, Leaderboard, EmailStatisticsTab
│   ├── documents/                # Block-baserad editor (offers/templates)
│   ├── quotes/                   # Klassiska offerter (radbaserade)
│   ├── reports/                  # Geo + Growth report renderers
│   ├── web-analysis/             # SeoReport, TechnicalReport, GeoAnalysisTab
│   ├── tickets/                  # Kanban + detail panel
│   ├── meetings/                 # Calendar + booking
│   ├── ai/                       # Floating AI Agent (chat med systemet)
│   └── ui/                       # shadcn-baserade primitiver
├── hooks/
│   ├── useAuth.tsx               # Supabase auth + profile
│   ├── useOrganization.tsx       # Aktuell org + medlemmar
│   ├── useModules.tsx            # Aktiverade moduler för användaren
│   ├── useNotifications.tsx      # Realtime-notiser
│   └── useTeamMembers.tsx
├── modules/registry.ts           # Single source of truth för alla moduler (sidebar)
├── lib/
│   ├── api/                      # firecrawl, hunter, webAnalysis-wrappers
│   └── activityLogger.ts
└── integrations/supabase/
    ├── client.ts                 # AUTO-GENERATED — rör inte
    └── types.ts                  # AUTO-GENERATED — rör inte

supabase/
├── config.toml                   # Edge function settings (verify_jwt etc.)
├── migrations/                   # SQL-migrationer (read-only via AI)
└── functions/                    # ~40 edge functions (se nedan)
```

---

## 5. Moduler (huvudfunktioner)

Alla moduler registreras i `src/modules/registry.ts`. Aktivering per användare sker via `user_modules`-tabellen.

| Modul | Path | Beskrivning |
|---|---|---|
| **Dashboard** | `/dashboard` | KPI:er, dagens aktiviteter, snabbåtkomst |
| **Kunder** | `/customers` | Konverterade leads, kunddatabas |
| **Pipeline** | `/pipeline` | Kanban över deal-stadier |
| **Leads** | `/leads`, `/leads/:id` | Leads-lista + detaljvy med tabbar (Aktivitet, Webb, GEO, SEO, Fordon, Mail, Möten) |
| **Prospektering** | `/prospecting` | Bulk-sökning (Google Places, företagsregister), berikning, mailutskick |
| **Tasks** | `/tasks` | Uppgiftslista och uppföljningar |
| **Ärenden** | `/tickets` | Sälj-/support-tickets (kanban) |
| **Webbanalys** | `/web-analysis` | Lighthouse, on-page SEO, AI-summering |
| **GEO/AI-synlighet** | (lead-tab) | Analys av synlighet i AI-sökmotorer (ChatGPT, Perplexity) |
| **Mail** | `/mail` | Inkorg, Skickat, Outreach, **Uppföljning** (alla per användare) |
| **Power Call** | `/outreach-pro/power-call` | Fokuserat ringläge med automatisk lead-rotation, leaderboard |
| **Rapporter** | `/reports` | Geo- och growth-rapporter (publik delning via `/r/:token`) |
| **Offerter** | `/quotes` | Klassiska radbaserade offerter (PRIMÄR) |
| **Offerter (Block)** | `/offers` | Block-baserad dokumentbyggare (avstängd som default) |
| **Mallar** | (i settings) | Dokumentmallar med blockbyggare |
| **Möten** | `/meetings` | Kalender + publika bokningssidor (`/book/:userId`) |
| **Statistik** | `/statistics` | Activitetsstatistik, leaderboard, mail-statistik (admin) |
| **Inställningar** | `/settings` | Profil, organisation, team, mallar, prissättning |

### Lead-detaljvyn
`/leads/:id` är navet — innehåller tabbar för: aktivitetstimeline, webbanalys, GEO-analys, SEO-analys, fordonsdata (merinfo), e-posttråd, möten, dokument. AI-knappar för enrich, mailgenerering och konkurrensanalys.

---

## 6. Backend — Lovable Cloud (Supabase)

### Auth
- Email + lösenord (standard signup/login).
- Google OAuth aktiverat.
- **NEVER auto-confirm email** om användaren inte explicit ber om det.
- Onboarding-flow för nya användare (`/onboarding`).

### Multi-tenancy & RLS
- `profiles.organization_id` kopplar användare till org.
- **Alla tabeller har RLS** baserat på `get_user_organization_id(auth.uid())`.
- Roller: `admin`, `moderator`, `user` (enum `app_role`) i `user_roles`.
- Lead-medlemmar via `lead_members` (säkerhetsfunktion `is_lead_member()`).

### Centrala tabeller (urval)
- `organizations`, `profiles`, `user_roles`, `user_modules`
- `leads`, `lead_members`, `lead_pool`, `lead_fleet_data`, `lead_competitors`, `lead_sequences`, `lead_analysis_status`
- `customers`, `tickets`, `tasks`, `meetings`, `activities`, `activity_events`
- `documents`, `document_blocks`, `document_templates`, `document_recipients`
- `quotes`, `quote_lines`
- `web_analyses`, `geo_analyses`, `geo_findings`, `geo_actions`, `geo_pages`, `geo_quick_scans`
- `outreach_sequences`, `sent_emails`, `email_replies`, `email_templates`
- `power_call_sessions`, `power_call_lists`, `power_call_locks`, `power_call_queue`
- `call_logs`, `call_outcomes`, `call_tasks`
- `notifications`, `leaderboard_snapshots`, `organization_pricing`, `company_registry`

### Viktiga DB-funktioner
- `has_role(_user_id, _role)` — RLS-säker rollkoll
- `get_user_organization_id(_user_id)` — slår upp org
- `is_lead_member(_lead_id, _user_id)` — lead-access
- `handle_new_user()` — trigger som skapar profile + default modules vid signup
- `auto_assign_lead_creator()` — lägger creator som lead-owner
- `generate_quote_number(org_id)` — år-baserat löpnummer
- `trigger_auto_enrich_lead()` — pg_net-anrop till edge function vid lead-insert

### Performance-index (2026-03)
18 composite-index på `sent_emails`, `documents`, `meetings`, `customers`, `tasks`, `lead_members`, `profiles`, `email_replies`, `lead_sequences`, `document_blocks` för att accelerera RLS-skannade queries.

---

## 7. Edge Functions (`supabase/functions/`)

Cirka 40 funktioner. Deployas automatiskt vid filändring. Standardinställningar i `config.toml` har `verify_jwt = false` för publika endpoints.

### Lead enrichment & analysis
- `auto-enrich-lead` — triggas vid lead-insert; hittar kontaktinfo via Hunter, fordon via Merinfo
- `enrich-lead-contact` — manuell berikning
- `process-enrichment-queue` — bakgrundskö
- `lookup-org-number` — Bolagsverket
- `fetch-fleet-data` — merinfo.se (fordon + telefonabonnemang)
- `find-competitors` — AI-sökning efter konkurrenter

### Webbanalys & GEO
- `analyze-seo` — Lighthouse + on-page (DataForSEO)
- `pagespeed-analyze` — Google PageSpeed
- `firecrawl-extract` — webbsidans innehåll
- `run-geo-analysis` — full GEO-analys (AI-synlighet)
- `geo-quick-scan` / `run-geo-quick-scan` / `geo-quick-scan-view` — snabb publik scan
- `generate-technical-summary` — AI-sammanfattning
- `generate-analysis-summary` — sammanfattning för leads
- `ensure-lead-analyses` — säkerställer att alla analyser finns

### Outreach & email
- `generate-outreach-email` — AI-personligt mail
- `generate-smart-outreach` — multi-step
- `generate-analysis-outreach` — baserat på webbanalys
- `send-quick-outreach-email` — skicka enskilt mail (används av Uppföljning + standalone)
- `send-sequence-email` — sekvens-steg
- `send-prospecting-batch` — bulk
- `send-document-email` / `send-quote-email` — dokumentutskick
- `process-sequence-steps` — schemalagd steg-progression
- `receive-email-reply` — webhook från Resend (svar in)
- `track-email-open` — pixel-spårning

### Power Call
- `power-call-start` — starta session
- `power-call-next` — hämta nästa lead
- `power-call-prepare-next` — förbereda i bakgrunden
- `power-call-session-state` — current state

### AI & övrigt
- `ai-agent-chat` — global AI-agent (chat)
- `book-report-meeting` — boka möte från publik rapport
- `report-track` — spåra rapportvyer
- `convert-lead-on-accept` — konvertera lead → kund vid accepterad offert
- `google-places-search` — företagssök
- `hunter-email-finder` — kontaktmail
- `upload-company-registry` — CSV-import
- `create-user` — admin skapar team-medlem
- `statistics-overview` — aggregerad statistik
- `generate-quote-pdf` — PDF-generering

### Secrets (redan konfigurerade)
`LOVABLE_API_KEY`, `RESEND_API_KEY`, `RESEND_API_KEY_PLATFORM`, `FIRECRAWL_API_KEY`, `GOOGLE_PAGESPEED_API_KEY`, `GOOGLE_PLACES_API_KEY`, `HUNTER_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `KODCO_ORG_ID`, `KODCOGEO_WEBHOOK_SECRET`, `SUPABASE_*`.

---

## 8. Externa integrationer

| Tjänst | Användning |
|---|---|
| **Resend** | All e-post (via connector gateway `connector-gateway.lovable.dev/resend`) |
| **Lovable AI Gateway** | Gemini 2.5 Pro/Flash, GPT-5 — utan API-nyckel |
| **Google Places API** | Företagssök i prospektering |
| **Google PageSpeed** | Lighthouse-analys |
| **Hunter.io** | E-postadresser till kontakter |
| **Firecrawl** | Webbsidans innehåll/scraping |
| **DataForSEO** | SERP, on-page SEO |
| **Merinfo.se** | Fordonsdata + telefoniabonnemang (scraping) |
| **Bolagsverket** | Org.nummer-lookup |

---

## 9. Utvecklingsflöde

### Lokalt
```bash
bun install   # eller npm install
bun run dev   # startar Vite på port 8080
bun run build
bun run test  # vitest
```

### Lovable-plattformen
- Frontend-ändringar → kräver klick på **Publish → Update** för att gå live.
- Backend-ändringar (edge functions, migrationer) → deployar **automatiskt**.
- Migrationer hanteras via `supabase--migration`-verktyget (kräver user-godkännande).

### Konventioner
- **Discussion-first**: Vid breda uppgifter, ställ frågor innan implementation.
- **Parallella tool calls**: Batcha läs/sökningar.
- **Search-replace > rewrite**: Använd `code--line_replace` för punktändringar.
- **Korta komponenter**: Refaktorera proaktivt; skapa nya filer hellre än att låta filer växa.
- **Aldrig anonyma signups**: Standard signup/login + Google OAuth.
- **Aldrig roller på `profiles`**: Använd `user_roles` + `has_role()`.

---

## 10. Viktiga produktbeslut

- **Outreach är konsoliderat i `/mail`** (tidigare egen modul). Den gamla `/outreach`-routen redirecterar.
- **Klassiska offerter (`/quotes`) är primära**; block-baserade offerter (`/offers`) är inaktiverade som default.
- **Användarisolering i Mail**: Alla mail (in/ut/svar) filtreras på `sent_by = auth.uid()` — säljare ser ENDAST sina egna konversationer även inom samma org.
- **Inkommande svar matchas via `reply_token`** för att hamna rätt.
- **Power Call**: lås på `power_call_locks`-tabell för att två användare aldrig ska få samma lead samtidigt.
- **Leads har `is_not_interested`-flagga** istället för hård radering — bevarar historik.

---

## 11. Felsökning

- **Mail skickas inte?** Kolla `sent_emails`-tabellen + Resend-dashboard. Edge function `send-quick-outreach-email` förväntar `bodyText`, INTE `body`.
- **Statistik visar inte data?** Verifiera `activity_events`-triggers körs (ses i DB-funktionerna `log_activity_event_from_*`).
- **RLS blockerar?** Kontrollera att användaren har `organization_id` på sin `profile` + är medlem via `lead_members` om det är lead-data.
- **Edge function returnerar 401?** Sätt `verify_jwt = false` i `config.toml` för publika endpoints.
- **Cache visar gammal data?** React Query har `staleTime: 2min`. Använd `queryClient.invalidateQueries()` efter mutations.

---

## 12. Snabbstart för ny utvecklare/AI

1. Läs `src/App.tsx` för att förstå routes och providers.
2. Läs `src/modules/registry.ts` för moduluniverset.
3. Läs `src/index.css` för designtokens.
4. Öppna en `pages/*.tsx` för entry-mönstret (alla använder `AppLayout`).
5. Edge functions följer alla samma mönster: CORS-headers → validate → call AI/external API → return JSON.
6. Vid databasarbete: använd ALLTID migrations-verktyget, aldrig direkt SQL i runtime.

**Hjälp finns i:** [Lovable Docs](https://docs.lovable.dev) · [Discord](https://discord.com/channels/1119885301872070706)

---

_Senast uppdaterad: 2026-04-21_
