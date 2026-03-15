import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        // User 테이블은 멀티테넌트 모델이 아니므로 findUnique 사용 가능
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            organizationId: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // 마지막 로그인 시간 업데이트 (비차단)
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(console.error);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8시간
    updateAge: 60 * 60,   // 1시간마다 갱신
  },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      // 최초 로그인 시 user 객체가 전달됨
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
      }

      // 세션 갱신 시(updateAge마다) DB에서 role 재확인
      if (trigger === 'update' || !user) {
        try {
          const dbUser = await prisma.user.findFirst({
            where: { id: token.id as string },
            select: { role: true, isActive: true },
          });
          if (!dbUser || !dbUser.isActive) return null as any; // 비활성 사용자 강제 로그아웃
          token.role = dbUser.role;
        } catch {
          // DB 조회 실패 시 기존 토큰 유지
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
      }
      return session;
    },
  },
});
