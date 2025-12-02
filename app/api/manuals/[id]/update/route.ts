import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateManualSchema = z.object({
  title: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
  thumbnailUrl: z.string().optional(),
  sections: z.array(z.any()).optional(),
});

export async function PUT(
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
    const data = updateManualSchema.parse(body);

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;
    if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;

    const updatedManual = await prisma.manual.update({
      where: { id },
      data: updateData,
    });

    if (data.sections) {
      await prisma.section.deleteMany({
        where: { manualId: id },
      });

      await prisma.section.createMany({
        data: data.sections.map((section: any, index: number) => ({
          manualId: id,
          parentId: section.parentId || null,
          title: section.title,
          orderIndex: section.orderIndex ?? index,
          contentMd: section.contentMd || "",
          imageUrl: section.imageUrl || null,
          annotations: section.annotations || null,
        })),
      });
    }

    return NextResponse.json(updatedManual);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Update manual error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

