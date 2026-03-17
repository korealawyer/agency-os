/**
 * AI Client — 통합 AI 호출 클라이언트
 * Gemini → OpenAI → Mock 폴백 체인
 */

export interface AiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: 'premium' | 'standard'; // premium=GPT-4o, standard=GPT-4o-mini
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface AiCallResult {
  content: string;
  model: string;
  isMock: boolean;
}

export async function callAi(options: AiCallOptions): Promise<AiCallResult> {
  const {
    systemPrompt, userPrompt,
    model = 'standard',
    maxTokens = 2000,
    temperature = 0.7,
  } = options;

  // 1순위: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { content: text, model: 'gemini-2.0-flash', isMock: false };
      }
    } catch (e) {
      console.error('[AI] Gemini error:', e);
    }
  }

  // 2순위: OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiModel = model === 'premium'
        ? (process.env.OPENAI_MODEL_PREMIUM || 'gpt-4o')
        : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return { content: text, model: openaiModel, isMock: false };
      }
    } catch (e) {
      console.error('[AI] OpenAI error:', e);
    }
  }

  // 3순위: Mock
  return { content: '', model: 'mock', isMock: true };
}
