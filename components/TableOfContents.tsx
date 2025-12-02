"use client";

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
}

export default function TableOfContents({
  sections,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onCollapse,
}: TableOfContentsProps) {
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
        {sections.map((section, index) => (
          <li key={section.id}>
            <div
              className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                activeIndex === index
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              onClick={() => onSelect(index)}
            >
              <span className="flex-1 truncate">
                {section.title || `섹션 ${index + 1}`}
              </span>
              {sections.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(index);
                  }}
                  className="ml-2 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                >
                  삭제
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

