import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler, safeParseBody } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await safeParseBody<any>(req);

  if (!isAiFeatureEnabled('AI_FEATURE_REPORT')) {
    return apiResponse({ report: null, message: 'AI 리포트 기능이 비활성 상태입니다.', mock: true });
  }

  // 템플릿 로딩
  const template = body.templateId
    ? await prisma.reportTemplate.findUnique({ where: { id: body.templateId } })
    : null;

  // 데이터 수집
  const [campaigns, topKeywords, bottomKeywords, bidChanges] = await Promise.all([
    prisma.campaign.findMany({
      where: { organizationId: user.organizationId, status: 'active' },
      select: { name: true, totalCost: true, clicks: true, conversions: true, impressions: true },
    }),
    prisma.keyword.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { conversions: 'desc' },
      take: 10,
      select: { keywordText: true, conversions: true, cost: true, ctr: true, roas: true },
    }),
    prisma.keyword.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { roas: 'asc' },
      take: 10,
      select: { keywordText: true, conversions: true, cost: true, ctr: true, roas: true },
    }),
    prisma.bidHistory.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { changedAt: 'desc' },
      take: 20,
    }),
  ]);

  const aiResult = await callAi({
    systemPrompt: `당신은 광고 대행사의 시니어 퍼포먼스 마케터이자 리포트 작성 전문가입니다.
광고주(클라이언트)에게 직접 전달되는 공식 성과 보고서를 작성합니다.
제공된 실제 데이터만을 사용하며, 절대로 가상의 수치나 없는 캠페인명을 작성하지 않습니다.

[독자 설정]
- 대상: 광고주 (마케팅 전문가가 아닐 수 있음)
- 톤: 전문적이고 신뢰감 있게, 어려운 용어는 괄호로 설명
- 목적: 성과 투명 공유 + 다음 달 전략 방향 제시

[섹션별 작성 가이드]
1. **요약 (Executive Summary)**
   - 이번 기간 가장 중요한 성과 3가지를 bullet로
   - 긍정/개선 사항을 균형 있게 제시

2. **KPI 분석**
   - 제공된 수치를 표(마크다운 테이블)로 정리
   - 데이터가 있으면 전환당 비용(CPA) 계산해서 포함
   - 목표 달성률이 없으면 "목표 미설정" 명시

3. **키워드 분석**
   - 상위 전환 키워드: 강점 키워드와 이유
   - 하위 ROAS 키워드: 개선 필요 키워드와 이유
   - 데이터 기반 관찰만 작성 (추측 금지)

4. **개선 제안 (다음 달 액션플랜)**
   - 최대 3개, 각 제안에 예상 효과 포함
   - 실행 가능한 구체적 제안 (예: "키워드 X 입찰가 ₩100 상향")
   - 우선순위 표시 (🔴 즉시 / 🟡 2주 내 / 🟢 다음 달)

[응답 규칙]
- 한국어, 마크다운 형식
- 데이터가 없는 섹션은 "해당 기간 데이터 수집 중" 명시
- 리포트 길이: 500~800자 내외로 간결하게`,
    userPrompt: JSON.stringify({ campaigns, topKeywords, bottomKeywords, bidChanges }),
    model: getModelForFeature('report_generation'),
    temperature: 0.5,
    maxTokens: 3000,
  });

  if (aiResult.isMock) {
    return apiResponse({ report: null, message: 'AI 미연동 - Mock 모드', mock: true });
  }

  // 리포트 저장
  const report = await prisma.report.create({
    data: {
      organizationId: user.organizationId,
      templateId: template?.id,
      title: body.title || `AI 리포트 - ${new Date().toLocaleDateString('ko-KR')}`,
      periodStart: body.periodStart ? new Date(body.periodStart) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : new Date(),
      fileUrl: null,
    },
  });

  await prisma.aiActionLog.create({
    data: {
      organizationId: user.organizationId, userId: user.id,
      actionType: 'report_generation', entityType: 'Report', entityId: report.id,
      inputData: { campaignCount: campaigns.length },
      outputData: { model: aiResult.model, reportId: report.id },
    },
  });

  return apiResponse({ report: { id: report.id, content: aiResult.content }, mock: false, model: aiResult.model });
});
