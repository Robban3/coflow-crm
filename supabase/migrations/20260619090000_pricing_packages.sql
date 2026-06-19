-- Pricing & packages: org-scoped, admin-editable sales reference.
CREATE TABLE public.pricing_packages (
  id              uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category        text NOT NULL DEFAULT 'Övrigt',
  name            text NOT NULL,
  price           text,                       -- e.g. "18 000 kr", "från 29 000 kr"
  unit            text,                       -- e.g. "engångs", "/mån", "kombo"
  description     text,
  features        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of strings
  highlighted     boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_pricing_packages_org ON public.pricing_packages (organization_id, sort_order);

ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- Auto-fill organization_id from the caller + maintain updated_at
CREATE TRIGGER set_pricing_packages_org_id
  BEFORE INSERT ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();
CREATE TRIGGER update_pricing_packages_updated_at
  BEFORE UPDATE ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: org members view; org admins write
CREATE POLICY "Org members can view pricing packages"
  ON public.pricing_packages FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Org admins can insert pricing packages"
  ON public.pricing_packages FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid())
             AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can update pricing packages"
  ON public.pricing_packages FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid())
         AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid())
             AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can delete pricing packages"
  ON public.pricing_packages FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid())
         AND public.has_role(auth.uid(), 'admin'::app_role));

-- Seed an initial catalogue for the Applabbet org (robert@applabbet.com),
-- only if it has no packages yet.
INSERT INTO public.pricing_packages
  (organization_id, category, name, price, unit, description, features, highlighted, sort_order)
SELECT p.organization_id, v.category, v.name, v.price, v.unit, v.description, v.features::jsonb, v.highlighted, v.ord
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
CROSS JOIN (VALUES
  ('Hemsidor','Landningssida','från 9 000 kr','engångs','Perfekt för kampanjer och lansering','["1 sida","Mobilanpassad","Kontaktformulär","Grundläggande SEO"]', false, 1),
  ('Hemsidor','Företagshemsida','18 000 kr','engångs','Vår populäraste – en komplett sajt','["Upp till 7 sidor","CMS – uppdatera själv","Responsiv design","On-page SEO","Google Analytics"]', true, 2),
  ('Hemsidor','E-handel','från 35 000 kr','engångs','Sälj online','["Webbshop","Betalningslösning","Produktkatalog","SEO-optimerad"]', false, 3),
  ('MVP & Appar','MVP','från 29 000 kr','engångs','Validera din idé snabbt','["Funktionell MVP","Kärnfunktioner","Levereras på 4–6 veckor","Källkod ingår"]', true, 11),
  ('MVP & Appar','Webbapp','från 49 000 kr','engångs','Skräddarsydd webbapplikation','["Inloggning & roller","Databas","Adminpanel","Skalbar arkitektur"]', false, 12),
  ('MVP & Appar','Mobilapp (iOS & Android)','från 79 000 kr','engångs','Cross-platform-app','["iOS + Android","Publicering i App Store & Google Play","Push-notiser","Backend ingår"]', false, 13),
  ('SEO & GEO','SEO Start','från 4 900 kr','/mån','Kom igång med synligheten','["On-page-optimering","Nyckelordsanalys","Månadsrapport"]', false, 21),
  ('SEO & GEO','SEO Tillväxt','från 9 900 kr','/mån','För dig som vill växa','["Innehållsproduktion","Länkbygge","Teknisk SEO","Löpande optimering"]', true, 22),
  ('SEO & GEO','GEO / AI-synlighet','från 6 900 kr','/mån','Synas i ChatGPT, Perplexity & AI-sök','["GEO-analys","Åtgärdsplan","AI-synlighetsrapport","Löpande uppföljning"]', false, 23),
  ('Design','Designpartner','från 9 000 kr','/mån','Löpande design när du behöver den','["UI/UX-design","Grafiskt material","Prioriterad tillgång","Förfrågningar i kö"]', true, 31),
  ('Design','Logotyp & varumärke','från 12 000 kr','engångs','Bygg ett starkt varumärke','["Logotyp","Färg & typsnitt","Brandguide"]', false, 32),
  ('Paket & kombinationer','Startpaket','18 000 kr + 3 900 kr/mån','kombo','Hemsida + SEO Start','["Företagshemsida","SEO Start","Rabatterat månadspris"]', false, 41),
  ('Paket & kombinationer','Tillväxtpaket','från 25 000 kr + 14 900 kr/mån','kombo','Hemsida + SEO Tillväxt + GEO','["Företagshemsida","SEO Tillväxt","GEO / AI-synlighet","Bäst för snabb tillväxt"]', true, 42),
  ('Paket & kombinationer','MVP-paket','från 29 000 kr + 7 000 kr/mån','kombo','MVP + Designpartner','["MVP-utveckling","Löpande designpartner","Rabatterat designpris"]', false, 43),
  ('Paket & kombinationer','Full digital närvaro','Kontakta oss','offert','Allt-i-ett för maximal effekt','["Hemsida eller app","SEO + GEO","Designpartner","Dedikerad kontaktperson"]', false, 44)
) AS v(category, name, price, unit, description, features, highlighted, ord)
WHERE lower(u.email) = 'robert@applabbet.com'
  AND p.organization_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.pricing_packages pp WHERE pp.organization_id = p.organization_id);
