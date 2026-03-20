import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler } from '@/lib/api-helpers';

// 네이버 검색광고 전문 AI가 실 키워드 데이터 기반으로 입찰가 조정을 추천하는 API
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);

  // 낮은 ROAS TOP 15 키워드 조회 (비용이 있고 전환이 낮은 키워드)
  const keywords = await prisma.keyword.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      cost: { gt: 0 },
    },
    orderBy: [{ cost: 'desc' }],
    take: 15,
    select: {
      id: true,
      keywordText: true,
      currentBid: true,
      cost: true,
      clicks: true,
      conversions: true,
      ctr: true,
      targetRank: true,
      adGroup: {
        select: {
          name: true,
          campaign: { select: { name: true } },
        },
      },
    },
  });

  if (keywords.length === 0) {
    return apiResponse({ recommendations: [], message: '분석할 키워드 데이터가 없습니다.' });
  }

  // 각 키워드의 ROAS 계산 및 추천 로직
  const recommendations = keywords.map((kw) => {
    const cost = Number(kw.cost);
    const conversions = Number(kw.conversions);
    const clicks = Number(kw.clicks);
    const ctr = Number(kw.ctr);
    const currentBid = Number(kw.currentBid);

    // ROAS 추정: (전환 * 평균 주문가치) / 비용 * 100
    // 주문가치는 업종별로 다르지만, 여기서는 CPC 기반 추정
    const roas = cost > 0 ? (conversions * 50000) / cost * 100 : 0;
    const ctrPct = ctr * 100;

    let action: 'decrease' | 'increase' | 'pause' | 'hold' = 'hold';
    let suggestedBid = currentBid;
    let reason = '';
    let urgency: 'high' | 'medium' | 'low' = 'low';

    if (cost > 0 && conversions === 0 && clicks > 50) {
      // 클릭은 많은데 전환 없음 → 입찰가 대폭 감소 또는 중단
      action = 'decrease';
      suggestedBid = Math.max(70, Math.round(currentBid * 0.6));
      reason = `클릭 ${clicks}회에도 전환 없음. 입찰가 40% 감소 권장`;
      urgency = 'high';
    } else if (roas < 100 && cost > 10000) {
      // ROAS 100% 미만 → 입찰가 감소
      action = 'decrease';
      suggestedBid = Math.max(70, Math.round(currentBid * 0.8));
      reason = `예상 ROAS ${roas.toFixed(0)}% — 목표 300% 대비 부족. 입찰가 20% 감소 권장`;
      urgency = 'medium';
    } else if (roas > 500 && ctrPct > 3) {
      // ROAS 높고 CTR 양호 → 입찰가 증가로 노출 확대
      action = 'increase';
      suggestedBid = Math.min(100000, Math.round(currentBid * 1.2));
      reason = `ROAS ${roas.toFixed(0)}%, CTR ${ctrPct.toFixed(1)}% 우수. 입찰가 20% 증가로 노출 확대 권장`;
      urgency = 'medium';
    } else if (ctrPct < 0.5 && clicks > 100) {
      // 클릭률 매우 낮음 → 소재/키워드 재검토 필요
      action = 'hold';
      reason = `CTR ${ctrPct.toFixed(2)}% 매우 낮음. 소재 개선 후 입찰가 조정 권장`;
      urgency = 'low';
    } else {
      action = 'hold';
      reason = '현재 성과 양호. 현행 유지 권장';
      urgency = 'low';
    }

    return {
      keywordId: kw.id,
      keyword: kw.keywordText,
      campaign: kw.adGroup?.campaign?.name ?? '-',
      adGroup: kw.adGroup?.name ?? '-',
      currentBid,
      suggestedBid,
      action,
      reason,
      urgency,
      metrics: {
        cost: cost.toLocaleString(),
        clicks,
        conversions,
        ctrPct: ctrPct.toFixed(2),
        estimatedRoas: roas.toFixed(0),
      },
    };
  });

  // 긴급도 순 정렬
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  // Gemini API로 종합 인사이트 생성 (선택적)
  let aiSummary: string | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      const kwSummary = recommendations.slice(0, 5).map(r =>
        `- ${r.keyword}: 현재 ₩${r.currentBid} → 제안 ₩${r.suggestedBid} (${r.reason})`
      ).join('\n');

      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: '당신은 네이버 검색광고 전문 AI입니다. 키워드 입찰가 데이터를 보고 짧고 명확한 한국어 종합 인사이트를 2~3문장으로 제공하세요. 마크다운 사용 가능.' }]
            },
            contents: [{
              role: 'user',
              parts: [{ text: `다음 키워드 입찰 추천 결과를 종합 분석해줘:\n${kwSummary}` }]
            }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
          }),
        }
      );
      if (geminiRes.ok) {
        const result = await geminiRes.json();
        aiSummary = result.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      }
    } catch {
      // Gemini 실패 시 무시
    }
  }

  return apiResponse({
    recommendations,
    aiSummary,
    totalAnalyzed: keywords.length,
    highUrgency: recommendations.filter(r => r.urgency === 'high').length,
    mediumUrgency: recommendations.filter(r => r.urgency === 'medium').length,
  });
});
