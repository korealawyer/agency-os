/**
 * Feature Flags — AI 기능별 ON/OFF
 */

export type AiFeatureFlag =
  | 'AI_FEATURE_COPILOT'
  | 'AI_FEATURE_AUTO_BID'
  | 'AI_FEATURE_CLICK_FRAUD'
  | 'AI_FEATURE_COMPETITIVE'
  | 'AI_FEATURE_KEYWORD_RECOMMEND'
  | 'AI_FEATURE_AD_CREATIVE'
  | 'AI_FEATURE_REPORT'
  | 'AI_FEATURE_INSIGHT';

export function isAiFeatureEnabled(flag: AiFeatureFlag): boolean {
  const value = process.env[flag];
  // 명시적으로 'true'면 활성, 그 외 비활성
  return value === 'true';
}

export function getAiDailyCallLimit(): number {
  return parseInt(process.env.AI_DAILY_CALL_LIMIT || '1000', 10);
}

export function getAutoBidConfig() {
  return {
    enabled: process.env.AUTO_BID_ENABLED === 'true',
    maxBid: parseInt(process.env.AUTO_BID_MAX_BID || '10000', 10),
    minBid: parseInt(process.env.AUTO_BID_MIN_BID || '70', 10),
    maxChange: parseInt(process.env.AUTO_BID_MAX_CHANGE || '50', 10),
    maxHourly: parseInt(process.env.AUTO_BID_MAX_HOURLY || '3', 10),
    minConfidence: parseFloat(process.env.AUTO_BID_MIN_CONFIDENCE || '0.6'),
    rollbackMinutes: parseInt(process.env.AUTO_BID_ROLLBACK_MINUTES || '60', 10),
    batchSize: parseInt(process.env.AUTO_BID_BATCH_SIZE || '500', 10),
  };
}
