"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

interface Annotation {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  number?: number;
}

interface ImageCanvasProps {
  imageUrl: string | null;
  annotations: Annotation[];
  onImageUpload: (file: File) => void;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onAnnotationClick?: (number: number) => void;
  highlightedAnnotation?: number | null;
}

export default function ImageCanvas({
  imageUrl,
  annotations,
  onImageUpload,
  onAnnotationsChange,
  onAnnotationClick,
  highlightedAnnotation,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [tempAnnotation, setTempAnnotation] = useState<Annotation | null>(null);
  const [editingNumber, setEditingNumber] = useState<string | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || !imageUrl) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const clickedAnnotation = annotations.find((ann) => {
        const pixelX = (x / 100) * rect.width;
        const pixelY = (y / 100) * rect.height;
        const annX = (ann.x / 100) * rect.width;
        const annY = (ann.y / 100) * rect.height;
        const annW = (ann.w / 100) * rect.width;
        const annH = (ann.h / 100) * rect.height;

        return (
          pixelX >= annX &&
          pixelX <= annX + annW &&
          pixelY >= annY &&
          pixelY <= annY + annH
        );
      });

      if (clickedAnnotation) {
        setSelectedAnnotation(clickedAnnotation.id);
        setIsDragging(true);
        const pixelX = (x / 100) * rect.width;
        const pixelY = (y / 100) * rect.height;
        const annX = (clickedAnnotation.x / 100) * rect.width;
        const annY = (clickedAnnotation.y / 100) * rect.height;
        setDragOffset({
          x: pixelX - annX,
          y: pixelY - annY,
        });
      } else {
        setSelectedAnnotation(null);
        setIsDrawing(true);
        setStartPos({ x, y });
        setTempAnnotation(null);
      }
    },
    [imageUrl, annotations]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || !imageUrl) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      if (isDragging && selectedAnnotation && dragOffset) {
        const annIndex = annotations.findIndex((a) => a.id === selectedAnnotation);
        if (annIndex !== -1) {
          const updated = [...annotations];
          const pixelX = (x / 100) * rect.width;
          const pixelY = (y / 100) * rect.height;
          const newX = (pixelX - dragOffset.x) / rect.width * 100;
          const newY = (pixelY - dragOffset.y) / rect.height * 100;
          updated[annIndex] = {
            ...updated[annIndex],
            x: Math.max(0, Math.min(100 - updated[annIndex].w, newX)),
            y: Math.max(0, Math.min(100 - updated[annIndex].h, newY)),
          };
          onAnnotationsChange(updated);
        }
      } else if (isDrawing && startPos) {
        const w = Math.abs(x - startPos.x);
        const h = Math.abs(y - startPos.y);
        const newX = Math.min(x, startPos.x);
        const newY = Math.min(y, startPos.y);

        const newTempAnnotation: Annotation = {
          id: "temp",
          x: Math.max(0, Math.min(100 - w, newX)),
          y: Math.max(0, Math.min(100 - h, newY)),
          w: Math.min(w, 100 - Math.max(0, Math.min(100 - w, newX))),
          h: Math.min(h, 100 - Math.max(0, Math.min(100 - h, newY))),
        };

        setTempAnnotation(newTempAnnotation);
      }
    },
    [imageUrl, isDrawing, isDragging, startPos, selectedAnnotation, dragOffset, annotations, onAnnotationsChange]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing && tempAnnotation) {
      // 길이 또는 높이가 2% 미만이면 박스를 생성하지 않음
      if (tempAnnotation.w < 2 || tempAnnotation.h < 2) {
        setTempAnnotation(null);
        setIsDrawing(false);
        setStartPos(null);
        return;
      }

      const updated = [...annotations.filter((a) => a.id !== "temp")];
      const maxNumber = updated.length > 0 
        ? Math.max(...updated.map(a => a.number || 0), 0)
        : 0;
      updated.push({ 
        ...tempAnnotation, 
        id: uuidv4(),
        number: maxNumber + 1
      });
      onAnnotationsChange(updated);
      setTempAnnotation(null);
    }
    setIsDrawing(false);
    setIsDragging(false);
    setStartPos(null);
    setDragOffset(null);
  }, [isDrawing, tempAnnotation, annotations, onAnnotationsChange]);

  const handleDeleteAnnotation = (id: string) => {
    onAnnotationsChange(annotations.filter((a) => a.id !== id));
    setSelectedAnnotation(null);
    setEditingNumber(null);
  };

  const handleNumberChange = (id: string, newNumber: string) => {
    const num = parseInt(newNumber, 10);
    if (isNaN(num) || num < 1) return;
    
    const updated = annotations.map((ann) => {
      if (ann.id === id) {
        return { ...ann, number: num };
      }
      return ann;
    });
    onAnnotationsChange(updated);
    setEditingNumber(null);
  };

  const getDisplayNumber = (ann: Annotation, index: number) => {
    return ann.number || index + 1;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 inline-block">
          이미지 업로드
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        <button
          onClick={() => onAnnotationsChange([])}
          className="ml-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          모든 Annotation 삭제
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div
          ref={containerRef}
          className="relative overflow-auto bg-gray-200 dark:bg-gray-800 flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Canvas"
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
              {annotations.filter((a) => a.id !== "temp").map((ann, index) => {
                const displayNumber = getDisplayNumber(ann, index);
                const isEditing = editingNumber === ann.id;
                
                return (
                  <div
                    key={ann.id}
                    className={`absolute border-2 ${
                      selectedAnnotation === ann.id
                        ? "border-blue-500 bg-blue-200 bg-opacity-30"
                        : highlightedAnnotation === displayNumber
                        ? "border-yellow-500 bg-yellow-200 bg-opacity-30 ring-2 ring-yellow-400"
                        : "border-red-500 bg-red-200 bg-opacity-20"
                    } cursor-move transition-all`}
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      width: `${ann.w}%`,
                      height: `${ann.h}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnotation(ann.id);
                      if (displayNumber && onAnnotationClick) {
                        onAnnotationClick(displayNumber);
                      }
                    }}
                  >
                    <div
                      className="absolute -left-2 -top-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg cursor-pointer hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNumber(ann.id);
                        setSelectedAnnotation(ann.id);
                      }}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          defaultValue={displayNumber}
                          className="w-full h-full text-center bg-transparent border-none outline-none text-white text-sm font-bold"
                          autoFocus
                          onBlur={(e) => {
                            handleNumberChange(ann.id, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleNumberChange(ann.id, e.currentTarget.value);
                            } else if (e.key === "Escape") {
                              setEditingNumber(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        displayNumber
                      )}
                    </div>
                    {selectedAnnotation === ann.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAnnotation(ann.id);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-700 z-10"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              {tempAnnotation && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30"
                  style={{
                    left: `${tempAnnotation.x}%`,
                    top: `${tempAnnotation.y}%`,
                    width: `${tempAnnotation.w}%`,
                    height: `${tempAnnotation.h}%`,
                  }}
                />
              )}
            </>
          ) : (
            <div className="text-center text-gray-400 dark:text-gray-500">
              <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 inline-block">
                이미지 선택
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

