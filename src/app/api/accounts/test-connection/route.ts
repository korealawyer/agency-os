import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiResponse, withErrorHandler, requireAuth } from '@/lib/api-helpers';

const testSchema = z.object({
  apiKey: z.string().min(1),
  secretKey: z.string().min(1),
  customerId: z.string().min(1),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  
  const body = await req.json();
  const data = testSchema.parse(body);

  // 네이버 검색광고 API 연결 테스트
  const timestamp = Date.now().toString();
  const baseUrl = 'https://api.searchad.naver.com';
  
  try {
    const crypto = await import('crypto');
    const hmac = crypto.createHmac('sha256', data.secretKey);
    hmac.update(`${timestamp}.GET./ncc/campaigns`);
    const signature = hmac.digest('base64');

    const res = await fetch(`${baseUrl}/ncc/campaigns`, {
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': data.apiKey,
        'X-Customer': data.customerId,
        'X-Signature': signature,
      },
    });

    if (res.ok || res.status === 200) {
      return apiResponse({ connected: true, message: '연결 성공' });
    }

    // 401/403은 인증 실패, 그 외는 연결은 됨
    const errorBody = await res.text();
    if (res.status === 401 || res.status === 403) {
      return apiResponse({ connected: false, message: 'API 인증 실패. API Key 또는 Secret Key를 확인해주세요.' }, 400);
    }
    
    // 다른 상태코드(404 등)는 연결은 성공한 것으로 처리 (캠페인이 없을 수 있음)
    return apiResponse({ connected: true, message: '연결 성공 (캠페인 없음)' });
  } catch (error: any) {
    return apiResponse({ connected: false, message: `연결 실패: ${error.message}` }, 500);
  }
});
