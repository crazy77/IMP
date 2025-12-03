import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import dayjs from "dayjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "대시보드 - Interactive Manual Maker",
  description: "매뉴얼 관리 대시보드",
};

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const manuals = await prisma.manual.findMany({
    where: {
      authorId: session.user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      sections: {
        orderBy: {
          orderIndex: "asc",
        },
        take: 1,
      },
    },
  });

  return <DashboardClient manuals={manuals} />;
}

