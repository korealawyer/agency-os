'use client';

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr';

// ──── Fetcher ────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    const err = new Error(body.error?.message || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
};

// ──── Generic Hook ────

export function useApi<T = any>(url: string | null, config?: SWRConfiguration) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<any>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    errorRetryCount: 2,
    ...config,
  });

  return {
    data: (data?.data ?? data) as T | undefined,
    pagination: data?.pagination,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

// ──── Mutation Helper ────

export async function apiMutate<T = any>(
  url: string,
  options: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error(body.error?.message || `요청 실패 (${res.status})`);
  }
  const json = await res.json();
  return json.data ?? json;
}

// ──── Domain Hooks ────

export function useDashboard(period?: string) {
  const params = period ? `?period=${period}` : '';
  return useApi(`/api/dashboard${params}`, {
    refreshInterval: 300_000,
    keepPreviousData: true,  // 기간 변경 시 이전 데이터 유지 (깜박임 방지)
  });
}

export function useHeatmap(period?: string) {
  const params = period ? `?period=${period}` : '';
  return useApi(`/api/dashboard/heatmap${params}`, { refreshInterval: 600_000 });
}

export function useAccounts(page = 1, limit = 20) {
  return useApi(`/api/accounts?page=${page}&limit=${limit}`);
}

export function useCampaigns(page = 1, limit = 20, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return useApi(`/api/campaigns?${params}`);
}

export function useKeywords(page = 1, limit = 50, filters?: Record<string, string>) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), ...filters });
  return useApi(`/api/keywords?${params}`, {
    keepPreviousData: true,
  });
}

export function useAiActions(page = 1, limit = 10, isApproved?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (isApproved !== undefined) params.set('isApproved', isApproved);
  return useApi(`/api/copilot/actions?${params}`);
}

export function useNotifications(page = 1, limit = 20) {
  return useApi(`/api/notifications?page=${page}&limit=${limit}`);
}

export function useAuditLogs(page = 1, limit = 20) {
  return useApi(`/api/audit-logs?page=${page}&limit=${limit}`);
}

export function useProfitability(period?: string) {
  const params = period ? `?period=${period}` : '';
  // TODO: 전용 /api/profitability 엔드포인트 구현 후 교체
  // 현재는 dashboard의 KPI 중 비용/수익 관련 데이터를 활용
  return useApi(`/api/dashboard${params}`, {
    refreshInterval: 600_000,
  });
}

export function useCompetitive() {
  return useApi('/api/competitive');
}

export function useReports(page = 1, limit = 20) {
  return useApi(`/api/reports?page=${page}&limit=${limit}`);
}

export function useReportTemplates() {
  return useApi('/api/reports/templates');
}

export function useClickFraudEvents(page = 1, limit = 20) {
  return useApi(`/api/click-fraud/events?page=${page}&limit=${limit}`);
}

export function useBlockedIps() {
  return useApi('/api/click-fraud/blocked-ips');
}

export function useClickFraudSummary() {
  return useApi('/api/click-fraud/summary');
}

export function useAdGroups(page = 1, limit = 50, campaignId?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (campaignId) params.set('campaignId', campaignId);
  return useApi(`/api/ad-groups?${params}`, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });
}

export function useAds(page = 1, limit = 50, filters?: Record<string, string>) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), ...filters });
  return useApi(`/api/ads?${params}`, {
    keepPreviousData: true,
  });
}

export function useSettings() {
  return useApi('/api/settings');
}

export function useSubscriptions() {
  return useApi('/api/subscriptions');
}

export function useMembers(page = 1, limit = 20) {
  return useApi(`/api/members?page=${page}&limit=${limit}`);
}

export function useSimulator() {
  return useApi('/api/simulator');
}

// ──── Global Mutate Shortcut ────

export function invalidateAll(keyPrefix: string) {
  globalMutate(
    (key: string) => typeof key === 'string' && key.startsWith(keyPrefix),
    undefined,
    { revalidate: true, populateCache: false }
  );
}
