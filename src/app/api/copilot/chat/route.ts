import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, apiError, requireAuth, withErrorHandler, safeParseBody, logAudit } from '@/lib/api-helpers';
import { copilotRateLimit, checkRateLimit, getClientIp } from '@/lib/rate-limit';

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(5000),
  })).max(20).default([]),
});

// DB 실데이터 기반 폴백 응답 (mock 수치 없음)
function buildContextResponse(context?: any): string {
  const keywordCount = context?.keywordCount ?? 0;
  const accountCount = context?.accountCount ?? 0;
  const totalCost = Number(context?.totalCost ?? 0);
  const totalConversions = Number(context?.totalConversions ?? 0);
  const avgRoas = context?.avgRoas ? (Number(context.avgRoas) * 100).toFixed(0) + '%' : '데이터 없음';

  if (accountCount === 0) {
    return `계정이 연결되어 있지 않습니다.📋\n\n**시작 방법:**\n1. 계정 관리 → 네이버 광고 계정 연결\n2. 편집 버튼에서 동기화\n3. 다시 코파일럿 돌아오기\n\n네이버 광고 계정 연결 후 실제 데이터를 분석해드립니다.`;
  }

  const topKws = (context?.recentKeywords ?? []) as any[];
  const kwList = topKws.slice(0, 5).map((k: any, i: number) =>
    `${i + 1}. ${k.keywordText}: 입찰가 ₩${k.currentBid}, 비용 ₩${Number(k.cost).toLocaleString()}`
  ).join('\n');

  return `📊 **현재 Agency OS 계정 현황 (실제 DB)**\n\n| 지표 | 값 |\n|------|-----|\n| 연결 계정 | ${accountCount}개 |\n| 총 키워드 | ${keywordCount}개 |\n| 누적 광고비 | ₩${totalCost.toLocaleString('ko-KR')} |\n| 누적 전환수 | ${totalConversions}건 |\n| 평균 ROAS | ${avgRoas} |\n\n${kwList ? `**비용 상위 키워드:**\n${kwList}` : '성과 데이터가 없습니다. 동기화를 먼저 실행해주세요.'}\n\n어떤 분석이 필요하신가요?\n- "성과 요약해줘" / "입찰가 최적화" / "키워드 추천"\n\n> ⚠️ AI(Gemini/GPT) API가 미설정되어 기본 응답 중입니다. 환경변수에 GEMINI_API_KEY를 설정하면 완전한 AI 응답을 받을 수 있습니다.`;
}



