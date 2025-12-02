"use client";

import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
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

interface MarkdownEditorProps {
  content: string;
  title: string;
  onChange: (content: string) => void;
  onTitleChange: (title: string) => void;
  onAnnotationClick?: (number: number) => void;
  highlightedAnnotation?: number | null;
  editorRef?: React.MutableRefObject<any>;
}

export default function MarkdownEditor({
  content,
  title,
  onChange,
  onTitleChange,
  onAnnotationClick,
  highlightedAnnotation,
  editorRef,
}: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
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
    },
    onUpdate: ({ editor }) => {
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
          <div className="h-full overflow-auto">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    </div>
  );
}

