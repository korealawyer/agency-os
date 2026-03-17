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
    systemPrompt: `당신은 광고 대행사 리포트 작성 전문가입니다.
광고주에게 보내는 성과 리포트를 작성하세요.
섹션: 1.요약, 2.KPI분석, 3.키워드분석, 4.개선제안
마크다운 형식, 한국어, 전문적이고 데이터 중심으로 작성하세요.`,
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
