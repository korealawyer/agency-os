import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/db';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// ──── 응답 유틸리티 ────

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { error: { message, ...(details ? { details } : {}) } },
    { status }
  );
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
}

// ──── 인증 유틸리티 ────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  organizationId: string;
}

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.id || !token.organizationId) {
    throw new UnauthorizedError('인증이 필요합니다. 로그인해 주세요.');
  }

  return {
    id: token.id as string,
    email: token.email as string,
    name: token.name as string,
    role: token.role as AuthUser['role'],
    organizationId: token.organizationId as string,
  };
}

export function requireRole(user: AuthUser, ...roles: AuthUser['role'][]) {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError('이 작업을 수행할 권한이 없습니다.');
  }
}

// ──── 페이지네이션 ────

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ──── 요청 바디 파싱 ────

export async function safeParseBody<T>(req: NextRequest): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw new BadRequestError('요청 바디가 유효한 JSON이 아닙니다.');
  }
}

// ──── 커스텀 에러 클래스 ────

export class UnauthorizedError extends Error {
  constructor(message = '인증이 필요합니다.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = '권한이 없습니다.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class BadRequestError extends Error {
  constructor(message = '잘못된 요청입니다.') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class NotFoundError extends Error {
  constructor(message = '리소스를 찾을 수 없습니다.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message = '동시 수정 충돌이 발생했습니다. 새로고침 후 다시 시도해주세요.') {
    super(message);
    this.name = 'ConflictError';
  }
}

// ──── 글로벌 에러 핸들러 ────

type ApiHandler = (req: NextRequest, context?: any) => Promise<NextResponse>;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error: any) {
      console.error(`[API Error] ${req.method} ${req.url}:`, error);

      // Zod 유효성 검사 에러
      if (error instanceof ZodError) {
        return apiError('입력 데이터가 유효하지 않습니다.', 422, error.flatten());
      }

      // 커스텀 에러
      if (error instanceof UnauthorizedError) {
        return apiError(error.message, 401);
      }
      if (error instanceof ForbiddenError) {
        return apiError(error.message, 403);
      }
      if (error instanceof BadRequestError) {
        return apiError(error.message, 400);
      }
      if (error instanceof NotFoundError) {
        return apiError(error.message, 404);
      }
      if (error instanceof ConflictError) {
        return apiError(error.message, 409);
      }

      // DUPLICATE_EMAIL 에러 매핑 (회원가입 시)
      if (error.message === 'DUPLICATE_EMAIL') {
        return apiError('이미 등록된 이메일입니다.', 409);
      }

      // Prisma 에러
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002': // Unique constraint violation
            return apiError('중복된 데이터가 존재합니다.', 409);
          case 'P2025': // Record not found
            return apiError('데이터를 찾을 수 없습니다.', 404);
          case 'P2003': // Foreign key constraint failed
            return apiError('참조하는 데이터가 존재하지 않습니다.', 400);
          default:
            return apiError('데이터베이스 오류가 발생했습니다.', 500);
        }
      }

      // 멀티테넌트 미들웨어 에러
      if (error.message?.includes('[SECURITY]')) {
        console.error('[CRITICAL SECURITY]', error.message);
        return apiError('접근이 거부되었습니다.', 403);
      }

      // 기타 서버 에러
      return apiError('서버 내부 오류가 발생했습니다.', 500);
    }
  };
}

// ──── 감사 로그 ────

export async function logAudit(params: {
  userId?: string;
  organizationId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    // 90일 후 자동 삭제용 expiresAt 설정
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await prisma.auditLog.create({
      data: {
        ...(params as any),
        expiresAt,
      },
    });
  } catch (error) {
    // 감사 로그 실패는 주 로직을 중단시키지 않음
    console.error('[AuditLog] Failed to create:', error);
  }
}
