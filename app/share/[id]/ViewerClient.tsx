"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Manual, Section } from "@prisma/client";
import SplitPane from "@/components/SplitPane";
import ThemeToggle from "@/components/ThemeToggle";

// localStorage 키
const STORAGE_KEY_SPLIT_RATIO = "imm-viewer-split-ratio";
const STORAGE_KEY_SIDEBAR_COLLAPSED = "imm-viewer-sidebar-collapsed";

// 하이라이트를 동적으로 적용하는 컴포넌트
function HighlightedContent({ 
  html, 
  highlightedAnnotation,
  onAnnotationClick,
  onSectionLinkClick,
  manualId,
}: { 
  html: string; 
  highlightedAnnotation?: number | null;
  onAnnotationClick?: (number: number) => void;
  onSectionLinkClick?: (sectionId: string) => void;
  manualId?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    // 모든 어노테이션 요소 찾기
    const annotationElements = contentRef.current.querySelectorAll('span[data-type="annotation"]');
    
    annotationElements.forEach((el) => {
      const number = parseInt(el.getAttribute('data-number') || '0', 10);
      if (highlightedAnnotation === number) {
        el.classList.add('highlighted');
      } else {
        el.classList.remove('highlighted');
      }
    });

    // 섹션 링크의 href를 전체 URL로 변환 및 외부 링크에 target="new_window" 추가
    if (manualId) {
      const sectionLinks = contentRef.current.querySelectorAll('a[href^="#"]');
      sectionLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#') && !href.startsWith('#/')) {
          // 상대 경로 해시를 전체 URL로 변환
          const sectionId = href.slice(1);
          const fullUrl = `${window.location.origin}/share/${manualId}#${sectionId}`;
          link.setAttribute('href', fullUrl);
          // 클릭 시에도 섹션으로 이동하도록 처리
          link.addEventListener('click', (e) => {
            e.preventDefault();
            if (onSectionLinkClick) {
              onSectionLinkClick(sectionId);
            }
          });
        }
      });
    }

    // 외부 링크(섹션 링크가 아닌)에 target="_blank" 추가
    const allLinks = contentRef.current.querySelectorAll('a[href]');
    allLinks.forEach((link) => {
      const href = link.getAttribute('href');
      // 섹션 링크(#로 시작)가 아닌 외부 링크에만 target="_blank" 추가
      if (href && !href.startsWith('#') && !href.startsWith('/')) {
        // new_window를 _blank로 변환 (표준)
        if (link.getAttribute('target') === 'new_window') {
          link.setAttribute('target', '_blank');
        } else if (!link.hasAttribute('target')) {
          link.setAttribute('target', '_blank');
        }
        if (!link.hasAttribute('rel')) {
          link.setAttribute('rel', 'noopener noreferrer'); // 보안을 위한 rel 속성 추가
        }
      }
    });
  }, [highlightedAnnotation, html, manualId, onSectionLinkClick]);

  // 섹션 링크 클릭 처리를 위한 별도 useEffect
  useEffect(() => {
    if (!contentRef.current || !onSectionLinkClick) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href*="#"]') as HTMLAnchorElement;
      
      if (link) {
        const href = link.getAttribute('href');
        // 전체 URL 형식 또는 해시만 있는 경우 모두 처리
        if (href && (href.includes('#') || href.startsWith('#'))) {
          const hashMatch = href.match(/#([^/]+)$/);
          if (hashMatch) {
            e.preventDefault();
            e.stopPropagation();
            const sectionId = hashMatch[1];
            console.log('섹션 링크 클릭:', sectionId, 'href:', href); // 디버깅용
            onSectionLinkClick(sectionId);
          }
        }
      }
    };

    // 이벤트 위임: 부모 요소에 리스너 추가
    contentRef.current.addEventListener('click', handleLinkClick, true);

    return () => {
      if (contentRef.current) {
        contentRef.current.removeEventListener('click', handleLinkClick, true);
      }
    };
  }, [html, onSectionLinkClick]);

  return (
    <div
      ref={contentRef}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        
        // 어노테이션 클릭 처리
        const annotationSpan = target.closest('span[data-type="annotation"]');
        if (annotationSpan) {
          const number = parseInt(annotationSpan.getAttribute('data-number') || '0', 10);
          if (number && onAnnotationClick) {
            onAnnotationClick(number);
          }
          return;
        }
        
        // 섹션 링크 클릭 처리 (fallback)
        const link = target.closest('a[href^="#"]') as HTMLAnchorElement;
        if (link && onSectionLinkClick) {
          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            e.preventDefault();
            e.stopPropagation();
            const sectionId = href.slice(1);
            console.log('섹션 링크 클릭 (onClick fallback):', sectionId); // 디버깅용
            onSectionLinkClick(sectionId);
            return;
          }
        }
      }}
    />
  );
}

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

