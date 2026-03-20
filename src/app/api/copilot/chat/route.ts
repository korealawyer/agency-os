import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, apiError, requireAuth, withErrorHandler, safeParseBody, logAudit } from '@/lib/api-helpers';
import { copilotRateLimit, getClientIp } from '@/lib/rate-limit';

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(5000),
  })).max(20).default([]),
});

// ── AI 응답 Mock 데이터 (LLM 미연동 시 폴백) ──
const aiResponses: Record<string, string> = {
  "성과": `📊 **전체 계정 성과 요약**

| 지표 | 값 | 전일 대비 |
|------|-----|----------|
| 총 광고비 | ₩6,480,000 | +8% |
| 평균 ROAS | 340% | +22% |
| 총 클릭수 | 6,890 | +14% |
| 전환수 | 68건 | +18% |

**💡 추천 액션:** B 성형외과 '쌍꺼풀수술가격' 키워드 소재 A/B 테스트를 진행하시겠어요?`,

  "키워드": `🔑 **AI 키워드 추천**

현재 활성 키워드를 분석한 결과, 다음 키워드를 추천합니다:

| 키워드 | 월 검색량 | 경쟁도 | 예상 CPC |
|--------|----------|--------|----------|
| 교통사고변호사 | 8,200 | 낮음 | ₩680 |
| 상속변호사 | 5,400 | 보통 | ₩850 |
| 임플란트비용 | 12,100 | 낮음 | ₩520 |

키워드 관리 페이지에서 바로 추가하시겠어요?`,

  "입찰": `💰 **입찰가 최적화 제안**

ROAS 기준 하위 키워드를 분석했습니다:

**1. 코성형후기** — ROAS 52% ❌
- 현재 입찰가: ₩1,800 → 제안: ₩1,500 (-17%)
- 예상 효과: ROAS 78%로 개선

**2. 인테리어견적** — ROAS 109%
- 현재 입찰가: ₩700 → 제안: ₩600 (-14%)
- 예상 효과: ROAS 145%로 개선

전체 적용하시겠어요?`,

  "부정": `🛡️ **부정클릭 분석 보고서**

최근 7일간 48,230건의 클릭 중 **2,415건(5.0%)**이 의심 클릭으로 탐지되었습니다.

**🔴 고위험 IP (즉시 차단 권장):**
- 203.xxx.xxx.12: 동일 IP에서 3회 연속 클릭 (10분 이내)

**💰 예상 절감액:** ₩350,000/주

키워드 관리 > 부정클릭 방지 탭에서 상세 확인 및 IP 차단이 가능합니다.`,

  "경쟁": `🕵️ **경쟁사 포지션 분석**

'형사변호사' 키워드 기준:

| 경쟁사 | 순위 | 예상 입찰가 | 위협도 |
|--------|------|-----------|--------|
| 우리 | **1위** | ₩1,200 | - |
| 법무법인 정의 | 2위 | ₩1,150 | 🟡 |
| 한빛 법률사무소 | 3위 | ₩1,080 | 🟢 |

입찰가 격차가 ₩50으로 좁혀지고 있어 주시가 필요합니다.`,

  "개선": `💡 **캠페인 개선 제안 TOP 3**

**1. 🔥 B 성형외과 — CTR 급락 대응**
- 소재 A/B 테스트 진행 (새 소재 2~3개 추가)

**2. 💰 C 치과의원 — 예산 조정**
- 시간대 차등 입찰 활성화 (오후 강화)

**3. 📈 E 학원 — 골든타임 활용**
- 15~18시 입찰가 +20% 자동 설정

각 제안을 실행하시겠어요?`,
};

