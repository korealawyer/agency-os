import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { apiResponse, apiError, withErrorHandler, logAudit } from '@/lib/api-helpers';
import { authRateLimit, checkRateLimit, getClientIp } from '@/lib/rate-limit';

const signupSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해 주세요.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
  name: z.string().min(1, '이름을 입력해 주세요.').max(100),
  organizationName: z.string().min(1, '에이전시 이름을 입력해 주세요.').max(200),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  // ──── Rate Limiting (IP 기반) ────
  const ip = getClientIp(req.headers);
  const { success } = await checkRateLimit(authRateLimit, ip);
  if (!success) {
    return apiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429);
  }

  const body = await req.json();
  const { email, password, name, organizationName } = signupSchema.parse(body);

  // 이메일 중복 확인
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new Error('DUPLICATE_EMAIL');
  }

  // 비밀번호 해싱
  const passwordHash = await bcrypt.hash(password, 12);

  // 트랜잭션: Organization + User + Subscription 동시 생성
  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        planType: 'starter',
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'owner', // 첫 번째 사용자는 자동으로 owner
        organizationId: organization.id,
      },
    });

    // 트라이얼 구독 자동 생성 (14일)
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await tx.subscription.create({
      data: {
        organizationId: organization.id,
        planType: 'starter',
        status: 'trialing',
        monthlyPrice: 0,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      organization: {
        id: organization.id,
        name: organization.name,
      },
    };
  });

  // 감사 로그 (비차단)
  logAudit({
    userId: result.user.id,
    organizationId: result.organization.id,
    action: 'CREATE',
    entityType: 'User',
    entityId: result.user.id,
    newValues: { email, name, organizationName },
  });

  return apiResponse(result, 201);
});