export const POST = withErrorHandler(async (req: NextRequest) => {
  // ──── Rate Limiting (Upstash 미설정 시 자동 스킵) ────
  const ip = getClientIp(req.headers);
  const { success: rlSuccess } = await checkRateLimit(copilotRateLimit, ip);
  if (!rlSuccess) {
    return apiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429);
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
  const systemPrompt = `당신은 Agency OS의 네이버 검색광고 전문 AI 어시스턴트 "애드파일럿(AdPilot)"입니다.
광고 대행사 실무 담당자의 파트너로, 실제 계정 데이터 기반 분석과 즉시 실행 가능한 제안만 제공합니다.

<core_rules>
1. 제공된 실제 계정 데이터에만 근거하여 분석한다
2. 가상 수치·없는 계정명·임의 키워드를 절대 생성하지 않는다
3. 데이터가 없으면 "현재 [항목] 데이터가 없습니다. 계정 동기화 후 다시 확인해주세요"라고 안내한다
4. 수치 근거 없는 "좋아보입니다", "나쁩니다" 표현은 사용하지 않는다
5. 광고 외 일반 질문: "저는 네이버 검색광고 전문 AI입니다. 광고 관련 질문을 도와드릴게요!"로 안내
</core_rules>

<mode_detection>
사용자 메시지를 분석하여 아래 4가지 모드 중 하나로 자동 전환하세요:
- MODE 1 (성과분석): "성과", "ROAS", "CTR", "전환", "클릭", "분석", "어때", "현황" 포함 시
- MODE 2 (입찰최적화): "입찰", "bid", "순위", "상향", "하향", "조정", "자동" 포함 시
- MODE 3 (소재생성): "소재", "광고문구", "제목", "copy", "카피", "써줘" 포함 시
- MODE 4 (부정클릭): "부정클릭", "fraud", "차단", "의심클릭", "IP" 포함 시
- 기본 (general): 위에 해당 없으면 계정 현황 요약 + 어떤 도움이 필요한지 안내
</mode_detection>

<mode1_performance_analysis>
[Chain of Thought — 성과 분석 시 응답 순서]
1. 📊 핵심 지표 요약 (제공된 데이터 기반 테이블)
2. 우선순위별 진단:
   🚨 즉각 조치: ROAS<50% / 부정클릭 급증 / 예산 80% 이상 소진
   ⚠️ 주의: 전주 대비 CTR 20% 이상 하락 / 순위 2단계 이상 하락
   💡 기회: 고성과 키워드 예산 확대 여지
   ✅ 긍정 (반드시 1개 이상 포함)
3. 각 항목 하단에 "👉 권장 액션: [구체적 행동]" 1줄
</mode1_performance_analysis>

<mode2_bid_optimization>
[Chain of Thought — 입찰 제안 시 응답 순서]
1. 현재 TOP 10 키워드 입찰 현황 테이블
2. 조정 우선순위 키워드 최대 3개:
   - 전환 0건 + 고비용 → 하향 권고 (상향 절대 금지)
   - ROAS 200% 초과 + 전환 존재 → 소폭 상향 고려
3. 구체적 제안: "키워드 [X], 현재 ₩[A] → 제안 ₩[B], 이유: [수치 근거]"
4. 자동입찰 설정 안내 (필요 시)
</mode2_bid_optimization>

<mode3_creative>
[Chain of Thought — 소재 제안 시 응답 순서]
1. 네이버 광고 규정 준수 확인 (제목15자, 설명45자)
2. 3가지 접근방식으로 각 1세트씩:
   Set A: 숫자/수치 활용
   Set B: 혜택 + 긴박감
   Set C: 질문형
3. 각 소재별 complianceCheck (업종 금지어 포함 여부)
</mode3_creative>

<mode4_fraud>
[Chain of Thought — 부정클릭 분석 시 응답 순서]
1. 탐지 현황 요약 (탐지건수/차단건수/예상절감액)
2. 고위험 패턴 분석 (dwellTime/geo/fingerprint 기반)
3. 권고 액션: block/monitor/safe 구분
4. 예방 설정 안내
</mode4_fraud>

<response_style>
- 한국어, 마크다운, 관련 이모지 활용
- 핵심 먼저 → 수치 근거 → 실행 제안 순서
- 전문용어는 괄호로 설명 (예: CTR(클릭률), ROAS(광고 수익률))
- "입찰가를 올리세요" (X) → "키워드 [X] 입찰가를 ₩[A]→₩[B]로 상향 권장, 이유: 전환 [N]건 확인" (O)
</response_style>

<account_context>
[현재 계정 현황]
- 연결 계정 수: ${context.accountCount ?? 0}개
- 총 키워드: ${context.keywordCount ?? 0}개
${context.accounts?.length ? `- 계정 목록: ${context.accounts.map((a: any) => `${a.customerName}(${a.connectionStatus})`).join(', ')}` : '- (연결된 계정 없음)'}

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
` : '\n[키워드 데이터 없음 — 계정 동기화 후 다시 시도해주세요]'}
</account_context>`;

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
          || buildContextResponse(context);
      } else {
        aiResponse = buildContextResponse(context);
      }
    } catch {
      aiResponse = buildContextResponse(context);
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
          || buildContextResponse(context);
      } else {
        aiResponse = buildContextResponse(context);
      }
    } catch {
      aiResponse = buildContextResponse(context);
    }
  } else {
    // LLM API 미설정 시: DB 실데이터 기반 안내
    aiResponse = buildContextResponse(context);
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
