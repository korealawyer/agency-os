import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClientDashboardLayout from "./ClientDashboardLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 서버사이드 인증 가드 — 세션이 없으면 로그인 페이지로 리다이렉트
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <ClientDashboardLayout>{children}</ClientDashboardLayout>;
}
