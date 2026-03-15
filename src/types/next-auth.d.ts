import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'owner' | 'admin' | 'editor' | 'viewer';
      organizationId: string;
    };
  }

  interface User {
    role?: string;
    organizationId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string;
  }
}
