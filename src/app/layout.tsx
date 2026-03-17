import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "AdAgency OS — 광고 대행사 AI 운영 플랫폼",
  description: "네이버 검색광고 대행사의 전체 업무를 AI가 운영하는 올인원 SaaS 플랫폼. 30개 계정 통합 관리, AI 자동 입찰, 리포트 자동 발송.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
