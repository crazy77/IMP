import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SignInButton from "./SignInButton";
import ThemeToggle from "@/components/ThemeToggle";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interactive Manual Maker",
  description: "이미지와 텍스트가 유기적으로 연결된 고품질 매뉴얼 작성 플랫폼",
};

export default async function Home() {
  const session = await auth();
  
  if (session) {
    redirect("/dashboard");
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-white dark:bg-gray-900">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
        Interactive Manual Maker
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
        이미지와 텍스트가 유기적으로 연결된 고품질 매뉴얼을 작성하세요
      </p>
      <SignInButton />
    </div>
  );
}

