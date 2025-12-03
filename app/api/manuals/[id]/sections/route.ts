import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSectionSchema = z.object({
  parentId: z.string().nullable().optional(),
  title: z.string().optional(),
  orderIndex: z.number().optional(),
  contentMd: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  annotations: z.any().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const manual = await prisma.manual.findUnique({
      where: { id },
    });

    if (!manual || manual.authorId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = createSectionSchema.parse(body);

    // parentId가 temp-로 시작하면 null로 설정 (아직 생성되지 않은 섹션)
    let resolvedParentId: string | null = null;
    if (data.parentId && !data.parentId.startsWith('temp-')) {
      // 부모 섹션이 존재하는지 확인
      const parentSection = await prisma.section.findUnique({
        where: { id: data.parentId },
      });
      if (parentSection && parentSection.manualId === id) {
        resolvedParentId = data.parentId;
      }
    }

    const section = await prisma.section.create({
      data: {
        manualId: id,
        parentId: resolvedParentId,
        title: data.title || `새 섹션`,
        orderIndex: data.orderIndex ?? 0,
        contentMd: data.contentMd || "",
        imageUrl: data.imageUrl || null,
        annotations: data.annotations || null,
      },
    });

    return NextResponse.json(section);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Create section error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