interface ViewerClientProps {
  manual: Manual;
  sections: SectionWithAnnotations[];
}

export default function ViewerClient({ manual, sections }: ViewerClientProps) {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [splitRatio, setSplitRatio] = useState(70);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [highlightedAnnotation, setHighlightedAnnotation] = useState<number | null>(null);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const isUpdatingFromHashRef = useRef(false);

  // 섹션의 자식 섹션들 찾기
  const getChildren = (sectionId: string): SectionWithAnnotations[] => {
    return sections.filter(s => s.parentId === sectionId);
  };

  // 계층 구조로 섹션 정렬 (orderIndex로 정렬)
  const sortedSections = [...sections].sort((a, b) => {
    return a.orderIndex - b.orderIndex;
  });

  // 섹션의 깊이 계산 (0 = 최상위, 1 = 하위)
  const getSectionDepth = (section: SectionWithAnnotations): number => {
    if (!section.parentId) return 0;
    const parent = sections.find(s => s.id === section.parentId);
    return parent ? getSectionDepth(parent) + 1 : 0;
  };

  // 섹션을 표시할지 여부 결정 (부모가 접혀있으면 숨김)
  const shouldShowSection = (section: SectionWithAnnotations): boolean => {
    if (!section.parentId) return true;
    const parent = sections.find(s => s.id === section.parentId);
    if (!parent) return true;
    return expandedSections.has(section.parentId);
  };

  // 초기 로드 시 모든 부모 섹션을 확장 상태로 설정
  useEffect(() => {
    const newExpandedSections = new Set(
      sections.filter(s => getChildren(s.id).length > 0).map(s => s.id)
    );
    setExpandedSections(newExpandedSections);
  }, [sections]);

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
    if (currentSection) {
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
  }, [activeSectionIndex, sections]);

  const activeSection = sections[activeSectionIndex] || null;

  // 활성 섹션 변경 시 document.title 업데이트
  useEffect(() => {
    if (manual && activeSection) {
      document.title = `${activeSection.title} - ${manual.title}`;
    } else if (manual) {
      document.title = `${manual.title} - Interactive Manual Maker`;
    }
  }, [activeSection, manual]);

  // 어노테이션 클릭 시 하이라이트
  const handleAnnotationClick = (number: number) => {
    setHighlightedAnnotation(number);
    setTimeout(() => setHighlightedAnnotation(null), 2000);
  };

  // 텍스트 어노테이션 클릭 시 이미지 하이라이트
  const handleTextAnnotationClick = (number: number) => {
    setHighlightedAnnotation(number);
    setTimeout(() => setHighlightedAnnotation(null), 2000);
  };

  const handleSectionLinkClick = (sectionId: string) => {
    const sectionIndex = sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex !== -1 && sectionIndex !== activeSectionIndex) {
      setActiveSectionIndex(sectionIndex);
      // URL 해시 업데이트는 useEffect에서 자동으로 처리됨
      // 스크롤을 맨 위로 이동
      window.scrollTo(0, 0);
    }
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
    const link = `${window.location.origin}/share/${manual.id}#${sectionId}`;
    await navigator.clipboard.writeText(link);
    setCopiedSectionId(sectionId);
    setTimeout(() => setCopiedSectionId(null), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      <div className="flex flex-1 overflow-hidden">
        {!isSidebarCollapsed && (
          <aside className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">목차</h2>
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label="목차 접기"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <ul className="space-y-1">
                {sortedSections.map((section) => {
                  if (!shouldShowSection(section)) return null;
                  
                  const originalIndex = sections.findIndex(s => s.id === section.id);
                  const depth = getSectionDepth(section);
                  const children = getChildren(section.id);
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedSections.has(section.id);

                  return (
                    <li key={section.id}>
                      <div className="flex items-center gap-1 group">
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
                        <button
                          onClick={() => setActiveSectionIndex(originalIndex)}
                          className={`flex-1 text-left p-2 rounded ${
                            activeSectionIndex === originalIndex
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {section.title || `섹션 ${originalIndex + 1}`}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySectionLink(section.id);
                          }}
                          className={`p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            copiedSectionId === section.id
                              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 opacity-100"
                              : "hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                          }`}
                          title="섹션 링크 복사"
                        >
                          {copiedSectionId === section.id ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
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

        {activeSection?.imageUrl ? (
          <SplitPane
            defaultRatio={splitRatio}
            onRatioChange={setSplitRatio}
            left={
              <div className="h-full overflow-auto bg-gray-200 dark:bg-gray-800 flex items-center justify-center p-8">
                <div className="relative flex items-center justify-center">
                  <img
                    src={activeSection.imageUrl}
                    alt={activeSection.title}
                    className="max-w-full max-h-full object-contain"
                  />
                  {activeSection.annotations?.map((ann, index) => {
                    const displayNumber = ann.number || index + 1;
                    const isHighlighted = highlightedAnnotation === displayNumber;
                    return (
                      <div key={ann.id}>
                        <div
                          className={`absolute border-2 ${
                            isHighlighted
                              ? "border-yellow-500 bg-yellow-200 bg-opacity-30 ring-2 ring-yellow-400"
                              : "border-blue-500 bg-blue-200 bg-opacity-20"
                          } transition-all cursor-pointer`}
                          style={{
                            left: `${ann.x}%`,
                            top: `${ann.y}%`,
                            width: `${ann.w}%`,
                            height: `${ann.h}%`,
                          }}
                          onClick={() => handleAnnotationClick(displayNumber)}
                        />
                        <div
                          className={`absolute bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg w-8 h-8 cursor-pointer hover:bg-blue-700 transition-colors ${
                            isHighlighted ? "ring-2 ring-yellow-400 ring-offset-2" : ""
                          }`}
                          style={{
                            left: `calc(${ann.x}% - 8px)`,
                            top: `calc(${ann.y}% - 8px)`,
                          }}
                          onClick={() => handleAnnotationClick(displayNumber)}
                        >
                          {displayNumber}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            }
            right={
              <div className="h-full overflow-auto bg-white dark:bg-gray-900">
                <div className="p-6 ProseMirror prose max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-code:text-gray-900 dark:prose-code:text-gray-100 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300">
                  <h2>{activeSection.title}</h2>
                  <HighlightedContent 
                    html={activeSection.contentMd}
                    highlightedAnnotation={highlightedAnnotation}
                    onAnnotationClick={handleTextAnnotationClick}
                    onSectionLinkClick={handleSectionLinkClick}
                    manualId={manual.id}
                  />
                </div>
              </div>
            }
          />
        ) : (
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
            {activeSection ? (
              <div className="p-6 ProseMirror prose max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-code:text-gray-900 dark:prose-code:text-gray-100 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300">
                <h2>{activeSection.title}</h2>
                <HighlightedContent 
                  html={activeSection.contentMd}
                  highlightedAnnotation={highlightedAnnotation}
                  onAnnotationClick={handleTextAnnotationClick}
                  onSectionLinkClick={handleSectionLinkClick}
                  manualId={manual.id}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                내용 없음
              </div>
            )}
          </div>
        )}
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
        <div className="flex items-center gap-4">
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
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

