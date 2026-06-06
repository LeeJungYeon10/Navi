import type { Metadata, Viewport } from "next";
import SessionTracker from "@/components/SessionTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "안녕나비야",
  description: "매일 대화하는 온라인 반려묘, 나비와 함께.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FBF7F0",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>
        <SessionTracker />
        {children}
      </body>
    </html>
  );
}
