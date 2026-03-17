/**
 * Response Parser — AI JSON 응답 파싱 + 검증
 */

export function parseJsonResponse<T>(raw: string, fallback: T): T {
  try {
    // JSON 블록 추출 (AI가 ```json ... ``` 형태로 응답할 수 있음)
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;

    // 앞뒤 텍스트 제거 후 JSON만 파싱
    const trimmed = jsonStr.trim();
    const start = trimmed.indexOf('{') !== -1 ? trimmed.indexOf('{') : trimmed.indexOf('[');
    const end = trimmed.lastIndexOf('}') !== -1 ? trimmed.lastIndexOf('}') + 1 : trimmed.lastIndexOf(']') + 1;

    if (start === -1 || end <= start) return fallback;

    return JSON.parse(trimmed.substring(start, end));
  } catch (e) {
    console.error('[AI] JSON parse error:', e);
    return fallback;
  }
}

export function extractArrayFromResponse<T>(raw: string, fallback: T[]): T[] {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const trimmed = jsonStr.trim();
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']') + 1;
    if (start === -1 || end <= start) return fallback;
    return JSON.parse(trimmed.substring(start, end));
  } catch {
    return fallback;
  }
}
