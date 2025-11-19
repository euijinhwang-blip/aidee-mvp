// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import MetricsTracker from "./metrics-tracker"; // ⭐ 추가

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aidee · Product Design Assistant",
  description:
    "Describe your idea in one line and get instant product concept, RFP, and expert-level insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {/* 방문 로그용 클라이언트 컴포넌트 */}
        <MetricsTracker />
        {children}
        <Analytics />
      </body>
    </html>
  );
}

