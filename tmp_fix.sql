-- 1. 새로운 조직 생성
WITH new_org AS (
  INSERT INTO "organizations" ("id", "name", "plan_type", "total_ad_spend", "max_accounts", "is_active", "created_at", "updated_at")
  VALUES (gen_random_uuid()::text, 'NeoLawyer Workspace', 'starter', 0, 5, true, now(), now())
  RETURNING id
)
-- 2. 해당 유저 업데이트 (조직 분리 및 role을 'viewer'로 강등)
UPDATE "users"
SET "organization_id" = (SELECT id FROM new_org),
    "role" = 'viewer'::"UserRole"
WHERE "email" = 'neolawyer@agency.com';
