import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiResponse, requireAuth, withErrorHandler, safeParseBody } from '@/lib/api-helpers';

const simulateSchema = z.object({
  industry: z.string().min(1),
  budget: z.number().int().min(100000),
  keywords: z.array(z.string()).min(1).max(50),
});

const industryDefaults: Record<string, { avgCpc: number; convRate: number }> = {
  '법률': { avgCpc: 890, convRate: 0.035 },
  '의료/성형': { avgCpc: 1800, convRate: 0.025 },
  '교육': { avgCpc: 420, convRate: 0.045 },
  '부동산': { avgCpc: 650, convRate: 0.03 },
  '인테리어': { avgCpc: 580, convRate: 0.032 },
};

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);

  const body = await safeParseBody(req);
  const data = simulateSchema.parse(body);

  const ind = industryDefaults[data.industry] || { avgCpc: 700, convRate: 0.03 };
  const clicks = Math.round(data.budget / ind.avgCpc);
  const impressions = Math.round(clicks / 0.05);
  const conversions = Math.round(clicks * ind.convRate);
  const roas = conversions > 0 ? Math.round((conversions * 150000) / data.budget * 100) : 0;

  const result = {
    industry: data.industry,
    budget: data.budget,
    keywordCount: data.keywords.length,
    impressions: { low: Math.round(impressions * 0.8), high: Math.round(impressions * 1.2) },
    clicks: { low: Math.round(clicks * 0.75), high: Math.round(clicks * 1.25) },
    conversions: { low: Math.max(1, Math.round(conversions * 0.6)), high: Math.round(conversions * 1.4) },
    roas: { low: Math.round(roas * 0.75), high: Math.round(roas * 1.3) },
    cpc: { low: Math.round(ind.avgCpc * 0.7), high: Math.round(ind.avgCpc * 1.15) },
    keywordBreakdown: data.keywords.slice(0, 10).map((kw, i) => ({
      keyword: kw,
      estimatedConversions: Math.max(1, Math.round((conversions / data.keywords.length) * (1 + Math.sin(i) * 0.5))),
      estimatedCpc: Math.round(ind.avgCpc * (0.8 + Math.random() * 0.4)),
    })),
  };

  return apiResponse(result);
});
