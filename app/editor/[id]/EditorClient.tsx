"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Manual, Section, Prisma } from "@prisma/client";
import ImageCanvas from "@/components/ImageCanvas";
import MarkdownEditor from "@/components/MarkdownEditor";
import TableOfContents from "@/components/TableOfContents";
import SplitPane from "@/components/SplitPane";
import ThemeToggle from "@/components/ThemeToggle";
import {
  insertAnnotationToMarkdown,
  updateAnnotationInMarkdown,
  removeAnnotationFromMarkdown,
} from "@/lib/markdownUtils";

interface Annotation {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  number?: number;
}

type SectionWithAnnotations = Omit<Section, 'annotations'> & {
  annotations: Annotation[] | null;
};

interface EditorClientProps {
  manual: Manual | null;
  sections: SectionWithAnnotations[];
}

export default function EditorClient({ manual, sections: initialSections }: EditorClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(manual?.title || "");
  const [isPublished, setIsPublished] = useState(manual?.isPublished || false);
  const [sections, setSections] = useState<SectionWithAnnotations[]>(initialSections);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [splitRatio, setSplitRatio] = useState(70);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const markdownEditorRef = useRef<any>(null);

  const activeSection = sections[activeSectionIndex] || null;

  const handleAddSection = () => {
    const newSection: SectionWithAnnotations = {
      id: `temp-${Date.now()}`,
      manualId: manual?.id || "",
      parentId: null,
      title: `새 섹션 ${sections.length + 1}`,
      orderIndex: sections.length,
      contentMd: "",
      imageUrl: null,
      annotations: null,
    } as SectionWithAnnotations;
    setSections([...sections, newSection]);
    setActiveSectionIndex(sections.length);
  };

  const handleUpdateSection = (index: number, updates: Partial<SectionWithAnnotations>) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], ...updates };
    setSections(updated);
  };

  // 어노테이션 변경 시 마크다운 동기화
  const handleAnnotationsChange = (annotations: Annotation[]) => {
    const oldAnnotations = activeSection?.annotations || [];
    const editor = markdownEditorRef.current;

    // 에디터에서 현재 존재하는 어노테이션 번호 추출
    const existingNumbers = new Set<number>();
    if (editor) {
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === "annotation") {
          existingNumbers.add(node.attrs.number);
        }
      });
    }

    // 새로 추가된 어노테이션 찾기 (ID로 비교)
    const newAnnotations = annotations.filter(
      (ann) => !oldAnnotations.find((old) => old.id === ann.id)
    );

    // 삭제된 어노테이션 찾기 (ID로 비교)
    const deletedAnnotations = oldAnnotations.filter(
      (old) => !annotations.find((ann) => ann.id === old.id)
    );

    // 번호가 변경된 어노테이션 찾기
    const updatedAnnotations = annotations.filter((ann) => {
      const old = oldAnnotations.find((o) => o.id === ann.id);
      return old && old.number !== ann.number;
    });

    // 새 어노테이션 추가 (에디터에 없을 때만)
    newAnnotations.forEach((ann) => {
      if (ann.number && !existingNumbers.has(ann.number)) {
        if (editor) {
          // 에디터에 줄넘김 후 어노테이션 추가
          const currentContent = editor.state.doc.textContent;
          const needsLineBreak = currentContent.length > 0 && !currentContent.endsWith("\n\n");
          
          if (needsLineBreak) {
            editor.commands.insertContent("\n\n");
          }
          
          // 어노테이션 삽입
          editor.commands.insertAnnotation(ann.number);
          
          // 방금 삽입한 어노테이션 노드 뒤로 커서 이동
          setTimeout(() => {
            let annotationPos = -1;
            editor.state.doc.descendants((node: any, pos: number) => {
              if (node.type.name === "annotation" && node.attrs.number === ann.number) {
                annotationPos = pos + node.nodeSize;
                return false; // 첫 번째 매칭만 찾으면 중단
              }
            });
            
            if (annotationPos >= 0) {
              editor.commands.setTextSelection(annotationPos);
              editor.commands.focus();
            }
          }, 0);
          
          // 마크다운은 onUpdate에서 자동으로 업데이트됨
        }
      }
    });

    // 삭제된 어노테이션 제거
    deletedAnnotations.forEach((ann) => {
      if (ann.number && existingNumbers.has(ann.number)) {
        if (editor) {
          editor.commands.removeAnnotation(ann.number);
          // 마크다운은 onUpdate에서 자동으로 업데이트됨
        }
      }
    });

    // 번호 변경된 어노테이션 업데이트
    updatedAnnotations.forEach((ann) => {
      const old = oldAnnotations.find((o) => o.id === ann.id);
      if (old?.number && ann.number && existingNumbers.has(old.number)) {
        if (editor) {
          editor.commands.updateAnnotation(old.number, ann.number);
          // 마크다운은 onUpdate에서 자동으로 업데이트됨
        }
      }
    });

    // 어노테이션만 업데이트 (마크다운은 onUpdate에서 자동으로 업데이트됨)
    // contentMd를 여기서 업데이트하면 useEffect가 트리거되어 에디터 내용이 덮어씌워질 수 있음
    handleUpdateSection(activeSectionIndex, { 
      annotations,
    });
  };

  // 어노테이션 클릭 핸들러 (쓰기 화면에서는 하이라이트 없이 동작)
  const handleAnnotationClick = (number: number) => {
    // 쓰기 화면에서는 하이라이트 기능 제거 (성능 최적화)
  };

  // 마크다운 어노테이션 클릭 핸들러 (쓰기 화면에서는 하이라이트 없이 동작)
  const handleMarkdownAnnotationClick = (number: number) => {
    // 쓰기 화면에서는 하이라이트 기능 제거 (성능 최적화)
  };

  const handleDeleteSection = (index: number) => {
    if (sections.length <= 1) {
      alert("최소 하나의 섹션이 필요합니다.");
      return;
    }
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
    if (activeSectionIndex >= updated.length) {
      setActiveSectionIndex(updated.length - 1);
    }
  };

  const handleImageUpload = async (file: File, sectionIndex: number) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      handleUpdateSection(sectionIndex, { imageUrl: data.url });
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      alert("이미지 업로드에 실패했습니다.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const url = manual
        ? `/api/manuals/${manual.id}/update`
        : "/api/manuals";
      
      const method = manual ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          isPublished,
          thumbnailUrl: sections[0]?.imageUrl || null,
          sections: sections.map((s, i) => ({
            ...s,
            orderIndex: i,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("저장 실패");
      }

      const data = await response.json();
      
      if (!manual) {
        router.push(`/editor/${data.id}`);
        router.refresh();
      } else {
        router.refresh();
      }
      
      alert("저장되었습니다!");
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!manual || !isPublished) {
      alert("먼저 매뉴얼을 게시해야 합니다.");
      return;
    }
    const link = `${window.location.origin}/share/${manual.id}`;
    await navigator.clipboard.writeText(link);
    alert("공유 링크가 복사되었습니다!");
  };

  const handlePrevious = () => {
    if (activeSectionIndex > 0) {
      setActiveSectionIndex(activeSectionIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeSectionIndex < sections.length - 1) {
      setActiveSectionIndex(activeSectionIndex + 1);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              ← 대시보드
            </Link>
            <div className="flex-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="매뉴얼 제목"
                className="text-2xl font-bold border-none outline-none w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              {manual && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  최종 수정일: {new Date(manual.updatedAt).toLocaleString("ko-KR")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {isPublished ? "공개됨" : "비공개"}
              </span>
            </label>
            {isPublished && (
              <button
                onClick={handleCopyShareLink}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                공유 링크 복사
              </button>
            )}
            <ThemeToggle />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!isSidebarCollapsed && (
          <aside className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
            <TableOfContents
              sections={sections}
              activeIndex={activeSectionIndex}
              onSelect={setActiveSectionIndex}
              onAdd={handleAddSection}
              onDelete={handleDeleteSection}
              onCollapse={() => setIsSidebarCollapsed(true)}
            />
          </aside>
        )}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 p-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-r-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="목차 펼치기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <SplitPane
          defaultRatio={splitRatio}
          onRatioChange={setSplitRatio}
          left={
            activeSection ? (
              <ImageCanvas
                imageUrl={activeSection.imageUrl}
                annotations={activeSection.annotations || []}
                onImageUpload={(file) => handleImageUpload(file, activeSectionIndex)}
                onAnnotationsChange={handleAnnotationsChange}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                섹션을 선택하세요
              </div>
            )
          }
          right={
            activeSection ? (
              <MarkdownEditor
                content={activeSection.contentMd}
                onChange={(content) =>
                  handleUpdateSection(activeSectionIndex, { contentMd: content })
                }
                onTitleChange={(newTitle) =>
                  handleUpdateSection(activeSectionIndex, { title: newTitle })
                }
                title={activeSection.title}
                editorRef={markdownEditorRef}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                섹션을 선택하세요
              </div>
            )
          }
        />
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 flex items-center justify-between">
        {activeSectionIndex > 0 ? (
          <button
            onClick={handlePrevious}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {sections[activeSectionIndex - 1]?.title || `섹션 ${activeSectionIndex}`}
          </button>
        ) : (
          <div></div>
        )}
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {activeSectionIndex + 1} / {sections.length}
        </span>
        {activeSectionIndex < sections.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            {sections[activeSectionIndex + 1]?.title || `섹션 ${activeSectionIndex + 2}`}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div></div>
        )}
      </div>
    </div>
  );
}

