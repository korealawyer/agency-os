import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { apiResponse, requireAuth, requireRole, withErrorHandler, safeParseBody, NotFoundError, parsePagination, paginatedResponse, logAudit } from '@/lib/api-helpers';

// GET: 조직 멤버 목록
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const members = await prisma.user.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, email: true, name: true, role: true,
      avatarUrl: true, phone: true, isActive: true,
      lastLoginAt: true, createdAt: true,
    },
  });

  return apiResponse(members);
});

// POST: 멤버 초대
const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  temporaryPassword: z.string().min(8),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'owner', 'admin');

  const body = await safeParseBody(req);
  const data = inviteMemberSchema.parse(body);

  // 이메일 중복 확인
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error('DUPLICATE_EMAIL');

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(data.temporaryPassword, 12);

  const member = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      passwordHash,
      organizationId: user.organizationId,
    },
    select: {
      id: true, email: true, name: true, role: true, createdAt: true,
    },
  });

  logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: 'CREATE', entityType: 'User', entityId: member.id,
    newValues: { email: data.email, role: data.role },
  });

  return apiResponse(member, 201);
});