function getContextBasedResponse(message: string, context?: any): string {
  const msgLower = message.toLowerCase();

  for (const [keyword, response] of Object.entries(aiResponses)) {
    if (msgLower.includes(keyword)) return response;
  }

  const keywordCount = context?.keywordCount ?? 0;
  const accountCount = context?.accountCount ?? 0;
  const totalCost = context?.totalCost ?? 0;
  const totalConversions = context?.totalConversions ?? 0;
  const avgRoas = context?.avgRoas ? (context.avgRoas * 100).toFixed(0) + '%' : '데이터 없음';
  return `안녕하세요! 실제 계정 데이터를 분석해보겠습니다.

📊 **현재 계정 현황 (실 DB)**
- 총 계정: ${accountCount}개
- 총 키워드: ${keywordCount}개
- 총 광고비: ₩${totalCost.toLocaleString('ko-KR')}
- 총 전환수: ${totalConversions}건
- 평균 ROAS: ${avgRoas}

더 구체적인 분석이 필요하시면:
- "성과 요약해줘"
- "키워드 추천해줘"
- "입찰가 최적화 제안해줘"
- "부정클릭 분석해줘"

위 질문을 시도해보세요!`;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  // ──── Rate Limiting (Upstash 미설정 시 스킵) ────
  const ip = getClientIp(req.headers);
  try {
    const { success } = await copilotRateLimit.limit(ip);
    if (!success) {
      return apiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429);
    }
  } catch {
    // Upstash Redis 미설정 시 rate limiting 스킵
  }

  const user = await requireAuth(req);
  const body = await safeParseBody(req);
  const { message, history } = chatSchema.parse(body);

  // 실 데이터 컨텍스트 수집
  let context: any = {};
  try {
    const [keywordCount, accountCount, recentKeywords, accounts, perfAgg] = await Promise.all([
      prisma.keyword.count({ where: { organizationId: user.organizationId, deletedAt: null } }),
      prisma.naverAccount.count({ where: { organizationId: user.organizationId, deletedAt: null } }),
      prisma.keyword.findMany({
        where: { organizationId: user.organizationId, deletedAt: null },
        orderBy: { cost: 'desc' },
        take: 10,
        select: { keywordText: true, currentBid: true, ctr: true, conversions: true, cost: true, roas: true },
      }),
      prisma.naverAccount.findMany({
        where: { organizationId: user.organizationId, deletedAt: null },
        select: { customerName: true, monthlySpend: true, connectionStatus: true },
        take: 10,
      }),
      prisma.keyword.aggregate({
        where: { organizationId: user.organizationId, deletedAt: null },
        _sum: { cost: true, conversions: true, clicks: true, impressions: true },
        _avg: { roas: true, ctr: true },
      }),
    ]);
    const totalCost = Number(perfAgg._sum.cost ?? 0);
    const totalConversions = Number(perfAgg._sum.conversions ?? 0);
    const totalClicks = Number(perfAgg._sum.clicks ?? 0);
    const totalImpressions = Number(perfAgg._sum.impressions ?? 0);
    const avgRoas = Number(perfAgg._avg.roas ?? 0);
    const avgCtr = Number(perfAgg._avg.ctr ?? 0);
    context = { keywordCount, accountCount, recentKeywords, accounts, totalCost, totalConversions, totalClicks, totalImpressions, avgRoas, avgCtr };
  } catch {
    // DB 미연결 시 빈 컨텍스트
  }

  // 공통 시스템 프롬프트 (실시간 계정 데이터 포함)
  const systemPrompt = `당신은 네이버 검색광고 전문 AI 어시스턴트입니다.
사용자의 실제 광고 계정 데이터를 기반으로만 분석하고 최적화를 제안합니다.
한국어로 응답하며, 마크다운 테이블과 이모지를 활용하여 가독성 높은 응답을 생성합니다.
절대로 가상의 데이터나 예시 수치를 사용하지 마세요. 데이터가 없으면 없다고 안내하세요.

[현재 계정 현황]
- 연결 계정 수: ${context.accountCount ?? 0}개
- 총 키워드: ${context.keywordCount ?? 0}개
${context.accounts?.length ? `- 계정 목록: ${context.accounts.map((a: any) => `${a.customerName}(${a.connectionStatus})`).join(', ')}` : ''}

[누적 성과 합계]
- 총 광고비: ₩${(context.totalCost ?? 0).toLocaleString('ko-KR')}
- 총 전환수: ${context.totalConversions ?? 0}건
- 총 클릭수: ${context.totalClicks ?? 0}회
- 총 노출수: ${context.totalImpressions ?? 0}회
- 평균 ROAS: ${context.avgRoas ? (context.avgRoas * 100).toFixed(0) + '%' : '데이터 없음'}
- 평균 CTR: ${context.avgCtr ? (context.avgCtr * 100).toFixed(2) + '%' : '데이터 없음'}
${context.recentKeywords?.length ? `
[비용 상위 키워드 TOP 10]
${context.recentKeywords.map((k: any, i: number) => `${i + 1}. ${k.keywordText}: 입찰가 ₩${k.currentBid}, 비용 ₩${Number(k.cost).toLocaleString()}, CTR ${(Number(k.ctr) * 100).toFixed(1)}%, 전환 ${k.conversions}건, ROAS ${k.roas ? (Number(k.roas) * 100).toFixed(0) + '%' : '-'}`).join('\n')}
` : '\n[키워드 데이터 없음 - 계정 동기화가 필요합니다]'}`;

  let aiResponse: string;

  // 1순위: Google Gemini API
  if (process.env.GEMINI_API_KEY) {
    try {
      // 멀티턴: 이전 대화 히스토리 → Gemini contents 형식으로 변환
      const geminiHistory = history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));
      const geminiRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [
              ...geminiHistory,
              { role: 'user', parts: [{ text: message }] },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      );
      if (geminiRes.ok) {
        const result = await geminiRes.json();
        aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text
          || getContextBasedResponse(message, context);
      } else {
        aiResponse = getContextBasedResponse(message, context);
      }
    } catch {
      aiResponse = getContextBasedResponse(message, context);
    }
  }
  // 2순위: OpenAI API
  else if (process.env.OPENAI_API_KEY) {
    try {
      // 멀티턴: 이전 대화 히스토리 포함
      const openaiHistory = history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      }));
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...openaiHistory,
            { role: 'user', content: message },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
      if (openaiRes.ok) {
        const result = await openaiRes.json();
        aiResponse = result.choices?.[0]?.message?.content
          || getContextBasedResponse(message, context);
      } else {
        aiResponse = getContextBasedResponse(message, context);
      }
    } catch {
      aiResponse = getContextBasedResponse(message, context);
    }
  } else {
    // 3순위: Mock 폴백
    aiResponse = getContextBasedResponse(message, context);
  }

  // AI 액션 로그 저장
  try {
    await prisma.aiActionLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        actionType: 'keyword_recommendation',
        entityType: 'copilot',
        inputData: { message },
        outputData: { response: aiResponse.substring(0, 500) },
      },
    });
  } catch {
    // 로그 실패는 무시
  }

  logAudit({
    userId: user.id,
    organizationId: user.organizationId,
    action: 'CREATE',
    entityType: 'CopilotChat',
    entityId: 'copilot',
    newValues: { message: message.substring(0, 100) },
  });

  return apiResponse({ response: aiResponse });
});
