import { createHmac } from 'crypto';

/**
 * 네이버 검색광고 REST API 클라이언트
 * @see https://searchad.naver.com/guide/api-doc
 */
export class NaverAdsClient {
  private baseUrl = 'https://api.searchad.naver.com';

  constructor(
    private customerId: string,
    private apiKey: string,
    private secretKey: string,
  ) {}

  // ── HMAC-SHA256 서명 생성 ──
  private getHeaders(method: string, path: string): HeadersInit {
    const timestamp = String(Date.now());
    const hmac = createHmac('sha256', this.secretKey);
    hmac.update(`${timestamp}.${method}.${path}`);
    const signature = hmac.digest('base64');

    return {
      'X-API-KEY': this.apiKey,
      'X-Customer': this.customerId,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    // 서명 시에는 쿼리 파라미터를 제외한 순수 경로만 사용
    const signPath = path.split('?')[0];
    const opts: RequestInit = {
      method,
      headers: this.getHeaders(method, signPath),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, opts);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err = new Error(`Naver API Error ${res.status}: ${errBody.title || res.statusText}`);
      (err as any).statusCode = res.status;
      throw err;
    }
    return res.json() as Promise<T>;
  }

  // ── Exponential Backoff 재시도 로직 ──
  private async requestWithRetry<T>(
    method: string, path: string, body?: any, maxRetries = 3
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.request<T>(method, path, body);
      } catch (error: any) {
        const status = error.statusCode;
        // 재시도 가능한 에러: 429 (Rate Limit), 500, 502, 503, 504
        const isRetryable = [429, 500, 502, 503, 504].includes(status);

        if (attempt === maxRetries || !isRetryable) throw error;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Naver API retry ${attempt + 1}/${maxRetries} after ${delay}ms (status: ${status})`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }


  // ── 캠페인 조회 ──
  async getCampaigns() {
    return this.requestWithRetry<any[]>('GET', '/ncc/campaigns');
  }

  // ── 광고그룹 조회 ──
  async getAdGroups(campaignId: string) {
    return this.requestWithRetry<any[]>('GET', `/ncc/adgroups?nccCampaignId=${campaignId}`);
  }

  // ── 키워드 조회 ──
  async getKeywords(adGroupId: string) {
    return this.requestWithRetry<any[]>('GET', `/ncc/keywords?nccAdgroupId=${adGroupId}`);
  }

  // ── 키워드별 통계 조회 ──
  async getKeywordStats(keywordIds: string[], startDate: string, endDate: string) {
    return this.requestWithRetry<any[]>('POST', '/stats', {
      ids: keywordIds,
      fields: ['clkCnt', 'impCnt', 'cpc', 'ccnt', 'salesAmt', 'convAmt'],
      timeRange: { since: startDate, until: endDate },
    });
  }

  // ── 입찰가 변경 ──
  async updateBid(keywordId: string, bidAmt: number) {
    return this.requestWithRetry<any>('PUT', `/ncc/keywords/${keywordId}`, {
      nccKeywordId: keywordId,
      bidAmt,
    });
  }

  // ── 캠페인 통계 조회 ──
  async getCampaignStats(campaignIds: string[], startDate: string, endDate: string) {
    return this.requestWithRetry<any[]>('POST', '/stats', {
      ids: campaignIds,
      fields: ['clkCnt', 'impCnt', 'cpc', 'ccnt', 'salesAmt', 'convAmt', 'viewCnt'],
      timeRange: { since: startDate, until: endDate },
    });
  }

  // ── 키워드 ON/OFF ──
  async setKeywordStatus(keywordId: string, userLock: boolean) {
    return this.requestWithRetry<any>('PUT', `/ncc/keywords/${keywordId}`, {
      nccKeywordId: keywordId,
      userLock,
    });
  }

  // ── 캠페인 예산 변경 ──
  async updateCampaignBudget(campaignId: string, dailyBudget: number) {
    return this.requestWithRetry<any>('PUT', `/ncc/campaigns/${campaignId}`, {
      nccCampaignId: campaignId,
      dailyBudget,
    });
  }
}

// ── 편의 팩토리 함수 ──
export function createNaverAdsClient(
  customerId: string,
  apiKey: string,
  secretKey: string,
): NaverAdsClient {
  return new NaverAdsClient(customerId, apiKey, secretKey);
}
