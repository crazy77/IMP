"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Manual, Section, Prisma } from "@prisma/client";
import toast from "react-hot-toast";
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

// localStorage 키
const STORAGE_KEY_SPLIT_RATIO = "imm-editor-split-ratio";
const STORAGE_KEY_SIDEBAR_COLLAPSED = "imm-editor-sidebar-collapsed";

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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [splitRatio, setSplitRatio] = useState(70);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const markdownEditorRef = useRef<any>(null);
  const isUpdatingFromHashRef = useRef(false);

  // localStorage에서 초기값 로드 (클라이언트에서만)
  useEffect(() => {
    const savedSplitRatio = localStorage.getItem(STORAGE_KEY_SPLIT_RATIO);
    if (savedSplitRatio) {
      setSplitRatio(parseInt(savedSplitRatio, 10));
    }
    const savedSidebarCollapsed = localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED);
    if (savedSidebarCollapsed === "true") {
      setIsSidebarCollapsed(true);
    }
  }, []);

  // splitRatio 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SPLIT_RATIO, splitRatio.toString());
  }, [splitRatio]);

  // isSidebarCollapsed 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // URL 해시에서 섹션 ID 읽기 및 해당 섹션으로 이동
  useEffect(() => {
    const handleHashChange = () => {
      // 프로그래밍 방식 업데이트 중이면 무시
      if (isUpdatingFromHashRef.current) {
        return;
      }

      const hash = window.location.hash.slice(1); // # 제거
      if (hash) {
        const sectionIndex = sections.findIndex((s) => s.id === hash);
        if (sectionIndex !== -1) {
          setActiveSectionIndex((prevIndex) => {
            if (prevIndex !== sectionIndex) {
              // 스크롤을 맨 위로 이동
              window.scrollTo(0, 0);
              return sectionIndex;
            }
            return prevIndex;
          });
        }
      }
    };

    // 초기 로드 시 해시 확인
    handleHashChange();

    // 해시 변경 감지
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [sections]);

  // activeSectionIndex 변경 시 URL 해시 업데이트
  useEffect(() => {
    const currentSection = sections[activeSectionIndex];
    if (currentSection && manual?.id) {
      const newHash = `#${currentSection.id}`;
      if (window.location.hash !== newHash) {
        // 프로그래밍 방식 업데이트 플래그 설정
        isUpdatingFromHashRef.current = true;
        // history.pushState를 사용하여 페이지 리로드 없이 URL 업데이트
        window.history.pushState(null, "", newHash);
        // 다음 이벤트 루프에서 플래그 해제
        setTimeout(() => {
          isUpdatingFromHashRef.current = false;
        }, 0);
      }
    }
  }, [activeSectionIndex, sections, manual?.id]);

  const activeSection = sections[activeSectionIndex] || null;

  // 활성 섹션 변경 시 document.title 업데이트
  useEffect(() => {
    if (manual && activeSection) {
      document.title = `${activeSection.title} - ${manual.title}`;
    } else if (manual) {
      document.title = `${manual.title} 편집 - Interactive Manual Maker`;
    }
  }, [activeSection, manual]);

  const handleAddSection = async (parentId: string | null = null) => {
    // 매뉴얼이 없으면 먼저 매뉴얼을 생성
    let manualId = manual?.id;
    if (!manualId) {
      try {
        const createResponse = await fetch("/api/manuals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "새 매뉴얼",
          }),
        });

        if (!createResponse.ok) {
          throw new Error("매뉴얼 생성 실패");
        }

        const newManual = await createResponse.json();
        manualId = newManual.id;
        
        // router를 사용하여 새 매뉴얼 페이지로 이동
        router.push(`/editor/${manualId}`);
        router.refresh();
        
        // 매뉴얼이 생성되었으므로 잠시 대기 후 섹션 추가
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error("매뉴얼 생성 실패:", error);
        toast.error("매뉴얼 생성에 실패했습니다.");
        return;
      }
    }

    try {
      // 새 섹션을 즉시 서버에 저장하여 실제 ID 받아오기
      // parentId를 순수 값으로 변환
      const parentIdValue = parentId && typeof parentId === 'string' ? parentId : null;
      
      const requestBody = {
        parentId: parentIdValue,
        title: `새 섹션 ${sections.length + 1}`,
        orderIndex: sections.length,
        contentMd: "",
        imageUrl: null,
        annotations: null,
      };

      const response = await fetch(`/api/manuals/${manualId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("섹션 추가 실패");
      }

      const newSection = await response.json();
      
      // 실제 ID를 가진 섹션으로 추가
      const sectionWithAnnotations: SectionWithAnnotations = {
        ...newSection,
        annotations: newSection.annotations as Annotation[] | null,
      };
      
      setSections([...sections, sectionWithAnnotations]);
      setActiveSectionIndex(sections.length);
      
      // 매뉴얼이 새로 생성된 경우 페이지 새로고침하여 최신 데이터 로드
      if (!manual?.id) {
        router.refresh();
      }
    } catch (error) {
      console.error("섹션 추가 실패:", error);
      toast.error("섹션 추가에 실패했습니다.");
    }
  };

  const handleSetParent = (sectionIndex: number, parentId: string | null) => {
    const updated = [...sections];
    const section = updated[sectionIndex];
    
    if (parentId) {
      // 하위로 만들기: 부모 섹션 찾기
      const parentSection = updated.find(s => s.id === parentId);
      if (parentSection) {
        // 같은 부모를 가진 다른 자식 섹션들 찾기
        const siblings = updated.filter(s => s.parentId === parentId && s.id !== section.id);
        
        // 부모의 orderIndex를 기준으로 자식 섹션들의 orderIndex 설정
        // 부모 바로 다음에 오도록 (부모의 orderIndex + 0.1, 0.2, ...)
        const sortedSiblings = siblings.sort((a, b) => a.orderIndex - b.orderIndex);
        
        // 현재 섹션을 부모의 첫 번째 자식으로 설정
        updated[sectionIndex] = { 
          ...section, 
          parentId,
          orderIndex: parentSection.orderIndex + 0.1 
        };
        
        // 다른 형제들의 orderIndex 조정
        sortedSiblings.forEach((sibling, idx) => {
          const siblingIndex = updated.findIndex(s => s.id === sibling.id);
          if (siblingIndex !== -1) {
            updated[siblingIndex] = {
              ...updated[siblingIndex],
              orderIndex: parentSection.orderIndex + (idx + 2) * 0.1
            };
          }
        });
      }
    } else {
      // 상위로 올리기: 기존 부모의 자식들 리스트 다음에 위치
      const oldParentId = section.parentId;
      if (oldParentId) {
        // 기존 부모 섹션 찾기
        const oldParent = updated.find(s => s.id === oldParentId);
        if (oldParent) {
          // 부모의 orderIndex를 정수로 변환하고 +1
          // 예: 부모가 orderIndex 0이면, 상위로 올린 섹션은 orderIndex 1
          const parentOrderIndex = Math.floor(oldParent.orderIndex);
          const newOrderIndex = parentOrderIndex + 1;
          
          updated[sectionIndex] = { 
            ...section, 
            parentId: null,
            orderIndex: newOrderIndex 
          };
        } else {
          // 부모를 찾을 수 없으면 정수로 변환하고 +1
          updated[sectionIndex] = { 
            ...section, 
            parentId: null,
            orderIndex: Math.floor(section.orderIndex) + 1
          };
        }
      } else {
        // 이미 상위 섹션이면 그대로 유지
        updated[sectionIndex] = { 
          ...section, 
          parentId: null,
          orderIndex: Math.floor(section.orderIndex)
        };
      }
    }
    
    setSections(updated);
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
      toast.error("최소 하나의 섹션이 필요합니다.");
      return;
    }
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
    if (activeSectionIndex >= updated.length) {
      setActiveSectionIndex(updated.length - 1);
    }
  };

  const handleReorderSections = (fromIndex: number, toIndex: number) => {
    const updated = [...sections];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    
    // orderIndex 업데이트
    const reordered = updated.map((section, index) => ({
      ...section,
      orderIndex: index,
    }));
    
    setSections(reordered);
    
    // 활성 섹션 인덱스 업데이트
    if (activeSectionIndex === fromIndex) {
      setActiveSectionIndex(toIndex);
    } else if (activeSectionIndex === toIndex && fromIndex < toIndex) {
      setActiveSectionIndex(activeSectionIndex - 1);
    } else if (activeSectionIndex === toIndex && fromIndex > toIndex) {
      setActiveSectionIndex(activeSectionIndex + 1);
    } else if (activeSectionIndex > fromIndex && activeSectionIndex < toIndex) {
      setActiveSectionIndex(activeSectionIndex - 1);
    } else if (activeSectionIndex < fromIndex && activeSectionIndex > toIndex) {
      setActiveSectionIndex(activeSectionIndex + 1);
    }
  };

  const handleImageUpload = async (file: File, sectionIndex: number) => {
    setIsUploadingImage(true);
    const toastId = toast.loading("이미지 업로드 중...");
    
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
      toast.success("이미지가 업로드되었습니다.", { id: toastId });
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      toast.error("이미지 업로드에 실패했습니다.", { id: toastId });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageDelete = (sectionIndex: number) => {
    if (confirm("이미지를 삭제하시겠습니까? 어노테이션도 함께 삭제됩니다.")) {
      handleUpdateSection(sectionIndex, { 
        imageUrl: null,
        annotations: null 
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading("저장 중...");
    
    try {
      const url = manual
        ? `/api/manuals/${manual.id}/update`
        : "/api/manuals";
      
      const method = manual ? "PUT" : "POST";

      // 순환 참조 방지를 위해 필요한 필드만 추출하고 깊은 복사
      const sectionsData = sections.map((s, i) => {
        // 각 필드를 명시적으로 추출하여 순환 참조 제거
        // parentId를 문자열로 변환 (null이 아닌 경우에만)
        const parentIdValue = s.parentId 
          ? (typeof s.parentId === 'string' ? s.parentId : String(s.parentId))
          : null;
        
        const sectionData: any = {
          id: s.id && typeof s.id === 'string' && s.id.startsWith('temp-') ? undefined : String(s.id || ""),
          manualId: String(s.manualId || ""),
          parentId: parentIdValue,
          title: String(s.title || ""),
          orderIndex: typeof s.orderIndex === 'number' ? s.orderIndex : i,
          contentMd: String(s.contentMd || ""),
          imageUrl: s.imageUrl ? String(s.imageUrl) : null,
        };
        
        // annotations는 깊은 복사
        if (s.annotations && Array.isArray(s.annotations)) {
          sectionData.annotations = s.annotations.map((ann: any) => ({
            id: String(ann.id || ""),
            x: typeof ann.x === 'number' ? ann.x : 0,
            y: typeof ann.y === 'number' ? ann.y : 0,
            w: typeof ann.w === 'number' ? ann.w : 0,
            h: typeof ann.h === 'number' ? ann.h : 0,
            label: ann.label ? String(ann.label) : undefined,
            number: typeof ann.number === 'number' ? ann.number : undefined,
          }));
        } else {
          sectionData.annotations = null;
        }
        
        return sectionData;
      });

      // thumbnailUrl도 순수 값으로 추출
      const thumbnailUrl = sections.length > 0 && sections[0].imageUrl 
        ? String(sections[0].imageUrl) 
        : null;

      const requestBody = {
        title: String(title || ""),
        isPublished: Boolean(isPublished),
        thumbnailUrl,
        sections: sectionsData,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("저장 실패 상세:", errorData);
        throw new Error(errorData.error || `저장 실패 (${response.status})`);
      }

      const data = await response.json();
      
      if (!manual) {
        router.push(`/editor/${data.id}`);
        router.refresh();
      } else {
        // 저장 후 섹션 ID 매핑을 사용하여 모든 섹션의 에디터 링크 업데이트
        if (data.sectionIdMap) {
          // 모든 섹션의 contentMd에서 temp- ID를 실제 ID로 교체
          const updatedSections = sections.map((section, index) => {
            let updatedContentMd = section.contentMd;
            
            // temp- ID를 실제 ID로 교체
            for (const [tempId, realId] of Object.entries(data.sectionIdMap)) {
              if (tempId.startsWith('temp-') && typeof realId === 'string') {
                // href="#temp-xxx"를 href="#realId"로 교체
                const regex = new RegExp(`href="#${tempId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
                updatedContentMd = updatedContentMd.replace(regex, `href="#${realId}"`);
              }
            }
            
            if (updatedContentMd !== section.contentMd) {
              return { ...section, contentMd: updatedContentMd };
            }
            return section;
          });
          
          // 변경된 섹션이 있으면 업데이트
          const hasChanges = updatedSections.some((s, i) => s.contentMd !== sections[i].contentMd);
          if (hasChanges) {
            setSections(updatedSections);
            
            // 현재 활성 섹션의 에디터도 업데이트
            if (markdownEditorRef.current?.editor) {
              const activeSection = updatedSections[activeSectionIndex];
              if (activeSection) {
                markdownEditorRef.current.editor.commands.setContent(activeSection.contentMd, { emitUpdate: false });
              }
            }
          }
        }
        
        // 저장 후 업데이트된 섹션 정보를 다시 가져와서 ID 동기화
        router.refresh();
      }
      
      toast.success("저장되었습니다!", { id: toastId });
    } catch (error) {
      console.error("저장 실패:", error);
      toast.error("저장에 실패했습니다.", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!manual || !isPublished) {
      toast.error("먼저 매뉴얼을 게시해야 합니다.");
      return;
    }
    const link = `${window.location.origin}/share/${manual.id}`;
    await navigator.clipboard.writeText(link);
    toast.success("공유 링크가 복사되었습니다!");
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

  const handleCopySectionLink = async (sectionId: string) => {
    if (!manual?.id) {
      toast.error("먼저 매뉴얼을 저장해야 합니다.");
      return;
    }
    const link = `${window.location.origin}/editor/${manual.id}#${sectionId}`;
    await navigator.clipboard.writeText(link);
    setCopiedSectionId(sectionId);
    setTimeout(() => setCopiedSectionId(null), 2000);
    toast.success("섹션 링크가 복사되었습니다!");
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
              onCopyLink={handleCopySectionLink}
              copiedSectionId={copiedSectionId}
              onReorder={handleReorderSections}
              onSetParent={handleSetParent}
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
                onImageDelete={() => handleImageDelete(activeSectionIndex)}
                onAnnotationsChange={handleAnnotationsChange}
                isUploading={isUploadingImage}
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
                sections={sections.map((s) => ({
                  id: s.id,
                  title: s.title,
                  orderIndex: s.orderIndex,
                }))}
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

