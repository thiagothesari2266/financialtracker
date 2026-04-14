import { type MouseEvent, useState, useMemo } from 'react';

export function useBulkSelection<T extends { id: number }>(items: T[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | null>(null);

  const handleSelect = (
    id: number,
    checked: boolean,
    event?: MouseEvent,
    index?: number
  ) => {
    const newSelected = new Set(selected);

    if (event?.shiftKey && lastIndex !== null && index !== undefined) {
      const startIdx = Math.min(lastIndex, index);
      const endIdx = Math.max(lastIndex, index);
      for (let i = startIdx; i <= endIdx; i++) {
        const item = items[i];
        if (item) newSelected.add(item.id);
      }
    } else if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }

    setSelected(newSelected);
    if (index !== undefined) setLastIndex(index);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(items.map((item) => item.id)) : new Set());
  };

  const handleCancel = () => {
    setSelected(new Set());
    setLastIndex(null);
  };

  const isAllSelected = useMemo(
    () => items.length > 0 && items.every((item) => selected.has(item.id)),
    [items, selected]
  );

  return { selected, handleSelect, handleSelectAll, handleCancel, isAllSelected };
}
