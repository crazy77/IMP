"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import { Manual } from "@prisma/client";
import ThemeToggle from "@/components/ThemeToggle";

interface ManualWithSections extends Manual {
  sections: Array<{ imageUrl: string | null }>;
}

interface DashboardClientProps {
  manuals: ManualWithSections[];
}

export default function DashboardClient({ manuals }: DashboardClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

  const filteredManuals = manuals
    .filter((manual) =>
      manual.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return a.title.localeCompare(b.title);
    });

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/manuals/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("삭제 실패:", error);
    }
  };

  const handleCopyLink = async (id: string) => {
    const link = `${window.location.origin}/share/${id}`;
    await navigator.clipboard.writeText(link);
    alert("링크가 복사되었습니다!");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            내 매뉴얼
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/editor/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              새 매뉴얼 만들기
            </Link>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="제목으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "name")}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">날짜순</option>
            <option value="name">이름순</option>
          </select>
        </div>

        {filteredManuals.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">
              {manuals.length === 0
                ? "첫 매뉴얼을 만들어보세요"
                : "검색 결과가 없습니다"}
            </p>
            {manuals.length === 0 && (
              <Link
                href="/editor/new"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                새 매뉴얼 만들기
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredManuals.map((manual) => (
              <div
                key={manual.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-gray-200 relative">
                  {manual.thumbnailUrl || manual.sections[0]?.imageUrl ? (
                    <img
                      src={manual.thumbnailUrl || manual.sections[0]?.imageUrl || ""}
                      alt={manual.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      이미지 없음
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        manual.isPublished
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {manual.isPublished ? "공개됨" : "비공개"}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {manual.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    수정일: {dayjs(manual.updatedAt).format("YYYY-MM-DD HH:mm")}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/editor/${manual.id}`}
                      className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-center"
                    >
                      수정
                    </Link>
                    <Link
                      href={`/share/${manual.id}`}
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors text-center"
                    >
                      미리보기
                    </Link>
                    <div className="relative group">
                      <button className="px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors">
                        ⋮
                      </button>
                      <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <button
                          onClick={() => handleCopyLink(manual.id)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          링크 복사
                        </button>
                        <button
                          onClick={() => handleDelete(manual.id)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

