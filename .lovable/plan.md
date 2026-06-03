

# Offert- och Mallbyggare 2.0 -- Uppdaterad Implementeringsplan

## Sammanfattning

En blockbaserad, mallstyrd offertmodul byggd direkt i CoFlow. Denna plan inkorporerar alla godkanda justeringar: separerad status/signaturstatus, deterministiska totaler, saker publik token, @dnd-kit for drag-and-drop, Tiptap for rik text, och konsekvent React Router-routing.

---

## Godkanda justeringar inarbetade

| Justering | Losning |
|-----------|---------|
| Separerad status/signatur | `status` (draft/sent/viewed/accepted/rejected/expired) + `signature_status` (none/requested/signed/declined) |
| Deterministiska totaler | Totaler lagras for snabb lasning men beraknas om pa varje sparning och vid skickande |
| Publik token-sakerhet | `view_token` med UNIQUE + index, RLS-policy som isolerar per token utan org-laskage |
| Drag & drop | @dnd-kit (stabilt bibliotek med touch, a11y, framtida nesting) |
| Rik text i TextBlock | Tiptap (ProseMirror-baserat), lagrar JSON-format |
| Router-konsistens | React Router (BrowserRouter) -- samma monster som ovriga CoFlow-sidor |

---

## Fas 1: Datamodell och RLS

### Nya tabeller

**`document_templates`**
- `id` (uuid PK), `organization_id` (FK profiles), `name`, `type` (text: offer/contract/other), `description`
- `brand_settings` (JSONB: `{ logo_url, primary_color, font_family, footer_text }`)
- `created_by`, `created_at`, `updated_at`
- Trigger: `set_organization_id_from_user`

**`template_versions`**
- `id` (uuid PK), `template_id` (FK), `version` (int), `blocks_json` (JSONB)
- `created_by`, `created_at`
- UNIQUE pa `(template_id, version)`

**`documents`**
- `id` (uuid PK), `organization_id`, `document_number`, `title`, `type`
- `status` (text, default 'draft') -- draft / sent / viewed / accepted / rejected / expired
- `signature_status` (text, default 'none') -- none / requested / signed / declined
- `template_id`, `template_version` (int)
- `currency`, `valid_until`, `discount_percent`
- `subtotal`, `vat_total`, `total` (lagras for snabb lasning)
- `lead_id`, `customer_id`
- `recipient_name`, `recipient_email`
- `notes`, `terms`
- `view_token` (uuid, UNIQUE, DEFAULT gen_random_uuid(), indexerat)
- `view_count`, `viewed_at`, `sent_at`, `accepted_at`, `rejected_at`
- `sender_signature_data`, `sender_signed_at`
- `recipient_signature_data`, `recipient_signed_at`
- `created_by`, `created_at`, `updated_at`
- Trigger: `set_organization_id_from_user`

**`document_blocks`**
- `id` (uuid PK), `document_id` (FK), `type` (text), `sort_order` (int)
- `config` (JSONB -- typspecifik data)
- `created_at`

**`document_recipients`**
- `id` (uuid PK), `document_id` (FK), `email`, `name`
- `sent_at`, `viewed_at`, `signed_at`
- `sign_provider` (text, nullable)

### RLS-policyer

- Alla tabeller: `organization_id = get_user_organization_id(auth.uid())` for SELECT/INSERT/UPDATE
- DELETE: enbart admins inom organisationen
- Publik SELECT pa `documents` och `document_blocks` via `view_token` (anon-policy som matchar exakt en post, ingen org-information exponeras)

### Rekommenderade framtida tillagg (ej MVP)

- `deleted_at` (soft delete)
- `document_number`-sekvensering per organisation (liknande `generate_quote_number`)
- Audit trail-tabell

---

## Fas 2: Block-system och renderer

### Nytt beroende

- `@dnd-kit/core` + `@dnd-kit/sortable` -- for drag-and-drop
- `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link` -- for rik text

### Block Registry Pattern

```text
src/components/documents/blocks/
  registry.ts          -- registerBlock(), getRenderer(), getEditor()
  BlockRenderer.tsx     -- renderar ett block baserat pa typ
  BlockEditor.tsx       -- redigeringsvy for ett block
  TextBlock.tsx         -- Tiptap-baserad rik text (bold, listor, lankar)
  ImageBlock.tsx        -- bilduppladdning, justering, bredd
  DividerBlock.tsx      -- solid/dashed/dotted
  ArticleTableBlock.tsx -- artikelrader med berakningar
  KeyValueBlock.tsx     -- nyckel-varde-par
  SpacerBlock.tsx       -- konfigurerbar hojd
```

### TextBlock -- Tiptap-integration

- Lagrar innehall som Tiptap JSON (ProseMirror-dokumentstruktur)
- Config: `{ level: "h1"/"h2"/"p", content: TiptapJSON }`
- Stodjer: fetstil, kursiv, punktlistor, numrerade listor, lankar
- Framtida: inline-variabler (t.ex. `{{kundnamn}}`)

### Block-typer (config-schema)

| Typ | Config |
|-----|--------|
| `text` | `{ level, content: TiptapJSON }` |
| `image` | `{ url, alt, alignment, width }` |
| `divider` | `{ style }` |
| `article_table` | `{ rows: [{ title, description, qty, unit, unit_price, discount, vat_rate }], show_vat }` |
| `key_value` | `{ pairs: [{ label, value }] }` |
| `spacer` | `{ height }` |

### Drag & Drop med @dnd-kit

