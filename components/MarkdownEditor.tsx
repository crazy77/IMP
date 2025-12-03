"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import Link from "@tiptap/extension-link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Annotation, AnnotationOptions } from "./AnnotationNode";

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

interface Section {
  id: string;
  title: string;
  orderIndex: number;
}

interface MarkdownEditorProps {
  content: string;
  title: string;
  onChange: (content: string) => void;
  onTitleChange: (title: string) => void;
  onAnnotationClick?: (number: number) => void;
  highlightedAnnotation?: number | null;
  editorRef?: React.MutableRefObject<any>;
  sections?: Section[];
  onSectionSelect?: (sectionId: string) => void;
}

export default function MarkdownEditor({
  content,
  title,
  onChange,
  onTitleChange,
  onAnnotationClick,
  highlightedAnnotation,
  editorRef,
  sections = [],
  onSectionSelect,
}: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [showSectionMenu, setShowSectionMenu] = useState(false);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [slashCommandPosition, setSlashCommandPosition] = useState<{ top: number; left: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const isUpdatingContentRef = useRef(false); // 무한 루프 방지 플래그
  
  // 상태를 ref로 관리하여 handleKeyDown에서 최신 값 참조
  const showSectionMenuRef = useRef(showSectionMenu);
  const selectedSectionIndexRef = useRef(selectedSectionIndex);
  const sectionsRef = useRef(sections);
  const selectedSectionIdRef = useRef<string | null>(null);
  const searchQueryRef = useRef(searchQuery);
  const filteredSectionsRef = useRef<Section[]>([]);
  
  useEffect(() => {
    showSectionMenuRef.current = showSectionMenu;
  }, [showSectionMenu]);
  
  useEffect(() => {
    selectedSectionIndexRef.current = selectedSectionIndex;
    // 선택된 섹션 ID도 저장
    if (sections[selectedSectionIndex]) {
      selectedSectionIdRef.current = sections[selectedSectionIndex].id;
    }
  }, [selectedSectionIndex, sections]);
  
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  // 검색어로 섹션 필터링
  const filteredSections = sections.filter(section => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return section.title.toLowerCase().includes(query);
  });

  useEffect(() => {
    filteredSectionsRef.current = filteredSections;
    // 검색어가 변경되면 선택 인덱스 초기화
    if (searchQuery) {
      setSelectedSectionIndex(0);
    }
  }, [filteredSections, searchQuery]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false, // StarterKit의 기본 Link를 비활성화하고 확장된 Link 사용
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'cursor-pointer',
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            target: {
              default: null,
            },
          };
        },
        renderHTML({ HTMLAttributes }) {
          const href = HTMLAttributes.href;
          // 섹션 링크가 아닌 외부 링크에만 target="_blank" 추가
          if (href && !href.startsWith('#') && !href.startsWith('/')) {
            return ['a', { ...HTMLAttributes, target: '_blank', rel: 'noopener noreferrer' }, 0];
          }
          return ['a', HTMLAttributes, 0];
        },
      }),
      Annotation.configure({
        onAnnotationClick,
        highlightedAnnotation,
      }),
      Markdown,
      Placeholder.configure({
        placeholder: "마크다운으로 작성하세요...",
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-6 min-h-full dark:prose-invert",
      },
      handleKeyDown: (view, event) => {
        // 슬래시 메뉴가 열려있을 때 키보드 이벤트 처리
        if (showSectionMenuRef.current) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const filtered = filteredSectionsRef.current;
            setSelectedSectionIndex((prev) => (prev + 1) % filtered.length);
            return true;
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            const filtered = filteredSectionsRef.current;
            setSelectedSectionIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
            return true;
          } else if (event.key === "Enter") {
            event.preventDefault();
            const filtered = filteredSectionsRef.current;
            // 필터링된 섹션 목록에서 선택
            const selectedSection = filtered[selectedSectionIndexRef.current];
            
            if (selectedSection && editor) {
              insertSectionLink(selectedSection);
            }
            return true;
          } else if (event.key === "Escape") {
            event.preventDefault();
            setShowSectionMenu(false);
            setSearchQuery("");
            return true;
          }
          // 일반 문자 입력과 백스페이스는 에디터의 onUpdate에서 처리됨
          // 한글 입력을 위해 IME 이벤트를 허용해야 함
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // 무한 루프 방지
      if (isUpdatingContentRef.current) {
        const html = editor.getHTML();
        onChange(html);
        return;
      }

      const { state } = editor;
      const { doc, schema } = state;
      const linkMarkType = schema.marks.link;
      let hasChanges = false;
      const tr = state.tr;

      // 모든 텍스트 노드를 순회하며 마크다운 링크 패턴 찾기
      doc.descendants((node, pos) => {
        // 텍스트 노드이고 이미 링크 마크가 없는 경우만 처리
        if (node.isText && !node.marks.some(mark => mark.type === linkMarkType)) {
          const text = node.text || '';
          // 마크다운 링크 패턴: [텍스트](URL)
          // 더 견고한 정규식: 대괄호와 괄호 내부에 특수 문자 허용
          const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
          const matches: Array<{ start: number; end: number; text: string; url: string }> = [];
          let match;

          while ((match = markdownLinkRegex.exec(text)) !== null) {
            const linkText = match[1] || '';
            const url = match[2] || '';
            
            // 빈 URL은 스킵
            if (!url.trim()) {
              continue;
            }

            matches.push({
              start: pos + match.index,
              end: pos + match.index + match[0].length,
              text: linkText,
              url: url.trim(),
            });
          }

          // 뒤에서부터 처리하여 위치가 변경되지 않도록 함
          for (let i = matches.length - 1; i >= 0; i--) {
            const { start, end, text: linkText, url } = matches[i];
            
            // 외부 링크인지 확인
            const isExternalLink = !url.startsWith('#') && !url.startsWith('/');
            
            // 링크 마크 생성
            const linkAttrs: { href: string; target?: string; rel?: string } = { href: url };
            if (isExternalLink) {
              linkAttrs.target = '_blank';
              linkAttrs.rel = 'noopener noreferrer';
            }
            
            const linkMark = linkMarkType.create(linkAttrs);
            
            // 텍스트를 링크로 변환
            // 먼저 마크다운 링크 텍스트 부분만 남기고 나머지 삭제
            const linkStart = start;
            const linkEnd = end;
            const linkTextStart = linkStart + 1; // '[' 다음
            const linkTextEnd = linkTextStart + linkText.length;
            
            // 마크다운 링크 전체를 삭제하고 링크 텍스트만 삽입
            tr.delete(linkStart, linkEnd);
            tr.insert(linkStart, schema.text(linkText));
            // 링크 마크 추가
            tr.addMark(linkStart, linkStart + linkText.length, linkMark);
            
            hasChanges = true;
          }
        }
      });

      // 변경사항이 있으면 적용
      if (hasChanges) {
        isUpdatingContentRef.current = true;
        editor.view.dispatch(tr);
        // 다음 틱에서 플래그 리셋
        setTimeout(() => {
          isUpdatingContentRef.current = false;
        }, 0);
      }

      // HTML로 저장 (어노테이션 번호가 HTML 태그로 포함되어 있으므로)
      const html = editor.getHTML();
      onChange(html);
    },
  });

  // Update editor options when props change
  // 쓰기 화면에서는 하이라이트 기능을 제거하여 성능 최적화
  useEffect(() => {
    if (editor) {
      editor.extensionManager.extensions.forEach((ext) => {
        if (ext.name === "annotation") {
          ext.options.onAnnotationClick = onAnnotationClick;
          // 하이라이트 기능은 읽기 화면에서만 사용
          ext.options.highlightedAnnotation = null;
        }
      });
    }
  }, [editor, onAnnotationClick]);

  // Expose editor instance via ref
  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  useEffect(() => {
    if (!editor) return;
    
    // Get current HTML from editor
    const currentHtml = editor.getHTML();
    
    // HTML로 저장하므로 HTML을 직접 비교
    if (content !== currentHtml && content !== undefined) {
      const contentIsEmpty = !content || content.trim() === "" || content.trim() === "<p></p>";
      
      if (contentIsEmpty) {
        // 빈 내용일 때는 에디터를 초기화
        editor.commands.setContent("", { emitUpdate: false });
      } else {
        editor.commands.setContent(content, { emitUpdate: false }); // emitUpdate: false로 설정하여 무한 루프 방지
      }
    }
  }, [content, editor]);

  // 섹션 링크 삽입 함수
  const insertSectionLink = useCallback((section: Section) => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    const textContent = $from.parent.textContent || "";
    const pos = $from.parentOffset;
    
    // / 위치 찾기
    let slashPos = -1;
    for (let i = pos - 1; i >= 0; i--) {
      if (textContent[i] === "/") {
        const beforeSlash = i > 0 ? textContent.slice(0, i) : "";
        if (beforeSlash === "" || beforeSlash.endsWith(" ") || beforeSlash.endsWith("\n")) {
          slashPos = i;
          break;
        }
      } else if (textContent[i] === " " || textContent[i] === "\n") {
        break;
      }
    }
    
    if (slashPos !== -1) {
      // /부터 현재 위치까지 삭제
      const startPos = $from.start() + slashPos;
      const endPos = $from.pos;
      editor.commands.deleteRange({ from: startPos, to: endPos });
      
      // HTML 링크로 직접 삽입
      const linkHtml = `<a href="#${section.id}">${section.title}</a>`;
      editor.commands.insertContent(linkHtml);
    }
    
    setShowSectionMenu(false);
    setSearchQuery("");
    
    // 에디터에서는 이동하지 않음 - 뷰어에서만 링크 클릭 시 이동
  }, [editor]);

  // 슬래시 커맨드 감지 및 처리
  useEffect(() => {
    if (!editor || !sections.length || isPreview) return;

    const extractSearchQuery = () => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      const textContent = $from.parent.textContent || "";
      const pos = $from.parentOffset;
      
      // / 뒤의 텍스트 추출
      if (pos > 0 && textContent[pos - 1] === "/") {
        // / 앞에 공백이 있거나 줄의 시작인지 확인
        const beforeSlash = pos > 1 ? textContent.slice(0, pos - 1) : "";
        if (beforeSlash === "" || beforeSlash.endsWith(" ") || beforeSlash.endsWith("\n")) {
          return { shouldShow: true, query: "" };
        }
      } else if (pos > 1) {
        // / 뒤에 텍스트가 있는 경우
        let slashPos = -1;
        for (let i = pos - 1; i >= 0; i--) {
          if (textContent[i] === "/") {
            // / 앞에 공백이 있거나 줄의 시작인지 확인
            const beforeSlash = i > 0 ? textContent.slice(0, i) : "";
            if (beforeSlash === "" || beforeSlash.endsWith(" ") || beforeSlash.endsWith("\n")) {
              slashPos = i;
              break;
            }
          } else if (textContent[i] === " " || textContent[i] === "\n") {
            // 공백이나 줄바꿈을 만나면 중단
            break;
          }
        }
        
        if (slashPos !== -1) {
          const query = textContent.slice(slashPos + 1, pos);
          return { shouldShow: true, query };
        }
      }
      
      return { shouldShow: false, query: "" };
    };

    const handleUpdate = () => {
      if (showSectionMenu) {
        // 메뉴가 열려있을 때는 검색어만 업데이트
        const { query } = extractSearchQuery();
        if (query !== searchQueryRef.current) {
          setSearchQuery(query);
        }
        return;
      }
      
      const { shouldShow, query } = extractSearchQuery();
      
      if (shouldShow) {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;
        
        // 커서 위치 계산
        const coords = editor.view.coordsAtPos($from.pos);
        const editorElement = editor.view.dom.getBoundingClientRect();
        
        setSlashCommandPosition({
          top: coords.top - editorElement.top + 20,
          left: coords.left - editorElement.left,
        });
        setShowSectionMenu(true);
        setSelectedSectionIndex(0);
        setSearchQuery(query);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (showSectionMenuRef.current) {
        // 메뉴가 열려있을 때 특수 키 처리
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === "Escape") {
          // 이미 handleKeyDown에서 처리됨
          return;
        } else if (event.key === "Backspace") {
          // 백스페이스는 에디터에서 처리하도록 허용
          // handleUpdate에서 검색어가 업데이트됨
          return;
        } else {
          // 다른 키는 에디터에 입력되도록 허용
          // handleUpdate에서 검색어가 업데이트됨
          return;
        }
      } else {
        // 메뉴가 닫혀있을 때 / 입력 감지
        if (event.key === "/" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          // handleUpdate에서 처리됨
          return;
        }
      }
    };

    editor.on("update", handleUpdate);
    const editorElement = editor.view.dom;
    editorElement.addEventListener("keydown", handleKeyDown as any);

    return () => {
      editor.off("update", handleUpdate);
      editorElement.removeEventListener("keydown", handleKeyDown as any);
    };
  }, [editor, sections, showSectionMenu, isPreview]);

  // 선택된 항목이 보이도록 스크롤
  useEffect(() => {
    if (showSectionMenu && selectedItemRef.current && menuRef.current) {
      const menu = menuRef.current;
      const item = selectedItemRef.current;
      const menuRect = menu.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      
      // 항목이 메뉴 영역 밖에 있으면 스크롤
      if (itemRect.top < menuRect.top) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (itemRect.bottom > menuRect.bottom) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedSectionIndex, showSectionMenu, filteredSections]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!showSectionMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSectionMenu(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSectionMenu]);

  if (!editor) {
    return null;
  }

  // Get HTML from editor
  const getHtml = () => {
    return editor.getHTML();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="섹션 제목"
          className="text-lg font-semibold border-none outline-none flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <button
          onClick={() => {
            setIsPreview(!isPreview);
            if (!isPreview) {
              // Update content before showing preview
              const html = getHtml();
              onChange(html);
            }
          }}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {isPreview ? "편집" : "미리보기"}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {isPreview ? (
          <div className="p-6 prose max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-code:text-gray-900 dark:prose-code:text-gray-100 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300">
            <HighlightedContent 
              html={content}
              highlightedAnnotation={null}
              onAnnotationClick={onAnnotationClick}
            />
          </div>
        ) : (
          <div className="h-full overflow-auto relative">
            <EditorContent editor={editor} />
            {showSectionMenu && slashCommandPosition && filteredSections.length > 0 && (
              <div
                ref={menuRef}
                className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-[200px]"
                style={{
                  top: `${slashCommandPosition.top}px`,
                  left: `${slashCommandPosition.left}px`,
                }}
              >
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">섹션 선택</span>
                    {searchQuery && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        "{searchQuery}"
                      </span>
                    )}
                  </div>
                </div>
                {filteredSections.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    검색 결과가 없습니다
                  </div>
                ) : (
                  filteredSections.map((section, index) => {
                    const isSelected = index === selectedSectionIndex;
                    const originalIndex = sections.findIndex(s => s.id === section.id);
                    return (
                      <div
                        key={section.id}
                        ref={isSelected ? selectedItemRef : null}
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30"
                            : ""
                        }`}
                        onClick={() => {
                          selectedSectionIdRef.current = section.id;
                          insertSectionLink(section);
                          setShowSectionMenu(false);
                          setSearchQuery("");
                        }}
                        onMouseEnter={() => {
                          setSelectedSectionIndex(index);
                          selectedSectionIdRef.current = section.id;
                        }}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {section.title || `섹션 ${originalIndex + 1}`}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          클릭하여 섹션으로 이동
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

