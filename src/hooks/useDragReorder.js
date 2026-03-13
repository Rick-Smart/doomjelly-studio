import { useState } from "react";

/**
 * Encapsulates the dragIdx / dropIdx tracking state for list reorder
 * interactions.
 *
 * @param {function} onReorder  Called with (fromIndex, toIndex) when a drop
 *                              lands on a different cell.
 * @returns {{ dragIdx, dropIdx, getDragProps }}
 *
 * Usage — spread the result of getDragProps(i) onto each draggable element:
 *   const { dragIdx, dropIdx, getDragProps } = useDragReorder(reorderFn);
 *   // ...
 *   <div draggable {...getDragProps(i)} className={dragIdx === i ? "dragging" : ""} />
 */
export function useDragReorder(onReorder) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);

  function getDragProps(i) {
    return {
      onDragStart: () => setDragIdx(i),
      onDragOver: (e) => {
        e.preventDefault();
        setDropIdx(i);
      },
      onDrop: () => {
        if (dragIdx !== null && dragIdx !== i) onReorder(dragIdx, i);
        setDragIdx(null);
        setDropIdx(null);
      },
      onDragEnd: () => {
        setDragIdx(null);
        setDropIdx(null);
      },
    };
  }

  return { dragIdx, dropIdx, getDragProps };
}
