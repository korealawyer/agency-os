import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireSuperAdmin, withErrorHandler } from '@/lib/api-helpers';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const dbCheck = await prisma.$queryRaw`SELECT 1 as ok` as any[];

  const [orgCount, userCount, keywordCount, campaignCount] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.keyword.count(),
    prisma.campaign.count(),
  ]);

  return apiResponse({
    database: { status: dbCheck?.length > 0 ? 'healthy' : 'error' },
    counts: { organizations: orgCount, users: userCount, keywords: keywordCount, campaigns: campaignCount },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
    },
    timestamp: new Date().toISOString(),
  });
});
