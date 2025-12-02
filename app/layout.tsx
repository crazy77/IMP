import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Interactive Manual Maker",
  description: "이미지와 텍스트가 유기적으로 연결된 고품질 매뉴얼 작성 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