- `@dnd-kit/sortable` for blocklistan
- DragHandle-komponent med GripVertical-ikon
- Knappar: lagg till block, duplicera, ta bort
- Touch-stod och tangentbordsnavigering inbyggt

---

## Fas 3: Mallredigerare

### Routing (React Router)

- `/templates` -- lista mallar
- `/templates/:id` -- blockredigerare + brandinstellningar

### Komponenter

- `TemplatesList.tsx` -- lista, skapa, ta bort mallar
- `TemplateEditor.tsx` -- blockredigerare med brandinstellningar
- `BrandSettingsPanel.tsx` -- logo, farg, typsnitt, sidfot
- `BlockEditorToolbar.tsx` -- verktygsrad for att lagga till block

### Versionering

- Varje sparning okar `version` och skapar ny `template_versions`-rad
- Offerter skapade fran aldre versioner paverkas inte

---

## Fas 4: Offertredigerare

### Routing

- `/offers` -- lista offerter (visar bade nya documents och gamla quotes)
- `/offers/:id` -- offertredigerare
- `/offer/:token` -- publik offertvy (anon-tillgang via view_token)

### Flode

1. Anvandare valjer "Ny offert" -> valjer mall -> kopierar block fran senaste mallversion
2. Redigerar block fritt utan att paverka mallen
3. ArticleTableBlock beraknar rad-totaler, subtotal, moms, total
4. **Deterministisk total-berakning**: vid varje sparning beraknas totaler fran artikelrader och skrivs till `subtotal`/`vat_total`/`total` pa dokumentet

### Status-livscykel

```text
status:           draft -> sent -> viewed -> accepted
                                          -> rejected
                                          -> expired

signature_status: none -> requested -> signed
                                    -> declined
```

### Bakåtkompatibilitet

- Offertlistan aggregerar bade `documents` och `quotes`
- Gamla offerter markeras "Klassisk offert" och oppnar befintliga QuoteEditor
- Inga andringar i befintligt quotes-system

---

## Fas 5: Skicka och sparning

### E-post

- Ny edge function `send-document-email` (baserad pa befintliga `send-quote-email`)
- Skapar `document_recipients`-post med `sent_at`
- Uppdaterar `documents.status` till 'sent' och `sent_at`

### E-sign-adapter (stub)

```text
src/lib/signing/
  adapter.ts       -- interface SigningAdapter { send(), getStatus() }
  noopAdapter.ts   -- standardimplementation
```

### Publik vy

- Route: `/offer/:token`
- RLS + anon-policy: `view_token = :token` (exakt en post, ingen org-data exponeras)
- Visar dokument med block, artikeltabell, signaturmojlighet
- Okar `view_count` vid forsta visning

---

## Fas 6: Navigation och modulregistrering

### Modul-registret (`registry.ts`)

Tva nya moduler:
- `templates` -- namn: "Mallar", ikon: Layout, path: `/templates`
- `offers` -- namn: "Offerter", ikon: FileText, path: `/offers` (ersatter `quotes` i navigationen)

### App.tsx -- nya routes

- `/templates`, `/templates/*`
- `/offers`, `/offers/*`
- `/offer/:token` (publik)

---

## Filstruktur (nya filer)

```text
src/components/documents/
  blocks/
    registry.ts
    BlockRenderer.tsx
    BlockEditor.tsx
    TextBlock.tsx
    ImageBlock.tsx
    DividerBlock.tsx
    ArticleTableBlock.tsx
    KeyValueBlock.tsx
    SpacerBlock.tsx
  templates/
    TemplatesList.tsx
    TemplateEditor.tsx
    BrandSettingsPanel.tsx
  offers/
    OffersList.tsx
    OfferEditor.tsx
    TemplatePickerDialog.tsx
  shared/
    BlockEditorToolbar.tsx
    DragHandle.tsx
    DocumentPreview.tsx

src/lib/signing/
  adapter.ts
  noopAdapter.ts

src/pages/
  TemplatesPage.tsx
  OffersPage.tsx
  PublicOfferPage.tsx

supabase/migrations/
  [timestamp]_document_templates_and_blocks.sql
```

---

## Implementeringsordning

1. Datamodell + RLS (migration med alla tabeller, triggers, policyer)
2. Installera @dnd-kit och @tiptap + block-registry och renderare
3. Mallredigerare (skapa/redigera mallar, brandinstellningar, versionering)
4. Offertredigerare (skapa fran mall, blockredigering, deterministiska totaler)
5. Skicka via e-post + publik vy med saker token-logik
6. Navigation, modulregistrering, bakåtkompatibilitet med gamla offerter

---

## Tekniska detaljer

### Deterministisk total-berakning

Totaler beraknas alltid fran artikelrader via en ren funktion:

```typescript
function calculateDocumentTotals(blocks: DocumentBlock[]): Totals {
  const articleBlocks = blocks.filter(b => b.type === 'article_table');
  // Summera alla rader fran alla article_table-block
  // Returnera { subtotal, vat_total, total }
}
```

Denna funktion anropas:
- Vid varje sparning (client-side + lagras i DB)
- Vid skickande
- Vid publik rendering (sakerhetsvalidering)

### View Token-sakerhet

- Kolumn: `view_token uuid UNIQUE DEFAULT gen_random_uuid()`
- Index: `CREATE UNIQUE INDEX idx_documents_view_token ON documents(view_token)`
- Anon RLS: `USING (view_token = current_setting('request.headers')::json->>'x-view-token')` eller parameter-baserat via publik sida
- Ingen organisationsdata exponeras i publik vy

### Nya beroenden

- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`

