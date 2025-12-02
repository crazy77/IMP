import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ViewerClient from "./ViewerClient";

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

