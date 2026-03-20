import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, withErrorHandler, safeParseBody } from '@/lib/api-helpers';
import { callAi } from '@/lib/ai/ai-client';
import { getModelForFeature } from '@/lib/ai/model-router';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await safeParseBody<any>(req);

  if (!isAiFeatureEnabled('AI_FEATURE_AD_CREATIVE')) {
    return apiResponse({
      creatives: [
        { title: '[Mock] 전문 변호사 상담', description: '20년 경력 전문 변호사의 무료 상담. 지금 바로 문의하세요.', version: 'mock' },
      ],
      mock: true,
    });
  }

  const aiResult = await callAi({
    systemPrompt: `당신은 네이버 검색광고 전문 카피라이터 AI "AdPilot"입니다.
실제 키워드·업종 데이터에 기반한 광고 소재만 생성하며, 없는 정보를 임의로 추가하지 않습니다.

<naver_ad_rules>
제목(title): 최대 15자 (공백 포함) — 초과 시 네이버 심사에서 자동 반려
설명(description): 최대 45자 (공백 포함) — 초과 시 자동 반려
특수문자(!?~※▶) 연속 사용 금지
업종별 절대 금지 표현:
  병원/의료 → 최고, 최대, 1등, 국내 최초, 완치, 치료 보장
  법률       → 승소 보장, 100% 승소, 무조건 해결
  금융       → 확정 수익, 원금 보장, 무조건 승인
  교육       → 합격 보장, 100% 취업
업종 정보가 없으면 모든 업종에서 안전한 표현만 사용
</naver_ad_rules>

<thinking_process>
각 소재를 작성할 때 반드시 이 순서로 검증한다 (Chain of Thought):
1단계 — 키워드와 직접 연관 단어를 제목에 포함 (품질지수 향상)
2단계 — CTR 향상 기법 중 해당 세트의 접근방식 선택:
  Set A: 숫자/수치 활용 ("20년 경력", "상담 5만 건")
  Set B: 혜택 명시 + 긴박감 ("오늘 무료 상담", "선착순 10명")
  Set C: 질문형 또는 감성소구 ("아직도 비싸게 내세요?")
3단계 — 기존 제목 목록과 다른 구조/표현 사용 (A/B 테스트 목적)
4단계 — 제목 글자수 자체 계산 후 확인 (15자 초과 시 재작성)
5단계 — 설명 글자수 자체 계산 후 확인 (45자 초과 시 재작성)
6단계 — 업종별 금지어 포함 여부 검토 → 포함 시 complianceCheck에 "경고: [금지어]" 기재
</thinking_process>

<few_shot_examples>
✅ GOOD 예시 (키워드="임플란트", 업종="치과"):
  Set A (숫자활용): title="임플란트 ₩88만" (7자) / description="삼성동 개원 15년 치과. 무이자 할부 상담 가능" (24자)
    → titleLength:7, descLength:24, complianceCheck:"통과", approach:"숫자활용"
  Set B (혜택+긴박감): title="오늘 무료 CT 촬영" (9자) / description="임플란트 전 과정 주치의 1인 케어. 당일 예약 가능" (26자)
    → titleLength:9, descLength:26, complianceCheck:"통과", approach:"혜택강조"
  Set C (질문형): title="임플란트 비싸다고요?" (11자) / description="타 병원 견적서 지참 시 추가 할인. 상담 후 결정" (25자)
    → titleLength:11, descLength:25, complianceCheck:"통과", approach:"질문형"

❌ BAD 예시 (절대 금지):
  title="국내 최고 임플란트 치과" (13자) → "최고" 금지어 → complianceCheck:"경고: 최고(의료 금지어)"
  title="임플란트 전문 치과 추천" (13자) → 15자 이내지만 "추천"은 비교 표현 주의
</few_shot_examples>

<output_format>
반드시 JSON만 응답 (설명 텍스트 없음):
{
  "creatives": [{
    "title": "최대15자",
    "titleLength": 숫자,
    "description": "최대45자",
    "descLength": 숫자,
    "approach": "숫자활용 | 혜택강조 | 질문형 | 감성소구 | 긴박감",
    "complianceCheck": "통과 | 경고: [이유]"
  }]
}
</output_format>`,
    userPrompt: `키워드: ${body.keyword || '(없음)'}
업종: ${body.industry || '(미지정 — 모든 업종 안전 표현 사용)'}
현재 제목 목록 (이와 다르게 작성): ${JSON.stringify(body.currentTitles || [])}`,
    model: getModelForFeature('ad_creative'),
    jsonMode: true,
    temperature: 0.8,
  });


  if (aiResult.isMock) {
    return apiResponse({ creatives: [], mock: true });
  }

  await prisma.aiActionLog.create({
    data: {
      organizationId: user.organizationId, userId: user.id,
      actionType: 'creative_suggestion', entityType: 'Ad',
      inputData: { keyword: body.keyword },
      outputData: { model: aiResult.model },
    },
  });

  return apiResponse({ ...JSON.parse(aiResult.content || '{}'), mock: false, model: aiResult.model });
});
