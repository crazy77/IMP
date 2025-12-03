import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateManualSchema = z.object({
  title: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
  thumbnailUrl: z.string().nullable().optional(),
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

    // 섹션 ID 매핑 (temp- ID -> 실제 생성된 ID)
    const sectionIdMap = new Map<string, string>();

    // contentMd에서 temp- ID를 실제 ID로 교체하는 함수
    const replaceTempIdsInContent = (contentMd: string): string => {
      let updatedContent = contentMd;
      for (const [tempId, realId] of sectionIdMap.entries()) {
        if (tempId.startsWith('temp-') && typeof realId === 'string') {
          // href="#temp-xxx"를 href="#realId"로 교체
          const regex = new RegExp(`href="#${tempId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
          updatedContent = updatedContent.replace(regex, `href="#${realId}"`);
        }
      }
      return updatedContent;
    };

    if (data.sections) {
      // 기존 섹션 ID 목록 가져오기
      const existingSections = await prisma.section.findMany({
        where: { manualId: id },
        select: { id: true },
      });
      const existingSectionIds = new Set(existingSections.map(s => s.id));

      // 전송된 섹션 ID 목록
      const sentSectionIds = new Set(
        data.sections
          .map((s: any) => s.id)
          .filter((id: string) => id && typeof id === 'string' && !id.startsWith('temp-'))
      );

      // 삭제할 섹션 (기존에 있지만 전송되지 않은 섹션)
      const idsToDelete = existingSections
        .map(s => s.id)
        .filter(id => !sentSectionIds.has(id));
      
      if (idsToDelete.length > 0) {
        await prisma.section.deleteMany({
          where: {
            id: { in: idsToDelete },
            manualId: id,
          },
        });
      }

      // 기존 섹션 ID 매핑
      for (const existingSection of existingSections) {
        sectionIdMap.set(existingSection.id, existingSection.id);
      }

      // 각 섹션을 업데이트하거나 생성 (부모가 없는 섹션부터 처리)
      const sectionsToProcess = [...data.sections];
      
      // 부모가 없는 섹션을 먼저 처리
      const sectionsWithoutParent = sectionsToProcess.filter((s: any) => {
        const parentId = s.parentId;
        return !parentId || parentId === null || parentId === '';
      });
      const sectionsWithParent = sectionsToProcess.filter((s: any) => {
        const parentId = s.parentId;
        return parentId && parentId !== null && parentId !== '';
      });
      
      // 1단계: 부모가 없는 섹션 처리
      for (const [index, section] of sectionsWithoutParent.entries()) {
        const originalIndex = data.sections.findIndex((s: any) => s === section);
        const sectionData: any = {
          manualId: id,
          parentId: null,
          title: section.title || "",
          orderIndex: section.orderIndex ?? originalIndex,
          contentMd: section.contentMd || "",
          imageUrl: section.imageUrl || null,
        };

        if (section.annotations !== undefined) {
          sectionData.annotations = section.annotations;
        }

        try {
          if (section.id && !section.id.startsWith('temp-') && existingSectionIds.has(section.id)) {
            await prisma.section.update({
              where: { id: section.id },
              data: sectionData,
            });
            sectionIdMap.set(section.id, section.id);
          } else {
            const created = await prisma.section.create({
              data: sectionData,
            });
            // temp- ID를 실제 생성된 ID로 매핑
            if (section.id && section.id.startsWith('temp-')) {
              sectionIdMap.set(section.id, created.id);
            }
            sectionIdMap.set(created.id, created.id);
          }
        } catch (sectionError) {
          console.error(`섹션 ${originalIndex} 저장 실패:`, sectionError);
          throw sectionError;
        }
      }

      // 2단계: 부모가 있는 섹션 처리
      for (const [index, section] of sectionsWithParent.entries()) {
        const originalIndex = data.sections.findIndex((s: any) => s === section);
        
        // parentId를 실제 생성된 ID로 변환
        let resolvedParentId: string | null = null;
        if (section.parentId) {
          // parentId가 문자열인지 확인
          const parentIdStr = typeof section.parentId === 'string' 
            ? section.parentId 
            : String(section.parentId);
          
          // temp- ID인 경우 매핑에서 찾기
          if (parentIdStr.startsWith('temp-')) {
            resolvedParentId = sectionIdMap.get(parentIdStr) || null;
          } else {
            // 기존 ID인 경우 존재 여부 확인
            resolvedParentId = sectionIdMap.has(parentIdStr) ? parentIdStr : null;
          }
          
          // 부모가 아직 생성되지 않았으면 null로 설정 (순환 참조 방지)
          if (!resolvedParentId) {
            console.warn(`부모 섹션 ${parentIdStr}을 찾을 수 없어 parentId를 null로 설정합니다.`);
            resolvedParentId = null;
          }
        }

        const sectionData: any = {
          manualId: id,
          parentId: resolvedParentId,
          title: section.title || "",
          orderIndex: section.orderIndex ?? originalIndex,
          contentMd: section.contentMd || "",
          imageUrl: section.imageUrl || null,
        };

        if (section.annotations !== undefined) {
          sectionData.annotations = section.annotations;
        }

        try {
          if (section.id && !section.id.startsWith('temp-') && existingSectionIds.has(section.id)) {
            await prisma.section.update({
              where: { id: section.id },
              data: sectionData,
            });
            sectionIdMap.set(section.id, section.id);
          } else {
            const created = await prisma.section.create({
              data: sectionData,
            });
            // temp- ID를 실제 생성된 ID로 매핑
            if (section.id && section.id.startsWith('temp-')) {
              sectionIdMap.set(section.id, created.id);
            }
            sectionIdMap.set(created.id, created.id);
          }
        } catch (sectionError) {
          console.error(`섹션 ${originalIndex} 저장 실패:`, sectionError);
          throw sectionError;
        }
      }

      // 3단계: 모든 섹션의 contentMd에서 temp- ID를 실제 ID로 교체
      const allSections = await prisma.section.findMany({
        where: { manualId: id },
      });

      for (const section of allSections) {
        const updatedContentMd = replaceTempIdsInContent(section.contentMd);
        if (updatedContentMd !== section.contentMd) {
          await prisma.section.update({
            where: { id: section.id },
            data: { contentMd: updatedContentMd },
          });
        }
      }
    }

    // 섹션 ID 매핑을 객체로 변환
    const sectionIdMapObj: Record<string, string> = {};
    for (const [tempId, realId] of sectionIdMap.entries()) {
      sectionIdMapObj[tempId] = realId;
    }

    return NextResponse.json({
      ...updatedManual,
      sectionIdMap: sectionIdMapObj,
    });
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

