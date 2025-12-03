import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ViewerClient from "./ViewerClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  
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

  if (!manual || !manual.isPublished) {
    return {
      title: "매뉴얼 보기 - Interactive Manual Maker",
    };
  }

  const firstSection = manual.sections[0];
  const sectionTitle = firstSection?.title || "새 섹션";
  
  return {
    title: `${sectionTitle} - ${manual.title}`,
    description: `${manual.title} 매뉴얼을 확인합니다`,
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

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  if (!manual || !manual.isPublished) {
    notFound();
  }

  await prisma.manual.update({
    where: { id },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });

  return <ViewerClient manual={manual} sections={manual.sections.map(transformSection)} />;
}

