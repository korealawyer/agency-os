import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler, safeParseBody, logAudit } from '@/lib/api-helpers';

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
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
  return `안녕하세요! 말씀하신 내용을 분석해보겠습니다.

📊 **현재 계정 현황:**
- 총 계정: ${accountCount}개
- 총 키워드: ${keywordCount}개

더 구체적인 분석이 필요하시면:
- "성과 요약해줘"
- "키워드 추천해줘"
- "입찰가 최적화 제안해줘"
- "부정클릭 분석해줘"

위 질문을 시도해보세요!`;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await safeParseBody(req);
  const { message } = chatSchema.parse(body);

  // 실 데이터 컨텍스트 수집
  let context: any = {};
  try {
    const [keywordCount, accountCount, recentKeywords] = await Promise.all([
      prisma.keyword.count({ where: { organizationId: user.organizationId, deletedAt: null } }),
      prisma.naverAccount.count({ where: { organizationId: user.organizationId, deletedAt: null } }),
      prisma.keyword.findMany({
        where: { organizationId: user.organizationId, deletedAt: null },
        orderBy: { cost: 'desc' },
        take: 10,
        select: { keywordText: true, currentBid: true, ctr: true, conversions: true, cost: true },
      }),
    ]);
    context = { keywordCount, accountCount, recentKeywords };
  } catch {
    // DB 미연결 시 빈 컨텍스트
  }

  // 공통 시스템 프롬프트 (실시간 계정 데이터 포함)
  const systemPrompt = `당신은 네이버 검색광고 전문 AI 어시스턴트입니다.
사용자의 광고 계정 데이터를 기반으로 분석하고 최적화를 제안합니다.
한국어로 응답하며, 마크다운 테이블과 이모지를 활용하여 가독성 높은 응답을 생성합니다.

[현재 계정 상태]
- 총 키워드: ${context.keywordCount ?? 0}개
- 총 계정: ${context.accountCount ?? 0}개
${context.recentKeywords?.length ? `
[상위 키워드 (비용 기준 TOP 10)]
${context.recentKeywords.map((k: any) => `- ${k.keywordText}: 입찰가 ₩${k.currentBid}, CTR ${(Number(k.ctr) * 100).toFixed(1)}%, 전환 ${k.conversions}건`).join('\n')}
` : ''}`;

  let aiResponse: string;

  // 1순위: Google Gemini API
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: message }] }],
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
