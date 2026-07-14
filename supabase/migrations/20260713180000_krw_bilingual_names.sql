-- Make the KRW product names bilingual: Korean (Swedish) so they're searchable
-- in both languages. Runs after the Korean-name migration (20260713170000);
-- matches on the current Korean name across all organizations.
UPDATE public.products p
SET name = v.new_name
FROM (VALUES
  ('랜딩 페이지', '랜딩 페이지 (Landningssida)'),
  ('기업 웹사이트', '기업 웹사이트 (Företagshemsida)'),
  ('다이나믹 웹사이트 / 웹앱', '다이나믹 웹사이트 / 웹앱 (Dynamisk webbplats/Webbapp)'),
  ('이커머스 스타트', '이커머스 스타트 (E-handel Start)'),
  ('이커머스 플러스', '이커머스 플러스 (E-handel Plus)'),
  ('이커머스 프로', '이커머스 프로 (E-handel Pro)'),
  ('ERP·회계 시스템 연동', 'ERP·회계 시스템 연동 (Affärssystem-integration)'),
  ('추가 언어·통화', '추가 언어·통화 (Extra språk & valuta)'),
  ('MVP (최소 기능 제품)', 'MVP (최소 기능 제품 / MVP)'),
  ('웹앱', '웹앱 (Webbapp)'),
  ('모바일 앱', '모바일 앱 (Mobilapp)'),
  ('로고·브랜드', '로고·브랜드 (Logotyp & varumärke)'),
  ('SEO 스타트', 'SEO 스타트 (SEO Start)'),
  ('SEO 성장', 'SEO 성장 (SEO Tillväxt)'),
  ('AI 가시성 스타트', 'AI 가시성 스타트 (AI-synlighet Start)'),
  ('AI 가시성 성장', 'AI 가시성 성장 (AI-synlighet Tillväxt)'),
  ('AI 가시성 도미네이트', 'AI 가시성 도미네이트 (AI-synlighet Dominate)'),
  ('AI 최적화 신규 웹사이트', 'AI 최적화 신규 웹사이트 (Ny AI-optimerad hemsida)'),
  ('디자인 파트너', '디자인 파트너 (Designpartner)')
) AS v(old_name, new_name)
WHERE p.name = v.old_name;
