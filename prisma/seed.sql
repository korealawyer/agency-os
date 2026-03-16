-- ============================================================
-- Agency OS — Seed Data
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. 조직 생성
INSERT INTO organizations (id, name, plan_type, business_number, contact_email, max_accounts)
VALUES (
  'org-seed-001',
  '안티그래비티 마케팅',
  'growth',
  '123-45-67890',
  'admin@antigravity.kr',
  10
);

-- 2. 사용자 생성 (비밀번호: password123)
INSERT INTO users (id, email, password_hash, name, role, organization_id)
VALUES
  ('user-owner-001', 'admin@agency.com', '$2b$12$E8ppaYJtvFS24jvW4UnBuO3KJYg/L2g.bIIZ994mnF1hG215rTlQRS', '김대행', 'owner', 'org-seed-001'),
  ('user-admin-001', 'lee@agency.com',   '$2b$12$E8ppaYJtvFS24jvW4UnBuO3KJYg/L2g.bIIZ994mnF1hG215rTlQRS', '이마케터', 'admin', 'org-seed-001'),
  ('user-edit-001',  'park@agency.com',  '$2b$12$E8ppaYJtvFS24jvW4UnBuO3KJYg/L2g.bIIZ994mnF1hG215rTlQRS', '박에디터', 'editor', 'org-seed-001');

-- 3. 구독 생성
INSERT INTO subscriptions (id, organization_id, plan_type, status, monthly_price, current_period_start, current_period_end)
VALUES (
  'sub-seed-001',
  'org-seed-001',
  'growth',
  'active',
  99000,
  NOW(),
  NOW() + INTERVAL '30 days'
);

-- 4. 네이버 광고 계정
INSERT INTO naver_accounts (id, organization_id, customer_id, customer_name, api_key_encrypted, secret_key_encrypted, connection_status, daily_budget, monthly_spend, commission_rate, last_sync_at)
VALUES
  ('acc-seed-001', 'org-seed-001', 'naver-123456', '안티그래비티 공식몰', 'dummy-encrypted-api-key', 'dummy-encrypted-secret-key', 'connected', 500000, 8500000, 0.15, NOW()),
  ('acc-seed-002', 'org-seed-001', 'naver-789012', '클라이언트A 쇼핑몰', 'dummy-encrypted-api-key-2', 'dummy-encrypted-secret-key-2', 'connected', 300000, 4200000, 0.12, NOW());

-- 5. 캠페인
INSERT INTO campaigns (id, naver_account_id, organization_id, naver_campaign_id, name, status, campaign_type, daily_budget, total_cost, impressions, clicks, conversions)
VALUES
  ('camp-seed-001', 'acc-seed-001', 'org-seed-001', 'camp-001', '브랜드 검색광고', 'active', 'BRAND_SEARCH', 200000, 3500000, 125000, 8500, 320),
  ('camp-seed-002', 'acc-seed-001', 'org-seed-001', 'camp-002', '쇼핑 검색광고', 'active', 'SHOPPING', 150000, 2100000, 95000, 6200, 180);

-- 6. 광고그룹
INSERT INTO ad_groups (id, campaign_id, organization_id, naver_ad_group_id, name, daily_budget)
VALUES
  ('ag-seed-001', 'camp-seed-001', 'org-seed-001', 'ag-001', '핵심 키워드 그룹', 100000),
  ('ag-seed-002', 'camp-seed-002', 'org-seed-001', 'ag-002', '쇼핑 키워드 그룹', 80000);

-- 7. 키워드 + 입찰이력
INSERT INTO keywords (id, ad_group_id, organization_id, naver_keyword_id, keyword_text, current_bid, target_rank, bid_strategy, quality_index, impressions, clicks, cpc, ctr, conversions, cost)
VALUES
  ('kw-seed-001', 'ag-seed-001', 'org-seed-001', 'kw-마케팅', '마케팅 대행', 5200, 3, 'target_rank', 8, 45000, 3200, 4160, 0.0711, 120, 13312000),
  ('kw-seed-002', 'ag-seed-001', 'org-seed-001', 'kw-네이버', '네이버 광고 대행사', 8500, 1, 'target_rank', 9, 32000, 2800, 6800, 0.0875, 95, 19040000),
  ('kw-seed-003', 'ag-seed-001', 'org-seed-001', 'kw-검색광', '검색광고 최적화', 3800, 5, 'target_rank', 7, 18000, 1200, 3040, 0.0667, 45, 3648000),
  ('kw-seed-004', 'ag-seed-001', 'org-seed-001', 'kw-SEO대', 'SEO 대행', 4500, 2, 'target_rank', 8, 28000, 2100, 3600, 0.0750, 78, 7560000),
  ('kw-seed-005', 'ag-seed-001', 'org-seed-001', 'kw-퍼포먼', '퍼포먼스 마케팅', 6200, 4, 'target_rank', 7, 22000, 1800, 4960, 0.0818, 62, 8928000);

INSERT INTO bid_history (keyword_id, organization_id, old_bid, new_bid, reason, changed_by, current_rank, target_rank)
VALUES
  ('kw-seed-001', 'org-seed-001', 4680, 5200, 'AI 자동 최적화', 'ai', 3, 3),
  ('kw-seed-002', 'org-seed-001', 7650, 8500, 'AI 자동 최적화', 'ai', 1, 1),
  ('kw-seed-003', 'org-seed-001', 3420, 3800, 'AI 자동 최적화', 'ai', 5, 5),
  ('kw-seed-004', 'org-seed-001', 4050, 4500, 'AI 자동 최적화', 'ai', 2, 2),
  ('kw-seed-005', 'org-seed-001', 5580, 6200, 'AI 자동 최적화', 'ai', 4, 4);

-- 8. 알림
INSERT INTO notifications (id, user_id, organization_id, type, priority, title, message)
VALUES
  ('notif-001', 'user-owner-001', 'org-seed-001', 'bid_change', 'normal', '입찰가 자동 조정', '"마케팅 대행" 키워드 입찰가가 4,800원 → 5,200원으로 조정되었습니다.'),
  ('notif-002', 'user-owner-001', 'org-seed-001', 'budget_alert', 'high', '일 예산 80% 소진', '브랜드 검색광고 캠페인의 일 예산이 80%를 초과했습니다.'),
  ('notif-003', 'user-owner-001', 'org-seed-001', 'anomaly_detected', 'urgent', '이상 클릭 감지', '최근 1시간 동안 비정상적인 클릭 패턴이 감지되었습니다.'),
  ('notif-004', 'user-owner-001', 'org-seed-001', 'report_sent', 'low', '주간 보고서 발송', '3월 1주차 주간 보고서가 발송되었습니다.'),
  ('notif-005', 'user-owner-001', 'org-seed-001', 'system_notice', 'normal', '시스템 업데이트', 'AI 입찰 최적화 엔진이 v2.1로 업데이트되었습니다.');

-- 9. 감사 로그
INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, ip_address, expires_at)
VALUES
  ('user-owner-001', 'org-seed-001', 'LOGIN', 'User', 'user-owner-001', '127.0.0.1', NOW() + INTERVAL '90 days'),
  ('user-owner-001', 'org-seed-001', 'CREATE', 'Campaign', 'camp-seed-001', '127.0.0.1', NOW() + INTERVAL '90 days');

-- ✅ 완료! 로그인 정보:
-- Owner:  admin@agency.com / password123
-- Admin:  lee@agency.com   / password123
-- Editor: park@agency.com  / password123
