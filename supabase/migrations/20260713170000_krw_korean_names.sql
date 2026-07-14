-- Rename the KRW product set to Korean names. Runs after the price/description
-- migrations (which match on the Swedish "(KR)" names), so ordering is safe.
-- Matches by the current name across all organizations.
UPDATE public.products p
SET name = v.new_name
FROM (VALUES
  ('Landningssida (KR)', '랜딩 페이지'),
  ('Företagshemsida (KR)', '기업 웹사이트'),
  ('Dynamisk webbplats / Webbapp (KR)', '다이나믹 웹사이트 / 웹앱'),
  ('E-handel Start (KR)', '이커머스 스타트'),
  ('E-handel Plus (KR)', '이커머스 플러스'),
  ('E-handel Pro (KR)', '이커머스 프로'),
  ('Affärssystem-integration (KR)', 'ERP·회계 시스템 연동'),
  ('Extra språk & valuta (KR)', '추가 언어·통화'),
  ('MVP (KR)', 'MVP (최소 기능 제품)'),
  ('Webbapp (KR)', '웹앱'),
  ('Mobilapp (KR)', '모바일 앱'),
  ('Logotyp & varumärke (KR)', '로고·브랜드'),
  ('SEO Start (KR)', 'SEO 스타트'),
  ('SEO Tillväxt (KR)', 'SEO 성장'),
  ('AI-synlighet Start (KR)', 'AI 가시성 스타트'),
  ('AI-synlighet Tillväxt (KR)', 'AI 가시성 성장'),
  ('AI-synlighet Dominate (KR)', 'AI 가시성 도미네이트'),
  ('Ny AI-optimerad hemsida (KR)', 'AI 최적화 신규 웹사이트'),
  ('Designpartner (KR)', '디자인 파트너')
) AS v(old_name, new_name)
WHERE p.name = v.old_name;
