import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, apiError, withErrorHandler } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { parseJsonResponse } from '@/lib/ai/response-parser';
import { isAiFeatureEnabled, getAutoBidConfig } from '@/lib/ai/feature-flags';

// Vercel Pro 최대 300초 타임아웃
export const maxDuration = 300;

export const POST = withErrorHandler(async (req: NextRequest) => {
  // ──── Cron 인증 (Fail-Close) ────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError('CRON_SECRET 환경변수가 설정되지 않았습니다.', 500);
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401);
  }

  if (!isAiFeatureEnabled('AI_FEATURE_AUTO_BID')) {
    return apiResponse({ message: 'Auto-bid feature is disabled', processed: 0 });
  }

  const config = getAutoBidConfig();
  if (!config.enabled) {
    return apiResponse({ message: 'Auto-bid is disabled', processed: 0 });
  }

  // 자동입찰 활성 키워드 조회
  const keywords = await prisma.keyword.findMany({
    where: { isAutoManaged: true, deletedAt: null },
    take: config.batchSize,
    include: {
      organization: { select: { id: true, name: true } },
      bidHistory: { orderBy: { changedAt: 'desc' }, take: 1 },
      rankSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
    },
  });

  if (keywords.length === 0) {
    return apiResponse({ message: 'No auto-managed keywords found', processed: 0 });
  }

  // 배치 분석
  const keywordsData = keywords.map(k => ({
    id: k.id,
    keyword: k.keywordText,
    strategy: k.bidStrategy,
    currentBid: k.currentBid,
    targetRank: k.targetRank,
    currentRank: k.rankSnapshots[0]?.rank ?? null,
    ctr: Number(k.ctr),
    conversions: k.conversions,
    cost: Number(k.cost),
    roas: k.roas ? Number(k.roas) : null,
  }));

  const aiResult = await callAi({
    systemPrompt: `당신은 네이버 검색광고 입찰가 최적화 전문가입니다.
각 키워드의 성과 데이터와 입찰 전략을 분석하여 입찰가 조정을 JSON 배열로 응답하세요.
각 항목: { "keywordId": "...", "recommendedBid": 숫자, "reason": "사유", "confidence": 0.0~1.0 }
안전장치: 상한 ₩${config.maxBid}, 하한 ₩${config.minBid}, 1회 변경폭 ±₩${config.maxChange}`,
    userPrompt: JSON.stringify(keywordsData),
    model: getModelForFeature('auto_bid'),
    jsonMode: true,
    temperature: 0.3,
  });

  if (aiResult.isMock) {
    return apiResponse({ message: 'Mock mode - no changes applied', processed: 0, mock: true });
  }

  // AI 응답 파싱
  const recommendations = parseJsonResponse<any[]>(aiResult.content, []);
  const validRecs: Array<{ keyword: typeof keywords[0]; newBid: number; rec: any }> = [];

  for (const rec of Array.isArray(recommendations) ? recommendations : []) {
    const keyword = keywords.find(k => k.id === rec.keywordId);
    if (!keyword) continue;

    // 신뢰도 필터
    if ((rec.confidence ?? 0) < config.minConfidence) continue;

    // 안전장치 검증
    let newBid = Math.round(rec.recommendedBid ?? keyword.currentBid);
    newBid = Math.min(newBid, config.maxBid);
    newBid = Math.max(newBid, config.minBid);

    const change = Math.abs(newBid - keyword.currentBid);
    if (change > config.maxChange) {
      newBid = keyword.currentBid + (newBid > keyword.currentBid ? config.maxChange : -config.maxChange);
    }

    if (newBid === keyword.currentBid) continue;
    validRecs.push({ keyword, newBid, rec });
  }

  // ──── 배치 트랜잭션 + OCC(Optimistic Concurrency Control) ────
  const results: any[] = [];

  if (validRecs.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { keyword, newBid, rec } of validRecs) {
        // OCC: version 확인 후 업데이트 — 동시 수정 시 건너뛰기
        const updated = await tx.keyword.updateMany({
          where: { id: keyword.id, version: keyword.version },
          data: { currentBid: newBid, version: { increment: 1 } },
        });

        if (updated.count === 0) continue; // 동시 수정 충돌 시 건너뛰기

        await tx.bidHistory.create({
          data: {
            keywordId: keyword.id,
            organizationId: keyword.organizationId,
            oldBid: keyword.currentBid,
            newBid,
            reason: rec.reason || 'AI 자동 입찰 조정',
            changedBy: 'ai',
          },
        });

        await tx.aiActionLog.create({
          data: {
            organizationId: keyword.organizationId,
            actionType: 'bid_adjustment',
            entityType: 'Keyword',
            entityId: keyword.id,
            inputData: { keyword: keyword.keywordText, currentBid: keyword.currentBid, strategy: keyword.bidStrategy },
            outputData: { newBid, reason: rec.reason, confidence: rec.confidence },
            confidence: rec.confidence,
            isApproved: true,
          },
        });

        results.push({ keywordId: keyword.id, keyword: keyword.keywordText, oldBid: keyword.currentBid, newBid });
      }
    });
  }

  return apiResponse({ processed: results.length, results, model: aiResult.model });
});

// Vercel Cron은 GET으로 호출하므로 GET → POST 위임
export const GET = POST;
