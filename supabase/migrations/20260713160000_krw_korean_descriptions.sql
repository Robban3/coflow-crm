-- Korean descriptions for the KRW (KR) product catalogue. Matches by product
-- name across all organizations. Formal, professional Korean for customer offers.
UPDATE public.products p
SET description = v.description
FROM (VALUES
  ('Landningssida (KR)', '캠페인·런칭용 집중형 랜딩 페이지 (Astro).'),
  ('Företagshemsida (KR)', '최대 7페이지 규모의 다중 페이지 기업 웹사이트 (Astro). 자체 CMS 포함.'),
  ('Dynamisk webbplats / Webbapp (KR)', '로그인, 예약, 견적 계산기, 고객 포털 기능 (React).'),
  ('E-handel Start (KR)', '자체 이커머스 플랫폼. 초기 구축 비용 — 월 운영비 ₩230,000 별도.'),
  ('E-handel Plus (KR)', '자체 이커머스 플랫폼. 초기 구축 비용 — 월 운영비 ₩390,000 별도.'),
  ('E-handel Pro (KR)', '자체 이커머스 플랫폼. 초기 구축 비용 — 월 운영비 ₩760,000 별도.'),
  ('Affärssystem-integration (KR)', '이커머스 부가 옵션 (ERP·회계 시스템 연동).'),
  ('Extra språk & valuta (KR)', '부가 옵션 (언어·통화 추가), 언어당 기준.'),
  ('MVP (KR)', '핵심 기능 검증용 MVP (React), 4~6주 소요.'),
  ('Webbapp (KR)', '상용 배포 가능한 웹 애플리케이션 (React).'),
  ('Mobilapp (KR)', 'iOS + Android 모바일 앱 (React Native).'),
  ('Logotyp & varumärke (KR)', '로고, 컬러 팔레트, 서체, 브랜드 가이드라인.'),
  ('SEO Start (KR)', '온페이지 최적화, 키워드 분석, 월간 리포트.'),
  ('SEO Tillväxt (KR)', '콘텐츠 제작, 링크 빌딩, 기술 SEO, 지속적 최적화.'),
  ('AI-synlighet Start (KR)', 'GEO 기본 최적화, 스키마 마크업, 월간 리포트.'),
  ('AI-synlighet Tillväxt (KR)', '고급 GEO 최적화, 콘텐츠 전략, 주간 리포트.'),
  ('AI-synlighet Dominate (KR)', '전체 최적화, 경쟁사 모니터링, 전담 컨설턴트.'),
  ('Ny AI-optimerad hemsida (KR)', 'AI 최적화 웹사이트 재구축 (AI 가시성 부가 옵션).'),
  ('Designpartner (KR)', '지속형 디자인 파트너십.')
) AS v(name, description)
WHERE p.name = v.name;
