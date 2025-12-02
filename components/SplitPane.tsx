"use client";

import { useState, useRef, useEffect } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;
  onRatioChange?: (ratio: number) => void;
}

export default function SplitPane({
  left,
  right,
  defaultRatio = 70,
  onRatioChange,
}: SplitPaneProps) {
  const [ratio, setRatio] = useState(defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      const clampedRatio = Math.max(20, Math.min(80, newRatio));
      setRatio(clampedRatio);
      onRatioChange?.(clampedRatio);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    if (isDraggingRef.current) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onRatioChange]);

  useEffect(() => {
    setRatio(defaultRatio);
  }, [defaultRatio]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      const clampedRatio = Math.max(20, Math.min(80, newRatio));
      setRatio(clampedRatio);
      onRatioChange?.(clampedRatio);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      <div className="overflow-hidden" style={{ width: `${ratio}%` }}>
        {left}
      </div>
      <div
        className="w-1 bg-gray-300 dark:bg-gray-600 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div className="overflow-hidden" style={{ width: `${100 - ratio}%` }}>
        {right}
      </div>
    </div>
  );
}

