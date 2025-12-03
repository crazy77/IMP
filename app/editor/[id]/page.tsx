import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import EditorClient from "./EditorClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  
  if (id === "new") {
    return {
      title: "새 매뉴얼 작성 - Interactive Manual Maker",
      description: "새 매뉴얼을 작성합니다",
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      title: "매뉴얼 편집 - Interactive Manual Maker",
    };
  }

  const manual = await prisma.manual.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: {
          orderIndex: "asc",
        },
        take: 1,
      },
    },
  });

  if (!manual) {
    return {
      title: "매뉴얼 편집 - Interactive Manual Maker",
    };
  }

  const firstSection = manual.sections[0];
  const sectionTitle = firstSection?.title || "새 섹션";
  
  return {
    title: `${sectionTitle} - ${manual.title}`,
    description: `${manual.title} 매뉴얼을 편집합니다`,
  };
}

type SectionWithAnnotations = {
  id: string;
  manualId: string;
  parentId: string | null;
  title: string;
  orderIndex: number;
  contentMd: string;
  imageUrl: string | null;
  annotations: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    label?: string;
  }> | null;
};

function transformSection(section: Prisma.SectionGetPayload<{}>): SectionWithAnnotations {
  return {
    ...section,
    annotations: section.annotations as SectionWithAnnotations['annotations'],
  };
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  if (id === "new") {
    const defaultSection: SectionWithAnnotations = {
      id: `temp-${Date.now()}`,
      manualId: "",
      parentId: null,
      title: "새 섹션 1",
      orderIndex: 0,
      contentMd: "",
      imageUrl: null,
      annotations: null,
    };
    return <EditorClient manual={null} sections={[defaultSection]} />;
  }

  const manual = await prisma.manual.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
  });

  if (!manual || manual.authorId !== session.user.id) {
    redirect("/dashboard");
  }

  return <EditorClient manual={manual} sections={manual.sections.map(transformSection)} />;
}

