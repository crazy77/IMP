"use client";

import { useState, useEffect } from "react";

interface Section {
  id: string;
  title: string;
  orderIndex: number;
  parentId: string | null;
}

interface TableOfContentsProps {
  sections: Section[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onCollapse?: () => void;
  onCopyLink?: (sectionId: string) => void;
  copiedSectionId?: string | null;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSetParent?: (sectionIndex: number, parentId: string | null) => void;
}

export default function TableOfContents({
  sections,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onCollapse,
  onCopyLink,
  copiedSectionId,
  onReorder,
  onSetParent,
}: TableOfContentsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // 섹션의 자식 섹션들 찾기
  const getChildren = (sectionId: string): Section[] => {
    return sections.filter(s => s.parentId === sectionId);
  };
  
  // 초기 로드 시 모든 부모 섹션을 확장 상태로 설정
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  // sections가 변경되면 확장 상태 업데이트 (부모 섹션은 기본적으로 확장)
  useEffect(() => {
    const newExpandedSections = new Set(
      sections.filter(s => getChildren(s.id).length > 0).map(s => s.id)
    );
    setExpandedSections(newExpandedSections);
  }, [sections]);

  // 계층 구조로 섹션 정렬 (orderIndex로 정렬하면 부모와 자식이 올바른 순서로 배치됨)
  // 부모 섹션의 orderIndex는 정수이고, 자식은 부모 + 소수점 (예: 1.0, 1.1, 1.2, ...)
  const sortedSections = [...sections].sort((a, b) => {
    return a.orderIndex - b.orderIndex;
  });

  // 섹션의 깊이 계산 (0 = 최상위, 1 = 하위)
  const getSectionDepth = (section: Section): number => {
    if (!section.parentId) return 0;
    const parent = sections.find(s => s.id === section.parentId);
    return parent ? getSectionDepth(parent) + 1 : 0;
  };

  // 섹션을 표시할지 여부 결정 (부모가 접혀있으면 숨김)
  const shouldShowSection = (section: Section): boolean => {
    if (!section.parentId) return true;
    const parent = sections.find(s => s.id === section.parentId);
    if (!parent) return true;
    return expandedSections.has(section.parentId);
  };

  const toggleExpand = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onReorder) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">목차</h2>
        <div className="flex items-center gap-2">
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="목차 접기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={onAdd}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + 추가
          </button>
        </div>
      </div>
      <ul className="space-y-1">
        {(() => {
          // 실제로 표시되는 섹션들만 필터링
          const visibleSections = sortedSections.filter(s => shouldShowSection(s));
          
          return visibleSections.map((section, visibleIndex) => {
          
          const originalIndex = sections.findIndex(s => s.id === section.id);
          const depth = getSectionDepth(section);
          const children = getChildren(section.id);
          const hasChildren = children.length > 0;
          const isExpanded = expandedSections.has(section.id);

          return (
            <li
              key={section.id}
              draggable={onReorder !== undefined && sections.length > 1}
              onDragStart={() => handleDragStart(originalIndex)}
              onDragOver={(e) => handleDragOver(e, originalIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, originalIndex)}
              onDragEnd={handleDragEnd}
              className={`transition-all ${
                draggedIndex === originalIndex
                  ? "opacity-50"
                  : dragOverIndex === originalIndex
                  ? "translate-y-1"
                  : ""
              }`}
            >
              <div className="flex items-center gap-1 group">
                {/* {onReorder && sections.length > 1 && (
                  <div
                    className="cursor-move p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                    title="드래그하여 순서 변경"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                )} */}
                {/* 들여쓰기 */}
                <div style={{ width: `${depth * 20}px` }} className="flex-shrink-0">
                  {depth > 0 && (
                    <div className="w-full h-full border-l-2 border-gray-300 dark:border-gray-600 ml-2" />
                  )}
                </div>
                {/* 확장/축소 버튼 */}
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(section.id);
                    }}
                    className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                  >
                    <svg 
                      className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                {!hasChildren && <div className="w-4" />}
                <div
                  className={`flex-1 flex items-center justify-between p-2 rounded cursor-pointer ${
                    activeIndex === originalIndex
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  } ${dragOverIndex === originalIndex ? "border-2 border-blue-400 border-dashed" : ""}`}
                  onClick={() => onSelect(originalIndex)}
                >
                  <span className="flex-1 truncate">
                    {section.title || `섹션 ${originalIndex + 1}`}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onSetParent && (
                      <>
                        {/* 하위에 있을 때: 상위로 올리기 (↑) */}
                        {section.parentId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetParent(originalIndex, null);
                            }}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="상위로 올리기"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                        )}
                        {/* 상위에 있을 때: 하위로 만들기 (↓) */}
                        {!section.parentId && visibleIndex > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const prevSection = visibleSections[visibleIndex - 1];
                              if (!prevSection.parentId) {
                                onSetParent(originalIndex, prevSection.id);
                              } else {
                                onSetParent(originalIndex, prevSection.parentId);
                              }
                            }}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            title="하위로 만들기"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                    {sections.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(originalIndex);
                        }}
                        className="p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="삭제"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    {onCopyLink && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyLink(section.id);
                        }}
                        className={`p-1 rounded ${
                          copiedSectionId === section.id
                            ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                        title="섹션 링크 복사"
                      >
                        {copiedSectionId === section.id ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
          });
        })()}
      </ul>
    </div>
  );
}

