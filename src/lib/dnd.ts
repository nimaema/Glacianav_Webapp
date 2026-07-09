"use client";

import { useState } from "react";

/**
 * Minimal HTML5 drag and drop shared across lenses (customers by segment/
 * stage, library conversations by topic). Each caller decides what a drop
 * target key means. Clicking still opens the drawer; browsers suppress
 * click after a real drag.
 */
export function useDnd(onDrop: (dragId: string, targetKey: string) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
      setDragId(id);
    },
    onDragEnd: () => {
      setDragId(null);
      setOverKey(null);
    },
  });

  const dropProps = (key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverKey(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverKey(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (id) onDrop(id, key);
      setDragId(null);
      setOverKey(null);
    },
  });

  return { dragId, overKey, dragProps, dropProps };
}
