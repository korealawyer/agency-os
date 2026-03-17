/**
 * Model Router — 기능별 모델 배정
 */

export type AiFeature =
  | 'copilot_chat'
  | 'auto_bid'
  | 'click_fraud'
  | 'competitive'
  | 'keyword_recommend'
  | 'ad_creative'
  | 'dashboard_insight'
  | 'report_generation';

export function getModelForFeature(feature: AiFeature): 'premium' | 'standard' {
  // 사용자 대면 기능 → premium (GPT-4o)
  const premiumFeatures: AiFeature[] = [
    'copilot_chat',
    'ad_creative',
    'dashboard_insight',
    'report_generation',
  ];

  return premiumFeatures.includes(feature) ? 'premium' : 'standard';
}
