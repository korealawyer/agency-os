/**
 * Auth utilities — JWT-like token management with localStorage
 */

const TOKEN_KEY = "agency_os_token";
const USER_KEY = "agency_os_user";

export interface User {
  id: string;
  name: string;
  email: string;
  agency: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

// Demo users (in production, this would be in a database)
const DEMO_USERS: (User & { password: string })[] = [
  { id: "u1", name: "김대행", email: "admin@agency.com", password: "password", agency: "안티그래비티 마케팅", role: "owner" },
  { id: "u2", name: "이마케터", email: "lee@agency.com", password: "password", agency: "안티그래비티 마케팅", role: "admin" },
];

function generateToken(user: User): string {
  const payload = { ...user, exp: Date.now() + 24 * 60 * 60 * 1000 }; // 24h expiry
  return btoa(JSON.stringify(payload));
}

function decodeToken(token: string): (User & { exp: number }) | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp && payload.exp > Date.now()) return payload;
    return null;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): { success: boolean; user?: User; token?: string; error?: string } {
  const found = DEMO_USERS.find((u) => u.email === email);
  if (!found) return { success: false, error: "존재하지 않는 계정입니다." };
  if (found.password !== password) return { success: false, error: "비밀번호가 올바르지 않습니다." };

  const { password: _, ...user } = found;
  const token = generateToken(user);

  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  return { success: true, user, token };
}

export function signup(name: string, email: string, password: string, agency: string): { success: boolean; user?: User; token?: string; error?: string } {
  const existing = DEMO_USERS.find((u) => u.email === email);
  if (existing) return { success: false, error: "이미 등록된 이메일입니다." };

  const newUser: User & { password: string } = {
    id: `u${Date.now()}`,
    name,
    email,
    password,
    agency,
    role: "owner",
  };
  DEMO_USERS.push(newUser);

  const { password: _, ...user } = newUser;
  const token = generateToken(user);

  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  return { success: true, user, token };
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const decoded = decodeToken(token);
  if (!decoded) {
    logout();
    return null;
  }
  return decoded;
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}
