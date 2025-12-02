"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Manual, Section } from "@prisma/client";
import SplitPane from "@/components/SplitPane";
import ThemeToggle from "@/components/ThemeToggle";

// 하이라이트를 동적으로 적용하는 컴포넌트
function HighlightedContent({ 
  html, 
  highlightedAnnotation,
  onAnnotationClick 
}: { 
  html: string; 
  highlightedAnnotation?: number | null;
  onAnnotationClick?: (number: number) => void;
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
  }, [highlightedAnnotation, html]);

  return (
    <div
      ref={contentRef}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const annotationSpan = target.closest('span[data-type="annotation"]');
        if (annotationSpan) {
          const number = parseInt(annotationSpan.getAttribute('data-number') || '0', 10);
          if (number && onAnnotationClick) {
            onAnnotationClick(number);
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

  const activeSection = sections[activeSectionIndex] || null;

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
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSectionIndex(index)}
                      className={`w-full text-left p-2 rounded ${
                        activeSectionIndex === index
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {section.title || `섹션 ${index + 1}`}
                    </button>
                  </li>
                ))}
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

